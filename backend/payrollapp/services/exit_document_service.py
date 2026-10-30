"""Eligibility checks and issuance for employee exit documents."""
import calendar
import os
from datetime import date
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from reportlab.lib.utils import ImageReader
from xml.sax.saxutils import escape

from HRMSapp.models import EmployeeDocument, Notification
from ..models import EmployeeExitDocument, EmployeeExitRequest, PayrollAuditLog, PayrollRunEmployee
from .exit_clearance_service import clearance_payload

DOCUMENT_LABELS = {
    'EXPERIENCE': 'Experience Certificate',
    'RELIEVING_LETTER': 'Relieving Letter',
    'FNF_STATEMENT': 'Full & Final Settlement Statement',
}


def _one_year_anniversary(start):
    month = start.month
    year = start.year + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def exit_document_status(exit_request, actor=None):
    issued = {row.document_type: row for row in exit_request.issued_documents.select_related('employee_document')}
    fnf_run = exit_request.fnf_runs.filter(run_type='FNF', status='PAID').order_by('-created_at').first()
    exit_date_reached = exit_request.proposed_exit_date <= timezone.localdate()
    experience_eligible = bool(
        exit_request.employee.date_of_joining
        and exit_date_reached
        and exit_request.proposed_exit_date >= _one_year_anniversary(exit_request.employee.date_of_joining)
    )
    clearance = clearance_payload(exit_request, actor) if exit_request.status == 'APPROVED' else {'items': []}
    all_clearances_complete = all(item['status'] == 'COMPLETED' for item in clearance['items'])
    settlement_complete = bool(fnf_run and exit_request.employee.status == 'TERMINATED')

    rules = {
        'EXPERIENCE': (experience_eligible, 'Requires an approved exit date that has passed and at least one year of service by that date.'),
        'RELIEVING_LETTER': (
            exit_request.status == 'APPROVED' and exit_date_reached and all_clearances_complete and settlement_complete,
            'Requires the last working date to have passed, every clearance task to be COMPLETED, and F&F payroll to be PAID. Waived tasks do not count as completed.',
        ),
        'FNF_STATEMENT': (settlement_complete, 'Available after the F&F payroll run is paid and the employee exit is completed.'),
    }
    return {
        'exit_request_id': str(exit_request.id),
        'employee_name': exit_request.employee.full_name,
        'employee_code': exit_request.employee.employee_id,
        'proposed_exit_date': exit_request.proposed_exit_date.isoformat(),
        'settlement_status': fnf_run.status if fnf_run else 'NOT_PAID',
        'clearance_complete': all_clearances_complete,
        'items': [{
            'document_type': code,
            'label': DOCUMENT_LABELS[code],
            'eligible': allowed,
            'reason': '' if allowed else message,
            'issued': code in issued,
            'issued_at': issued[code].issued_at.isoformat() if code in issued else None,
            'document_id': str(issued[code].id) if code in issued else None,
        } for code, (allowed, message) in rules.items()],
    }


def _render_exit_certificate(exit_request, document_type):
    from HRMSapp.models import CompanyLogo
    from HRMSapp.services.pdf_generator import get_company

    employee = exit_request.employee
    company = get_company()

    # Prefer the optional filesystem path from .env. If it is not configured,
    # use the active logo uploaded in Company Branding settings.
    logo_source = None
    logo_path = getattr(settings, 'COMPANY_LOGO_PATH', '')
    if logo_path and os.path.isfile(logo_path):
        logo_source = logo_path
    else:
        active_logo = CompanyLogo.objects.filter(is_active=True).first()
        if active_logo and active_logo.logo:
            try:
                active_logo.logo.open('rb')
                logo_source = BytesIO(active_logo.logo.read())
            finally:
                active_logo.logo.close()

    def draw_exit_letter_decorations(canvas_obj, pdf_doc):
        page_width, page_height = A4
        canvas_obj.saveState()
        primary = colors.HexColor(company['primary'])
        accent = colors.HexColor(company['accent'])

        # Brand block: logo at the left edge, company name centered in the
        # left half, and contact details aligned to the right edge.
        left, right = 22 * mm, page_width - 22 * mm
        logo_width, logo_height = 23 * mm, 17 * mm
        if logo_source:
            try:
                if hasattr(logo_source, 'seek'):
                    logo_source.seek(0)
                canvas_obj.drawImage(
                    ImageReader(logo_source), left, page_height - 25 * mm,
                    width=logo_width, height=logo_height,
                    preserveAspectRatio=True, anchor='c', mask='auto',
                )
            except Exception:
                pass

        name_left = left + 26 * mm
        name_right = page_width * 0.57
        name_width = name_right - name_left
        name_size = 13
        while name_size > 8 and stringWidth(company['name'], 'Helvetica-Bold', name_size) > name_width:
            name_size -= 0.5
        canvas_obj.setFillColor(primary)
        canvas_obj.setFont('Helvetica-Bold', name_size)
        canvas_obj.drawCentredString((name_left + name_right) / 2, page_height - 15 * mm, company['name'])
        if company.get('tagline'):
            tagline_size = 8
            canvas_obj.setFont('Helvetica-Oblique', tagline_size)
            canvas_obj.setFillColor(colors.HexColor('#4B5563'))
            canvas_obj.drawCentredString((name_left + name_right) / 2, page_height - 20 * mm, company['tagline'])

        details = [company.get('address'), f"Phone: {company.get('phone')}" if company.get('phone') else '',
                   f"Email: {company.get('email')}" if company.get('email') else '', company.get('website')]
        details = [value for value in details if value]
        canvas_obj.setFillColor(colors.HexColor('#374151'))
        canvas_obj.setFont('Helvetica', 7.5)
        detail_y = page_height - 12 * mm
        for detail in details:
            canvas_obj.drawRightString(right, detail_y, detail)
            detail_y -= 4 * mm

        canvas_obj.setStrokeColor(accent)
        canvas_obj.setLineWidth(1.5)
        canvas_obj.line(left, page_height - 29 * mm, right, page_height - 29 * mm)

        footer_y = 12 * mm
        canvas_obj.setStrokeColor(primary)
        canvas_obj.setLineWidth(0.7)
        canvas_obj.line(left, footer_y, right, footer_y)
        canvas_obj.setFillColor(colors.HexColor('#6B7280'))
        canvas_obj.setFont('Helvetica-Oblique', 6.5)
        canvas_obj.drawCentredString(page_width / 2, footer_y - 4 * mm, 'CONFIDENTIAL DOCUMENT · FOR RECIPIENT ONLY')
        canvas_obj.restoreState()
    end_date = exit_request.proposed_exit_date
    start_date = employee.date_of_joining
    position = employee.position.title if employee.position_id and employee.position else 'the assigned position'
    is_experience = document_type == 'EXPERIENCE'
    title = DOCUMENT_LABELS[document_type].upper()

    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, rightMargin=22 * mm, leftMargin=22 * mm, topMargin=38 * mm, bottomMargin=28 * mm)
    styles = getSampleStyleSheet()
    heading = ParagraphStyle('ExitDocHeading', parent=styles['Title'], alignment=TA_CENTER, textColor=colors.HexColor(company['primary']))
    body = ParagraphStyle('ExitDocBody', parent=styles['BodyText'], fontSize=11, leading=17, spaceAfter=12)
    story = [
        Paragraph(escape(company['name']), heading),
        Spacer(1, 10 * mm),
        Paragraph(title, ParagraphStyle('ExitDocTitle', parent=heading, fontSize=16)),
        Spacer(1, 8 * mm),
        Paragraph(f"Date: {timezone.localdate().strftime('%d %B %Y')}", body),
        Paragraph(f"To Whom It May Concern" if is_experience else f"To: {escape(employee.full_name)}", body),
        Spacer(1, 3 * mm),
    ]
    if is_experience:
        text = (
            f"This is to certify that <b>{escape(employee.full_name)}</b> (Employee ID: "
            f"<b>{escape(employee.employee_id)}</b>) was employed with {escape(company['name'])} "
            f"as <b>{escape(position)}</b> from <b>{start_date.strftime('%d %B %Y')}</b> "
            f"to <b>{end_date.strftime('%d %B %Y')}</b>. This certificate is issued upon the employee's request."
        )
    else:
        text = (
            f"This letter confirms that <b>{escape(employee.full_name)}</b> (Employee ID: "
            f"<b>{escape(employee.employee_id)}</b>) has completed the exit clearance process and "
            f"their Full & Final settlement has been paid. The employee is relieved from duties "
            f"effective at the close of <b>{end_date.strftime('%d %B %Y')}</b>."
        )
    story.extend([
        Paragraph(text, body), Spacer(1, 18 * mm),
        Paragraph('For ' + escape(company['name']), body), Spacer(1, 15 * mm),
        Paragraph('Authorized HR Representative', body),
    ])
    doc.build(story, onFirstPage=draw_exit_letter_decorations, onLaterPages=draw_exit_letter_decorations)
    return output.getvalue()


@transaction.atomic
def issue_exit_document(exit_request_id, document_type, actor):
    exit_request = EmployeeExitRequest.objects.select_for_update().select_related(
        'employee__position',
    ).get(pk=exit_request_id)
    if exit_request.status != 'APPROVED':
        raise ValueError('Exit documents can be issued only for an approved exit.')
    if document_type not in DOCUMENT_LABELS:
        raise ValueError('Unknown exit document type.')

    existing = EmployeeExitDocument.objects.filter(
        request=exit_request, document_type=document_type,
    ).select_related('employee_document').first()
    if existing:
        return existing

    status = exit_document_status(exit_request, actor)
    eligibility = next(item for item in status['items'] if item['document_type'] == document_type)
    if not eligibility['eligible']:
        raise ValueError(eligibility['reason'])

    if document_type == 'FNF_STATEMENT':
        run = exit_request.fnf_runs.filter(run_type='FNF', status='PAID').order_by('-created_at').first()
        row = PayrollRunEmployee.objects.filter(run=run, employee=exit_request.employee, status='CALCULATED').first()
        if not row:
            raise ValueError('The paid F&F payroll row could not be found to create the statement.')
        from .payslip_service import generate_payslip_pdf
        pdf_bytes, filename = generate_payslip_pdf(row.id)
    else:
        pdf_bytes = _render_exit_certificate(exit_request, document_type)
        filename = f"{document_type.lower()}_{exit_request.employee.employee_id}_{exit_request.proposed_exit_date.isoformat()}.pdf"

    label = DOCUMENT_LABELS[document_type]
    employee_document = EmployeeDocument(
        employee=exit_request.employee,
        document_type=document_type,
        document_name=f'{label} · {exit_request.proposed_exit_date.isoformat()}',
        file_size_kb=max(1, len(pdf_bytes) // 1024),
        mime_type='application/pdf',
        uploaded_by=getattr(actor, 'employee', None),
    )
    employee_document.file_path.save(filename, ContentFile(pdf_bytes), save=True)
    record = EmployeeExitDocument.objects.create(
        request=exit_request,
        employee=exit_request.employee,
        employee_document=employee_document,
        document_type=document_type,
        issued_by=getattr(actor, 'employee', None),
    )
    PayrollAuditLog.objects.create(
        employee=exit_request.employee,
        action='EXIT_DOCUMENT_ISSUED',
        reason=f'{label} issued after eligibility checks.',
        performed_by=getattr(actor, 'employee', None),
        new_values={
            'document_type': document_type,
            'document_name': employee_document.document_name,
            'issued_at': record.issued_at.isoformat(),
        },
    )
    Notification.objects.create(
        recipient=exit_request.employee,
        notification_type='LETTER_GENERATED',
        title=f'{label} is available',
        message=f'HR issued your {label}. Open Profile → Exit Documents to download it.',
        link='/profile',
        metadata={'document_type': document_type, 'exit_date': exit_request.proposed_exit_date.isoformat()},
    )
    return record


def employee_exit_document_payload(record):
    document = record.employee_document
    return {
        'id': str(record.id),
        'document_type': record.document_type,
        'label': DOCUMENT_LABELS[record.document_type],
        'document_name': document.document_name,
        'issued_at': record.issued_at.isoformat(),
        'exit_date': record.request.proposed_exit_date.isoformat(),
        'download_count': record.download_count,
        'last_downloaded_at': record.last_downloaded_at.isoformat() if record.last_downloaded_at else None,
    }
