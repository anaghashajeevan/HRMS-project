import io
import logging
import os
import subprocess
import shutil
import tempfile
import uuid
from django.utils import timezone

logger = logging.getLogger(__name__)

try:
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    PDF_STAMPING_AVAILABLE = True
except ImportError:
    PDF_STAMPING_AVAILABLE = False
    logger.warning("pypdf or reportlab not installed. PDF stamping bypassed.")


LIBREOFFICE_PATH = os.environ.get('LIBREOFFICE_PATH', 'soffice')
CONVERTIBLE_EXTENSIONS = {'.docx', '.doc', '.xlsx', '.xls'}


class ConversionError(Exception):
    pass


def get_or_create_pdf_version(original_file_path):
    """
    Returns a path to a PDF representation of the given file.
    - If the file is already a PDF, returns it unchanged.
    - If it's a Word/Excel doc, converts it via LibreOffice and caches
      the result next to the original (re-converts only if the source
      file has changed since the cache was made).
    Raises ConversionError if conversion fails or the file type is
    unsupported.
    """
    ext = os.path.splitext(original_file_path)[1].lower()

    if ext == '.pdf':
        return original_file_path

    if ext not in CONVERTIBLE_EXTENSIONS:
        raise ConversionError(f"Unsupported file type for preview: {ext}")

    base, _ = os.path.splitext(original_file_path)
    cached_pdf_path = f"{base}__converted.pdf"

    if os.path.exists(cached_pdf_path) and \
       os.path.getmtime(cached_pdf_path) >= os.path.getmtime(original_file_path):
        return cached_pdf_path

    # Convert into a unique temp dir first to avoid collisions between
    # concurrent requests converting the same or different files.
    with tempfile.TemporaryDirectory() as tmp_dir:
        try:
            subprocess.run(
                [
                    LIBREOFFICE_PATH,
                    '--headless',
                    '--norestore',
                    '--convert-to', 'pdf',
                    '--outdir', tmp_dir,
                    original_file_path,
                ],
                capture_output=True,
                timeout=90,
                check=True,
            )
        except FileNotFoundError as e:
            raise ConversionError(
                f"LibreOffice executable not found at '{LIBREOFFICE_PATH}'. "
                f"Set LIBREOFFICE_PATH in your .env."
            ) from e
        except subprocess.TimeoutExpired as e:
            raise ConversionError("Document conversion timed out.") from e
        except subprocess.CalledProcessError as e:
            logger.error(f"LibreOffice conversion failed: {e.stderr}")
            raise ConversionError("Document conversion failed.") from e

        produced_name = os.path.splitext(os.path.basename(original_file_path))[0] + '.pdf'
        produced_path = os.path.join(tmp_dir, produced_name)

        if not os.path.exists(produced_path):
            raise ConversionError("Conversion did not produce an output file.")

        # Atomic-ish move into the cache location (unique temp name then rename)
        tmp_target = f"{cached_pdf_path}.{uuid.uuid4().hex}.tmp"
        shutil.copyfile(produced_path, tmp_target)
        os.replace(tmp_target, cached_pdf_path)

    return cached_pdf_path


def stamp_pdf_document(original_file_path, approval_data):
    if not PDF_STAMPING_AVAILABLE:
        with open(original_file_path, 'rb') as f:
            return io.BytesIO(f.read())

    try:
        reader = PdfReader(original_file_path)
        writer = PdfWriter()

        num_pages = len(reader.pages)
        if num_pages == 0:
            with open(original_file_path, 'rb') as f:
                return io.BytesIO(f.read())

        for i in range(num_pages - 1):
            writer.add_page(reader.pages[i])

        last_page = reader.pages[num_pages - 1]
        page_width = float(last_page.mediabox.width)
        page_height = float(last_page.mediabox.height)

        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=(page_width, page_height))

        box_height = 85
        margin = 20
        box_width = page_width - (2 * margin)
        bottom_y = 15

        can.setFillColor(colors.HexColor("#FFFFFF"))
        can.setStrokeColor(colors.HexColor("#059669"))
        can.setLineWidth(1.5)
        can.roundRect(margin, bottom_y, box_width, box_height, 6, fill=1, stroke=1)

        can.setFillColor(colors.HexColor("#059669"))
        can.roundRect(margin, bottom_y + box_height - 18, box_width, 18, 0, fill=1, stroke=0)

        can.setFillColor(colors.white)
        can.setFont("Helvetica-Bold", 8)
        can.drawCentredString(page_width / 2, bottom_y + box_height - 13, "OFFICIALLY APPROVED & DIGITALLY SEALED DOCUMENT")

        steps = approval_data.get('steps', [])
        if not steps:
            steps = [{
                'role': 'AUTHOR',
                'name': approval_data.get('author_name', 'Authorized HR Admin'),
                'date': approval_data.get('published_at', timezone.now().strftime('%Y-%m-%d')),
                'emp_id': approval_data.get('author_id', 'HR-001')
            }]

        num_steps = min(len(steps), 4)
        col_width = (box_width - 20) / max(num_steps, 1)
        y_top = bottom_y + box_height - 25

        for idx, step in enumerate(steps[:4]):
            col_x = margin + 10 + (idx * col_width)

            can.setFillColor(colors.HexColor("#4B5563"))
            can.setFont("Helvetica-Bold", 7)
            role_text = str(step.get('role', 'APPROVED BY')).upper()
            can.drawString(col_x, y_top, role_text)

            can.setFillColor(colors.HexColor("#111827"))
            can.setFont("Helvetica-Bold", 8)
            name_text = str(step.get('name', 'N/A'))
            if len(name_text) > 18:
                name_text = name_text[:16] + '..'
            can.drawString(col_x, y_top - 10, name_text)

            can.setFillColor(colors.HexColor("#6B7280"))
            can.setFont("Helvetica", 7)
            can.drawString(col_x, y_top - 18, f"Date: {step.get('date', 'N/A')}")
            if step.get('emp_id'):
                can.drawString(col_x, y_top - 25, f"Emp ID: {step.get('emp_id')}")

            can.setStrokeColor(colors.HexColor("#059669"))
            can.setFillColor(colors.HexColor("#ECFDF5"))
            badge_w = max(col_width - 15, 65)
            can.roundRect(col_x, y_top - 44, badge_w, 14, 3, fill=1, stroke=1)

            can.setFillColor(colors.HexColor("#047857"))
            can.setFont("Helvetica-Bold", 7)
            can.drawCentredString(col_x + (badge_w / 2), y_top - 40, "✓ DIGITALLY SIGNED")

        can.save()
        packet.seek(0)

        overlay_pdf = PdfReader(packet)
        last_page.merge_page(overlay_pdf.pages[0])

        writer.add_page(last_page)

        output_packet = io.BytesIO()
        writer.write(output_packet)
        output_packet.seek(0)
        return output_packet

    except Exception as e:
        logger.error(f"Error stamping PDF document: {e}", exc_info=True)
        with open(original_file_path, 'rb') as f:
            return io.BytesIO(f.read())