"""Shared company letterhead helpers for payroll PDFs."""
import os
import logging
from io import BytesIO

from django.conf import settings

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth

logger = logging.getLogger(__name__)


def get_payroll_branding():
    from HRMSapp.models import CompanyLogo
    from HRMSapp.services.pdf_generator import get_company

    company = get_company()
    logo_source = None
    local_path = getattr(settings, 'COMPANY_LOGO_PATH', '')
    if local_path and os.path.isfile(local_path):
        logo_source = local_path
    else:
        active_logo = CompanyLogo.objects.filter(is_active=True).first()
        if active_logo and active_logo.logo:
            try:
                active_logo.logo.open('rb')
                # ReportLab's ImageReader needs a path or a binary file object,
                # not a raw bytes value.
                logo_source = BytesIO(active_logo.logo.read())
            except Exception:
                logo_source = None
            finally:
                active_logo.logo.close()
            if logo_source:
                # Uploaded branding is authoritative when no custom name is
                # shown beside the mark, and supplies the fallback tagline.
                company['name'] = active_logo.name or company['name']
                company['tagline'] = active_logo.tagline or company['tagline']
    return company, logo_source


def draw_company_letterhead(canvas_obj, doc, company, logo_source):
    """Draw a logo-or-name company header and contact details on every page."""
    page_width, page_height = A4
    left = 18 * mm
    right = page_width - 18 * mm
    primary = colors.HexColor(company.get('primary') or '#1E40AF')
    logo_width = 40 * mm
    logo_height = 24 * mm

    canvas_obj.saveState()
    if logo_source:
        try:
            if hasattr(logo_source, 'seek'):
                logo_source.seek(0)
            canvas_obj.drawImage(
                ImageReader(logo_source), left, page_height - 30 * mm,
                width=logo_width, height=logo_height,
                preserveAspectRatio=True, anchor='c', mask='auto',
            )
        except Exception:
            logger.exception('Could not render the active company logo in a payroll PDF; using the text header instead.')
            logo_source = None

    # Show the company name and tagline only when there is no usable logo.
    if not logo_source:
        name = str(company.get('name') or 'Company')
        name_size = 15
        while name_size > 9 and stringWidth(name, 'Helvetica-Bold', name_size) > 92 * mm:
            name_size -= 0.5
        canvas_obj.setFillColor(primary)
        canvas_obj.setFont('Helvetica-Bold', name_size)
        canvas_obj.drawString(left, page_height - 17 * mm, name)
        tagline = str(company.get('tagline') or '').strip()
        if tagline:
            canvas_obj.setFillColor(colors.HexColor('#4B5563'))
            canvas_obj.setFont('Helvetica-Oblique', 8)
            canvas_obj.drawString(left, page_height - 23 * mm, tagline[:110])

    detail_left = left + (logo_width + 8 * mm if logo_source else 100 * mm)
    available_width = max(30 * mm, right - detail_left)
    details = [
        str(company.get('address') or '').strip(),
        f"Phone: {company['phone']}" if company.get('phone') else '',
        f"Email: {company['email']}" if company.get('email') else '',
        str(company.get('website') or '').strip(),
    ]
    details = [detail for detail in details if detail]
    font_size = 7.2
    line_height = 3.2 * mm
    y = page_height - 12 * mm
    canvas_obj.setFillColor(colors.HexColor('#374151'))
    canvas_obj.setFont('Helvetica', font_size)
    for detail in details:
        words = detail.split()
        lines = []
        line = ''
        for word in words:
            candidate = f'{line} {word}'.strip()
            if line and stringWidth(candidate, 'Helvetica', font_size) > available_width:
                lines.append(line)
                line = word
            else:
                line = candidate
        if line:
            lines.append(line)
        for line in lines:
            canvas_obj.drawRightString(right, y, line)
            y -= line_height

    canvas_obj.setStrokeColor(colors.HexColor(company.get('accent') or '#3B82F6'))
    canvas_obj.setLineWidth(1.2)
    canvas_obj.line(left, page_height - 34 * mm, right, page_height - 34 * mm)
    canvas_obj.restoreState()


def draw_confidential_footer(canvas_obj, doc, company):
    page_width, _ = A4
    left = 18 * mm
    right = page_width - 18 * mm
    footer_y = 12 * mm
    canvas_obj.saveState()
    canvas_obj.setStrokeColor(colors.HexColor(company.get('primary') or '#1E40AF'))
    canvas_obj.setLineWidth(0.7)
    canvas_obj.line(left, footer_y, right, footer_y)
    canvas_obj.setFillColor(colors.HexColor('#6B7280'))
    canvas_obj.setFont('Helvetica-Oblique', 6.5)
    canvas_obj.drawCentredString(page_width / 2, footer_y - 4 * mm, 'CONFIDENTIAL DOCUMENT · FOR RECIPIENT ONLY')
    canvas_obj.restoreState()
