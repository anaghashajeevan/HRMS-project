"""
Email sending service for attendance reports.
"""

import logging
import os
import re
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)


class EmailConfigurationError(Exception):
    pass


class EmailServiceError(Exception):
    pass


def _require(value, label):
    if not value:
        raise EmailConfigurationError(f"{label} is not configured.")
    return value


def parse_recipients(value):
    if not value:
        return []
    return [item.strip() for item in re.split(r"[;,]", value) if item.strip()]


def get_report_receiver_email():
    receiver = (os.getenv("CTO_EMAIL") or "").strip()
    logger.info(
        "Report receiver configured: %s receiver=%s",
        "yes" if receiver else "no",
        receiver,
    )
    if not receiver:
        raise EmailConfigurationError("CTO_EMAIL is not configured in .env.")
    return receiver


def _log_smtp_diagnostics(settings_obj, report_type):
    logger.info(
        "SMTP diagnostics: report_type=%s smtp_host=%s smtp_port=%s sender_email_configured=%s smtp_password_configured=%s cto_email_configured=%s",
        report_type,
        settings_obj.smtp_host or "",
        settings_obj.smtp_port,
        bool((settings_obj.sender_email or "").strip()),
        bool(settings_obj.get_smtp_password()),
        bool((os.getenv("CTO_EMAIL") or "").strip()),
    )


def _smtp_base_settings(settings_obj):
    return {
        "host": _require(settings_obj.smtp_host, "SMTP Host"),
        "port": settings_obj.smtp_port,
        "sender": _require(settings_obj.sender_email, "Sender Email"),
        "password": _require(settings_obj.get_smtp_password(), "SMTP password"),
    }


def _smtp_settings(settings_obj, report_type):
    _log_smtp_diagnostics(settings_obj, report_type)
    smtp = _smtp_base_settings(settings_obj)
    receiver = get_report_receiver_email()
    cc = parse_recipients(settings_obj.cc_emails)
    logger.info(
        "Preparing email: report_type=%s receiver=%s cc_count=%s",
        report_type,
        receiver,
        len(cc),
    )
    smtp.update({"receiver": receiver, "cc": cc})
    return smtp


def resolve_monthly_receiver(settings_obj):
    receiver = get_report_receiver_email()
    logger.info(
        "Monthly receiver selection: report_type=MONTHLY receiver=%s legacy_monthly_receiver_configured=%s legacy_general_receiver_configured=%s",
        receiver,
        bool((settings_obj.monthly_report_receiver_email or "").strip()),
        bool((settings_obj.report_receiver_email or "").strip()),
    )
    return receiver, False


def _send_message(settings_obj, message):
    smtp = _smtp_base_settings(settings_obj)
    try:
        server = smtplib.SMTP(smtp["host"], smtp["port"], timeout=30)
    except (OSError, smtplib.SMTPException) as exc:
        logger.exception("SMTP connection failed.")
        raise EmailServiceError(
            "SMTP connection failed. Check SMTP host, port, and network access."
        ) from exc

    with server:
        try:
            server.starttls()
        except (OSError, smtplib.SMTPException) as exc:
            logger.exception("SMTP TLS failed.")
            raise EmailServiceError(
                "SMTP TLS failed. Check STARTTLS support for the configured port."
            ) from exc

        try:
            server.login(smtp["sender"], smtp["password"])
        except (OSError, smtplib.SMTPException) as exc:
            logger.exception("SMTP authentication failed.")
            raise EmailServiceError(
                "SMTP authentication failed. Check sender email and SMTP password."
            ) from exc

        try:
            server.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            logger.exception("SMTP delivery failed.")
            raise EmailServiceError("SMTP delivery failed.") from exc


def send_attendance_report(settings_obj, report_date, summary, report_path):
    smtp = _smtp_settings(settings_obj, "DAILY")
    subject = f"Daily Attendance Report - {report_date:%Y-%m-%d}"
    body = f"""Dear Mam,

Please find attached the daily attendance report for {report_date:%Y-%m-%d}.

Summary:
Total Employees Present: {summary["total_employees_present"]}
Late Coming: {summary["late_coming"]}
Early Exit: {summary["early_exit"]}
Missing Punch: {summary["missing_punch"]}

This is an automated attendance report generated from the eSSL AiFace-Orcus punch logs.

Regards,
Attendance Automation System
"""

    message = EmailMessage()
    message["From"] = smtp["sender"]
    message["To"] = smtp["receiver"]
    if smtp["cc"]:
        message["Cc"] = ", ".join(smtp["cc"])
    message["Subject"] = subject
    message.set_content(body)

    with open(report_path, "rb") as file:
        message.add_attachment(
            file.read(),
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=report_path.name,
        )

    _send_message(settings_obj, message)


def send_monthly_attendance_report(settings_obj, month_label, summary, report_path):
    receiver, _ = resolve_monthly_receiver(settings_obj)
    _log_smtp_diagnostics(settings_obj, "MONTHLY")
    smtp = _smtp_base_settings(settings_obj)
    cc = parse_recipients(settings_obj.monthly_cc_emails)
    subject = f"Monthly Attendance Report - {month_label}"
    logger.info(
        "Preparing email: report_type=MONTHLY subject=%s receiver=%s cc_count=%s",
        subject,
        receiver,
        len(cc),
    )
    body = f"""Dear Sir,

Please find attached the Monthly Attendance Report for {month_label}.

Summary:
Company: NL Technology
Monthly Days: {summary["monthly_days"]}
Week Off Days: {summary["week_off_days"]}
Week Off Present Days: {summary.get("week_off_present_days", 0)}
Working Days: {summary["working_days"]}
Total Employees: {summary["employees_count"]}
Present Days: {summary["attendance_days"]}
Absent Days: {summary["absent_days"]}
Missing Punch Days: {summary["missing_punch_days"]}

The report includes employee-wise attendance summary, daily punch details, department summary, and exception details.

Regards,
Attendance Automation System
"""

    message = EmailMessage()
    message["From"] = smtp["sender"]
    message["To"] = receiver
    if cc:
        message["Cc"] = ", ".join(cc)
    message["Subject"] = subject
    message.set_content(body)

    with open(report_path, "rb") as file:
        message.add_attachment(
            file.read(),
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=report_path.name,
        )

    _send_message(settings_obj, message)
    return receiver, cc


def send_test_email(settings_obj):
    smtp = _smtp_settings(settings_obj, "TEST")
    message = EmailMessage()
    message["From"] = smtp["sender"]
    message["To"] = smtp["receiver"]
    if smtp["cc"]:
        message["Cc"] = ", ".join(smtp["cc"])
    message["Subject"] = "Attendance Automation Test Email"
    message.set_content(
        "This is a test email from the Attendance Automation System."
    )
    _send_message(settings_obj, message)