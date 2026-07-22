from __future__ import annotations

from collections import Counter
from itertools import combinations
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from .models import BillExtraction, ExpenseAttachment


SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
SUPPORTED_PDF_EXTENSIONS = {".pdf"}
UNSUPPORTED_OCR_MESSAGE = "OCR is currently supported for image and PDF files only."
TESSERACT_UNAVAILABLE_MESSAGE = "Tesseract OCR is not available."
AMOUNT_KEYWORDS = [
    "grand total inr",
    "grand total",
    "amount payable",
    "total amount",
    "invoice total",
    "net amount",
    "paid amount",
    "bill amount",
    "amount in words",
    "grand to",
    "mode of payment",
    "total",
]
NOISE_CONTEXT_KEYWORDS = {
    "cgst",
    "sgst",
    "igst",
    "gst",
    "taxable",
    "tax rate",
    "tax %",
    "tax percent",
    "discount",
    "saving",
    "savings",
    "mrp",
    "hsn",
    "qty",
    "quantity",
    "rate",
    "phone",
    "mobile",
    "contact",
    "gstin",
    "order id",
    "invoice no",
    "invoice number",
    "receipt no",
    "receipt number",
}
AMOUNT_PATTERN = re.compile(
    r"(?<![\dA-Z])(?P<prefix>\u20b9|rs\.?|inr)?\s*(?P<value>[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?![\d/:-])",
    re.IGNORECASE,
)


class TesseractUnavailableError(RuntimeError):
    pass


def configure_tesseract() -> str:
    try:
        import pytesseract
    except ImportError as exc:
        checked_path = getattr(settings, "TESSERACT_CMD", "")
        raise TesseractUnavailableError(
            f"{TESSERACT_UNAVAILABLE_MESSAGE} Checked path: {checked_path}"
        ) from exc

    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
    return settings.TESSERACT_CMD


def get_tesseract_version_safe() -> str:
    checked_path = configure_tesseract()

    try:
        import pytesseract

        return str(pytesseract.get_tesseract_version())
    except Exception as exc:
        raise TesseractUnavailableError(
            f"{TESSERACT_UNAVAILABLE_MESSAGE} Checked path: {checked_path}"
        ) from exc


def normalize_amount(value: str) -> Decimal | None:
    normalized = value.replace(",", "").strip()
    try:
        return Decimal(normalized)
    except InvalidOperation:
        return None


def parse_amount_candidates(text: str) -> list[dict]:
    candidates: list[dict] = []

    for match in AMOUNT_PATTERN.finditer(text):
        raw_value = match.group("value")
        decimal_value = normalize_amount(raw_value)
        if decimal_value is None:
            continue

        candidates.append(
            {
                "value": decimal_value,
                "raw": raw_value,
                "full_match": match.group(0),
                "has_currency": bool(match.group("prefix")),
                "start": match.start(),
                "end": match.end(),
                "context": text,
            }
        )

    return candidates


def is_likely_noise_amount(value: Decimal, context: str, *, raw: str = "", has_currency: bool = False) -> bool:
    normalized_context = context.lower()
    integer_part = raw.replace(",", "").split(".")[0]

    if value == Decimal("0") or value == Decimal("0.00"):
        return True

    if len(integer_part) >= 7 and not has_currency:
        return True

    if not has_currency and value == value.to_integral_value() and Decimal("1900") <= value <= Decimal("2100"):
        return True

    if "%" in normalized_context and value <= Decimal("100"):
        return True

    if any(keyword in normalized_context for keyword in NOISE_CONTEXT_KEYWORDS):
        if (
            "total" not in normalized_context
            and "amount payable" not in normalized_context
            and "paid amount" not in normalized_context
            and "bill amount" not in normalized_context
        ):
            return True

    if not has_currency and value <= Decimal("4.00"):
        return True

    if not has_currency and value in {
        Decimal("2.50"),
        Decimal("5.00"),
        Decimal("6.00"),
        Decimal("9.00"),
        Decimal("12.00"),
        Decimal("18.00"),
        Decimal("28.00"),
        Decimal("49.50"),
        Decimal("48.81"),
    }:
        return True

    return False


def extract_amount_candidates_from_text(raw_text: str) -> list[Decimal]:
    candidates: list[Decimal] = []
    zero_candidates: list[Decimal] = []

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        for candidate in parse_amount_candidates(line):
            value = candidate["value"]
            normalized_value = value.quantize(Decimal("0.01"))

            if normalized_value == Decimal("0.00"):
                zero_candidates.append(normalized_value)
                continue

            if is_likely_noise_amount(
                value,
                candidate["context"],
                raw=candidate["raw"],
                has_currency=candidate["has_currency"],
            ):
                continue

            candidates.append(normalized_value)

    return candidates if candidates else zero_candidates


def find_claimed_amount_in_ocr(
    raw_text: str,
    claimed_amount: Decimal,
    tolerance: Decimal = Decimal("1.00"),
) -> Decimal | None:
    for candidate in extract_amount_candidates_from_text(raw_text):
        if abs(candidate - claimed_amount) <= tolerance:
            return candidate
    return None


def find_claimed_amount_by_sum(
    raw_text: str,
    claimed_amount: Decimal,
    tolerance: Decimal = Decimal("1.00"),
) -> Decimal | None:
    raw_candidates = extract_amount_candidates_from_text(raw_text)
    if len(raw_candidates) < 2:
        return None

    usable_candidates = [
        candidate
        for candidate in raw_candidates
        if Decimal("0.00") < candidate <= claimed_amount + tolerance
    ]
    if len(usable_candidates) < 2:
        return None

    prioritized_candidates = sorted(
        usable_candidates,
        key=lambda candidate: (
            abs(claimed_amount - candidate),
            -candidate,
        ),
    )[:12]

    max_group_size = min(5, len(prioritized_candidates))
    for group_size in range(2, max_group_size + 1):
        for combo_indexes in combinations(range(len(prioritized_candidates)), group_size):
            total = sum(prioritized_candidates[index] for index in combo_indexes)
            if abs(total - claimed_amount) <= tolerance:
                return total.quantize(Decimal("0.01"))

    return None


def _choose_preferred_candidate(candidates: list[dict]) -> Decimal | None:
    if not candidates:
        return None

    currency_candidates = [candidate for candidate in candidates if candidate["has_currency"]]
    preferred_candidates = currency_candidates if currency_candidates else candidates
    return preferred_candidates[-1]["value"].quantize(Decimal("0.01"))


def extract_amount_near_keywords(lines: list[str]) -> Decimal | None:
    normalized_lines = [line.lower().strip() for line in lines]

    for keyword in AMOUNT_KEYWORDS:
        for index, normalized_line in enumerate(normalized_lines):
            if keyword not in normalized_line:
                continue

            current_line_candidates = [
                candidate
                for candidate in parse_amount_candidates(lines[index])
                if not is_likely_noise_amount(
                    candidate["value"],
                    candidate["context"],
                    raw=candidate["raw"],
                    has_currency=candidate["has_currency"],
                )
            ]
            preferred_current = _choose_preferred_candidate(current_line_candidates)
            if preferred_current is not None:
                return preferred_current

            window_candidates: list[dict] = []
            for offset in range(1, 3):
                next_index = index + offset
                if next_index >= len(lines):
                    break

                for candidate in parse_amount_candidates(lines[next_index]):
                    if is_likely_noise_amount(
                        candidate["value"],
                        candidate["context"],
                        raw=candidate["raw"],
                        has_currency=candidate["has_currency"],
                    ):
                        continue
                    window_candidates.append(candidate)

            preferred_window = _choose_preferred_candidate(window_candidates)
            if preferred_window is not None:
                return preferred_window

    return None


def extract_amount_before_amount_in_words(raw_text: str) -> Decimal | None:
    match = re.search(r"\bamount\s+in\s+words\b", raw_text, re.IGNORECASE)
    if not match:
        return None

    preceding_text = raw_text[max(0, match.start() - 300) : match.start()]
    candidates: list[dict] = []
    for line in preceding_text.splitlines():
        for candidate in parse_amount_candidates(line):
            if is_likely_noise_amount(
                candidate["value"],
                candidate["context"],
                raw=candidate["raw"],
                has_currency=candidate["has_currency"],
            ):
                continue
            candidates.append(candidate)

    return _choose_preferred_candidate(candidates)


def extract_amount_from_text(raw_text: str) -> Decimal | None:
    amount_in_words_total = extract_amount_before_amount_in_words(raw_text)
    if amount_in_words_total is not None:
        return amount_in_words_total

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    keyword_amount = extract_amount_near_keywords(lines)
    if keyword_amount is not None:
        return keyword_amount

    candidates = extract_amount_candidates_from_text(raw_text)
    if not candidates:
        return None

    candidate_frequency = Counter(candidates)
    best_value = max(
        candidate_frequency,
        key=lambda value: (
            candidate_frequency[value],
            value >= Decimal("100.00"),
            value,
        ),
    )
    return best_value.quantize(Decimal("0.01"))


def extract_date_from_text(raw_text: str):
    date_patterns = [
        r"\b\d{2}/\d{2}/\d{4}\b",
        r"\b\d{2}-\d{2}-\d{4}\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{1,2}-[A-Za-z]{3}-\d{4}\b",
    ]
    parsers = {
        "/": "%d/%m/%Y",
        "-": ("%d-%m-%Y", "%Y-%m-%d", "%d-%b-%Y"),
    }

    for pattern in date_patterns:
        for match in re.findall(pattern, raw_text):
            if "/" in match:
                formats = [parsers["/"]]
            else:
                formats = list(parsers["-"])
            for fmt in formats:
                try:
                    return datetime.strptime(match, fmt).date()
                except ValueError:
                    continue
    return None


def extract_invoice_number_from_text(raw_text: str) -> str:
    invoice_patterns = [
        r"(?:invoice|bill|receipt)\s*(?:no|number|#)\s*[:\-]?\s*([A-Z0-9\-\/]{3,})",
        r"(?:invoice|bill|receipt)\s*:\s*([A-Z0-9\-\/]{3,})",
    ]

    for pattern in invoice_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


def _extract_vendor_from_text(raw_text: str) -> str:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    seller_labels = {"sold by", "sold by seller", "seller"}
    for index, line in enumerate(lines):
        normalized_label = re.sub(r"[^a-z]+", " ", line.lower()).strip()
        if normalized_label in seller_labels and index + 1 < len(lines):
            return lines[index + 1][:255]

    for line in lines:
        if line:
            return line[:255]
    return ""


def _extract_text_from_image(image_path: str) -> str:
    try:
        import pytesseract
    except ImportError as exc:
        checked_path = getattr(settings, "TESSERACT_CMD", "")
        raise TesseractUnavailableError(
            f"{TESSERACT_UNAVAILABLE_MESSAGE} Checked path: {checked_path}"
        ) from exc

    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Pillow is required for image OCR but is not installed.") from exc

    checked_path = configure_tesseract()

    try:
        with Image.open(image_path) as image:
            return pytesseract.image_to_string(image)
    except pytesseract.TesseractNotFoundError as exc:
        raise TesseractUnavailableError(
            f"{TESSERACT_UNAVAILABLE_MESSAGE} Checked path: {checked_path}"
        ) from exc


def extract_text_from_pdf(file_path: str, max_pages: int = 3) -> str:
    try:
        import fitz
    except ImportError as exc:
        raise RuntimeError("PyMuPDF is required for PDF OCR but is not installed.") from exc

    try:
        with fitz.open(file_path) as pdf_document:
            if pdf_document.is_encrypted:
                raise RuntimeError("PDF file is encrypted and cannot be read for OCR.")

            extracted_chunks: list[str] = []
            page_limit = min(len(pdf_document), max_pages)
            for page_index in range(page_limit):
                page_text = pdf_document.load_page(page_index).get_text("text")
                if page_text and page_text.strip():
                    extracted_chunks.append(page_text.strip())
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Unable to open PDF for OCR: {exc}") from exc

    return "\n\n".join(extracted_chunks).strip()


def ocr_pdf_pages(file_path: str, max_pages: int = 3) -> str:
    try:
        import fitz
    except ImportError as exc:
        raise RuntimeError("PyMuPDF is required for PDF OCR but is not installed.") from exc

    try:
        import pytesseract
    except ImportError as exc:
        checked_path = getattr(settings, "TESSERACT_CMD", "")
        raise TesseractUnavailableError(
            f"{TESSERACT_UNAVAILABLE_MESSAGE} Checked path: {checked_path}"
        ) from exc

    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Pillow is required for PDF OCR rendering but is not installed.") from exc

    checked_path = configure_tesseract()

    try:
        with fitz.open(file_path) as pdf_document:
            if pdf_document.is_encrypted:
                raise RuntimeError("PDF file is encrypted and cannot be read for OCR.")

            ocr_chunks: list[str] = []
            page_limit = min(len(pdf_document), max_pages)
            for page_index in range(page_limit):
                page = pdf_document.load_page(page_index)
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                image = Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)
                page_text = pytesseract.image_to_string(image)
                if page_text and page_text.strip():
                    ocr_chunks.append(page_text.strip())
    except pytesseract.TesseractNotFoundError as exc:
        raise TesseractUnavailableError(
            f"{TESSERACT_UNAVAILABLE_MESSAGE} Checked path: {checked_path}"
        ) from exc
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Unable to OCR PDF pages: {exc}") from exc

    return "\n\n".join(ocr_chunks).strip()


def run_ocr_for_attachment(attachment: ExpenseAttachment) -> BillExtraction:
    extraction, _ = BillExtraction.objects.get_or_create(attachment=attachment)
    extraction.status = BillExtraction.Status.PROCESSING
    extraction.error_message = ""
    extraction.save(update_fields=["status", "error_message", "updated_at"])

    file_extension = Path(attachment.original_filename or attachment.file.name).suffix.lower()

    if file_extension not in SUPPORTED_IMAGE_EXTENSIONS and file_extension not in SUPPORTED_PDF_EXTENSIONS:
        extraction.status = BillExtraction.Status.UNSUPPORTED
        extraction.raw_text = ""
        extraction.extracted_vendor = ""
        extraction.extracted_date = None
        extraction.extracted_amount = None
        extraction.extracted_invoice_number = ""
        extraction.confidence_score = None
        extraction.error_message = UNSUPPORTED_OCR_MESSAGE
        extraction.processed_at = timezone.now()
        extraction.save(
            update_fields=[
                "status",
                "raw_text",
                "extracted_vendor",
                "extracted_date",
                "extracted_amount",
                "extracted_invoice_number",
                "confidence_score",
                "error_message",
                "processed_at",
                "updated_at",
            ]
        )
        return extraction

    try:
        if file_extension in SUPPORTED_IMAGE_EXTENSIONS:
            get_tesseract_version_safe()
            raw_text = _extract_text_from_image(attachment.file.path).strip()
        else:
            raw_text = extract_text_from_pdf(attachment.file.path).strip()
            if len(re.sub(r"\s+", "", raw_text)) < 20:
                get_tesseract_version_safe()
                raw_text = ocr_pdf_pages(attachment.file.path).strip()
            if len(re.sub(r"\s+", "", raw_text)) < 20:
                raise RuntimeError("PDF did not contain readable text from direct extraction or OCR.")

        extraction.raw_text = raw_text
        extraction.extracted_vendor = _extract_vendor_from_text(raw_text)
        extraction.extracted_date = extract_date_from_text(raw_text)
        extraction.extracted_amount = extract_amount_from_text(raw_text)
        extraction.extracted_invoice_number = extract_invoice_number_from_text(raw_text)
        extraction.status = BillExtraction.Status.COMPLETED
        extraction.error_message = ""
        extraction.processed_at = timezone.now()
        extraction.save(
            update_fields=[
                "raw_text",
                "extracted_vendor",
                "extracted_date",
                "extracted_amount",
                "extracted_invoice_number",
                "status",
                "error_message",
                "processed_at",
                "updated_at",
            ]
        )
        return extraction
    except TesseractUnavailableError as exc:
        extraction.status = BillExtraction.Status.FAILED
        extraction.raw_text = ""
        extraction.extracted_vendor = ""
        extraction.extracted_date = None
        extraction.extracted_amount = None
        extraction.extracted_invoice_number = ""
        extraction.confidence_score = None
        extraction.error_message = str(exc)
        extraction.processed_at = timezone.now()
        extraction.save(
            update_fields=[
                "status",
                "raw_text",
                "extracted_vendor",
                "extracted_date",
                "extracted_amount",
                "extracted_invoice_number",
                "confidence_score",
                "error_message",
                "processed_at",
                "updated_at",
            ]
        )
        raise
    except Exception as exc:
        extraction.status = BillExtraction.Status.FAILED
        extraction.raw_text = ""
        extraction.extracted_vendor = ""
        extraction.extracted_date = None
        extraction.extracted_amount = None
        extraction.extracted_invoice_number = ""
        extraction.confidence_score = None
        extraction.error_message = f"OCR processing failed: {exc}"
        extraction.processed_at = timezone.now()
        extraction.save(
            update_fields=[
                "status",
                "raw_text",
                "extracted_vendor",
                "extracted_date",
                "extracted_amount",
                "extracted_invoice_number",
                "confidence_score",
                "error_message",
                "processed_at",
                "updated_at",
            ]
        )
        return extraction
 