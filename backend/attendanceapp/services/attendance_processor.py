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

from datetime import datetime, time

def _setting_time(value):
    if isinstance(value, time):
        return value
    return datetime.strptime(str(value), "%H:%M").time()


def _calculate_lunch_overlap(punch_in, punch_out, settings_obj):
    """Calculate overlap between employee working hours and configured lunch window."""
    if not punch_in or not punch_out:
        return 0
    local_in = timezone.localtime(punch_in)
    local_out = timezone.localtime(punch_out)
    
    lunch_start_t = _setting_time(getattr(settings_obj, 'lunch_start_time', '13:00'))
    lunch_end_t = _setting_time(getattr(settings_obj, 'lunch_end_time', '14:00'))

    lunch_start = timezone.make_aware(
        datetime.combine(local_in.date(), lunch_start_t),
        timezone.get_current_timezone(),
    )
    lunch_end = timezone.make_aware(
        datetime.combine(local_in.date(), lunch_end_t),
        timezone.get_current_timezone(),
    )
    
    overlap_start = max(local_in, lunch_start)
    overlap_end = min(local_out, lunch_end)
    if overlap_end <= overlap_start:
        return 0
    return int((overlap_end - overlap_start).total_seconds())

# def _build_attendance_row(employee_code, attendance_date, punch_entries, settings_obj):
#     """
#     Multi-device pairing:
#     - Merges punches from ALL devices for this employee/date
#     - Sort by time, dedupe near-duplicates
#     - First punch = Punch In, Last punch = Punch Out
#     - Middle punches = potential break inference (like single-device)
#     """
#     existing = DailyAttendance.objects.filter(
#         attendance_date=attendance_date,
#         employee_code=employee_code,
#     ).first()
#     if existing and getattr(existing, "is_manual_override", False):
#         return existing

#     # Extract just the datetime objects (whether entries are dicts or datetimes)
#     if punch_entries and isinstance(punch_entries[0], dict):
#         raw_times = [e["punch_time"] for e in punch_entries]
#     else:
#         raw_times = list(punch_entries)

#     clean_punches = remove_duplicate_punches(
#         raw_times, settings_obj.duplicate_punch_ignore_seconds
#     )
#     if not clean_punches:
#         return None

#     punch_in = clean_punches[0]
#     punch_out = clean_punches[-1] if len(clean_punches) > 1 else None
#     total_punches = len(clean_punches)
#     missing_punch = punch_out is None

#     working_time = timedelta()
#     if punch_in and punch_out:
#         working_time = punch_out - punch_in

#     inferred_break_seconds = int(calculate_break_time(clean_punches).total_seconds())
#     lunch_overlap_seconds = (
#         _calculate_lunch_overlap(punch_in, punch_out, settings_obj)
#         if punch_in and punch_out else 0
#     )
#     total_break_seconds = max(inferred_break_seconds, lunch_overlap_seconds)
#     net_working_time = max(working_time - timedelta(seconds=total_break_seconds), timedelta())

#     local_punch_in = timezone.localtime(punch_in) if punch_in else None
#     local_punch_out = timezone.localtime(punch_out) if punch_out else None
#     is_late = bool(local_punch_in and local_punch_in.time() > settings_obj.shift_in_time)
#     is_early_exit = bool(local_punch_out and local_punch_out.time() < settings_obj.shift_out_time)

#     hrms_employee = find_hrms_employee_by_code(employee_code)
#     employee_name = get_employee_display_name(hrms_employee)

#     attendance, _ = DailyAttendance.objects.update_or_create(
#         attendance_date=attendance_date,
#         employee_code=employee_code,
#         defaults={
#             "employee": hrms_employee,
#             "employee_name": employee_name,
#             "punch_in": punch_in,
#             "punch_out": punch_out,
#             "total_punches": total_punches,
#             "working_hours_seconds": int(working_time.total_seconds()),
#             "break_time_seconds": total_break_seconds,
#             "net_working_hours_seconds": int(net_working_time.total_seconds()),
#             "is_late": is_late,
#             "is_early_exit": is_early_exit,
#             "missing_punch": missing_punch,
#             "status": (
#                 DailyAttendance.STATUS_MISSING if missing_punch
#                 else DailyAttendance.STATUS_PRESENT
#             ),
#         },
#     )
#     return attendance

def _build_attendance_row(employee_code, attendance_date, punch_entries, settings_obj):
    """
    Build/update a DailyAttendance row for one employee on one date.
    Correctly separates IN punches from OUT punches so IN punches never appear in Punch Out.
    """
    existing = DailyAttendance.objects.filter(
        attendance_date=attendance_date,
        employee_code=employee_code,
    ).first()
    if existing and getattr(existing, "is_manual_override", False):
        return existing

    if not punch_entries:
        return None

    # Detect if punch_entries contains device_role (dicts) or just datetimes
    is_dict = isinstance(punch_entries[0], dict)
    
    if is_dict:
        # Separate punches by device role
        in_punches = sorted([e["punch_time"] for e in punch_entries if e.get("device_role") in ("PUNCH_IN", "BOTH")])
        out_punches = sorted([e["punch_time"] for e in punch_entries if e.get("device_role") in ("PUNCH_OUT", "BOTH")])
        all_times = sorted([e["punch_time"] for e in punch_entries])
    else:
        all_times = remove_duplicate_punches(punch_entries, settings_obj.duplicate_punch_ignore_seconds)
        in_punches = all_times
        out_punches = all_times

    if not all_times:
        return None

    # 1. PUNCH IN: Always the earliest punch of the day
    punch_in = in_punches[0] if in_punches else all_times[0]

    # 2. PUNCH OUT: Must be an EXIT punch (PUNCH_OUT device or EVEN-numbered punch)
    punch_out = None
    if is_dict and any(e.get("device_role") == "PUNCH_OUT" for e in punch_entries):
        # Dedicated device setup: Take latest punch from PUNCH_OUT device
        out_device_punches = sorted([e["punch_time"] for e in punch_entries if e.get("device_role") == "PUNCH_OUT"])
        if out_device_punches:
            punch_out = out_device_punches[-1]
    else:
        # BOTH devices / Single device setup: Take latest EVEN-numbered punch
        total_count = len(all_times)
        if total_count >= 2:
            if total_count % 2 == 0:
                punch_out = all_times[-1]  # Even count (2, 4) -> Last punch is an OUT punch
            else:
                punch_out = all_times[-2]  # Odd count (3, 5) -> Second-to-last punch is the OUT punch

    total_punches = len(all_times)
    missing_punch = punch_out is None or punch_in is None

    working_time = timedelta()
    if punch_in and punch_out:
        working_time = punch_out - punch_in

    inferred_break_seconds = int(calculate_break_time(all_times).total_seconds()) if len(all_times) >= 4 else 0
    lunch_overlap_seconds = _calculate_lunch_overlap(punch_in, punch_out, settings_obj) if punch_in and punch_out else 0
    total_break_seconds = max(inferred_break_seconds, lunch_overlap_seconds)
    
    net_working_time = max(working_time - timedelta(seconds=total_break_seconds), timedelta())

    local_punch_in = timezone.localtime(punch_in) if punch_in else None
    local_punch_out = timezone.localtime(punch_out) if punch_out else None
    is_late = bool(local_punch_in and local_punch_in.time() > settings_obj.shift_in_time)
    is_early_exit = bool(local_punch_out and local_punch_out.time() < settings_obj.shift_out_time)

    hrms_employee = find_hrms_employee_by_code(employee_code)
    employee_name = get_employee_display_name(hrms_employee)

    attendance, _ = DailyAttendance.objects.update_or_create(
        attendance_date=attendance_date,
        employee_code=employee_code,
        defaults={
            "employee": hrms_employee,
            "employee_name": employee_name,
            "punch_in": punch_in,
            "punch_out": punch_out,
            "total_punches": total_punches,
            "working_hours_seconds": int(working_time.total_seconds()),
            "break_time_seconds": total_break_seconds,
            "net_working_hours_seconds": int(net_working_time.total_seconds()),
            "is_late": is_late,
            "is_early_exit": is_early_exit,
            "missing_punch": missing_punch,
            "status": DailyAttendance.STATUS_MISSING if missing_punch else DailyAttendance.STATUS_PRESENT,
        },
    )
    return attendance


# def persist_raw_logs(logs):
#     """Save raw punches to DB. Auto-links to HRMS Employee if match found."""
#     saved = 0
#     for log in logs:
#         employee_code = normalize_employee_code(log["employee_code"])
#         if not employee_code:
#             continue
#         punch_time = _make_aware(log["punch_time"])

#         # 🎯 HRMS INTEGRATION: Try to link to HRMS Employee
#         hrms_employee = find_hrms_employee_by_code(employee_code)

#         _, created = RawPunchLog.objects.get_or_create(
#             employee_code=employee_code,
#             punch_time=punch_time,
#             defaults={
#                 "punch_date": timezone.localtime(punch_time).date(),
#                 "raw_line": log.get("raw_line", ""),
#                 "employee": hrms_employee,
#             },
#         )
#         if created:
#             saved += 1
#     return saved

def persist_raw_logs(logs):
    """Save raw punches to DB. Preserves device_serial in raw_line for live presence tracking."""
    saved = 0
    for log in logs:
        employee_code = normalize_employee_code(log["employee_code"])
        if not employee_code:
            continue
        punch_time = _make_aware(log["punch_time"])

        hrms_employee = find_hrms_employee_by_code(employee_code)

        # Append device_serial to raw_line so live presence can read which machine was used
        raw_line = log.get("raw_line", "")
        device_serial = log.get("device_serial", "")
        if device_serial and f"| {device_serial}" not in raw_line:
            raw_line = f"{raw_line} | {device_serial}"

        _, created = RawPunchLog.objects.get_or_create(
            employee_code=employee_code,
            punch_time=punch_time,
            defaults={
                "punch_date": timezone.localtime(punch_time).date(),
                "raw_line": raw_line,
                "employee": hrms_employee,
            },
        )
        if created:
            saved += 1
    return saved

def process_attendance_period(logs, settings_obj, start_date, end_date):
    persist_raw_logs(logs)

    # Group ALL punches by (employee, date) — merge across all devices
    grouped_logs = defaultdict(list)
    for log in logs:
        employee_code = normalize_employee_code(log["employee_code"])
        if not employee_code:
            continue
        punch_time = _make_aware(log["punch_time"])
        attendance_date = timezone.localtime(punch_time).date()
        if start_date <= attendance_date <= end_date:
            grouped_logs[(employee_code, attendance_date)].append(punch_time)

    attendance_rows = []
    codes_by_date = defaultdict(list)
    for (employee_code, attendance_date), punch_times in grouped_logs.items():
        attendance = _build_attendance_row(
            employee_code, attendance_date, punch_times, settings_obj
        )
        if attendance:
            attendance_rows.append(attendance)
            codes_by_date[attendance_date].append(employee_code)

    current_date = start_date
    while current_date <= end_date:
        DailyAttendance.objects.filter(attendance_date=current_date).exclude(
            employee_code__in=codes_by_date.get(current_date, [])
        ).exclude(is_manual_override=True).delete()
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