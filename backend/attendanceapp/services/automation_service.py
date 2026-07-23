"""
Daily attendance automation orchestrator.
"""

import logging

from django.db import transaction
from django.utils import timezone

from attendanceapp.models import AutomationSettings, DailyAttendance, EmailReportLog

from .attendance_processor import build_summary, process_attendance
from .email_service import send_attendance_report
from .essl_service import call_essl_api, extract_str_data_list, parse_punch_logs
from .report_service import generate_excel_report

logger = logging.getLogger(__name__)


class AttendanceAutomationError(Exception):
    pass


def run_attendance_automation(report_date=None, force_send=False):
    report_date = report_date or timezone.localdate()
    settings_obj = AutomationSettings.get_solo()
    steps = []

    def mark(step):
        steps.append(step)

    log, _ = EmailReportLog.objects.get_or_create(
        report_date=report_date,
        defaults={"status": EmailReportLog.STATUS_SKIPPED},
    )

    if log.status == EmailReportLog.STATUS_SUCCESS and not force_send:
        return {
            "ok": True,
            "skipped": True,
            "message": "Today's attendance report has already been sent.",
            "steps": ["Completed"],
            "log": log,
        }

    try:
        mark("Connecting to eSSL API")
        xml_text = call_essl_api(settings_obj, report_date)

        mark("Fetching Logs")
        _, str_data = extract_str_data_list(xml_text)
        if not str_data:
            raise AttendanceAutomationError("No punch logs received from eSSL API.")

        logs = parse_punch_logs(str_data)
        if not logs:
            raise AttendanceAutomationError("No valid punch logs found in eSSL response.")

        mark("Processing Attendance")
        with transaction.atomic():
            attendance_rows = process_attendance(logs, settings_obj, report_date)

        if not attendance_rows:
            raise AttendanceAutomationError("No attendance rows were generated for today.")

        mark("Generating Excel")
        summary = build_summary(attendance_rows)
        report_file_name, report_path = generate_excel_report(attendance_rows, report_date)

        if not settings_obj.enable_daily_report_email:
            mark("Completed")
            log.status = EmailReportLog.STATUS_SKIPPED
            log.report_file.name = report_file_name
            log.error_message = "Daily Report Email is disabled."
            log.total_employees_present = summary["total_employees_present"]
            log.late_coming = summary["late_coming"]
            log.early_exit = summary["early_exit"]
            log.missing_punch = summary["missing_punch"]
            log.total_break_seconds = summary["total_break_seconds"]
            log.save()
            return {
                "ok": True,
                "skipped": True,
                "message": "Attendance report generated. Daily Report Email is disabled.",
                "steps": steps,
                "log": log,
            }

        mark("Sending Email")
        send_attendance_report(settings_obj, report_date, summary, report_path)

        mark("Completed")
        log.mark_success(summary, report_file_name)
        return {
            "ok": True,
            "skipped": False,
            "message": "Attendance automation completed successfully.",
            "steps": steps,
            "log": log,
        }
    except Exception as exc:
        logger.exception("Attendance automation failed.")
        clean_error = str(exc) or "Attendance automation failed."
        log.mark_failed(clean_error)
        return {
            "ok": False,
            "skipped": False,
            "message": clean_error,
            "steps": steps,
            "log": log,
        }


def latest_attendance_for(report_date=None):
    report_date = report_date or timezone.localdate()
    rows = DailyAttendance.objects.filter(attendance_date=report_date)
    log = EmailReportLog.objects.filter(report_date=report_date).first()
    return rows, log, build_summary(rows, log)