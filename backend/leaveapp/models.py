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