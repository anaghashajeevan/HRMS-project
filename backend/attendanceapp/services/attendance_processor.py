"""
Attendance processor — processes raw punch logs into daily attendance records.
Adapted for HRMS integration: uses HRMS Employee via employee_matcher.
"""

from collections import defaultdict
from datetime import timedelta
import logging

from django.utils import timezone

from attendanceapp.models import DailyAttendance, RawPunchLog, normalize_employee_code
from .employee_matcher import find_hrms_employee_by_code, get_employee_display_name

logger = logging.getLogger(__name__)


def remove_duplicate_punches(punch_times, duplicate_seconds):
    clean_times = []
    for punch_time in sorted(punch_times):
        if not clean_times:
            clean_times.append(punch_time)
            continue

        difference = (punch_time - clean_times[-1]).total_seconds()
        if difference > duplicate_seconds:
            clean_times.append(punch_time)
    return clean_times


def calculate_break_time(clean_punches):
    break_time = timedelta()
    for index in range(1, len(clean_punches) - 1, 2):
        next_index = index + 1
        if next_index >= len(clean_punches) - 1:
            break
        break_time += clean_punches[next_index] - clean_punches[index]
    return break_time


def _make_aware(punch_time):
    if timezone.is_aware(punch_time):
        return punch_time
    return timezone.make_aware(punch_time, timezone.get_default_timezone())


def _build_attendance_row(employee_code, attendance_date, punch_times, settings_obj):
    """
    Build/update a DailyAttendance row for one employee on one date.
    Uses HRMS Employee matcher to link employee + populate name.
    """
    clean_punches = remove_duplicate_punches(
        punch_times,
        settings_obj.duplicate_punch_ignore_seconds,
    )
    if not clean_punches:
        return None

    punch_in = clean_punches[0]
    punch_out = clean_punches[-1] if len(clean_punches) > 1 else None
    missing_punch = punch_out is None

    working_time = timedelta()
    if punch_in and punch_out:
        working_time = punch_out - punch_in

    break_time = calculate_break_time(clean_punches)
    middle_punches = clean_punches[1:-1]
    if len(middle_punches) % 2:
        logger.warning(
            "Ignoring unpaired intermediate punch for %s on %s while inferring break time.",
            employee_code,
            attendance_date,
        )
    net_working_time = max(working_time - break_time, timedelta())

    local_punch_in = timezone.localtime(punch_in) if punch_in else None
    local_punch_out = timezone.localtime(punch_out) if punch_out else None

    is_late = bool(local_punch_in and local_punch_in.time() > settings_obj.shift_in_time)
    is_early_exit = bool(
        local_punch_out and local_punch_out.time() < settings_obj.shift_out_time
    )

    # 🎯 HRMS INTEGRATION: Look up HRMS Employee via matcher
    hrms_employee = find_hrms_employee_by_code(employee_code)
    employee_name = get_employee_display_name(hrms_employee)

    attendance, _ = DailyAttendance.objects.update_or_create(
        attendance_date=attendance_date,
        employee_code=employee_code,
        defaults={
            "employee": hrms_employee,  # FK to HRMS Employee (or None)
            "employee_name": employee_name,
            "punch_in": punch_in,
            "punch_out": punch_out,
            "total_punches": len(clean_punches),
            "working_hours_seconds": int(working_time.total_seconds()),
            "break_time_seconds": int(break_time.total_seconds()),
            "net_working_hours_seconds": int(net_working_time.total_seconds()),
            "is_late": is_late,
            "is_early_exit": is_early_exit,
            "missing_punch": missing_punch,
            "status": DailyAttendance.STATUS_MISSING
            if missing_punch
            else DailyAttendance.STATUS_PRESENT,
        },
    )
    return attendance


def persist_raw_logs(logs):
    """Save raw punches to DB. Auto-links to HRMS Employee if match found."""
    saved = 0
    for log in logs:
        employee_code = normalize_employee_code(log["employee_code"])
        if not employee_code:
            continue
        punch_time = _make_aware(log["punch_time"])

        # 🎯 HRMS INTEGRATION: Try to link to HRMS Employee
        hrms_employee = find_hrms_employee_by_code(employee_code)

        _, created = RawPunchLog.objects.get_or_create(
            employee_code=employee_code,
            punch_time=punch_time,
            defaults={
                "punch_date": timezone.localtime(punch_time).date(),
                "raw_line": log.get("raw_line", ""),
                "employee": hrms_employee,
            },
        )
        if created:
            saved += 1
    return saved


def process_attendance_period(logs, settings_obj, start_date, end_date):
    persist_raw_logs(logs)

    grouped_logs = defaultdict(list)
    for log in logs:
        employee_code = normalize_employee_code(log["employee_code"])
        if not employee_code:
            continue
        punch_time = _make_aware(log["punch_time"])
        local_punch_time = timezone.localtime(punch_time)
        attendance_date = local_punch_time.date()
        if start_date <= attendance_date <= end_date:
            grouped_logs[(employee_code, attendance_date)].append(punch_time)

    attendance_rows = []
    codes_by_date = defaultdict(list)
    for (employee_code, attendance_date), punch_times in grouped_logs.items():
        attendance = _build_attendance_row(
            employee_code,
            attendance_date,
            punch_times,
            settings_obj,
        )
        if attendance:
            attendance_rows.append(attendance)
            codes_by_date[attendance_date].append(employee_code)

    current_date = start_date
    while current_date <= end_date:
        DailyAttendance.objects.filter(attendance_date=current_date).exclude(
            employee_code__in=codes_by_date.get(current_date, [])
        ).delete()
        current_date += timedelta(days=1)

    return sorted(attendance_rows, key=lambda row: (row.attendance_date, row.employee_code))


def process_attendance(logs, settings_obj, report_date):
    return process_attendance_period(logs, settings_obj, report_date, report_date)


def build_summary(attendance_rows, report_log=None):
    rows = list(attendance_rows)
    summary = {
        "total_employees_present": len(rows),
        "late_coming": sum(1 for row in rows if row.is_late),
        "early_exit": sum(1 for row in rows if row.is_early_exit),
        "missing_punch": sum(1 for row in rows if row.missing_punch),
        "total_break_seconds": sum(row.break_time_seconds for row in rows),
        "report_sent_status": "Not Sent",
        "last_sent_time": None,
    }
    if report_log:
        summary["report_sent_status"] = report_log.get_status_display()
        summary["last_sent_time"] = report_log.sent_at
    return summary


def format_duration(total_seconds):
    total_seconds = max(int(total_seconds or 0), 0)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    return f"{hours:02d}:{minutes:02d}"