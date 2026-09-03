from django.shortcuts import render

# Create your views here.
"""
Attendance app DRF views.
JSON APIs for React SPA (JWT authenticated).
"""

import logging
import os
from datetime import datetime

from django.http import FileResponse, Http404
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from HRMSapp.permissions import IsHRAdmin, IsSystemAdmin

from .models import (
    AutomationSettings,
    DailyAttendance,
    EmailReportLog,
    MonthlyReportLog,
    RawPunchLog,
)
from .serializers import (
    AutomationSettingsSerializer,
    DailyAttendanceSerializer,
    MonthlyReportLogSerializer,
)
from .services.attendance_processor import format_duration
from .services.automation_service import latest_attendance_for, run_attendance_automation
from .services.email_service import (
    EmailConfigurationError,
    get_report_receiver_email,
    send_test_email,
)
from .services.essl_service import test_connection
from .services.live_presence_service import (
    build_live_presence_map,
    sync_live_raw_punches,
)
from .services.monthly_report_service import (
    collect_monthly_attendance,
    generate_monthly_report,
    run_monthly_attendance_automation,
    send_monthly_report,
)

logger = logging.getLogger(__name__)


# ==============================================================================
# HELPERS
# ==============================================================================

def _format_time_value(value, fallback="-"):
    if not value:
        return fallback
    return timezone.localtime(value).strftime("%H:%M:%S")


def _report_receiver_display():
    try:
        return get_report_receiver_email()
    except EmailConfigurationError:
        return ""


def _get_hrms_active_employees():
    from HRMSapp.models import Employee as HRMSEmployee
    return HRMSEmployee.objects.filter(
        is_deleted=False,
        status__in=['ACTIVE', 'PROBATION'],
    ).select_related('structure_location').order_by('employee_id')


def _build_employee_lookup(hrms_employees):
    return {emp.employee_id: emp for emp in hrms_employees}


def _attendance_row_payload(row, hrms_employee, presence):
    if presence["is_live_day"]:
        punch_in = _format_time_value(presence["punch_in_time"]) if presence["punch_in_time"] else "-"
        punch_out = _format_time_value(presence["punch_out_time"]) if presence["punch_out_time"] else "-"
    else:
        punch_in = _format_time_value(row.punch_in) if row else "-"
        punch_out = _format_time_value(row.punch_out) if row else "-"

    last_punch_time = _format_time_value(presence["last_punch_time"], fallback="")

    employee_name = (
        row.employee_name
        if row
        else (hrms_employee.full_name if hrms_employee else "Unknown Employee")
    )
    employee_code = row.employee_code if row else (hrms_employee.employee_id if hrms_employee else "")
    status_display = row.get_status_display() if row else presence["current_presence_display"]

    return {
        "employeeCode": employee_code,
        "employeeName": employee_name,
        "punchIn": punch_in,
        "punchOut": punch_out,
        "workingHours": format_duration(row.working_hours_seconds) if row else "00:00",
        "breakTime": format_duration(row.break_time_seconds) if row else "00:00",
        "netWorkingHours": format_duration(row.net_working_hours_seconds) if row else "00:00",
        "lateStatus": "Late" if row and row.is_late else "On Time",
        "earlyExit": "Yes" if row and row.is_early_exit else "No",
        "missingPunch": "Yes" if row and row.missing_punch else "No",
        "status": status_display,
        "isUnknownEmployee": employee_name == "Unknown Employee",
        "liveStatus": presence["live_status"],
        "punchCount": presence["punch_count"],
        "lastPunchTime": last_punch_time,
        "currentPresenceDisplay": presence["current_presence_display"],
    }


def _live_status_from_presence(row, presence):
    if row:
        return row.get_status_display()
    if presence["punch_count"] == 0:
        return "Not Arrived"
    return "Present"


def _live_presence_employee_payload(row, hrms_employee, presence):
    employee_code = row.employee_code if row else (hrms_employee.employee_id if hrms_employee else "")
    employee_name = (
        row.employee_name
        if row
        else (hrms_employee.full_name if hrms_employee else "Unknown Employee")
    )
    return {
        "employee_code": employee_code,
        "employee_name": employee_name,
        "punch_in": _format_time_value(presence["punch_in_time"]),
        "punch_out": _format_time_value(presence["punch_out_time"]),
        "break_time": format_duration(row.break_time_seconds) if row else "00:00",
        "net_hours": format_duration(row.net_working_hours_seconds) if row else "00:00",
        "missing_punch": bool(row.missing_punch) if row else False,
        "current_presence": presence["live_status"],
        "current_presence_display": presence["current_presence_display"],
        "last_punch_time": _format_time_value(presence["last_punch_time"], fallback=""),
        "status": _live_status_from_presence(row, presence),
    }


def _monthly_dashboard_payload(log, settings_obj):
    receiver_display = _report_receiver_display()
    if not log:
        return {
            "available": False,
            "status": "Not Generated",
            "periodLabel": "",
            "sentTo": receiver_display,
            "sentAt": "-",
            "downloadUrl": "",
            "employeesCount": 0,
            "attendanceDays": 0,
            "absentDays": 0,
            "missingPunchDays": 0,
            "totalWorkingHours": "00:00",
        }

    download_url = ""
    if log.report_file:
        download_url = f"/api/v1/attendance/reports/monthly/{log.id}/download/"

    payload = {
        "available": bool(log.report_file and log.status == MonthlyReportLog.STATUS_SUCCESS),
        "status": log.get_status_display(),
        "periodLabel": f"{log.month:02d}/{log.year}",
        "sentTo": log.sent_to or receiver_display,
        "sentAt": timezone.localtime(log.sent_at).strftime("%d %b %Y, %H:%M") if log.sent_at else "-",
        "downloadUrl": download_url,
        "employeesCount": 0,
        "attendanceDays": 0,
        "absentDays": 0,
        "missingPunchDays": 0,
        "totalWorkingHours": "00:00",
    }
    try:
        report = collect_monthly_attendance(log.year, log.month, settings_obj=settings_obj)
    except Exception:
        logger.exception("Could not build monthly dashboard summary.")
        return payload
    totals = report["totals"]
    payload.update({
        "periodLabel": report["period_label"],
        "employeesCount": totals["employees_count"],
        "attendanceDays": totals["attendance_days"],
        "absentDays": totals["absent_days"],
        "missingPunchDays": totals["missing_punch_days"],
        "totalWorkingHours": totals["total_working_hours"],
    })
    return payload


def _daily_download_url(log):
    if not log or not log.report_file:
        return ""
    return f"/api/v1/attendance/reports/daily/{log.id}/download/"


def _automation_report_types(settings_obj):
    daily_enabled = settings_obj.enable_daily_report_email
    monthly_enabled = settings_obj.enable_monthly_report
    if daily_enabled and monthly_enabled:
        mode = settings_obj.automation_run_mode
        if mode == AutomationSettings.AUTOMATION_RUN_DAILY:
            return ["DAILY"]
        if mode == AutomationSettings.AUTOMATION_RUN_BOTH:
            return ["DAILY", "MONTHLY"]
        return ["MONTHLY"]
    if daily_enabled:
        return ["DAILY"]
    if monthly_enabled:
        return ["MONTHLY"]
    return []


# ==============================================================================
# DASHBOARD VIEW
# ==============================================================================

class AttendanceDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_date = timezone.localdate()
        attendance_rows, report_log, summary = latest_attendance_for(report_date)
        settings_obj = AutomationSettings.get_solo()

        api_configured = all([
            settings_obj.essl_api_url,
            settings_obj.device_serial_number,
            settings_obj.api_username,
            settings_obj.get_api_password(),
        ])

        attendance_by_code = {row.employee_code: row for row in attendance_rows}
        hrms_employees = _get_hrms_active_employees()
        employee_lookup = _build_employee_lookup(hrms_employees)

        employee_codes = set(attendance_by_code.keys()) | set(employee_lookup.keys())
        presence_map = build_live_presence_map(employee_codes, report_date, settings_obj)

        rows = [
            _attendance_row_payload(
                attendance_by_code.get(code),
                employee_lookup.get(code),
                presence_map[code],
            )
            for code in sorted(employee_codes)
        ]

        latest_monthly_log = MonthlyReportLog.objects.filter(report_file__gt="").first()

        payload = {
            "reportDate": report_date.strftime("%d %b %Y"),
            "apiStatus": "Configured" if api_configured else "Needs Setup",
            "summary": {
                "totalEmployeesPresent": summary["total_employees_present"],
                "lateComing": summary["late_coming"],
                "earlyExit": summary["early_exit"],
                "missingPunch": summary["missing_punch"],
                "totalBreakTime": format_duration(summary["total_break_seconds"]),
                "reportSentStatus": summary["report_sent_status"],
                "lastSentTime": (
                    timezone.localtime(summary["last_sent_time"]).strftime("%H:%M")
                    if summary["last_sent_time"]
                    else "-"
                ),
            },
            "attendanceRows": rows,
            "monthlyReport": _monthly_dashboard_payload(latest_monthly_log, settings_obj),
            "downloadReportUrl": _daily_download_url(report_log),
        }
        return Response(payload)


# ==============================================================================
# LIVE PRESENCE VIEW
# ==============================================================================

class LivePresenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_date = timezone.localdate()
        settings_obj = AutomationSettings.get_solo()
        sync_warning = ""

        try:
            saved_count = sync_live_raw_punches(settings_obj, report_date)
            logger.info(
                "Live presence sync: date=%s raw_punches_saved=%s",
                report_date, saved_count,
            )
        except Exception as exc:
            logger.warning("Live presence device sync failed: %s", exc)
            sync_warning = "Live device sync failed. Showing latest saved data."

        attendance_by_code = {
            row.employee_code: row
            for row in DailyAttendance.objects.filter(attendance_date=report_date)
        }
        hrms_employees = _get_hrms_active_employees()
        employee_lookup = _build_employee_lookup(hrms_employees)
        raw_codes = set(
            RawPunchLog.objects.filter(punch_date=report_date).values_list("employee_code", flat=True)
        )

        employee_codes = set(attendance_by_code.keys()) | set(employee_lookup.keys()) | raw_codes
        presence_map = build_live_presence_map(employee_codes, report_date, settings_obj)

        employees = [
            _live_presence_employee_payload(
                attendance_by_code.get(code),
                employee_lookup.get(code),
                presence_map[code],
            )
            for code in sorted(employee_codes)
        ]

        summary = {
            "total_employees": len(employees),
            "in_office": sum(1 for e in employees if e["current_presence"] == "IN_OFFICE"),
            "outside": sum(1 for e in employees if e["current_presence"] == "OUTSIDE"),
            "not_arrived": sum(1 for e in employees if e["current_presence"] == "NOT_ARRIVED"),
        }

        payload = {
            "ok": True,
            "date": report_date.strftime("%Y-%m-%d"),
            "last_updated": timezone.localtime(timezone.now()).strftime("%H:%M:%S"),
            "summary": summary,
            "employees": employees,
        }
        if sync_warning:
            payload["warning"] = sync_warning
        return Response(payload)


# ==============================================================================
# RUN AUTOMATION VIEW
# ==============================================================================

class RunAutomationView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        settings_obj = AutomationSettings.get_solo()
        report_types = _automation_report_types(settings_obj)

        if not report_types:
            return Response(
                {
                    "ok": False,
                    "message": "No report type enabled. Enable Daily or Monthly Report in Settings.",
                    "steps": [], "report_type": "", "email_sent": False,
                    "download_url": "", "daily": None, "monthly": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_for_monthly = request.user if request.user.is_authenticated else None
        daily_result = None
        monthly_result = None

        if "DAILY" in report_types:
            daily_result = run_attendance_automation(force_send=True)
        if "MONTHLY" in report_types:
            monthly_result = run_monthly_attendance_automation(
                created_by=user_for_monthly, force_send=True,
            )

        results = [r for r in [daily_result, monthly_result] if r is not None]
        ok = all(r["ok"] for r in results)
        report_type = "BOTH" if len(report_types) == 2 else report_types[0]
        email_sent = any(r["ok"] and not r.get("skipped") for r in results)

        download_url = ""
        if report_type == "DAILY" and daily_result:
            download_url = _daily_download_url(daily_result["log"])
        elif report_type == "MONTHLY" and monthly_result and monthly_result.get("log"):
            log = monthly_result["log"]
            if log and log.report_file:
                download_url = f"/api/v1/attendance/reports/monthly/{log.id}/download/"

        message = "Attendance automation completed successfully."
        if report_type == "DAILY":
            message = daily_result["message"]
        elif report_type == "MONTHLY":
            message = monthly_result["message"]
        elif not ok:
            message = "One or more attendance reports failed."

        payload = {
            "ok": ok,
            "message": message,
            "steps": [step for r in results for step in r.get("steps", [])],
            "report_type": report_type,
            "email_sent": email_sent,
            "download_url": download_url,
            "daily_download_url": _daily_download_url(daily_result["log"]) if daily_result else "",
            "monthly_download_url": (
                f"/api/v1/attendance/reports/monthly/{monthly_result['log'].id}/download/"
                if monthly_result and monthly_result.get("log") and monthly_result["log"].report_file
                else ""
            ),
            "monthlyReport": (
                _monthly_dashboard_payload(monthly_result["log"], settings_obj)
                if monthly_result and monthly_result.get("log")
                else None
            ),
        }
        return Response(payload, status=status.HTTP_200_OK if ok else status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# SETTINGS VIEWS
# ==============================================================================

class AttendanceSettingsView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), IsHRAdmin()]
        return [IsAuthenticated(), IsSystemAdmin()]

    def get(self, request):
        settings_obj = AutomationSettings.get_solo()
        serializer = AutomationSettingsSerializer(settings_obj)
        data = serializer.data
        data['report_receiver_display'] = _report_receiver_display()
        data['report_receiver_configured'] = bool(_report_receiver_display())
        return Response(data)

    def patch(self, request):
        settings_obj = AutomationSettings.get_solo()
        serializer = AutomationSettingsSerializer(
            settings_obj, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        settings_obj.refresh_from_db()
        fresh_serializer = AutomationSettingsSerializer(settings_obj)
        data = fresh_serializer.data
        data['report_receiver_display'] = _report_receiver_display()
        data['report_receiver_configured'] = bool(_report_receiver_display())
        return Response({
            'ok': True,
            'message': 'Settings saved successfully.',
            'settings': data,
        })


class TestEsslConnectionView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        settings_obj = AutomationSettings.get_solo()
        try:
            result = test_connection(settings_obj)
            return Response({
                'ok': True,
                'message': f"eSSL connection successful. Logs found: {result['log_count']}.",
                'log_count': result['log_count'],
            })
        except Exception as exc:
            return Response(
                {'ok': False, 'message': str(exc) or 'eSSL connection failed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class SendTestEmailView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        settings_obj = AutomationSettings.get_solo()
        server_pid = os.getpid()
        cto_email = ""
        try:
            cto_email = get_report_receiver_email()
        except EmailConfigurationError:
            pass

        try:
            send_test_email(settings_obj)
            logger.info("Test email sent successfully. pid=%s", server_pid)
            return Response({
                'ok': True,
                'message': 'Test email sent successfully.',
                'sent_to': cto_email,
                'server_pid': server_pid,
            })
        except Exception as exc:
            root_exc = exc.__cause__ or exc
            return Response(
                {
                    'ok': False,
                    'message': str(exc) or 'Test email failed.',
                    'server_pid': server_pid,
                    'exception_class': root_exc.__class__.__name__,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


# ==============================================================================
# MONTHLY REPORT VIEWS
# ==============================================================================

def _parse_month_value(value):
    try:
        parsed = datetime.strptime(value, "%Y-%m")
    except (TypeError, ValueError) as exc:
        raise ValueError("Select a valid report month (format: YYYY-MM).") from exc
    return parsed.year, parsed.month


def _monthly_log_response(log):
    return {
        "status": log.get_status_display(),
        "lastSentTime": (
            timezone.localtime(log.sent_at).strftime("%d %b %Y, %H:%M")
            if log.sent_at else "-"
        ),
        "downloadUrl": (
            f"/api/v1/attendance/reports/monthly/{log.id}/download/"
            if log.report_file else ""
        ),
    }


class GenerateMonthlyReportView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        try:
            month_value = request.data.get('month')
            year, month = _parse_month_value(month_value)
            log, report = generate_monthly_report(year, month, created_by=request.user)
        except Exception as exc:
            return Response(
                {'ok': False, 'message': str(exc) or 'Monthly report generation failed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            'ok': True,
            'message': f"Monthly attendance report generated for {report['month_label']}.",
            'monthlyReport': _monthly_log_response(log),
        })


class SendMonthlyReportView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        try:
            month_value = request.data.get('month')
            year, month = _parse_month_value(month_value)
            result = send_monthly_report(year, month, created_by=request.user, manual_send=True)
        except Exception as exc:
            return Response(
                {'ok': False, 'message': str(exc) or 'Monthly report email failed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        response_status = status.HTTP_200_OK if result['ok'] else status.HTTP_400_BAD_REQUEST
        return Response({
            'ok': result['ok'],
            'message': result['message'],
            'monthlyReport': _monthly_log_response(result['log']),
        }, status=response_status)


class ListMonthlyReportsView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request):
        logs = MonthlyReportLog.objects.all()[:24]
        serializer = MonthlyReportLogSerializer(logs, many=True)
        return Response(serializer.data)


# ==============================================================================
# REPORT DOWNLOADS
# ==============================================================================

class DownloadDailyReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, log_id):
        try:
            report_log = EmailReportLog.objects.get(id=log_id)
        except EmailReportLog.DoesNotExist as exc:
            raise Http404("Report not found.") from exc

        if not report_log.report_file:
            raise Http404("Report file is not available.")

        return FileResponse(
            report_log.report_file.open("rb"),
            as_attachment=True,
            filename=report_log.report_file.name.split("/")[-1],
        )


class DownloadMonthlyReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, log_id):
        try:
            report_log = MonthlyReportLog.objects.get(id=log_id)
        except MonthlyReportLog.DoesNotExist as exc:
            raise Http404("Monthly report not found.") from exc

        if not report_log.report_file:
            raise Http404("Monthly report file is not available.")

        return FileResponse(
            report_log.report_file.open("rb"),
            as_attachment=True,
            filename=report_log.report_file.name.split("/")[-1],
        )


# # ==============================================================================
# # EMPLOYEE MY-ATTENDANCE VIEWS
# # ==============================================================================

# from datetime import date, datetime
# from .services.personal_attendance_service import (
#     get_monthly_attendance_for_employee,
#     get_day_detail_for_employee,
#     get_team_monthly_summary,
# )


# class MyAttendanceMonthView(APIView):
#     """Employee views their own attendance for a specific month."""
#     permission_classes = [IsAuthenticated]

#     def get(self, request):
#         user = request.user
#         if not hasattr(user, 'employee'):
#             return Response({'detail': 'No employee record linked'}, status=400)

#         year = int(request.query_params.get('year', timezone.now().year))
#         month = int(request.query_params.get('month', timezone.now().month))

#         try:
#             data = get_monthly_attendance_for_employee(user.employee, year, month)
#             return Response(data)
#         except Exception as exc:
#             logger.exception("Failed to load monthly attendance")
#             return Response({'detail': str(exc)}, status=500)


# class MyAttendanceDayView(APIView):
#     """Employee views detailed punch info for a single day."""
#     permission_classes = [IsAuthenticated]

#     def get(self, request):
#         user = request.user
#         if not hasattr(user, 'employee'):
#             return Response({'detail': 'No employee record linked'}, status=400)

#         date_str = request.query_params.get('date')
#         if not date_str:
#             return Response({'detail': 'date query param required (YYYY-MM-DD)'}, status=400)

#         try:
#             day = datetime.strptime(date_str, '%Y-%m-%d').date()
#         except ValueError:
#             return Response({'detail': 'Invalid date format. Use YYYY-MM-DD'}, status=400)

#         try:
#             data = get_day_detail_for_employee(user.employee, day)
#             return Response(data)
#         except Exception as exc:
#             logger.exception("Failed to load day detail")
#             return Response({'detail': str(exc)}, status=500)


# class TeamAttendanceMonthView(APIView):
#     """Manager views their team's monthly attendance summary."""
#     permission_classes = [IsAuthenticated]

#     def get(self, request):
#         user = request.user
#         if not hasattr(user, 'employee'):
#             return Response({'detail': 'No employee record linked'}, status=400)

#         # Allow managers + HR admins
#         if not (
#             user.has_role('MANAGER') or user.has_role('HR_ADMIN')
#             or user.has_role('SYSTEM_ADMIN')
#         ):
#             return Response({'detail': 'Only managers or HR can access team view'}, status=403)

#         year = int(request.query_params.get('year', timezone.now().year))
#         month = int(request.query_params.get('month', timezone.now().month))

#         # HR can specify any manager, others see own team
#         target_manager = user.employee
#         manager_id = request.query_params.get('manager_id')
#         if manager_id and (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
#             from HRMSapp.models import Employee
#             try:
#                 target_manager = Employee.objects.get(id=manager_id, is_deleted=False)
#             except Employee.DoesNotExist:
#                 return Response({'detail': 'Manager not found'}, status=404)

#         try:
#             data = get_team_monthly_summary(target_manager, year, month)
#             return Response(data)
#         except Exception as exc:
#             logger.exception("Failed to load team attendance")
#             return Response({'detail': str(exc)}, status=500)


# class EmployeeAttendanceMonthView(APIView):
#     """
#     Manager/HR views a specific employee's monthly attendance.
#     Manager can only view their own reportees.
#     """
#     permission_classes = [IsAuthenticated]

#     def get(self, request, employee_id):
#         user = request.user
#         if not hasattr(user, 'employee'):
#             return Response({'detail': 'No employee record linked'}, status=400)

#         from HRMSapp.models import Employee
#         try:
#             target_employee = Employee.objects.get(id=employee_id, is_deleted=False)
#         except Employee.DoesNotExist:
#             return Response({'detail': 'Employee not found'}, status=404)

#         # Permission: HR sees all, manager only sees their team, employee only sees self
#         is_hr = user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')
#         is_manager_of = (
#             user.has_role('MANAGER') and
#             target_employee.reporting_manager_id == user.employee.id
#         )
#         is_self = user.employee.id == target_employee.id

#         if not (is_hr or is_manager_of or is_self):
#             return Response(
#                 {'detail': 'You do not have permission to view this employee'},
#                 status=403,
#             )

#         year = int(request.query_params.get('year', timezone.now().year))
#         month = int(request.query_params.get('month', timezone.now().month))

#         try:
#             data = get_monthly_attendance_for_employee(target_employee, year, month)
#             return Response(data)
#         except Exception as exc:
#             logger.exception("Failed to load employee attendance")
#             return Response({'detail': str(exc)}, status=500)

# ==============================================================================
# EMPLOYEE MY-ATTENDANCE VIEWS (FIXED & IMPROVED)
# ==============================================================================

from datetime import date, datetime
from .services.personal_attendance_service import (
    get_monthly_attendance_for_employee,
    get_day_detail_for_employee,
    get_team_monthly_summary,
)
from HRMSapp.models import Employee  # Ensure this import is available here


class MyAttendanceMonthView(APIView):
    """Employee views their own attendance for a specific month."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Explicitly fetch a fresh, concrete Employee object from the database
        try:
            employee = Employee.objects.get(user_id=user.id, is_deleted=False)
        except Employee.DoesNotExist:
            return Response({'detail': 'No employee record linked'}, status=400)

        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))

        try:
            data = get_monthly_attendance_for_employee(employee, year, month)
            return Response(data)
        except Exception as exc:
            logger.exception("Failed to load monthly attendance")
            return Response({'detail': str(exc)}, status=500)


class MyAttendanceDayView(APIView):
    """Employee views detailed punch info for a single day."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Explicitly fetch a fresh, concrete Employee object from the database
        try:
            employee = Employee.objects.get(user_id=user.id, is_deleted=False)
        except Employee.DoesNotExist:
            return Response({'detail': 'No employee record linked'}, status=400)

        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'detail': 'date query param required (YYYY-MM-DD)'}, status=400)

        try:
            day = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD'}, status=400)

        try:
            data = get_day_detail_for_employee(employee, day)
            return Response(data)
        except Exception as exc:
            logger.exception("Failed to load day detail")
            return Response({'detail': str(exc)}, status=500)


class TeamAttendanceMonthView(APIView):
    """Manager views their team's monthly attendance summary."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Explicitly fetch a fresh, concrete Employee object from the database
        try:
            employee = Employee.objects.get(user_id=user.id, is_deleted=False)
        except Employee.DoesNotExist:
            return Response({'detail': 'No employee record linked'}, status=400)

        # Allow managers + HR admins
        if not (
            user.has_role('MANAGER') or user.has_role('HR_ADMIN')
            or user.has_role('SYSTEM_ADMIN')
        ):
            return Response({'detail': 'Only managers or HR can access team view'}, status=403)

        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))

        # HR can specify any manager, others see own team
        target_manager = employee
        manager_id = request.query_params.get('manager_id')
        if manager_id and (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            try:
                target_manager = Employee.objects.get(id=manager_id, is_deleted=False)
            except Employee.DoesNotExist:
                return Response({'detail': 'Manager not found'}, status=404)

        try:
            data = get_team_monthly_summary(target_manager, year, month)
            return Response(data)
        except Exception as exc:
            logger.exception("Failed to load team attendance")
            return Response({'detail': str(exc)}, status=500)


class EmployeeAttendanceMonthView(APIView):
    """
    Manager/HR views a specific employee's monthly attendance.
    Manager can only view their own reportees.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, employee_id):
        user = request.user
        
        # Explicitly fetch a fresh, concrete Employee object from the database
        try:
            employee = Employee.objects.get(user_id=user.id, is_deleted=False)
        except Employee.DoesNotExist:
            return Response({'detail': 'No employee record linked'}, status=400)

        try:
            target_employee = Employee.objects.get(id=employee_id, is_deleted=False)
        except Employee.DoesNotExist:
            return Response({'detail': 'Employee not found'}, status=404)

        # Permission: HR sees all, manager only sees their team, employee only sees self
        is_hr = user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')
        is_manager_of = (
            user.has_role('MANAGER') and
            target_employee.reporting_manager_id == employee.id
        )
        is_self = employee.id == target_employee.id

        if not (is_hr or is_manager_of or is_self):
            return Response(
                {'detail': 'You do not have permission to view this employee'},
                status=403,
            )

        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))

        try:
            data = get_monthly_attendance_for_employee(target_employee, year, month)
            return Response(data)
        except Exception as exc:
            logger.exception("Failed to load employee attendance")
            return Response({'detail': str(exc)}, status=500)

class AllEmployeesAttendanceView(APIView):
    """HR-only view: All employees' monthly attendance."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request):
        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))
        department_id = request.query_params.get('department_id')
        search = request.query_params.get('search', '')

        filters = {}
        if department_id:
            filters['department_id'] = department_id
        if search:
            filters['search'] = search

        try:
            from .services.personal_attendance_service import (
                get_all_employees_monthly_summary,
            )
            data = get_all_employees_monthly_summary(year, month, filters)
            return Response(data)
        except Exception as exc:
            logger.exception("Failed to load all employees attendance")
            return Response({'detail': str(exc)}, status=500)        