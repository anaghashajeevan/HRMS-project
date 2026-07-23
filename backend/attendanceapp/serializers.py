"""
DRF serializers for attendance app.
"""

from rest_framework import serializers

from .models import (
    AutomationSettings,
    DailyAttendance,
    EmailReportLog,
    MonthlyReportLog,
    RawPunchLog,
)


# ==============================================================================
# AUTOMATION SETTINGS
# ==============================================================================

class AutomationSettingsSerializer(serializers.ModelSerializer):
    """Full settings serializer (excludes encrypted password fields)."""
    api_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    smtp_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    secret_statuses = serializers.SerializerMethodField()

    class Meta:
        model = AutomationSettings
        fields = [
            'id',
            # eSSL
            'essl_api_url',
            'device_serial_number',
            'api_username',
            'api_password',
            # SMTP
            'smtp_host',
            'smtp_port',
            'sender_email',
            'smtp_password',
            'report_receiver_email',
            'cc_emails',
            # Daily
            'auto_send_time',
            'enable_daily_report_email',
            # Automation mode
            'automation_run_mode',
            # Shift rules
            'shift_in_time',
            'shift_out_time',
            'duplicate_punch_ignore_seconds',
            # Monthly
            'enable_monthly_report',
            'monthly_report_receiver_email',
            'monthly_cc_emails',
            'monthly_report_start_date',
            'monthly_report_end_date',
            'monthly_send_day',
            'monthly_send_time',
            'monthly_report_mode',
            # Working hour rules
            'full_day_min_hours',
            'half_day_min_hours',
            'full_day_out_time',
            'half_day_out_time',
            'lunch_start_time',
            'lunch_end_time',
            'excluded_dates',
            # Meta
            'updated_at',
            'secret_statuses',
        ]
        read_only_fields = ['id', 'updated_at', 'secret_statuses']
        # Never expose the encrypted password fields
        extra_kwargs = {
            'api_password_encrypted': {'write_only': True},
            'smtp_password_encrypted': {'write_only': True},
        }

    def get_secret_statuses(self, obj):
        return obj.secret_statuses()

    def update(self, instance, validated_data):
        # Handle password fields separately
        api_password = validated_data.pop('api_password', None)
        smtp_password = validated_data.pop('smtp_password', None)

        # Update all other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Only update passwords if new values provided (non-empty)
        if api_password:
            instance.set_api_password(api_password)
        if smtp_password:
            instance.set_smtp_password(smtp_password)

        instance.save()
        return instance


# ==============================================================================
# DAILY ATTENDANCE
# ==============================================================================

class DailyAttendanceSerializer(serializers.ModelSerializer):
    """Simple daily attendance row."""
    hrms_employee_id = serializers.CharField(source='employee.employee_id', read_only=True, default=None)
    hrms_employee_uuid = serializers.CharField(source='employee.id', read_only=True, default=None)
    department = serializers.SerializerMethodField()

    class Meta:
        model = DailyAttendance
        fields = [
            'id',
            'attendance_date',
            'employee_code',
            'employee_name',
            'hrms_employee_uuid',
            'hrms_employee_id',
            'department',
            'punch_in',
            'punch_out',
            'total_punches',
            'working_hours_seconds',
            'break_time_seconds',
            'net_working_hours_seconds',
            'is_late',
            'is_early_exit',
            'missing_punch',
            'status',
            'updated_at',
        ]
        read_only_fields = fields

    def get_department(self, obj):
        if obj.employee and obj.employee.structure_location:
            return obj.employee.structure_location.name
        return None


# ==============================================================================
# EMAIL REPORT LOG
# ==============================================================================

class EmailReportLogSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = EmailReportLog
        fields = [
            'id',
            'report_date',
            'status',
            'status_display',
            'sent_at',
            'report_file',
            'error_message',
            'total_employees_present',
            'late_coming',
            'early_exit',
            'missing_punch',
            'total_break_seconds',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


# ==============================================================================
# MONTHLY REPORT LOG
# ==============================================================================

class MonthlyReportLogSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True, default=None)

    class Meta:
        model = MonthlyReportLog
        fields = [
            'id',
            'month',
            'year',
            'report_file',
            'sent_to',
            'cc',
            'sent_at',
            'status',
            'status_display',
            'error_message',
            'created_by',
            'created_by_email',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


# ==============================================================================
# RAW PUNCH LOG (for admin/debug purposes)
# ==============================================================================

class RawPunchLogSerializer(serializers.ModelSerializer):
    hrms_employee_id = serializers.CharField(source='employee.employee_id', read_only=True, default=None)

    class Meta:
        model = RawPunchLog
        fields = [
            'id',
            'employee_code',
            'hrms_employee_id',
            'punch_time',
            'punch_date',
            'raw_line',
            'created_at',
        ]
        read_only_fields = fields