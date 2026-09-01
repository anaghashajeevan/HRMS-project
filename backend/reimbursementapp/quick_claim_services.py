from __future__ import annotations

from calendar import month_name
from decimal import Decimal
import hashlib
from io import BytesIO
from pathlib import PurePosixPath
import zipfile

import magic
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .email_services import build_quick_claim_finance_email, send_reimbursement_email
from .models import (
    DraftExtractedExpense,
    EmployeeReimbursementProfile,
    EmailDispatchLog,
    ExpenseItem,
    MonthlyReimbursementBatch,
    ReimbursementClaim,
    SmartReimbursementUpload,
    SmartUploadedBillFile,
    get_quick_claim_allowed_recipient_domains,
)
from .report_services import generate_quick_claim_excel_report, generate_quick_claim_pdf_report
from .services import _get_or_create_batch, _get_or_create_employee, _recalculate_batch_totals


ALLOWED_BILL_MIME_TYPES = {"image/jpeg", "image/png", "application/pdf"}
ZIP_MIME_TYPES = {"application/zip", "application/x-zip-compressed"}


class QuickClaimProcessingError(Exception):
    def __init__(
        self,
        message: str,
        *,
        stage: str,
        email_log_id: int | None = None,
    ):
        super().__init__(message)
        self.stage = stage
        self.email_log_id = email_log_id


def get_complete_reimbursement_profile(user) -> EmployeeReimbursementProfile:
    profile = EmployeeReimbursementProfile.objects.filter(user=user, is_complete=True).first()
    if not profile:
        raise ValidationError("A completed reimbursement profile is required before using Smart Upload.")
    return profile


def mark_confirm_failure(upload_id: int, message: str) -> SmartReimbursementUpload:
    SmartReimbursementUpload.objects.filter(
        pk=upload_id,
        status=SmartReimbursementUpload.Status.CONFIRMING,
    ).update(
        status=SmartReimbursementUpload.Status.READY_TO_CONFIRM,
        error_message=message,
        updated_at=timezone.now(),
    )
    return SmartReimbursementUpload.objects.get(pk=upload_id)


# def detect_mime_type(file_obj) -> str:
#     position = file_obj.tell() if hasattr(file_obj, "tell") else 0
#     header = file_obj.read(8192)
#     if hasattr(file_obj, "seek"):
#         file_obj.seek(position)
#     return magic.from_buffer(header, mime=True)


# def _validated_bill(name: str, content: bytes) -> dict:
#     max_size = settings.QUICK_CLAIM_MAX_FILE_SIZE
#     if not content:
#         raise ValidationError(f"{name}: empty files are not allowed.")
#     if len(content) > max_size:
#         raise ValidationError(f"{name}: file exceeds the {max_size // (1024 * 1024)} MB limit.")
#     mime_type = magic.from_buffer(content[:8192], mime=True)
#     if mime_type not in ALLOWED_BILL_MIME_TYPES:
#         raise ValidationError(f"{name}: detected MIME type '{mime_type}' is not allowed.")
#     return {
#         "name": PurePosixPath(name.replace("\\", "/")).name,
#         "content": ContentFile(content),
#         "mime_type": mime_type,
#         "size": len(content),
#         "sha256": hashlib.sha256(content).hexdigest(),
#         "status": SmartUploadedBillFile.Status.QUEUED,
#         "error_message": "",
#     }

# FIND these functions in quick_claim_services.py and REPLACE them:

def detect_mime_type(file_obj) -> str:
    position = file_obj.tell() if hasattr(file_obj, "tell") else 0
    header = file_obj.read(8192)
    if hasattr(file_obj, "seek"):
        file_obj.seek(position)
    
    # ✅ Safe Windows Fallback
    try:
        return magic.from_buffer(header, mime=True)
    except Exception:
        import mimetypes
        name = getattr(file_obj, 'name', '')
        mime_type, _ = mimetypes.guess_type(name)
        return mime_type or "application/octet-stream"


def _validated_bill(name: str, content: bytes) -> dict:
    max_size = settings.QUICK_CLAIM_MAX_FILE_SIZE
    if not content:
        raise ValidationError(f"{name}: empty files are not allowed.")
    if len(content) > max_size:
        raise ValidationError(f"{name}: file exceeds the {max_size // (1024 * 1024)} MB limit.")
    
    # ✅ Safe Windows Fallback
    try:
        mime_type = magic.from_buffer(content[:8192], mime=True)
    except Exception:
        import mimetypes
        mime_type, _ = mimetypes.guess_type(name)
        if not mime_type:
            if name.lower().endswith(('.jpg', '.jpeg')):
                mime_type = 'image/jpeg'
            elif name.lower().endswith('.png'):
                mime_type = 'image/png'
            elif name.lower().endswith('.pdf'):
                mime_type = 'application/pdf'
            else:
                mime_type = 'application/octet-stream'

    if mime_type not in ALLOWED_BILL_MIME_TYPES:
        raise ValidationError(f"{name}: detected MIME type '{mime_type}' is not allowed.")
    return {
        "name": PurePosixPath(name.replace("\\", "/")).name,
        "content": ContentFile(content),
        "mime_type": mime_type,
        "size": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        "status": SmartUploadedBillFile.Status.QUEUED,
        "error_message": "",
    }

def _failed_bill(name: str, content: bytes, message: str) -> dict:
    mime_type = magic.from_buffer(content[:8192], mime=True) if content else "application/octet-stream"
    return {
        "name": PurePosixPath(name.replace("\\", "/")).name,
        "content": None,
        "mime_type": mime_type,
        "size": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        "status": SmartUploadedBillFile.Status.FAILED,
        "error_message": message,
    }


def _validation_message(exc: ValidationError) -> str:
    detail = getattr(exc, "detail", None)
    if isinstance(detail, list) and detail:
        return str(detail[0])
    return str(exc)


def prepare_uploaded_bills(uploaded_files) -> list[dict]:
    prepared: list[dict] = []
    max_files = settings.QUICK_CLAIM_MAX_FILES

    for uploaded_file in uploaded_files:
        content = uploaded_file.read()
        uploaded_file.seek(0)
        detected_type = magic.from_buffer(content[:8192], mime=True)
        if detected_type in ZIP_MIME_TYPES:
            try:
                with zipfile.ZipFile(BytesIO(content)) as archive:
                    entries = [entry for entry in archive.infolist() if not entry.is_dir()]
                    if len(prepared) + len(entries) > max_files:
                        raise ValidationError(f"A Quick Claim may contain at most {max_files} bill files.")
                    for entry in entries:
                        if entry.file_size > settings.QUICK_CLAIM_MAX_FILE_SIZE:
                            prepared.append(
                                _failed_bill(
                                    entry.filename,
                                    b"",
                                    f"{entry.filename}: extracted file exceeds the size limit.",
                                )
                            )
                            continue
                        with archive.open(entry) as source:
                            extracted = source.read(settings.QUICK_CLAIM_MAX_FILE_SIZE + 1)
                        try:
                            prepared.append(_validated_bill(entry.filename, extracted))
                        except ValidationError as exc:
                            prepared.append(_failed_bill(entry.filename, extracted, _validation_message(exc)))
            except zipfile.BadZipFile as exc:
                raise ValidationError(f"{uploaded_file.name}: invalid ZIP archive.") from exc
        else:
            try:
                prepared.append(_validated_bill(uploaded_file.name, content))
            except ValidationError as exc:
                prepared.append(_failed_bill(uploaded_file.name, content, _validation_message(exc)))

        if len(prepared) > max_files:
            raise ValidationError(f"A Quick Claim may contain at most {max_files} bill files.")

    has_supported_bill = any(bill["status"] == SmartUploadedBillFile.Status.QUEUED for bill in prepared)
    if not prepared or not has_supported_bill:
        raise ValidationError("At least one JPEG, PNG, PDF, or ZIP containing supported bills is required.")
    return prepared


@transaction.atomic
def create_smart_upload(*, user, validated_data: dict, prepared_bills: list[dict]) -> SmartReimbursementUpload:
    profile = get_complete_reimbursement_profile(user)
    upload = SmartReimbursementUpload.objects.create(
        created_by=user,
        reimbursement_profile=profile,
        employee_name=profile.employee_name.strip(),
        employee_department=profile.department.strip(),
        month=profile.default_claim_month,
        year=profile.default_claim_year,
        recipient_email=profile.finance_head_email,
        cc_emails=profile.cc_emails,
        auto_send=False,
        total_files=len(prepared_bills),
        status=SmartReimbursementUpload.Status.QUEUED,
    )
    for prepared in prepared_bills:
        bill = SmartUploadedBillFile(
            upload=upload,
            original_filename=prepared["name"],
            detected_mime_type=prepared["mime_type"],
            file_size=prepared["size"],
            content_sha256=prepared["sha256"],
            status=prepared.get("status", SmartUploadedBillFile.Status.QUEUED),
            error_message=prepared.get("error_message", ""),
        )
        if prepared.get("content") is not None:
            bill.file.save(prepared["name"], prepared["content"], save=False)
        bill.save()
    return upload


def recipient_is_allowed(email: str) -> bool:
    try:
        validate_email(email)
    except Exception:
        return False
    allowed_domains = get_quick_claim_allowed_recipient_domains()
    if not allowed_domains:
        return False
    domain = email.rsplit("@", 1)[-1].lower()
    return any(domain == allowed or domain.endswith(f".{allowed}") for allowed in allowed_domains)


def validate_recipients(recipient_email: str, cc_emails: list[str]) -> None:
    allowed_domains = get_quick_claim_allowed_recipient_domains()
    if not allowed_domains:
        raise ValidationError(
            {
                "recipient_email": (
                    "No Quick Claim recipient domains are configured. "
                    "Add vbsai.com in System Settings."
                )
            }
        )
    rejected = [email for email in [recipient_email, *cc_emails] if not recipient_is_allowed(email)]
    if rejected:
        raise ValidationError(
            {
                "recipient_email": (
                    "Recipient domain is not allowlisted. "
                    f"Add {allowed_domains[0]} in System Settings."
                )
            }
        )


def refresh_upload_progress(upload_id: int) -> SmartReimbursementUpload:
    upload = SmartReimbursementUpload.objects.get(pk=upload_id)
    processed_files = upload.bill_files.filter(status=SmartUploadedBillFile.Status.PROCESSED).count()
    failed_files = upload.bill_files.filter(status=SmartUploadedBillFile.Status.FAILED).count()
    total = upload.draft_expenses.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    SmartReimbursementUpload.objects.filter(pk=upload_id).update(
        processed_files=processed_files,
        failed_files=failed_files,
        draft_total_amount=total,
    )
    upload.refresh_from_db()
    return upload


def validate_draft_expenses_ready(upload: SmartReimbursementUpload) -> list[DraftExtractedExpense]:
    drafts = list(upload.draft_expenses.select_related("bill_file__expense_attachment", "expense_item"))
    if not drafts:
        raise ValidationError("No draft expenses are available to confirm.")
    invalid = [
        draft.id
        for draft in drafts
        if draft.amount is None
        or draft.amount <= 0
        or not draft.expense_date
        or not draft.vendor_name.strip()
        or not draft.purpose.strip()
        or draft.requires_manual_review
    ]
    if invalid:
        raise ValidationError({"items": f"Draft items require correction before confirmation: {invalid}"})
    return drafts


@transaction.atomic
def materialize_draft_expenses(upload: SmartReimbursementUpload) -> ReimbursementClaim:
    upload = SmartReimbursementUpload.objects.select_for_update().get(pk=upload.pk)
    if upload.status == SmartReimbursementUpload.Status.CANCELLED:
        raise ValidationError("Cancelled uploads cannot be confirmed.")

    drafts = validate_draft_expenses_ready(upload)

        # Try multiple ways to find the employee
    employee = upload.created_by_employee
    
    if not employee and upload.created_by:
        # Try HRMS: UserAccount → Employee (OneToOne)
        try:
            from HRMSapp.models import Employee as HRMSEmployee
            user_account = upload.created_by
            if hasattr(user_account, 'employee'):
                employee = user_account.employee
        except Exception:
            pass
    
    if not employee:
        employee = _get_or_create_employee(
            {
                "employee_name": upload.employee_name or (
                    upload.created_by.get_full_name() if hasattr(upload.created_by, 'get_full_name') 
                    else str(upload.created_by)
                ),
                "department": upload.employee_department,
            }
        )
    batch = _get_or_create_batch({"month": month_name[upload.month], "year": str(upload.year)})
    claim = upload.claim
    if claim is None:
        existing_claim = ReimbursementClaim.objects.filter(batch=batch, employee=employee).first()
        if existing_claim and existing_claim.source != ReimbursementClaim.Source.QUICK_BULK_UPLOAD:
            raise ValidationError("An Excel-form claim already exists for this employee and month.")
        claim = existing_claim or ReimbursementClaim.objects.create(
            batch=batch,
            employee=employee,
            source=ReimbursementClaim.Source.QUICK_BULK_UPLOAD,
            status=ReimbursementClaim.Status.SUBMITTED,
            remarks=f"Created from Smart Reimbursement Upload #{upload.id}.",
        )

    for draft in drafts:
        if draft.expense_item_id:
            continue
        expense_item = ExpenseItem.objects.create(
            claim=claim,
            expense_date=draft.expense_date,
            category=draft.category,
            vendor_name=draft.vendor_name.strip(),
            description=draft.purpose.strip(),
            review_notes=draft.remarks.strip(),
            claimed_amount=draft.amount,
            classification_source=draft.classification_source,
            category_confidence=draft.category_confidence,
            requires_manual_review=False,
            status=ExpenseItem.Status.PENDING_REVIEW,
        )
        draft.expense_item = expense_item
        draft.save(update_fields=["expense_item", "updated_at"])
        attachment = draft.bill_file.expense_attachment
        if attachment:
            attachment.expense_item = expense_item
            attachment.save(update_fields=["expense_item"])

    totals = claim.expense_items.aggregate(total=Sum("claimed_amount"))
    claim.total_claimed_amount = totals["total"] or Decimal("0.00")
    claim.source = ReimbursementClaim.Source.QUICK_BULK_UPLOAD
    claim.save(update_fields=["total_claimed_amount", "source", "updated_at"])
    _recalculate_batch_totals(batch)
    upload.claim = claim
    upload.created_by_employee = employee
    upload.save(update_fields=["claim", "created_by_employee", "updated_at"])
    return claim


def confirm_and_send_upload(upload_id: int, triggered_by_id: int | None = None):
    with transaction.atomic():
        upload = SmartReimbursementUpload.objects.select_for_update().get(pk=upload_id)
        if upload.status == SmartReimbursementUpload.Status.SENT or upload.email_dispatch_logs.filter(
            status=EmailDispatchLog.Status.SENT
        ).exists():
            raise ValidationError("This Quick Claim has already been sent.")
        triggered_by = upload.created_by
        if not triggered_by:
            raise ValidationError("A logged-in employee is required to confirm this Quick Claim.")
        if triggered_by_id:
            if triggered_by_id != upload.created_by_id:
                raise ValidationError("This Quick Claim does not belong to the authenticated user.")
        profile = get_complete_reimbursement_profile(triggered_by)
        upload.reimbursement_profile = profile
        upload.employee_name = profile.employee_name.strip()
        upload.employee_department = profile.department.strip()
        upload.month = profile.default_claim_month
        upload.year = profile.default_claim_year
        upload.recipient_email = profile.finance_head_email
        upload.cc_emails = profile.cc_emails
        upload.status = SmartReimbursementUpload.Status.CONFIRMING
        upload.error_message = ""
        upload.save(
            update_fields=[
                "reimbursement_profile",
                "employee_name",
                "employee_department",
                "month",
                "year",
                "recipient_email",
                "cc_emails",
                "status",
                "error_message",
                "updated_at",
            ]
        )

    upload = SmartReimbursementUpload.objects.select_related(
        "created_by",
        "claim__employee",
        "claim__batch",
        "excel_report",
        "pdf_report",
    ).get(pk=upload_id)
    recipient = upload.recipient_email or ""
    try:
        validate_recipients(recipient, upload.cc_emails)
        claim = materialize_draft_expenses(upload)
    except ValidationError:
        mark_confirm_failure(upload_id, "Quick Claim validation failed. Review the draft and try again.")
        raise
    except Exception as exc:
        message = f"Claim creation failed: {exc}"
        mark_confirm_failure(upload_id, message)
        raise QuickClaimProcessingError(message, stage="claim") from exc

    upload.refresh_from_db()
    try:
        if not upload.excel_report_id:
            upload.excel_report = generate_quick_claim_excel_report(upload.id)
            upload.save(update_fields=["excel_report", "updated_at"])
        if not upload.pdf_report_id:
            upload.pdf_report = generate_quick_claim_pdf_report(upload.id)
            upload.save(update_fields=["pdf_report", "updated_at"])
    except Exception as exc:
        message = f"Report generation failed: {exc}"
        mark_confirm_failure(upload_id, message)
        raise QuickClaimProcessingError(message, stage="report") from exc

    reports = [upload.excel_report, upload.pdf_report]
    try:
        email_content = build_quick_claim_finance_email(upload, reports)
        log = send_reimbursement_email(
            batch_id=claim.batch_id,
            report_ids=[report.id for report in reports],
            to_email=recipient,
            cc_email=upload.cc_emails[0] if upload.cc_emails else "",
            cc_emails=upload.cc_emails,
            subject=email_content["subject"],
            body=email_content["body"],
            smart_reimbursement_upload=upload,
            triggered_by=upload.created_by,
        )
    except Exception as exc:
        message = f"Email preparation failed: {exc}"
        mark_confirm_failure(upload_id, message)
        raise QuickClaimProcessingError(message, stage="email") from exc

    if log.status != log.Status.SENT:
        message = log.error_message or "Email delivery failed."
        mark_confirm_failure(upload_id, message)
        raise QuickClaimProcessingError(
            message,
            stage="email",
            email_log_id=log.id,
        )

    upload.status = SmartReimbursementUpload.Status.SENT
    upload.error_message = ""
    upload.sent_at = log.sent_at
    upload.save(update_fields=["status", "error_message", "sent_at", "updated_at"])
    return log
