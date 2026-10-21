"""Build a finalized payroll result into an employee-specific PDF payslip."""

from io import BytesIO
import calendar as month_calendar
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..models import PayrollRunComponentDetail, PayrollRunEmployee


def _money(value):
    return f"{value:,.2f}"


def _masked_account(account):
    digits = ''.join(ch for ch in (account or '') if ch.isalnum())
    return f"{'*' * max(0, len(digits) - 4)}{digits[-4:]}" if digits else 'Not provided'


def generate_payslip_pdf(run_employee_id):
    row = PayrollRunEmployee.objects.select_related(
        'employee', 'run__pay_calendar', 'salary_assignment',
    ).get(id=run_employee_id, status='CALCULATED', run__status__in=['FINALIZED', 'PAID'])
    employee = row.employee
    calendar = row.run.pay_calendar

    profile = employee.payroll_profiles.filter(is_active=True).order_by('-effective_from').first()
    account = (profile.bank_account if profile else '') or getattr(employee, 'bank_account_encrypted', '') or ''
    ifsc = (profile.ifsc_code if profile else '') or getattr(employee, 'ifsc_code', '') or ''
    locked_day_data = (row.input_snapshot or {}).get('locked_inputs', {}).get('day_data', {})
    day_summary = locked_day_data.get('summary', {})

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
        title=f"Payslip {calendar.year}-{calendar.month:02d} {employee.employee_id}",
        author='Payroll',
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle('PayslipTitle', parent=styles['Title'], alignment=TA_CENTER, textColor=colors.HexColor('#17365D'))
    cell_label = ParagraphStyle(
        'PayslipCellLabel', parent=styles['BodyText'], fontName='Helvetica',
        fontSize=8, leading=10, spaceAfter=0,
    )
    story = [
        Paragraph('PAYSLIP', title),
        Paragraph(f"Pay period: {month_calendar.month_name[calendar.month]} {calendar.year}", styles['Heading2']),
        Spacer(1, 5 * mm),
    ]

    employee_rows = [
        ['Employee', employee.full_name, 'Employee ID', employee.employee_id],
        ['Calendar days', str(row.days_in_month), 'Payable days', str(row.payable_days)],
        ['LOP / absent', str(row.lop_days), 'Paid leave', str(day_summary.get('paid_leave', '0'))],
        ['Off-day work', str(day_summary.get('off_day_worked', 0)), 'Salary divisor', f"{row.salary_divisor_days or row.days_in_month} calendar days"],
        ['Bank account', _masked_account(account), 'IFSC', (ifsc or 'Not provided')],
    ]
    info = Table(employee_rows, colWidths=[30 * mm, 58 * mm, 30 * mm, 58 * mm])
    info.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#EFF4F8')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#EFF4F8')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), .4, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 7),
    ]))
    story.extend([info, Spacer(1, 7 * mm)])

    components = PayrollRunComponentDetail.objects.filter(
        run_employee=row,
    ).select_related('component').order_by('is_earning', 'component__display_order', 'component_label')
    earnings = []
    deductions = []
    for detail in components:
        label = detail.component.name if detail.component_id else (detail.component_label or 'Adjustment')
        wrapped_label = Paragraph(escape(str(label)), cell_label)
        (deductions if not detail.is_earning else earnings).append([wrapped_label, _money(detail.amount)])

    rows = [['Earnings', 'Amount', 'Deductions', 'Amount']]
    for i in range(max(len(earnings), len(deductions))):
        earning = earnings[i] if i < len(earnings) else ['', '']
        deduction = deductions[i] if i < len(deductions) else ['', '']
        rows.append([*earning, *deduction])
    rows.append(['Total earnings', _money(row.total_earnings), 'Total deductions', _money(row.total_deductions)])
    rows.append(['Reimbursements', _money(row.total_reimbursements), 'Net pay', _money(row.net_pay)])

    # Keep the full table within A4's printable width and allow long labels,
    # especially unpaid day deductions, to wrap within their own cell.
    detail_table = Table(rows, colWidths=[48 * mm, 39 * mm, 48 * mm, 39 * mm], repeatRows=1)
    detail_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#17365D')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -2), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E8F1FA')),
        ('GRID', (0, 0), (-1, -1), .4, colors.HexColor('#CBD5E1')),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 7),
    ]))
    story.extend([detail_table, Spacer(1, 3 * mm), Paragraph(
        'Salary structure components are shown at their assigned monthly amounts; unpaid days appear as a separate deduction.',
        styles['Italic'],
    ), Spacer(1, 5 * mm), Paragraph(
        'This is a computer-generated payslip. Bank account details are masked for security.',
        styles['Italic'],
    )])
    doc.build(story)
    return buffer.getvalue(), f"payslip_{employee.employee_id}_{calendar.year}_{calendar.month:02d}.pdf"
