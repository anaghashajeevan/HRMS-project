from __future__ import annotations

from pathlib import Path

from celery import chord, shared_task
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .classification_services import classify_expense
from .models import (
    BillExtraction,
    DraftExtractedExpense,
    ExpenseAttachment,
    SmartReimbursementUpload,
    SmartUploadedBillFile,
)
from .ocr_services import run_ocr_for_attachment
from .quick_claim_services import (
    QuickClaimProcessingError,
    confirm_and_send_upload,
    mark_confirm_failure,
    refresh_upload_progress,
)


MIME_OCR_SUFFIXES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
}


def enqueue_smart_upload(upload_id: int):
    bill_ids = list(
        SmartUploadedBillFile.objects.filter(upload_id=upload_id, status=SmartUploadedBillFile.Status.QUEUED)
        .order_by("id")
        .values_list("id", flat=True)
    )
    if not bill_ids:
        return finalize_quick_claim_batch.delay([], upload_id)
    header = [process_bill_file.s(bill_id) for bill_id in bill_ids]
    result = chord(header)(finalize_quick_claim_batch.s(upload_id))
    SmartReimbursementUpload.objects.filter(pk=upload_id).update(task_group_id=result.id or "")
    return result


@shared_task(bind=True, max_retries=2)
def process_bill_file(self, bill_file_id: int) -> dict:
    try:
        with transaction.atomic():
            bill = SmartUploadedBillFile.objects.select_for_update().select_related("upload").get(pk=bill_file_id)
            if bill.status == SmartUploadedBillFile.Status.PROCESSED and hasattr(bill, "draft_expense"):
                return {"bill_file_id": bill.id, "status": "processed", "idempotent": True}
            if bill.upload.status == SmartReimbursementUpload.Status.CANCELLED:
                bill.status = SmartUploadedBillFile.Status.CANCELLED
                bill.save(update_fields=["status", "updated_at"])
                return {"bill_file_id": bill.id, "status": "cancelled"}
            bill.status = SmartUploadedBillFile.Status.PROCESSING
            bill.celery_task_id = self.request.id or ""
            bill.error_message = ""
            bill.save(update_fields=["status", "celery_task_id", "error_message", "updated_at"])
            SmartReimbursementUpload.objects.filter(pk=bill.upload_id).update(
                status=SmartReimbursementUpload.Status.PROCESSING
            )

        bill.refresh_from_db()
        attachment = bill.expense_attachment
        if attachment is None:
            original_stem = Path(bill.original_filename).stem or f"bill-{bill.id}"
            ocr_filename = f"{original_stem}{MIME_OCR_SUFFIXES[bill.detected_mime_type]}"
            attachment = ExpenseAttachment.objects.create(
                expense_item=None,
                file=bill.file.name,
                original_filename=ocr_filename,
                file_type=bill.detected_mime_type,
            )
            bill.expense_attachment = attachment
            bill.save(update_fields=["expense_attachment", "updated_at"])

        extraction = run_ocr_for_attachment(attachment)
        if extraction.status != BillExtraction.Status.COMPLETED:
            raise RuntimeError(extraction.error_message or f"OCR ended with status {extraction.status}.")

        classification = classify_expense(extraction.raw_text, extraction.extracted_vendor)
        requires_review = (
            classification.requires_manual_review
            or extraction.extracted_amount is None
            or extraction.extracted_date is None
            or not extraction.extracted_vendor.strip()
        )
        DraftExtractedExpense.objects.update_or_create(
            bill_file=bill,
            defaults={
                "upload": bill.upload,
                "expense_date": extraction.extracted_date,
                "vendor_name": extraction.extracted_vendor,
                "purpose": classification.purpose,
                "category": classification.category,
                "amount": extraction.extracted_amount,
                "classification_source": classification.classification_source,
                "category_confidence": classification.confidence,
                "requires_manual_review": requires_review,
            },
        )
        bill.status = SmartUploadedBillFile.Status.PROCESSED
        bill.processed_at = timezone.now()
        bill.error_message = ""
        bill.save(update_fields=["status", "processed_at", "error_message", "updated_at"])
        refresh_upload_progress(bill.upload_id)
        return {"bill_file_id": bill.id, "status": "processed"}
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=2 ** self.request.retries)
        SmartUploadedBillFile.objects.filter(pk=bill_file_id).update(
            status=SmartUploadedBillFile.Status.FAILED,
            error_message=str(exc),
            processed_at=timezone.now(),
        )
        upload_id = SmartUploadedBillFile.objects.filter(pk=bill_file_id).values_list("upload_id", flat=True).first()
        if upload_id:
            refresh_upload_progress(upload_id)
        return {"bill_file_id": bill_file_id, "status": "failed", "error": str(exc)}


@shared_task
def finalize_quick_claim_batch(results: list[dict], upload_id: int) -> dict:
    upload = refresh_upload_progress(upload_id)
    if upload.status == SmartReimbursementUpload.Status.CANCELLED:
        return {"upload_id": upload_id, "status": upload.status}

    flagged = upload.draft_expenses.filter(requires_manual_review=True).exists()
    if upload.processed_files == 0:
        upload.status = SmartReimbursementUpload.Status.FAILED
    elif upload.failed_files or flagged:
        upload.status = SmartReimbursementUpload.Status.NEEDS_REVIEW
    else:
        upload.status = SmartReimbursementUpload.Status.READY_TO_CONFIRM
    upload.save(update_fields=["status", "updated_at"])

    if upload.auto_send and upload.status == SmartReimbursementUpload.Status.READY_TO_CONFIRM:
        confirm_and_send_quick_claim.delay(upload.id, upload.created_by_id)
    return {"upload_id": upload_id, "status": upload.status, "results": results}


@shared_task
def confirm_and_send_quick_claim(upload_id: int, triggered_by_id: int | None = None) -> dict:
    try:
        log = confirm_and_send_upload(upload_id, triggered_by_id)
        return {
            "success": True,
            "upload_id": upload_id,
            "email_log_id": log.id,
            "status": log.status,
        }
    except QuickClaimProcessingError as exc:
        return {
            "success": False,
            "upload_id": upload_id,
            "email_log_id": exc.email_log_id,
            "stage": exc.stage,
            "error": str(exc),
        }
    except ValidationError as exc:
        return {
            "success": False,
            "upload_id": upload_id,
            "stage": "validation",
            "error": str(exc.detail),
        }
    except Exception as exc:
        message = f"Confirm and send failed: {exc}"
        try:
            mark_confirm_failure(upload_id, message)
        except Exception:
            pass
        return {
            "success": False,
            "upload_id": upload_id,
            "stage": "confirm",
            "error": message,
        }
