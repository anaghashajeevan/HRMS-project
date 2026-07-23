"""
Live presence service — real-time attendance tracking.
"""

import logging

from django.utils import timezone

from attendanceapp.models import RawPunchLog
from .attendance_processor import persist_raw_logs
from .essl_service import call_essl_api, extract_str_data_list, parse_punch_logs


LIVE_STATUS_NOT_ARRIVED = "NOT_ARRIVED"
LIVE_STATUS_IN_OFFICE = "IN_OFFICE"
LIVE_STATUS_OUTSIDE = "OUTSIDE"
LIVE_STATUS_COMPLETED_DAY = "COMPLETED_DAY"
LIVE_DUPLICATE_IGNORE_SECONDS = 15

logger = logging.getLogger(__name__)


def clean_live_presence_punches(punch_times):
    clean_times = []
    for punch_time in sorted(punch_times):
        if not clean_times:
            clean_times.append(punch_time)
            continue

        difference = (punch_time - clean_times[-1]).total_seconds()
        if difference > LIVE_DUPLICATE_IGNORE_SECONDS:
            clean_times.append(punch_time)
    return clean_times


def _latest_completed_out_punch(punch_times, report_date, today):
    if len(punch_times) < 2:
        return None
    if report_date == today and len(punch_times) % 2:
        return punch_times[-2]
    return punch_times[-1]


def _presence_for_punches(punch_times, report_date, today):
    punch_count = len(punch_times)
    last_punch = punch_times[-1] if punch_times else None
    punch_in = punch_times[0] if punch_times else None
    punch_out = _latest_completed_out_punch(punch_times, report_date, today)

    if report_date != today:
        return {
            "live_status": LIVE_STATUS_COMPLETED_DAY,
            "current_presence_display": "Completed Day",
            "punch_count": punch_count,
            "last_punch_time": last_punch,
            "punch_in_time": punch_in,
            "punch_out_time": punch_out,
            "is_live_day": False,
        }

    if punch_count == 0:
        return {
            "live_status": LIVE_STATUS_NOT_ARRIVED,
            "current_presence_display": "Not Arrived",
            "punch_count": 0,
            "last_punch_time": None,
            "punch_in_time": None,
            "punch_out_time": None,
            "is_live_day": True,
        }

    if punch_count % 2:
        return {
            "live_status": LIVE_STATUS_IN_OFFICE,
            "current_presence_display": "In Office",
            "punch_count": punch_count,
            "last_punch_time": last_punch,
            "punch_in_time": punch_in,
            "punch_out_time": punch_out,
            "is_live_day": True,
        }

    return {
        "live_status": LIVE_STATUS_OUTSIDE,
        "current_presence_display": "Outside",
        "punch_count": punch_count,
        "last_punch_time": last_punch,
        "punch_in_time": punch_in,
        "punch_out_time": punch_out,
        "is_live_day": True,
    }


def build_live_presence_map(employee_codes, report_date, _settings_obj, today=None):
    today = today or timezone.localdate()
    codes = {code for code in employee_codes if code}
    grouped_punches = {code: [] for code in codes}

    raw_punches = (
        RawPunchLog.objects.filter(punch_date=report_date, employee_code__in=codes)
        .order_by("employee_code", "punch_time")
        .values_list("employee_code", "punch_time")
    )
    for employee_code, punch_time in raw_punches:
        grouped_punches.setdefault(employee_code, []).append(punch_time)

    presence_map = {}
    for employee_code in codes:
        raw_punches_list = grouped_punches.get(employee_code, [])
        clean_punches = clean_live_presence_punches(raw_punches_list)
        presence = _presence_for_punches(
            clean_punches,
            report_date,
            today,
        )
        presence_map[employee_code] = presence
    return presence_map


def sync_live_raw_punches(settings_obj, report_date):
    xml_text = call_essl_api(settings_obj, report_date)
    _, str_data = extract_str_data_list(xml_text)
    logs = parse_punch_logs(str_data)
    return persist_raw_logs(logs)