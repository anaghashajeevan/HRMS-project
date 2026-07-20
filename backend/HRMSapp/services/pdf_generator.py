"""
Simple, guaranteed-working branded PDF generator using ReportLab.
No conflicts with default stylesheet.
"""
import re
import logging
from io import BytesIO
from django.conf import settings
from django.template import Template, Context
from django.utils import timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
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
        'address': getattr(settings, 'COMPANY_ADDRESS', '123 Business Park, Bengaluru'),
        'phone': getattr(settings, 'COMPANY_PHONE', '+91 80 4567 8900'),
        'email': getattr(settings, 'COMPANY_EMAIL', 'hr@company.com'),
        'website': getattr(settings, 'COMPANY_WEBSITE', 'www.company.com'),
        'primary': getattr(settings, 'COMPANY_PRIMARY_COLOR', '#1E40AF'),
        'accent': getattr(settings, 'COMPANY_ACCENT_COLOR', '#3B82F6'),
    }


# ==============================================================================
# HTML CLEANING
# ==============================================================================

def clean_html_for_reportlab(html: str) -> str:
    """Convert HTML/markdown to ReportLab-safe markup."""
    if not html:
        return ''
    
    html = re.sub(r'```(?:html)?\s*', '', html, flags=re.I)
    html = re.sub(r'```', '', html)
    
    # Markdown → HTML
    html = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', html)
    html = re.sub(r'(?<!\*)\*([^*\n]+?)\*(?!\*)', r'<i>\1</i>', html)
    
    html = html.replace('<strong>', '<b>').replace('</strong>', '</b>')
    html = html.replace('<em>', '<i>').replace('</em>', '</i>')
    html = html.replace('<br>', '<br/>').replace('<br />', '<br/>')
    
    # Remove unsupported tags
    html = re.sub(
        r'</?(?:html|head|body|div|span|section|article|table|tr|td|th|tbody|thead)[^>]*>',
        '', html, flags=re.I
    )
    html = re.sub(r'\s(?:style|class)="[^"]*"', '', html, flags=re.I)
    
    return html.strip()


def html_to_blocks(html: str):
    """Extract paragraphs, headings from HTML."""
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
# TEMPLATE CONTEXT
# ==============================================================================

def render_template_with_variables(html: str, ctx: dict) -> str:
    return Template(html).render(Context(ctx))


def build_context(req):
    emp = req.employee
    return {
        'employee_name': emp.full_name,
        'employee_id': emp.employee_id,
        'current_position': req.current_position.title if req.current_position else '—',
        'current_department': (
            req.current_position.department.name
            if req.current_position and req.current_position.department else '—'
        ),
        'new_position': req.proposed_position.title if req.proposed_position else '—',
        'new_department': (
            req.proposed_position.department.name
            if req.proposed_position and req.proposed_position.department else '—'
        ),
        'new_manager': req.proposed_manager.full_name if req.proposed_manager else '—',
        'effective_date': req.effective_date.strftime('%d %B %Y'),
        'current_date': timezone.now().strftime('%d %B %Y'),
        'company_name': get_company()['name'],
        'reason': req.reason or '',
        'request_number': req.request_number,
        'change_type': req.get_change_type_display(),
    }


# ==============================================================================
# PAGE HEADER + FOOTER (drawn on every page via callback)
# ==============================================================================

def draw_page_decorations(canvas_obj, doc):
    """Draw branded header + footer on each page."""
    cfg = get_company()
    width, height = A4
    
    primary = colors.HexColor(cfg['primary'])
    accent = colors.HexColor(cfg['accent'])
    
    canvas_obj.saveState()
    
    # ===== HEADER BAND =====
    header_height = 2.2 * cm
    canvas_obj.setFillColor(primary)
    canvas_obj.rect(0, height - header_height, width, header_height, fill=1, stroke=0)
    
    # Company name (left)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont('Helvetica-Bold', 16)
    canvas_obj.drawString(1.5 * cm, height - 1.1 * cm, cfg['name'])
    
    canvas_obj.setFont('Helvetica-Oblique', 8)
    canvas_obj.drawString(1.5 * cm, height - 1.6 * cm, cfg['tagline'])
    
    # Contact (right)
    canvas_obj.setFont('Helvetica', 7.5)
    canvas_obj.drawRightString(width - 1.5 * cm, height - 0.8 * cm, cfg['address'][:60])
    canvas_obj.drawRightString(width - 1.5 * cm, height - 1.2 * cm, f"Phone: {cfg['phone']}")
    canvas_obj.drawRightString(width - 1.5 * cm, height - 1.6 * cm, f"Email: {cfg['email']}")
    
    # Accent line
    canvas_obj.setFillColor(accent)
    canvas_obj.rect(0, height - header_height - 0.15 * cm, width, 0.15 * cm, fill=1, stroke=0)
    
    # ===== FOOTER =====
    footer_y = 1.2 * cm
    canvas_obj.setStrokeColor(primary)
    canvas_obj.setLineWidth(1.5)
    canvas_obj.line(1.5 * cm, footer_y, width - 1.5 * cm, footer_y)
    
    canvas_obj.setFillColor(colors.HexColor('#6B7280'))
    canvas_obj.setFont('Helvetica', 7.5)
    footer_text = f"{cfg['name']}  |  {cfg['address']}  |  {cfg['phone']}  |  {cfg['website']}"
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

def generate_lifecycle_letter_pdf(lifecycle_request) -> bytes:
    """Generate branded PDF for lifecycle change letter."""
    template = lifecycle_request.letter_template
    if not template:
        raise ValueError("No letter template selected")
    
    cfg = get_company()
    ctx = build_context(lifecycle_request)
    primary = colors.HexColor(cfg['primary'])
    
    # Render template with variables
    rendered = render_template_with_variables(template.body_html, ctx)
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
    
    # ===== STYLES (all custom names to avoid conflicts) =====
    ss = getSampleStyleSheet()
    
    style_heading = ParagraphStyle(
        'HRMSHeading',
        parent=ss['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=15,
        textColor=primary,
        alignment=TA_CENTER,
        spaceAfter=12,
        spaceBefore=6,
    )
    
    style_subheading = ParagraphStyle(
        'HRMSSubHeading',
        parent=ss['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=primary,
        spaceAfter=8,
    )
    
    style_body = ParagraphStyle(
        'HRMSBody',
        parent=ss['BodyText'],
        fontName='Helvetica',
        fontSize=10.5,
        leading=15,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor('#1F2937'),
        spaceAfter=8,
    )
    
    style_bullet = ParagraphStyle(
        'HRMSBulletItem',
        parent=style_body,
        leftIndent=14,
    )
    
    style_small = ParagraphStyle(
        'HRMSSmall',
        parent=ss['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#374151'),
    )
    
    style_small_right = ParagraphStyle(
        'HRMSSmallRight',
        parent=style_small,
        alignment=TA_RIGHT,
    )
    
    story = []
    
    # ===== LETTER TYPE BADGE =====
    badge_colors_map = {
        'PROMOTION': '#16A34A',
        'TRANSFER': '#2563EB',
        'REDESIGNATION': '#9333EA',
        'CONFIRMATION': '#D97706',
        'MANAGER_CHANGE': '#4F46E5',
    }
    badge_color = colors.HexColor(
        badge_colors_map.get(lifecycle_request.change_type, '#1E40AF')
    )
    
    badge_para = Paragraph(
        f'<font color="white" size="11"><b>{ctx["change_type"].upper()} LETTER</b></font>',
        ParagraphStyle('HRMSBadge', alignment=TA_CENTER, leading=14),
    )
    
    badge_table = Table([[badge_para]], colWidths=[7 * cm])
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
            Paragraph(f'<b>Reference No:</b> {ctx["request_number"]}', style_small),
            Paragraph(f'<b>Date:</b> {ctx["current_date"]}', style_small_right),
        ],
        [
            Paragraph(f'<b>Employee ID:</b> {ctx["employee_id"]}', style_small),
            Paragraph(f'<b>Effective Date:</b> {ctx["effective_date"]}', style_small_right),
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
    
    # ===== LETTER BODY =====
    for block_type, content in blocks:
        if not content:
            continue
        
        try:
            if block_type in ('h1', 'h2'):
                story.append(Paragraph(content, style_heading))
            elif block_type == 'h3':
                story.append(Paragraph(content, style_subheading))
            elif block_type == 'li':
                story.append(Paragraph(f'•  {content}', style_bullet))
            else:
                story.append(Paragraph(content, style_body))
        except Exception as e:
            logger.warning(f"Skipping block due to error: {e}")
            continue
    
    story.append(Spacer(1, 30))
    
    # ===== SIGNATURE + SEAL =====
    sig_left = Paragraph(
        '<font size="10">_________________________</font><br/><br/>'
        '<b><font size="10">Human Resources</font></b><br/>'
        f'<font size="9" color="#6B7280">{cfg["name"]}</font>',
        ParagraphStyle('HRMSSignature', leading=14),
    )
    
    seal_para = Paragraph(
        f'<font color="{cfg["primary"]}" size="11"><b>{cfg["name"].split()[0].upper()}</b></font><br/>'
        f'<font color="{cfg["primary"]}" size="7">✦ OFFICIAL ✦</font>',
        ParagraphStyle('HRMSSeal', alignment=TA_CENTER, leading=14),
    )
    
    seal_box = Table([[seal_para]], colWidths=[2.8 * cm], rowHeights=[2.8 * cm])
    seal_box.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 2, primary),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EFF6FF')),
    ]))
    
    sig_table = Table(
        [[sig_left, seal_box]],
        colWidths=[10 * cm, 7 * cm],
    )
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
    
    logger.info(f"✅ Branded PDF generated for {lifecycle_request.request_number}")
    return pdf_bytes

# Add this new function to pdf_generator.py

def build_performance_letter_context(scorecard) -> dict:
    """Build variable context for performance rating letters."""
    emp = scorecard.employee
    cfg = get_company()

    # Get rating band label
    from ..models import RatingScale
    rating_label = '—'
    if scorecard.final_rating:
        band = RatingScale.objects.filter(rating=scorecard.final_rating, is_active=True).first()
        if band:
            rating_label = band.label

    # KRA breakdown text
    kra_lines = []
    for kra in scorecard.kras.all():
        kra_lines.append(
            f"• {kra.name} (Weight: {kra.weight}%) - Score: {kra.kra_score or 0}%"
        )
    kra_breakdown = '\n'.join(kra_lines) if kra_lines else 'No KRAs'

    return {
        'employee_name': emp.full_name,
        'employee_id': emp.employee_id,
        'employee_position': emp.position.title if emp.position else '—',
        'employee_department': emp.structure_location.name if emp.structure_location else '—',
        'cycle_name': scorecard.cycle.name,
        'cycle_period': f"{scorecard.cycle.period_start} to {scorecard.cycle.period_end}",
        'final_score': str(scorecard.final_score or 0),
        'final_rating': str(scorecard.final_rating or 0),
        'rating_label': rating_label,
        'self_score': str(scorecard.self_score or '—'),
        'peer_score': str(scorecard.peer_score or '—'),
        'manager_score': str(scorecard.manager_score or 0),
        'kra_breakdown': kra_breakdown,
        'company_name': cfg['name'],
        'current_date': timezone.now().strftime('%d %B %Y'),
        'reporting_manager': emp.reporting_manager.full_name if emp.reporting_manager else 'HR Team',
    }


def generate_performance_letter_pdf(scorecard) -> bytes:
    """Generate branded PDF performance rating letter for a scorecard."""
    template = None

    # Determine template type based on rating
    if scorecard.final_rating and scorecard.final_rating <= 2:
        template_type = 'PIP_LETTER'
    else:
        template_type = 'PERFORMANCE_RATING'

    # Fetch default template
    from ..models import LetterTemplate
    template = LetterTemplate.objects.filter(
        template_type=template_type,
        is_default=True,
        is_active=True,
    ).first()

    # Fallback: any active template of this type
    if not template:
        template = LetterTemplate.objects.filter(
            template_type=template_type,
            is_active=True,
        ).first()

    # Fallback: PERFORMANCE_RATING
    if not template:
        template = LetterTemplate.objects.filter(
            template_type='PERFORMANCE_RATING',
            is_active=True,
        ).first()

    if not template:
        raise ValueError(
            f"No active letter template found for {template_type}. "
            f"Please create one in Settings → Letter Templates."
        )

    cfg = get_company()
    ctx = build_performance_letter_context(scorecard)
    primary = colors.HexColor(cfg['primary'])

    rendered = render_template_with_variables(template.body_html, ctx)
    blocks = html_to_blocks(rendered)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2.0 * cm,
        leftMargin=2.0 * cm,
        topMargin=3.2 * cm,
        bottomMargin=2.5 * cm,
    )

    ss = getSampleStyleSheet()

    style_heading = ParagraphStyle(
        'PerfHeading', parent=ss['Heading2'],
        fontName='Helvetica-Bold', fontSize=15,
        textColor=primary, alignment=TA_CENTER,
        spaceAfter=12, spaceBefore=6,
    )
    style_body = ParagraphStyle(
        'PerfBody', parent=ss['BodyText'],
        fontName='Helvetica', fontSize=10.5, leading=15,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor('#1F2937'),
        spaceAfter=8,
    )
    style_bullet = ParagraphStyle('PerfBullet', parent=style_body, leftIndent=14)

    story = []

    # Badge
    badge_para = Paragraph(
        f'<font color="white" size="11"><b>PERFORMANCE RATING LETTER</b></font>',
        ParagraphStyle('PerfBadge', alignment=TA_CENTER, leading=14),
    )
    badge_table = Table([[badge_para]], colWidths=[8 * cm])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), primary),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    badge_wrapper = Table([[badge_table]], colWidths=[17 * cm])
    badge_wrapper.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    story.append(badge_wrapper)
    story.append(Spacer(1, 16))

    # Meta table
    meta_data = [
        [
            Paragraph(f'<b>Employee:</b> {ctx["employee_name"]}',
                      ParagraphStyle('PerfSmall', fontSize=9, textColor=colors.HexColor('#374151'))),
            Paragraph(f'<b>ID:</b> {ctx["employee_id"]}',
                      ParagraphStyle('PerfSmallR', fontSize=9,
                                     textColor=colors.HexColor('#374151'), alignment=TA_RIGHT)),
        ],
        [
            Paragraph(f'<b>Cycle:</b> {ctx["cycle_name"]}',
                      ParagraphStyle('PerfSmall2', fontSize=9, textColor=colors.HexColor('#374151'))),
            Paragraph(f'<b>Date:</b> {ctx["current_date"]}',
                      ParagraphStyle('PerfSmall2R', fontSize=9,
                                     textColor=colors.HexColor('#374151'), alignment=TA_RIGHT)),
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

    # Body from template
    for block_type, content in blocks:
        if not content:
            continue
        try:
            if block_type in ('h1', 'h2', 'h3'):
                story.append(Paragraph(content, style_heading))
            elif block_type == 'li':
                story.append(Paragraph(f'•  {content}', style_bullet))
            else:
                story.append(Paragraph(content, style_body))
        except Exception:
            continue

    # Big score card
    story.append(Spacer(1, 20))
    score_para = Paragraph(
        f'<para alignment="center"><font color="white" size="14"><b>FINAL SCORE: {ctx["final_score"]}%</b></font><br/>'
        f'<font color="white" size="11">Rating: {ctx["final_rating"]}/5 - {ctx["rating_label"]}</font></para>',
        ParagraphStyle('PerfScore', alignment=TA_CENTER, leading=18),
    )
    score_table = Table([[score_para]], colWidths=[14 * cm])
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), primary),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    score_wrap = Table([[score_table]], colWidths=[17 * cm])
    score_wrap.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    story.append(score_wrap)

    story.append(Spacer(1, 30))

    # Signature
    sig_left = Paragraph(
        '<font size="10">_________________________</font><br/><br/>'
        '<b><font size="10">Human Resources</font></b><br/>'
        f'<font size="9" color="#6B7280">{cfg["name"]}</font>',
        ParagraphStyle('PerfSig', leading=14),
    )
    seal_para = Paragraph(
        f'<font color="{cfg["primary"]}" size="11"><b>{cfg["name"].split()[0].upper()}</b></font><br/>'
        f'<font color="{cfg["primary"]}" size="7">✦ OFFICIAL ✦</font>',
        ParagraphStyle('PerfSeal', alignment=TA_CENTER, leading=14),
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

    doc.build(story, onFirstPage=draw_page_decorations, onLaterPages=draw_page_decorations)
    return buffer.getvalue()
