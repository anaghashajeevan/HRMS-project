from django.db import models

# Create your models here.
"""
Attendance app models.
All models use UUID primary keys and reference HRMSapp.Employee (single source of truth).
"""

import base64
import hashlib
import os
import uuid

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models
from django.utils import timezone


# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def _fernet():
    """Fernet encryption using Django SECRET_KEY."""
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    )
    return Fernet(key)


def encrypt_secret(value):
    if not value:
        return ""
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value):
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


def _env_int(name, default):
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def normalize_employee_code(value):
    """
    Normalize employee code for matching between eSSL and HRMS.
    Strips whitespace, removes hyphens/spaces, uppercases.
    
    Examples:
        'NL-001'  -> 'NL001'
        'nl 001'  -> 'NL001'
        ' NL001 ' -> 'NL001'
    """
    if not value:
        return ""
    return str(value).strip().replace("-", "").replace(" ", "").upper()


# ==============================================================================
# AUTOMATION SETTINGS (Global config, singleton)
# ==============================================================================

class AutomationSettings(models.Model):
    """
    Singleton table storing eSSL API config, SMTP config, shift rules, etc.
    Access via AutomationSettings.get_solo()
    """
    AUTOMATION_RUN_DAILY = "DAILY"
    AUTOMATION_RUN_MONTHLY = "MONTHLY"
    AUTOMATION_RUN_BOTH = "BOTH"

    AUTOMATION_RUN_MODE_CHOICES = [
        (AUTOMATION_RUN_DAILY, "Daily"),
        (AUTOMATION_RUN_MONTHLY, "Monthly"),
        (AUTOMATION_RUN_BOTH, "Both"),
    ]

    MONTHLY_MODE_PREVIOUS = "previous_month"
    MONTHLY_MODE_CURRENT = "current_month"

    MONTHLY_REPORT_MODE_CHOICES = [
        (MONTHLY_MODE_PREVIOUS, "Previous month"),
        (MONTHLY_MODE_CURRENT, "Current month"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # eSSL API
    essl_api_url = models.URLField(blank=True)
    device_serial_number = models.CharField(max_length=120, blank=True)
    api_username = models.CharField(max_length=120, blank=True)
    api_password_encrypted = models.TextField(blank=True)

    # SMTP
    smtp_host = models.CharField(max_length=180, blank=True)
    smtp_port = models.PositiveIntegerField(default=587)
    sender_email = models.EmailField(blank=True)
    smtp_password_encrypted = models.TextField(blank=True)
    report_receiver_email = models.EmailField(blank=True)
    cc_emails = models.TextField(blank=True)

    # Daily schedule
    auto_send_time = models.TimeField(default="19:15")
    enable_daily_report_email = models.BooleanField(default=False)

    # Automation
    automation_run_mode = models.CharField(
        max_length=16,
        choices=AUTOMATION_RUN_MODE_CHOICES,
        default=AUTOMATION_RUN_MONTHLY,
    )

    # Shift rules
    shift_in_time = models.TimeField(default="09:30")
    shift_out_time = models.TimeField(default="19:00")
    duplicate_punch_ignore_seconds = models.PositiveIntegerField(default=60)

    # Monthly
    enable_monthly_report = models.BooleanField(default=True)
    monthly_report_receiver_email = models.EmailField(blank=True)
    monthly_cc_emails = models.TextField(blank=True)
    monthly_report_start_date = models.DateField(null=True, blank=True)
    monthly_report_end_date = models.DateField(null=True, blank=True)
    monthly_send_day = models.CharField(max_length=2, default="1")
    monthly_send_time = models.TimeField(default="09:00")
    monthly_report_mode = models.CharField(
        max_length=32,
        choices=MONTHLY_REPORT_MODE_CHOICES,
        default=MONTHLY_MODE_PREVIOUS,
    )

    # Working hour rules
    full_day_min_hours = models.DecimalField(max_digits=4, decimal_places=2, default=8)
    half_day_min_hours = models.DecimalField(max_digits=4, decimal_places=2, default=4)
    full_day_out_time = models.TimeField(default="18:30")
    half_day_out_time = models.TimeField(default="14:00")
    lunch_start_time = models.TimeField(default="13:00")
    lunch_end_time = models.TimeField(default="14:00")
    excluded_dates = models.TextField(blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_automation_settings'
        verbose_name = "Automation Settings"
        verbose_name_plural = "Automation Settings"

    def __str__(self):
        return "Attendance Automation Settings"

    @classmethod
    def get_solo(cls):
        """Get or create the singleton settings row."""
        settings_obj = cls.objects.first()
        if settings_obj:
            return settings_obj

        settings_obj = cls(
            essl_api_url=os.getenv("ESSL_API_URL", ""),
            device_serial_number=os.getenv("ESSL_SERIAL_NUMBER", ""),
            api_username=os.getenv("ESSL_USERNAME", ""),
            smtp_host=os.getenv("EMAIL_HOST", ""),
            smtp_port=_env_int("EMAIL_PORT", 587),
            sender_email=os.getenv("EMAIL_HOST_USER", ""),
            report_receiver_email=os.getenv("REPORT_RECEIVER_EMAIL")
            or os.getenv("CTO_EMAIL", ""),
            auto_send_time=os.getenv("AUTO_SEND_TIME", "19:15"),
            shift_in_time=os.getenv("SHIFT_IN_TIME", "09:30"),
            shift_out_time=os.getenv("SHIFT_OUT_TIME", "19:00"),
            duplicate_punch_ignore_seconds=_env_int("DUPLICATE_SECONDS", 60),
            monthly_report_receiver_email=os.getenv("MONTHLY_REPORT_RECEIVER_EMAIL", ""),
        )
        settings_obj.set_api_password(os.getenv("ESSL_PASSWORD", ""))
        settings_obj.set_smtp_password(os.getenv("EMAIL_HOST_PASSWORD", ""))
        settings_obj.save()
        return settings_obj

    def set_api_password(self, value):
        if value:
            self.api_password_encrypted = encrypt_secret(value)

    def get_api_password(self):
        return decrypt_secret(self.api_password_encrypted)

    def has_api_password(self):
        return bool(self.api_password_encrypted)

    def set_smtp_password(self, value):
        if value:
            self.smtp_password_encrypted = encrypt_secret(value)

    def get_smtp_password(self):
        return decrypt_secret(self.smtp_password_encrypted)

    def has_smtp_password(self):
        return bool(self.smtp_password_encrypted)

    def secret_statuses(self):
        return {
            "api_password": "Configured" if self.has_api_password() else "Not Configured",
            "smtp_password": "Configured" if self.has_smtp_password() else "Not Configured",
        }


# ==============================================================================
# RAW PUNCH LOG (raw data from eSSL device)
# ==============================================================================

class RawPunchLog(models.Model):
    """Raw punch events from eSSL device — one row per punch."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    employee_code = models.CharField(max_length=32, db_index=True)  # As sent by eSSL
    # Optional FK to HRMS Employee (populated when matched)
    employee = models.ForeignKey(
        'HRMSapp.Employee',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='attendance_raw_punches',
    )

    punch_time = models.DateTimeField(db_index=True)
    punch_date = models.DateField(db_index=True)
    raw_line = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_raw_punch_logs'
        ordering = ["employee_code", "punch_time"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee_code", "punch_time"],
                name="attendance_unique_raw_punch",
            )
        ]

    def __str__(self):
        return f"{self.employee_code} @ {self.punch_time:%Y-%m-%d %H:%M:%S}"


# ==============================================================================
# DAILY ATTENDANCE (aggregated per employee per day)
# ==============================================================================

class DailyAttendance(models.Model):
    """Daily aggregated attendance — one row per employee per day."""
    STATUS_PRESENT = "present"
    STATUS_MISSING = "missing_punch"

    STATUS_CHOICES = [
        (STATUS_PRESENT, "Present"),
        (STATUS_MISSING, "Missing Punch"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    attendance_date = models.DateField(db_index=True)
    # FK to HRMS Employee (populated when matched)
    employee = models.ForeignKey(
        'HRMSapp.Employee',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="attendance_daily_records",
    )
    employee_code = models.CharField(max_length=32, db_index=True)  # eSSL code
    employee_name = models.CharField(max_length=160, default="Unknown Employee")  # Cached

    punch_in = models.DateTimeField(null=True, blank=True)
    punch_out = models.DateTimeField(null=True, blank=True)
    total_punches = models.PositiveIntegerField(default=0)
    working_hours_seconds = models.PositiveIntegerField(default=0)
    break_time_seconds = models.PositiveIntegerField(default=0)
    net_working_hours_seconds = models.PositiveIntegerField(default=0)
    is_late = models.BooleanField(default=False)
    is_early_exit = models.BooleanField(default=False)
    missing_punch = models.BooleanField(default=False)
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_PRESENT,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_daily'
        ordering = ["employee_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["attendance_date", "employee_code"],
                name="attendance_unique_daily_per_employee",
            )
        ]

    def __str__(self):
        return f"{self.employee_code} - {self.attendance_date}"


# ==============================================================================
# EMAIL REPORT LOG (daily reports)
# ==============================================================================

class EmailReportLog(models.Model):
    """Log of daily attendance email reports sent."""
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_SKIPPED = "skipped"

    STATUS_CHOICES = [
        (STATUS_SUCCESS, "Success"),
        (STATUS_FAILED, "Failed"),
        (STATUS_SKIPPED, "Skipped"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    report_date = models.DateField(unique=True, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES)
    sent_at = models.DateTimeField(null=True, blank=True)
    report_file = models.FileField(upload_to="attendance/reports/daily/", blank=True)
    error_message = models.TextField(blank=True)
    total_employees_present = models.PositiveIntegerField(default=0)
    late_coming = models.PositiveIntegerField(default=0)
    early_exit = models.PositiveIntegerField(default=0)
    missing_punch = models.PositiveIntegerField(default=0)
    total_break_seconds = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_email_report_logs'
        ordering = ["-report_date"]

    def __str__(self):
        return f"Daily Report {self.report_date} - {self.get_status_display()}"

    def mark_success(self, summary, report_file):
        self.status = self.STATUS_SUCCESS
        self.sent_at = timezone.now()
        self.report_file.name = report_file
        self.error_message = ""
        self.total_employees_present = summary["total_employees_present"]
        self.late_coming = summary["late_coming"]
        self.early_exit = summary["early_exit"]
        self.missing_punch = summary["missing_punch"]
        self.total_break_seconds = summary["total_break_seconds"]
        self.save()

    def mark_failed(self, error_message):
        self.status = self.STATUS_FAILED
        self.error_message = error_message[:2000]
        self.save()


# ==============================================================================
# MONTHLY REPORT LOG
# ==============================================================================

class MonthlyReportLog(models.Model):
    """Log of monthly attendance reports."""
    STATUS_GENERATED = "generated"
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_GENERATED, "Generated"),
        (STATUS_SUCCESS, "Success"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    month = models.PositiveSmallIntegerField(db_index=True)
    year = models.PositiveSmallIntegerField(db_index=True)
    report_file = models.FileField(upload_to="attendance/reports/monthly/", blank=True)
    sent_to = models.EmailField(blank=True)
    cc = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_GENERATED,
    )
    error_message = models.TextField(blank=True)
    # Link to HRMS user who generated it
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attendance_monthly_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_monthly_report_logs'
        ordering = ["-year", "-month", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["year", "month"],
                name="attendance_unique_monthly_report",
            )
        ]

    def __str__(self):
        return f"Monthly Report {self.month:02d}/{self.year}"

    def mark_generated(self, report_file):
        self.status = self.STATUS_GENERATED
        self.report_file.name = report_file
        self.error_message = ""
        self.save()

    def mark_success(self, report_file, sent_to, cc):
        self.status = self.STATUS_SUCCESS
        self.report_file.name = report_file
        self.sent_to = sent_to
        self.cc = cc
        self.sent_at = timezone.now()
        self.error_message = ""
        self.save()

    def mark_failed(self, error_message):
        self.status = self.STATUS_FAILED
        self.error_message = error_message[:2000]
        self.save()