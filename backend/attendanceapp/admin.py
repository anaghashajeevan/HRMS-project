from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import (
    AutomationSettings,
    DailyAttendance,
    EmailReportLog,
    MonthlyReportLog,
    RawPunchLog,
)


@admin.register(AutomationSettings)
class AutomationSettingsAdmin(admin.ModelAdmin):
    exclude = ("api_password_encrypted", "smtp_password_encrypted")
    list_display = (
        "essl_api_url",
        "device_serial_number",
        "smtp_host",
        "sender_email",
        "report_receiver_email",
        "auto_send_time",
        "enable_monthly_report",
        "monthly_send_day",
        "monthly_send_time",
        "updated_at",
    )

    def has_add_permission(self, request):
        return not AutomationSettings.objects.exists()


@admin.register(RawPunchLog)
class RawPunchLogAdmin(admin.ModelAdmin):
    list_display = ("employee_code", "employee", "punch_time", "punch_date", "created_at")
    search_fields = ("employee_code", "employee__employee_id", "employee__first_name")
    list_filter = ("punch_date",)
    autocomplete_fields = ("employee",)
    date_hierarchy = "punch_date"


@admin.register(DailyAttendance)
class DailyAttendanceAdmin(admin.ModelAdmin):
    list_display = (
        "attendance_date",
        "employee_code",
        "employee_name",
        "employee",
        "punch_in",
        "punch_out",
        "is_late",
        "is_early_exit",
        "missing_punch",
        "status",
    )
    search_fields = (
        "employee_code",
        "employee_name",
        "employee__employee_id",
        "employee__first_name",
        "employee__last_name",
    )
    list_filter = (
        "attendance_date",
        "status",
        "is_late",
        "is_early_exit",
        "missing_punch",
    )
    autocomplete_fields = ("employee",)
    date_hierarchy = "attendance_date"


@admin.register(EmailReportLog)
class EmailReportLogAdmin(admin.ModelAdmin):
    list_display = (
        "report_date",
        "status",
        "sent_at",
        "total_employees_present",
        "late_coming",
        "early_exit",
        "missing_punch",
    )
    list_filter = ("status", "report_date")
    date_hierarchy = "report_date"


@admin.register(MonthlyReportLog)
class MonthlyReportLogAdmin(admin.ModelAdmin):
    list_display = (
        "year",
        "month",
        "status",
        "sent_to",
        "sent_at",
        "created_by",
        "created_at",
    )
    list_filter = ("status", "year", "month")
    search_fields = ("sent_to", "cc")