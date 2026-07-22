from __future__ import annotations

from calendar import month_name
import smtplib

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from .models import (
    EmailDispatchLog,
    GeneratedReport,
    MonthlyReimbursementBatch,
    get_system_settings,
)


SMTP_AUTH_ERROR_MESSAGE = (
    "SMTP authentication failed. Check EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, "
    "MFA/app password, and whether SMTP AUTH is enabled."
)

EMAIL_TEMPLATE_FORMAL_SUMMARY = "FORMAL_SUMMARY"
EMAIL_TEMPLATE_FINANCE_APPROVAL = "FINANCE_APPROVAL"
EMAIL_TEMPLATE_CTO_EXECUTIVE = "CTO_EXECUTIVE"
EMAIL_TEMPLATE_QUICK_CLAIM_FINANCE = "QUICK_CLAIM_FINANCE"
EMAIL_TEMPLATE_CHOICES = {
    EMAIL_TEMPLATE_FORMAL_SUMMARY,
    EMAIL_TEMPLATE_FINANCE_APPROVAL,
    EMAIL_TEMPLATE_CTO_EXECUTIVE,
}


def build_quick_claim_finance_email(upload, reports: list[GeneratedReport]) -> dict:
    if not upload.claim_id:
        raise ValueError("Quick Claim must be confirmed before preparing email.")
    claim = upload.claim
    employee_name = claim.employee.full_name
    attachment_names = [report.original_filename for report in reports]
    failed_note = (
        f"Failed or excluded bills: {upload.failed_files}"
        if upload.failed_files
        else "Failed or excluded bills: None"
    )
    subject = f"Reimbursement Claim Report - {employee_name} - {month_name[upload.month]} {upload.year}"
    body = (
        "Dear Finance Team,\n\n"
        "Please find the verified reimbursement claim details below.\n\n"
        f"Employee: {employee_name}\n"
        f"Claim Month: {month_name[upload.month]} {upload.year}\n"
        f"Final Confirmed Amount: INR {claim.total_claimed_amount:.2f}\n"
        f"Total Uploaded Bills: {upload.total_files}\n"
        f"Successfully Processed Bills: {upload.processed_files}\n"
        f"{failed_note}\n\n"
        "The attached Excel and PDF reports were generated only after the employee reviewed and verified the extracted rows.\n\n"
        "Attachments:\n"
        + "\n".join(f"- {name}" for name in attachment_names)
        + "\n\nRegards,\nReimburIQ Automation"
    )
    return {"subject": subject, "body": body, "attachment_names": attachment_names}


def _format_smtp_error(exc: Exception) -> str:
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return SMTP_AUTH_ERROR_MESSAGE
    if "authentication failed" in str(exc).lower() or "authentication unsuccessful" in str(exc).lower():
        return SMTP_AUTH_ERROR_MESSAGE
    return str(exc)


def _get_batch_label(batch: MonthlyReimbursementBatch) -> str:
    return batch.title or f"Batch {batch.month}/{batch.year}"


def _build_email_subject(batch_label: str, template_type: str) -> str:
    subject_map = {
        EMAIL_TEMPLATE_FORMAL_SUMMARY: f"Expense Reimbursement Summary - {batch_label}",
        EMAIL_TEMPLATE_FINANCE_APPROVAL: f"Approved Expense Reimbursement Package - {batch_label}",
        EMAIL_TEMPLATE_CTO_EXECUTIVE: f"Monthly Reimbursement Approval Summary - {batch_label}",
    }
    return subject_map[template_type]


def _build_email_body(
    *,
    template_type: str,
    batch_label: str,
    batch: MonthlyReimbursementBatch,
    report_count: int,
    company_name: str,
    default_email_body_note: str,
) -> str:
    summary_lines = (
        f"Batch Title: {batch_label}\n"
        f"Batch Month/Year: {batch.month:02d}/{batch.year}\n"
        f"Total Claims: {batch.claims.count()}\n"
        f"Total Claimed Amount: {batch.total_claimed_amount:.2f}\n"
        f"Total Approved Amount: {batch.total_approved_amount:.2f}\n"
        f"Reports Attached: {report_count}"
    )
    note_section = f"\n\n{default_email_body_note.strip()}" if default_email_body_note.strip() else ""

    if template_type == EMAIL_TEMPLATE_FORMAL_SUMMARY:
        return (
            "Dear Sir/Madam,\n\n"
            "Please find below the reimbursement summary for the referenced batch.\n\n"
            f"{summary_lines}\n\n"
            "The attached reports are shared for your review and record."
            f"{note_section}\n\n"
            "Regards,\n"
            f"Finance Team\n{company_name}"
        )

    if template_type == EMAIL_TEMPLATE_FINANCE_APPROVAL:
        return (
            "Dear CTO and Finance Head,\n\n"
            "Finance review has been completed for the reimbursement batch noted below.\n\n"
            f"{summary_lines}\n\n"
            "The approved reimbursement amounts are included, and the attached reports are ready for processing."
            f"{note_section}\n\n"
            "Regards,\n"
            f"Finance Team\n{company_name}"
        )

    return (
        "Dear CTO and Finance Head,\n\n"
        "Please find the executive reimbursement summary for the batch below.\n\n"
        f"{summary_lines}\n\n"
        "The attached reports are provided for review and final processing."
        f"{note_section}\n\n"
        "Regards,\n"
        f"Finance Team\n{company_name}"
    )


def build_reimbursement_email_preview(
    batch_id: int,
    report_ids: list[int] | None = None,
    template_type: str | None = None,
) -> dict:
    batch = MonthlyReimbursementBatch.objects.filter(pk=batch_id).first()
    if not batch:
        raise ValueError("Reimbursement batch not found.")
    normalized_template_type = (template_type or EMAIL_TEMPLATE_CTO_EXECUTIVE).strip().upper()
    if normalized_template_type not in EMAIL_TEMPLATE_CHOICES:
        raise ValueError("Invalid email template type.")

    reports_qs = GeneratedReport.objects.filter(batch_id=batch_id).order_by("-generated_at")
    if report_ids:
        reports_qs = reports_qs.filter(id__in=report_ids)
    reports = list(reports_qs)
    system_settings = get_system_settings()
    batch_label = _get_batch_label(batch)
    subject = _build_email_subject(batch_label, normalized_template_type)
    body = _build_email_body(
        template_type=normalized_template_type,
        batch_label=batch_label,
        batch=batch,
        report_count=len(reports),
        company_name=system_settings.company_name or "Finance Team",
        default_email_body_note=system_settings.default_email_body_note,
    )

    return {
        "batch_id": batch.id,
        "to_email": system_settings.cto_email or settings.CTO_EMAIL,
        "cc_email": system_settings.finance_head_email or settings.FINANCE_HEAD_EMAIL,
        "subject": subject,
        "body": body,
        "report_ids": [report.id for report in reports],
    }


def send_reimbursement_email(
    batch_id: int,
    report_ids: list[int],
    to_email: str,
    cc_email: str,
    subject: str,
    body: str,
    *,
    smart_reimbursement_upload=None,
    triggered_by=None,
    cc_emails: list[str] | None = None,
) -> EmailDispatchLog:
    batch = MonthlyReimbursementBatch.objects.filter(pk=batch_id).first()
    if not batch:
        raise ValueError("Reimbursement batch not found.")

    reports = list(GeneratedReport.objects.filter(id__in=report_ids).order_by("-generated_at"))
    normalized_cc_emails = [email.strip() for email in (cc_emails or []) if email and email.strip()]
    if cc_email and cc_email not in normalized_cc_emails:
        normalized_cc_emails.insert(0, cc_email)

    log = EmailDispatchLog.objects.create(
        batch=batch,
        smart_reimbursement_upload=smart_reimbursement_upload,
        triggered_by=triggered_by,
        subject=subject,
        body=body,
        to_email=to_email,
        cc_email=cc_email,
        cc_emails=normalized_cc_emails,
        status=EmailDispatchLog.Status.DRAFT,
    )
    if reports:
        log.attached_reports.set(reports)

    try:
        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email],
            cc=normalized_cc_emails,
        )
        for report in reports:
            email.attach_file(report.file.path)
        email.send(fail_silently=False)
        log.status = EmailDispatchLog.Status.SENT
        log.sent_at = timezone.now()
        log.error_message = ""
    except Exception as exc:
        log.status = EmailDispatchLog.Status.FAILED
        log.error_message = _format_smtp_error(exc)

    log.save(update_fields=["status", "sent_at", "error_message", "updated_at"])
    return log


def send_smtp_test_email(test_to_email: str) -> dict:
    subject = "ReimburIQ SMTP Test"
    body = (
        "This is a test email from ReimburIQ.\n\n"
        "Your SMTP configuration is being verified before sending reimbursement reports."
    )

    try:
        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[test_to_email],
        )
        email.send(fail_silently=False)
        return {"success": True, "message": "SMTP test email sent successfully."}
    except Exception as exc:
        return {"success": False, "message": _format_smtp_error(exc)}
