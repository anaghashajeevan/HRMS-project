from django.db import models

# Create your models here.
"""
Leave Management models.
All models use UUID PKs and reference HRMSapp.Employee.
"""

import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


# ==============================================================================
# LEAVE TYPE
# ==============================================================================

class LeaveType(models.Model):
    """Master data for leave types (CL, SL, EL, LOP, etc.)."""

    ACCRUAL_CHOICES = [
        ('YEARLY', 'Yearly (all at once)'),
        ('MONTHLY', 'Monthly accrual'),
        ('QUARTERLY', 'Quarterly accrual'),
        ('ON_DEMAND', 'On demand only'),
    ]

    GENDER_CHOICES = [
        ('ALL', 'All employees'),
        ('MALE', 'Male only'),
        ('FEMALE', 'Female only'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Basic
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_paid = models.BooleanField(default=True)

    # Accrual
    accrual_type = models.CharField(max_length=20, choices=ACCRUAL_CHOICES, default='YEARLY')
    yearly_quota = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    accrual_per_period = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Carry forward
    can_carry_forward = models.BooleanField(default=False)
    max_carry_forward = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    carry_forward_expiry_months = models.IntegerField(default=12)

    # Encashment
    can_encash = models.BooleanField(default=False)
    max_encashment_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    encashment_basis = models.CharField(max_length=20, default='BASIC')

    # Application rules
    requires_document = models.BooleanField(default=False)
    min_days_before_apply = models.IntegerField(default=0)
    max_consecutive_days = models.IntegerField(default=0)
    can_apply_half_day = models.BooleanField(default=True)
    allowed_during_probation = models.BooleanField(default=False)

    # Approval
    requires_manager_approval = models.BooleanField(default=True)
    requires_hr_approval = models.BooleanField(default=False)
    hr_approval_threshold_days = models.IntegerField(
        default=5,
        help_text="If leave > this many days, HR approval also required"
    )
    auto_approve = models.BooleanField(default=False)

    # Eligibility
    min_service_months = models.IntegerField(default=0)
    applicable_gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='ALL')

    # Display
    color_code = models.CharField(max_length=7, default='#3B82F6')
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_types'
        ordering = ['display_order', 'code']

    def __str__(self):
        return f"{self.code} - {self.name}"

class AnnualCalendar(models.Model):
    """A yearly holiday calendar that goes through approval workflow."""

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('IN_REVIEW', 'In Review'),
        ('APPROVED', 'Approved'),
        ('PUBLISHED', 'Published'),
        ('ARCHIVED', 'Archived'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    year = models.IntegerField(unique=True, db_index=True)
    title = models.CharField(max_length=200, help_text="e.g., 'Annual Calendar 2027'")
    description = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    # Ownership
    created_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True,
        related_name='created_calendars',
    )
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='published_calendars',
    )

    # Return for changes
    return_comments = models.TextField(blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    returned_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='returned_calendars',
    )

    # Rejection
    rejection_reason = models.TextField(blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'annual_calendars'
        ordering = ['-year']

    def __str__(self):
        return f"{self.year} - {self.get_status_display()}"

    @property
    def holiday_count(self):
        return self.holidays.count()
    



class AnnualCalendarApproval(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('RETURNED', 'Returned for Changes'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    calendar = models.ForeignKey(
        AnnualCalendar, on_delete=models.CASCADE, related_name='approvals',
    )
    step_number = models.IntegerField()
    step_name = models.CharField(max_length=100)
    approver = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.PROTECT,
        related_name='calendar_approvals',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    acted_at = models.DateTimeField(null=True, blank=True)
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'annual_calendar_approvals'
        ordering = ['calendar', 'step_number']
# ==============================================================================
# HOLIDAY
# ==============================================================================

class Holiday(models.Model):
    """Company holidays with regional support."""

    TYPE_CHOICES = [
        ('NATIONAL', 'National Holiday'),
        ('REGIONAL', 'Regional Holiday'),
        ('COMPANY', 'Company Holiday'),
        ('OPTIONAL', 'Optional Holiday'),
        ('RESTRICTED', 'Restricted Holiday'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    name = models.CharField(max_length=150)
    date = models.DateField(db_index=True)
    year = models.IntegerField(db_index=True)
    holiday_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='NATIONAL')
    description = models.TextField(blank=True)

    applicable_to_all_locations = models.BooleanField(default=True)
    applicable_locations = models.ManyToManyField(
        'HRMSapp.CompanyStructure',
        blank=True,
        related_name='holidays',
    )
    calendar = models.ForeignKey(
        AnnualCalendar,
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='holidays',
        help_text="Which annual calendar this holiday belongs to",
    )
    is_optional = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'holidays'
        ordering = ['date']

    def __str__(self):
        return f"{self.date} - {self.name}"

    def save(self, *args, **kwargs):
        if self.date:
            self.year = self.date.year
        super().save(*args, **kwargs)




class CalendarAmendment(models.Model):
    """Track amendments to published calendars."""

    ACTION_CHOICES = [
        ('ADD', 'Added Holiday'),
        ('REMOVE', 'Removed Holiday'),
        ('EDIT', 'Edited Holiday'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    calendar = models.ForeignKey(
        AnnualCalendar, on_delete=models.CASCADE, related_name='amendments',
    )
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    holiday_name = models.CharField(max_length=150)
    holiday_date = models.DateField()
    reason = models.TextField(help_text="Why this amendment was made")

    made_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True,
        related_name='calendar_amendments',
    )
    made_at = models.DateTimeField(auto_now_add=True)

    # Snapshot of holiday data (for REMOVE actions where FK is gone)
    holiday_snapshot = models.JSONField(default=dict)

    class Meta:
        db_table = 'calendar_amendments'
        ordering = ['-made_at']

    def __str__(self):
        return f"{self.calendar.year} - {self.action} - {self.holiday_name}"
# ==============================================================================
# LEAVE BALANCE
# ==============================================================================

class LeaveBalance(models.Model):
    """Employee's leave balance for a specific year."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.CASCADE,
        related_name='leave_balances',
    )
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT)
    year = models.IntegerField()

    allocated = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    accrued_till_date = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    carried_forward = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    used = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    pending = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    encashed = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    adjustment = models.DecimalField(max_digits=6, decimal_places=1, default=0)

    last_accrual_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_balances'
        ordering = ['-year', 'leave_type__display_order']
        unique_together = [('employee', 'leave_type', 'year')]
        indexes = [
            models.Index(fields=['employee', 'year']),
        ]

    def __str__(self):
        return f"{self.employee.employee_id} - {self.leave_type.code} ({self.year}): {self.available}"

    @property
    def available(self):
        """Available days = accrued + carried + adjustment - used - pending - encashed."""
        return (
            self.accrued_till_date + self.carried_forward + self.adjustment
            - self.used - self.pending - self.encashed
        )

    @property
    def total_eligible(self):
        """Total eligible = allocated + carried + adjustment."""
        return self.allocated + self.carried_forward + self.adjustment


# ==============================================================================
# LEAVE APPLICATION
# ==============================================================================

class LeaveApplication(models.Model):
    """Employee leave request."""

    STATUS_CHOICES = [
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
        ('WITHDRAWN', 'Withdrawn'),
    ]

    HALF_DAY_CHOICES = [
        ('AM', 'First Half (Morning)'),
        ('PM', 'Second Half (Afternoon)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application_number = models.CharField(max_length=30, unique=True)

    # Who & What
    employee = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.CASCADE,
        related_name='leave_applications',
    )
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT)

    # When
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    total_days = models.DecimalField(max_digits=5, decimal_places=1)
    is_half_day = models.BooleanField(default=False)
    half_day_period = models.CharField(max_length=2, choices=HALF_DAY_CHOICES, blank=True)

    # Why
    reason = models.TextField()
    contact_during_leave = models.CharField(max_length=100, blank=True)
    supporting_document = models.FileField(
        upload_to='leave_documents/%Y/%m/',
        null=True, blank=True,
    )

    # Handover
    handover_to = models.ForeignKey(
        'HRMSapp.Employee',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='leave_handovers_received',
    )
    handover_notes = models.TextField(blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    applied_at = models.DateTimeField(auto_now_add=True)

    # Approval
    current_approver = models.ForeignKey(
        'HRMSapp.Employee',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='leaves_to_approve',
    )
    approved_by = models.ForeignKey(
        'HRMSapp.Employee',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='leaves_approved',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    # Cancellation
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)

    # LOP tracking
    is_lop = models.BooleanField(default=False)
    lop_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_applications'
        ordering = ['-applied_at']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['current_approver', 'status']),
        ]

    def __str__(self):
        return f"{self.application_number} - {self.employee.full_name}"

    @property
    def duration_days(self):
        return (self.end_date - self.start_date).days + 1


# ==============================================================================
# LEAVE APPLICATION APPROVAL
# ==============================================================================

class LeaveApplicationApproval(models.Model):
    """Audit trail of approval actions on a leave application."""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        LeaveApplication,
        on_delete=models.CASCADE,
        related_name='approvals',
    )
    step_number = models.IntegerField(default=1)
    step_name = models.CharField(max_length=100, default='Manager Approval')

    approver = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.PROTECT,
        related_name='leave_approvals_pending',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    acted_at = models.DateTimeField(null=True, blank=True)
    comments = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'leave_application_approvals'
        ordering = ['application', 'step_number']

    def __str__(self):
        return f"{self.application.application_number} - Step {self.step_number} - {self.status}"



class WhatsAppNotificationLog(models.Model):
    """Track all WhatsApp notifications for auditing."""
    
    NOTIFICATION_TYPE_CHOICES = [
        ('LEAVE_APPROVAL_REQUEST', 'Leave Approval Request'),
        ('LEAVE_APPROVED', 'Leave Approved'),
        ('LEAVE_REJECTED', 'Leave Rejected'),
        ('LEAVE_CANCELLED', 'Leave Cancelled'),
    ]
    
    STATUS_CHOICES = [
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('SKIPPED', 'Skipped'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    
    recipient_employee = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True,
        related_name='whatsapp_notifications',
    )
    recipient_phone = models.CharField(max_length=20)
    
    leave_application = models.ForeignKey(
        LeaveApplication, on_delete=models.CASCADE,
        related_name='whatsapp_logs', null=True, blank=True,
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    message_id = models.CharField(max_length=200, blank=True)
    error_message = models.TextField(blank=True)
    
    sent_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'whatsapp_notification_logs'
        ordering = ['-sent_at']
    
    def __str__(self):
        return f"{self.notification_type} → {self.recipient_phone} ({self.status})"



class CompOffCreditLog(models.Model):
    """Audit log for Comp-Off credits given for weekend/holiday work."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.CASCADE,
        related_name='compoff_credits',
    )
    credit_date = models.DateField(help_text="Date they worked (weekend/holiday)")
    comp_off_days = models.DecimalField(max_digits=4, decimal_places=1)
    worked_hours = models.DecimalField(max_digits=5, decimal_places=2)
    reason = models.CharField(max_length=200)
    credited_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'compoff_credit_logs'
        ordering = ['-credit_date']
        unique_together = [('employee', 'credit_date')]  # 🔥 Prevent duplicate credits
    
    def __str__(self):
        return f"{self.employee.employee_id} — {self.credit_date} — {self.comp_off_days} days"