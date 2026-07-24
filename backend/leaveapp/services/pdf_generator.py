"""
PDF generator for leave application letters.
Uses letter template configured in HRMS Settings → Letter Templates.
"""

import re
import logging
from io import BytesIO
from datetime import datetime

from django.conf import settings
from django.template import Template, Context
from django.utils import timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)

logger = logging.getLogger(__name__)


# ==============================================================================
# COMPANY CONFIG
# ==============================================================================

def get_company():
    return {
        'name': getattr(settings, 'COMPANY_NAME', 'Your Company Ltd'),
        'tagline': getattr(settings, 'COMPANY_TAGLINE', 'Excellence in Every Endeavor'),
        'address': getattr(settings, 'COMPANY_ADDRESS', ''),
        'phone': getattr(settings, 'COMPANY_PHONE', ''),
        'email': getattr(settings, 'COMPANY_EMAIL', ''),
        'website': getattr(settings, 'COMPANY_WEBSITE', ''),
        'primary': getattr(settings, 'COMPANY_PRIMARY_COLOR', '#1E40AF'),
        'accent': getattr(settings, 'COMPANY_ACCENT_COLOR', '#3B82F6'),
    }


# ==============================================================================
# HTML CLEANING
# ==============================================================================

def clean_html_for_reportlab(html: str) -> str:
    if not html:
        return ''
    html = re.sub(r'```(?:html)?\s*', '', html, flags=re.I)
    html = re.sub(r'```', '', html)
    html = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', html)
    html = re.sub(r'(?<!\*)\*([^*\n]+?)\*(?!\*)', r'<i>\1</i>', html)
    html = html.replace('<strong>', '<b>').replace('</strong>', '</b>')
    html = html.replace('<em>', '<i>').replace('</em>', '</i>')
    html = html.replace('<br>', '<br/>').replace('<br />', '<br/>')
    html = re.sub(
        r'</?(?:html|head|body|div|span|section|article|table|tr|td|th|tbody|thead)[^>]*>',
        '', html, flags=re.I
    )
    html = re.sub(r'\s(?:style|class)="[^"]*"', '', html, flags=re.I)
    return html.strip()


def html_to_blocks(html: str):
    html = clean_html_for_reportlab(html)
    blocks = []
    pattern = re.compile(
        r'<(h[1-3])[^>]*>(.*?)</\1>|<p[^>]*>(.*?)</p>|<li[^>]*>(.*?)</li>',
        re.I | re.S
    )
    matches = list(pattern.finditer(html))
    if not matches:
        text = re.sub(r'<[^>]+>', '', html).strip()
        for line in text.split('\n'):
            line = line.strip()
            if line:
                blocks.append(('p', line))
        return blocks
    for m in matches:
        heading_tag = m.group(1)
        heading_text = m.group(2)
        p_text = m.group(3)
        li_text = m.group(4)
        if heading_tag:
            blocks.append((heading_tag.lower(), heading_text.strip()))
        elif p_text is not None:
            blocks.append(('p', p_text.strip()))
        elif li_text is not None:
            blocks.append(('li', li_text.strip()))
    return blocks


# ==============================================================================
# BUILD LEAVE CONTEXT (for template variables)
# ==============================================================================

def build_leave_context(application, approver=None):
    """Build all placeholder values for a leave application."""
    employee = application.employee
    cfg = get_company()
    
    return {
        # Employee
        'employee_name': employee.full_name,
        'employee_id': employee.employee_id,
        'current_position': employee.position.title if employee.position else '—',
        'current_department': (
            employee.structure_location.name if employee.structure_location else '—'
        ),
        'manager_name': (
            employee.reporting_manager.full_name if employee.reporting_manager else '—'
        ),
        
        # Leave details
        'leave_type': application.leave_type.name,
        'leave_type_code': application.leave_type.code,
        'start_date': application.start_date.strftime('%d %B %Y'),
        'end_date': application.end_date.strftime('%d %B %Y'),
        'total_days': str(application.total_days),
        'is_half_day': 'Yes' if application.is_half_day else 'No',
        'half_day_period': (
            application.get_half_day_period_display() if application.is_half_day else '—'
        ),
        'application_number': application.application_number,
        'reason': application.reason or '',
        'contact_during_leave': application.contact_during_leave or '—',
        'handover_to': (
            application.handover_to.full_name if application.handover_to else '—'
        ),
        'handover_notes': application.handover_notes or '—',
        'is_lop': 'Yes' if application.is_lop else 'No',
        'lop_days': str(application.lop_days),
        
        # Approver
        'approver_name': (
            approver.full_name if approver
            else application.current_approver.full_name if application.current_approver
            else '—'
        ),
        
        # Company + date
        'current_date': timezone.now().strftime('%d %B %Y'),
        'company_name': cfg['name'],
    }


def render_template_with_variables(html: str, ctx: dict) -> str:
    return Template(html).render(Context(ctx))


# ==============================================================================
# PAGE HEADER + FOOTER
# ==============================================================================

def draw_page_decorations(canvas_obj, doc):
    """Draw branded header + footer on each page."""
    cfg = get_company()
    width, height = A4
    primary = colors.HexColor(cfg['primary'])
    accent = colors.HexColor(cfg['accent'])
    
    canvas_obj.saveState()
    
    # Header band
    header_height = 2.2 * cm
    canvas_obj.setFillColor(primary)
    canvas_obj.rect(0, height - header_height, width, header_height, fill=1, stroke=0)
    
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont('Helvetica-Bold', 16)
    canvas_obj.drawString(1.5 * cm, height - 1.1 * cm, cfg['name'])
    canvas_obj.setFont('Helvetica-Oblique', 8)
    canvas_obj.drawString(1.5 * cm, height - 1.6 * cm, cfg['tagline'])
    
    canvas_obj.setFont('Helvetica', 7.5)
    if cfg['address']:
        canvas_obj.drawRightString(width - 1.5 * cm, height - 0.8 * cm, cfg['address'][:60])
    if cfg['phone']:
        canvas_obj.drawRightString(width - 1.5 * cm, height - 1.2 * cm, f"Phone: {cfg['phone']}")
    if cfg['email']:
        canvas_obj.drawRightString(width - 1.5 * cm, height - 1.6 * cm, f"Email: {cfg['email']}")
    
    canvas_obj.setFillColor(accent)
    canvas_obj.rect(0, height - header_height - 0.15 * cm, width, 0.15 * cm, fill=1, stroke=0)
    
    # Footer
    footer_y = 1.2 * cm
    canvas_obj.setStrokeColor(primary)
    canvas_obj.setLineWidth(1.5)
    canvas_obj.line(1.5 * cm, footer_y, width - 1.5 * cm, footer_y)
    
    canvas_obj.setFillColor(colors.HexColor('#6B7280'))
    canvas_obj.setFont('Helvetica', 7.5)
    footer_text = f"{cfg['name']}"
    if cfg['address']:
        footer_text += f"  |  {cfg['address']}"
    if cfg['phone']:
        footer_text += f"  |  {cfg['phone']}"
    canvas_obj.drawCentredString(width / 2, footer_y - 0.4 * cm, footer_text[:120])
    
    canvas_obj.setFont('Helvetica-Oblique', 6.5)
    canvas_obj.setFillColor(colors.HexColor('#9CA3AF'))
    canvas_obj.drawCentredString(
        width / 2, footer_y - 0.75 * cm,
        "CONFIDENTIAL DOCUMENT · FOR RECIPIENT ONLY"
    )
    
    canvas_obj.restoreState()


# ==============================================================================
# MAIN GENERATOR
# ==============================================================================

def generate_leave_letter_pdf(application, template_type='LEAVE_APPLICATION', approver=None):
    """
    Generate leave letter PDF using template from Settings.
    
    Args:
        application: LeaveApplication instance
        template_type: 'LEAVE_APPLICATION' (initial submission) or 'LEAVE_APPROVAL' (after approval)
        approver: Employee approver (for LEAVE_APPROVAL type)
    
    Returns: PDF bytes
    """
    from HRMSapp.models import LetterTemplate
    
    # Try to fetch template
    template = LetterTemplate.objects.filter(
        template_type=template_type,
        is_active=True,
        is_default=True,
    ).first()
    
    if not template:
        # Fallback: any active template of this type
        template = LetterTemplate.objects.filter(
            template_type=template_type,
            is_active=True,
        ).first()
    
    if not template:
        # Fallback: use built-in default
        logger.warning(f"No {template_type} template found — using built-in default")
        html_content = _get_default_template(template_type)
    else:
        html_content = template.body_html
    
    cfg = get_company()
    ctx = build_leave_context(application, approver)
    primary = colors.HexColor(cfg['primary'])
    
    # Render template with variables
    rendered = render_template_with_variables(html_content, ctx)
    blocks = html_to_blocks(rendered)
    
    # ===== PDF SETUP =====
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2.0 * cm,
        leftMargin=2.0 * cm,
        topMargin=3.2 * cm,
        bottomMargin=2.5 * cm,
    )
    
    # ===== STYLES =====
    ss = getSampleStyleSheet()
    
    style_heading = ParagraphStyle(
        'LeaveHeading', parent=ss['Heading2'],
        fontName='Helvetica-Bold', fontSize=15, textColor=primary,
        alignment=TA_CENTER, spaceAfter=12, spaceBefore=6,
    )
    style_body = ParagraphStyle(
        'LeaveBody', parent=ss['BodyText'],
        fontName='Helvetica', fontSize=10.5, leading=15,
        alignment=TA_JUSTIFY, textColor=colors.HexColor('#1F2937'), spaceAfter=8,
    )
    style_small = ParagraphStyle(
        'LeaveSmall', parent=ss['Normal'],
        fontSize=9, textColor=colors.HexColor('#374151'),
    )
    style_small_right = ParagraphStyle(
        'LeaveSmallRight', parent=style_small, alignment=TA_RIGHT,
    )
    
    story = []
    
    # ===== BADGE =====
    badge_text = 'LEAVE APPLICATION' if template_type == 'LEAVE_APPLICATION' else 'LEAVE APPROVAL'
    badge_color = colors.HexColor('#F59E0B') if template_type == 'LEAVE_APPLICATION' else colors.HexColor('#16A34A')
    
    badge_para = Paragraph(
        f'<font color="white" size="11"><b>{badge_text}</b></font>',
        ParagraphStyle('LeaveBadge', alignment=TA_CENTER, leading=14),
    )
    badge_table = Table([[badge_para]], colWidths=[6 * cm])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), badge_color),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    badge_wrapper = Table([[badge_table]], colWidths=[17 * cm])
    badge_wrapper.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    story.append(badge_wrapper)
    story.append(Spacer(1, 16))
    
    # ===== META TABLE =====
    meta_data = [
        [
            Paragraph(f'<b>Reference:</b> {ctx["application_number"]}', style_small),
            Paragraph(f'<b>Date:</b> {ctx["current_date"]}', style_small_right),
        ],
        [
            Paragraph(f'<b>Employee ID:</b> {ctx["employee_id"]}', style_small),
            Paragraph(f'<b>Leave Type:</b> {ctx["leave_type_code"]} - {ctx["leave_type"]}', style_small_right),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[8.5 * cm, 8.5 * cm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F9FAFB')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 18))
    
    # ===== BODY (from template) =====
    for block_type, content in blocks:
        if not content:
            continue
        try:
            if block_type in ('h1', 'h2', 'h3'):
                story.append(Paragraph(content, style_heading))
            elif block_type == 'li':
                story.append(Paragraph(f'•  {content}', style_body))
            else:
                story.append(Paragraph(content, style_body))
        except Exception as e:
            logger.warning(f"Skipping block: {e}")
            continue
    
    # ===== DETAILS TABLE =====
    story.append(Spacer(1, 15))
    details = [
        ['Employee Name', ctx['employee_name']],
        ['Employee ID', ctx['employee_id']],
        ['Department', ctx['current_department']],
        ['Position', ctx['current_position']],
        ['Leave Type', f"{ctx['leave_type_code']} - {ctx['leave_type']}"],
        ['Start Date', ctx['start_date']],
        ['End Date', ctx['end_date']],
        ['Total Days', f"{ctx['total_days']} day(s)"],
    ]
    if application.is_half_day:
        details.append(['Half Day', ctx['half_day_period']])
    details.extend([
        ['Reason', ctx['reason']],
        ['Handover To', ctx['handover_to']],
    ])
    if application.contact_during_leave:
        details.append(['Contact', ctx['contact_during_leave']])
    if application.is_lop:
        details.append(['LOP Days', f"{ctx['lop_days']} day(s) (unpaid)"])
    
    details_table = Table(details, colWidths=[5 * cm, 12 * cm])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#374151')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 25))
    
    # ===== SIGNATURE (for approval type) =====
    if template_type == 'LEAVE_APPROVAL' and approver:
        story.append(Paragraph(
            f'<b>Approved By:</b> {approver.full_name}<br/>'
            f'<b>Approved On:</b> {timezone.localtime(timezone.now()).strftime("%d %B %Y, %H:%M")}',
            style_body,
        ))
        story.append(Spacer(1, 15))
    
    sig_left = Paragraph(
        '<font size="10">_________________________</font><br/><br/>'
        '<b><font size="10">Human Resources</font></b><br/>'
        f'<font size="9" color="#6B7280">{cfg["name"]}</font>',
        ParagraphStyle('LeaveSig', leading=14),
    )
    
    seal_para = Paragraph(
        f'<font color="{cfg["primary"]}" size="11"><b>{cfg["name"].split()[0].upper()}</b></font><br/>'
        f'<font color="{cfg["primary"]}" size="7">✦ OFFICIAL ✦</font>',
        ParagraphStyle('LeaveSeal', alignment=TA_CENTER, leading=14),
    )
    seal_box = Table([[seal_para]], colWidths=[2.8 * cm], rowHeights=[2.8 * cm])
    seal_box.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 2, primary),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EFF6FF')),
    ]))
    
    sig_table = Table([[sig_left, seal_box]], colWidths=[10 * cm, 7 * cm])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    story.append(sig_table)
    
    # ===== BUILD PDF =====
    doc.build(
        story,
        onFirstPage=draw_page_decorations,
        onLaterPages=draw_page_decorations,
    )
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    logger.info(f"✅ Leave letter PDF generated for {application.application_number}")
    return pdf_bytes


def _get_default_template(template_type):
    """Fallback templates if HR hasn't configured any."""
    if template_type == 'LEAVE_APPLICATION':
        return """
        <h2>Leave Application</h2>
        <p>Dear {{approver_name}},</p>
        <p>I am writing to formally request leave from work for the following period. 
        Please find the details below and consider my application for approval.</p>
        <p>I have arranged for a smooth handover of my responsibilities during my absence 
        to ensure minimal disruption to ongoing work.</p>
        <p>Thank you for considering my request. I look forward to your approval.</p>
        <p>Sincerely,<br/>{{employee_name}}</p>
        """
    else:  # LEAVE_APPROVAL
        return """
        <h2>Leave Approval Notification</h2>
        <p>Dear {{employee_name}},</p>
        <p>This letter is to formally confirm that your leave application 
        <strong>{{application_number}}</strong> has been reviewed and <b>APPROVED</b>.</p>
        <p>Please ensure a smooth handover of your responsibilities before proceeding on leave. 
        For any queries or assistance, feel free to contact the HR department.</p>
        <p>Wishing you a pleasant leave!</p>
        <p>Sincerely,<br/>Human Resources<br/>{{company_name}}</p>
        """