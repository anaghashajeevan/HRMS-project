# """
# Live presence service — real-time attendance tracking.
# """

# import logging

# from django.utils import timezone

# from attendanceapp.models import RawPunchLog
# from .attendance_processor import persist_raw_logs
# from .essl_service import call_essl_api, extract_str_data_list, parse_punch_logs


# LIVE_STATUS_NOT_ARRIVED = "NOT_ARRIVED"
# LIVE_STATUS_IN_OFFICE = "IN_OFFICE"
# LIVE_STATUS_OUTSIDE = "OUTSIDE"
# LIVE_STATUS_COMPLETED_DAY = "COMPLETED_DAY"
# LIVE_DUPLICATE_IGNORE_SECONDS = 60

# logger = logging.getLogger(__name__)


# def clean_live_presence_punches(punch_times):
#     clean_times = []
#     for punch_time in sorted(punch_times):
#         if not clean_times:
#             clean_times.append(punch_time)
#             continue

#         difference = (punch_time - clean_times[-1]).total_seconds()
#         if difference > LIVE_DUPLICATE_IGNORE_SECONDS:
#             clean_times.append(punch_time)
#     return clean_times


# def _latest_completed_out_punch(punch_times, report_date, today):
#     if len(punch_times) < 2:
#         return None
#     if report_date == today and len(punch_times) % 2:
#         return punch_times[-2]
#     return punch_times[-1]


# def _presence_for_punches(punch_times, report_date, today):
#     punch_count = len(punch_times)
#     last_punch = punch_times[-1] if punch_times else None
#     punch_in = punch_times[0] if punch_times else None
#     punch_out = _latest_completed_out_punch(punch_times, report_date, today)

#     if report_date != today:
#         return {
#             "live_status": LIVE_STATUS_COMPLETED_DAY,
#             "current_presence_display": "Completed Day",
#             "punch_count": punch_count,
#             "last_punch_time": last_punch,
#             "punch_in_time": punch_in,
#             "punch_out_time": punch_out,
#             "is_live_day": False,
#         }

#     if punch_count == 0:
#         return {
#             "live_status": LIVE_STATUS_NOT_ARRIVED,
#             "current_presence_display": "Not Arrived",
#             "punch_count": 0,
#             "last_punch_time": None,
#             "punch_in_time": None,
#             "punch_out_time": None,
#             "is_live_day": True,
#         }

#     if punch_count % 2:
#         return {
#             "live_status": LIVE_STATUS_IN_OFFICE,
#             "current_presence_display": "In Office",
#             "punch_count": punch_count,
#             "last_punch_time": last_punch,
#             "punch_in_time": punch_in,
#             "punch_out_time": punch_out,
#             "is_live_day": True,
#         }

#     return {
#         "live_status": LIVE_STATUS_OUTSIDE,
#         "current_presence_display": "Outside",
#         "punch_count": punch_count,
#         "last_punch_time": last_punch,
#         "punch_in_time": punch_in,
#         "punch_out_time": punch_out,
#         "is_live_day": True,
#     }


# def build_live_presence_map(employee_codes, report_date, _settings_obj, today=None):
#     today = today or timezone.localdate()
#     codes = {code for code in employee_codes if code}
#     grouped_punches = {code: [] for code in codes}

#     raw_punches = (
#         RawPunchLog.objects.filter(punch_date=report_date, employee_code__in=codes)
#         .order_by("employee_code", "punch_time")
#         .values_list("employee_code", "punch_time")
#     )
#     for employee_code, punch_time in raw_punches:
#         grouped_punches.setdefault(employee_code, []).append(punch_time)

#     presence_map = {}
#     for employee_code in codes:
#         raw_punches_list = grouped_punches.get(employee_code, [])
#         clean_punches = clean_live_presence_punches(raw_punches_list)
#         presence = _presence_for_punches(
#             clean_punches,
#             report_date,
#             today,
#         )
#         presence_map[employee_code] = presence
#     return presence_map


# from datetime import datetime, time as dtime
# from .essl_service import fetch_logs_for_range
# from .attendance_processor import persist_raw_logs

# def sync_live_raw_punches(settings_obj, report_date):
#     try:
#         mode, logs = fetch_logs_for_range(
#             datetime.combine(report_date, dtime.min),
#             datetime.combine(report_date, dtime(23, 59, 59)),
#         )
#     except Exception:
#         raise
#     return persist_raw_logs(logs)



"""
Live presence service — real-time attendance tracking.
Supports single & multi-device setups (In, Out, and Both roles).
"""

import logging
from datetime import datetime, time as dtime
from django.utils import timezone

from attendanceapp.models import RawPunchLog, EsslDevice, AutomationSettings
from .attendance_processor import persist_raw_logs
from .essl_service import fetch_logs_for_range

LIVE_STATUS_NOT_ARRIVED = "NOT_ARRIVED"
LIVE_STATUS_IN_OFFICE = "IN_OFFICE"
LIVE_STATUS_OUTSIDE = "OUTSIDE"
LIVE_STATUS_COMPLETED_DAY = "COMPLETED_DAY"

logger = logging.getLogger(__name__)


def _latest_completed_out_punch(punch_records, report_date, today):
    if len(punch_records) < 2:
        return None
    if report_date == today and len(punch_records) % 2:
        return punch_records[-2]["punch_time"]
    return punch_records[-1]["punch_time"]


# def _presence_for_punches(punch_records, report_date, today, active_devices_by_serial):
#     """
#     Determine live presence status:
#     - Last punch on PUNCH_IN device  -> "In Office"
#     - Last punch on PUNCH_OUT device -> "Outside"
#     - Last punch on BOTH device      -> Odd count = "In Office", Even count = "Outside"
#     """
#     punch_count = len(punch_records)
#     last_record = punch_records[-1] if punch_records else None
#     last_punch = last_record["punch_time"] if last_record else None
#     punch_in = punch_records[0]["punch_time"] if punch_records else None
#     punch_out = _latest_completed_out_punch(punch_records, report_date, today)

#     if report_date != today:
#         return {
#             "live_status": LIVE_STATUS_COMPLETED_DAY,
#             "current_presence_display": "Completed Day",
#             "punch_count": punch_count,
#             "last_punch_time": last_punch,
#             "punch_in_time": punch_in,
#             "punch_out_time": punch_out,
#             "is_live_day": False,
#         }

#     if punch_count == 0:
#         return {
#             "live_status": LIVE_STATUS_NOT_ARRIVED,
#             "current_presence_display": "Not Arrived",
#             "punch_count": 0,
#             "last_punch_time": None,
#             "punch_in_time": None,
#             "punch_out_time": None,
#             "is_live_day": True,
#         }

#     # Determine device role of the LAST punch
#     last_serial = last_record.get("device_serial", "") if last_record else ""
#     device = active_devices_by_serial.get(last_serial)
#     last_role = device.role if device else "BOTH"

#     # Rule 1: Last punch on a PUNCH_IN device -> ALWAYS In Office
#     if last_role == EsslDevice.ROLE_PUNCH_IN:
#         return {
#             "live_status": LIVE_STATUS_IN_OFFICE,
#             "current_presence_display": "In Office",
#             "punch_count": punch_count,
#             "last_punch_time": last_punch,
#             "punch_in_time": punch_in,
#             "punch_out_time": punch_out,
#             "is_live_day": True,
#         }

#     # Rule 2: Last punch on a PUNCH_OUT device -> ALWAYS Outside
#     if last_role == EsslDevice.ROLE_PUNCH_OUT:
#         return {
#             "live_status": LIVE_STATUS_OUTSIDE,
#             "current_presence_display": "Outside",
#             "punch_count": punch_count,
#             "last_punch_time": last_punch,
#             "punch_in_time": punch_in,
#             "punch_out_time": punch_out,
#             "is_live_day": True,
#         }

#     # Rule 3: Last punch on a BOTH device -> ODD = In Office, EVEN = Outside
#     if punch_count % 2 != 0:
#         return {
#             "live_status": LIVE_STATUS_IN_OFFICE,
#             "current_presence_display": "In Office",
#             "punch_count": punch_count,
#             "last_punch_time": last_punch,
#             "punch_in_time": punch_in,
#             "punch_out_time": punch_out,
#             "is_live_day": True,
#         }

#     return {
#         "live_status": LIVE_STATUS_OUTSIDE,
#         "current_presence_display": "Outside",
#         "punch_count": punch_count,
#         "last_punch_time": last_punch,
#         "punch_in_time": punch_in,
#         "punch_out_time": punch_out,
#         "is_live_day": True,
#     }

def _presence_for_punches(punch_records, report_date, today, active_devices_by_serial):
    """
    Determine live presence status and accurately extract punch_in and punch_out.
    """
    punch_count = len(punch_records)
    last_record = punch_records[-1] if punch_records else None
    last_punch = last_record["punch_time"] if last_record else None
    punch_in = punch_records[0]["punch_time"] if punch_records else None

    # Calculate Punch Out (Only select actual exit punches)
    punch_out = None
    if punch_count >= 2:
        # Check if any punch was from a dedicated PUNCH_OUT device
        out_device_records = [
            r for r in punch_records 
            if active_devices_by_serial.get(r.get("device_serial", ""), None) 
            and active_devices_by_serial[r["device_serial"]].role == EsslDevice.ROLE_PUNCH_OUT
        ]
        if out_device_records:
            punch_out = out_device_records[-1]["punch_time"]
        else:
            # BOTH device setup: If count is odd (1, 3), punch_out is the last EVEN punch [-2]
            if punch_count % 2 != 0:
                punch_out = punch_records[-2]["punch_time"]
            else:
                punch_out = punch_records[-1]["punch_time"]

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

    # Determine device role of the LAST punch
    last_serial = last_record.get("device_serial", "") if last_record else ""
    device = active_devices_by_serial.get(last_serial)
    last_role = device.role if device else "BOTH"

    if last_role == EsslDevice.ROLE_PUNCH_IN:
        return {
            "live_status": LIVE_STATUS_IN_OFFICE,
            "current_presence_display": "In Office",
            "punch_count": punch_count,
            "last_punch_time": last_punch,
            "punch_in_time": punch_in,
            "punch_out_time": punch_out,
            "is_live_day": True,
        }

    if last_role == EsslDevice.ROLE_PUNCH_OUT:
        return {
            "live_status": LIVE_STATUS_OUTSIDE,
            "current_presence_display": "Outside",
            "punch_count": punch_count,
            "last_punch_time": last_punch,
            "punch_in_time": punch_in,
            "punch_out_time": punch_out,
            "is_live_day": True,
        }

    # BOTH device logic (Odd = In Office, Even = Outside)
    if punch_count % 2 != 0:
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


def build_live_presence_map(employee_codes, report_date, settings_obj=None, today=None):
    today = today or timezone.localdate()
    settings_obj = settings_obj or AutomationSettings.get_solo()
    ignore_seconds = getattr(settings_obj, "duplicate_punch_ignore_seconds", 60)

    codes = {code for code in employee_codes if code}
    grouped_punches = {code: [] for code in codes}

    # Map of active devices by serial number
    active_devices = EsslDevice.objects.filter(is_active=True)
    active_devices_by_serial = {d.serial_number: d for d in active_devices}

    # Query raw punches for the date
    raw_punches = (
        RawPunchLog.objects.filter(punch_date=report_date, employee_code__in=codes)
        .order_by("employee_code", "punch_time")
        .values("employee_code", "punch_time", "raw_line")
    )

    for item in raw_punches:
        code = item["employee_code"]
        raw_line = item.get("raw_line", "")
        device_serial = ""
        if " | " in raw_line:
            device_serial = raw_line.split(" | ")[-1].strip()

        grouped_punches.setdefault(code, []).append({
            "punch_time": item["punch_time"],
            "raw_line": raw_line,
            "device_serial": device_serial,
        })

    presence_map = {}
    for employee_code in codes:
        records_list = grouped_punches.get(employee_code, [])

        # Clean duplicate/rapid scans within duplicate threshold
        clean_records = []
        for rec in sorted(records_list, key=lambda x: x["punch_time"]):
            if not clean_records:
                clean_records.append(rec)
                continue
            if (rec["punch_time"] - clean_records[-1]["punch_time"]).total_seconds() > ignore_seconds:
                clean_records.append(rec)

        presence = _presence_for_punches(
            clean_records,
            report_date,
            today,
            active_devices_by_serial,
        )
        presence_map[employee_code] = presence

    return presence_map


def sync_live_raw_punches(settings_obj, report_date):
    """Sync raw punches from all active devices into DB."""
    try:
        mode, logs = fetch_logs_for_range(
            datetime.combine(report_date, dtime.min),
            datetime.combine(report_date, dtime(23, 59, 59)),
        )
        if logs:
            return persist_raw_logs(logs)
    except Exception as exc:
        logger.warning("Live sync error: %s", exc)
    return 0