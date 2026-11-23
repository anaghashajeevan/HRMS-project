from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives
from django.template import Context, Template
from django.utils.html import format_html, strip_tags
from django.utils import timezone
from django.utils.text import get_valid_filename
import re

from HRMSapp.models import EmployeeDocument, LetterTemplate
from HRMSapp.services.pdf_generator import generate_recruitment_offer_pdf, get_company
from .models import CandidateDocument


def _offer_context(offer):
    application = offer.application
    requisition = application.requisition
    return {
        'candidate_name': application.candidate.full_name,
        'candidate_email': application.candidate.email,
        'position_title': requisition.position.title,
        'department_name': requisition.department.name,
        'location_name': requisition.location.name,
        'grade_band': requisition.grade_band,
        'annual_salary': f'{offer.annual_salary:,.2f}',
        'signing_bonus': f'{offer.signing_bonus:,.2f}',
        'currency': offer.currency,
        'joining_date': offer.joining_date.strftime('%d %B %Y'),
        'offer_expiry_date': offer.expires_on.strftime('%d %B %Y'),
        'offer_date': timezone.localdate().strftime('%d %B %Y'),
        'offer_reference': str(offer.pk),
        'requisition_number': requisition.requisition_number,
        'company_name': get_company()['name'],
    }


def render_text_template(value, context):
    return Template(value).render(Context(context))


def _center_email_headings(html):
    """Inline centered heading styles because some email clients drop CSS blocks."""
    def apply_style(match):
        tag, attrs = match.group(1), match.group(2) or ''
        existing = re.search(r'\sstyle=["\']([^"\']*)["\']', attrs, re.I)
        style = existing.group(1).rstrip(';') + ';' if existing else ''
        if existing:
            attrs = attrs[:existing.start()] + attrs[existing.end():]
        attrs = attrs.rstrip()
        style += 'text-align:center;color:#1e3a8a;margin:0 0 22px'
        return f'<{tag}{attrs} style="{style}">'

    return re.sub(r'<(h1|h2)\b([^>]*)>', apply_style, html, flags=re.I)


def send_candidate_offer_email(offer):
    """Send the approved offer details and request a response. No formal PDF is attached."""
    template = LetterTemplate.objects.filter(template_type='OFFER_EMAIL', is_active=True).order_by('-is_default', 'name').first()
    if template is None:
        raise ValueError('Create and activate a Recruitment Offer Email template in Settings > Letter Templates before sending.')
    context = _offer_context(offer)
    subject = render_text_template(template.subject, context).strip()
    body = render_text_template(template.body_html, context).strip()
    if not subject or not body:
        raise ValueError('The active Offer email template must include both a subject and a message body.')
    body += str(format_html(
        '<hr><h3>Offer details</h3><p><strong>Position:</strong> {}<br>'
        '<strong>Department:</strong> {}<br><strong>Annual salary:</strong> {} {}<br>'
        '<strong>Signing bonus:</strong> {} {}<br><strong>Expected joining date:</strong> {}<br>'
        'Please reply to this email to accept or decline by {}. HR will record your response and follow up.</p>',
        context['position_title'], context['department_name'], context['currency'], context['annual_salary'],
        context['currency'], context['signing_bonus'], context['joining_date'], context['offer_expiry_date'],
    ))
    # A consistent email frame makes both hand-written and AI-generated
    # templates readable across common email clients. Inline styles are used
    # because many clients discard CSS classes and stylesheets.
    body = _center_email_headings(body)
    body = (
        '<div style="margin:0;padding:24px 12px;background:#f1f5f9;'
        'font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">'
        '<div style="max-width:640px;margin:0 auto;padding:32px;background:#ffffff;'
        'border:1px solid #e2e8f0;border-radius:10px">'
        '<style>h1,h2{text-align:center;color:#1e3a8a} p{margin:0 0 14px} '
        'h1{font-size:24px;margin:0 0 24px} h2{font-size:20px;margin:0 0 20px} '
        'h3{font-size:16px;margin:20px 0 8px;color:#1e3a8a}</style>'
        f'{body}'
        '</div></div>'
    )
    email = EmailMultiAlternatives(
        subject=subject,
        body=strip_tags(re.sub(r'<style\b[^>]*>.*?</style>', '', body, flags=re.I | re.S)).replace('&nbsp;', ' '),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[offer.application.candidate.email],
    )
    email.attach_alternative(body, 'text/html')
    sent_count = email.send(fail_silently=False)
    if not sent_count:
        raise RuntimeError('The offer email was not accepted by the configured email backend.')


def _attach_offer_letter_to_employee(offer, uploaded_by=None):
    if not offer.offer_letter:
        return
    employee = offer.employee
    if employee is None:
        return

    # The offer letter is one specific document record. If HR later selects
    # the correct employee, move that record instead of creating a duplicate.
    if offer.employee_document_id:
        document = offer.employee_document
        if document.employee_id != employee.pk:
            document.employee = employee
            document.save(update_fields=['employee'])
        return

    with offer.offer_letter.open('rb') as source:
        pdf_bytes = source.read()
    document = EmployeeDocument(
        employee=employee,
        document_type='OFFER_LETTER',
        document_name=f'Offer Letter - {offer.application.requisition.requisition_number}',
        file_size_kb=round(len(pdf_bytes) / 1024),
        mime_type='application/pdf',
        uploaded_by=uploaded_by or offer.created_by,
    )
    filename = f'Offer_{offer.application.requisition.requisition_number}_{offer.pk.hex[:8]}.pdf'
    document.file_path.save(filename, ContentFile(pdf_bytes), save=True)
    offer.employee = employee
    offer.employee_document = document
    offer.save(update_fields=['employee', 'employee_document', 'updated_at'])


def deliver_accepted_offer_letter(offer, uploaded_by=None, force_resend=False):
    """Generate and email the formal PDF after acceptance; retain errors for HR retry."""
    if offer.status != 'ACCEPTED':
        raise ValueError('The formal offer letter is delivered only after the candidate accepts.')
    if offer.offer_letter_sent_at and not force_resend:
        return True, ''
    try:
        if not offer.offer_letter:
            pdf_bytes = generate_recruitment_offer_pdf(offer)
            filename = f'Offer_{offer.application.requisition.requisition_number}_{offer.pk.hex[:8]}.pdf'
            offer.offer_letter.save(filename, ContentFile(pdf_bytes), save=False)
            offer.save(update_fields=['offer_letter', 'updated_at'])
        _attach_offer_letter_to_employee(offer, uploaded_by=uploaded_by)
        with offer.offer_letter.open('rb') as source:
            pdf_bytes = source.read()
        filename = f'Offer_{offer.application.requisition.requisition_number}_{offer.pk.hex[:8]}.pdf'
        if settings.EMAIL_BACKEND.endswith('console.EmailBackend'):
            raise RuntimeError('The configured email backend is the console backend. The message is printed in the backend terminal, not delivered to the candidate. Configure SMTP in backend environment settings and retry.')
        email = EmailMultiAlternatives(
            subject=f'{get_company()["name"]} - Your formal offer letter',
            body=(
                f"To: {offer.application.candidate.full_name} "
                f"<{offer.application.candidate.email}>\n\n"
                f"Dear {offer.application.candidate.full_name},\n\n"
                f"Congratulations. Please find attached your formal offer letter for "
                f"the {offer.application.requisition.position.title} position.\n\n"
                'Regards,\nHuman Resources'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[offer.application.candidate.email],
        )
        email.attach_alternative(str(format_html(
            '<div style="margin:0;padding:24px 12px;background:#f1f5f9;'
            'font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">'
            '<div style="max-width:640px;margin:0 auto;padding:32px;background:#fff;'
            'border:1px solid #e2e8f0;border-radius:10px">'
            '<h1 style="margin:0 0 28px;text-align:center;color:#1e3a8a;font-size:24px">Formal Offer Letter</h1>'
            '<p style="margin:0 0 8px"><strong>To:</strong> {}<br>{}</p>'
            '<p style="margin:24px 0 14px;color:#111827;font-weight:700">Dear {},</p>'
            '<p>Congratulations. Please find attached your formal offer letter for the <strong>{}</strong> position.</p>'
            '<p>Please review the attached letter and contact Human Resources if you have questions.</p>'
            '<p style="margin-top:28px">Regards,<br><strong>Human Resources</strong><br>{}</p>'
            '</div></div>',
            offer.application.candidate.full_name,
            offer.application.candidate.email,
            offer.application.candidate.full_name,
            offer.application.requisition.position.title,
            get_company()['name'],
        )), 'text/html')
        email.attach(filename, pdf_bytes, 'application/pdf')
        if not email.send(fail_silently=False):
            raise RuntimeError('The formal offer letter email was not accepted by the configured email backend.')
        offer.offer_letter_sent_at = timezone.now()
        offer.offer_letter_error = ''
        offer.save(update_fields=['offer_letter_sent_at', 'offer_letter_error', 'updated_at'])
        return True, ''
    except Exception as exc:
        offer.offer_letter_error = str(exc)[:4000]
        offer.save(update_fields=['offer_letter_error', 'updated_at'])
        return False, offer.offer_letter_error


def link_accepted_offer_to_employee(offer, employee, uploaded_by=None):
    if offer.status != 'ACCEPTED':
        raise ValueError('Only an accepted offer can be linked to an employee profile.')
    offer.employee = employee
    offer.save(update_fields=['employee', 'updated_at'])
    _attach_offer_letter_to_employee(offer, uploaded_by=uploaded_by)
    _attach_verified_candidate_documents(offer, employee, uploaded_by=uploaded_by)


def _attach_verified_candidate_documents(offer, employee, uploaded_by=None):
    """Copy verified offer-stage documents once into the employee repository."""
    documents = CandidateDocument.objects.filter(
        application=offer.application, candidate=offer.application.candidate,
        status='VERIFIED', employee_document__isnull=True,
    ).order_by('uploaded_at')
    for source in documents:
        with source.file.open('rb') as uploaded_file:
            content = uploaded_file.read()
        destination = EmployeeDocument(
            employee=employee,
            document_type=source.document_type,
            document_name=source.document_name,
            file_size_kb=source.file_size_kb,
            mime_type=source.mime_type,
            uploaded_by=uploaded_by or offer.created_by,
        )
        safe_name = get_valid_filename(source.original_filename.rsplit('/', 1)[-1].rsplit('\\', 1)[-1])
        filename = f'Candidate_{source.pk.hex[:8]}_{safe_name}'
        destination.file_path.save(filename, ContentFile(content), save=True)
        source.employee_document = destination
        source.save(update_fields=['employee_document'])
