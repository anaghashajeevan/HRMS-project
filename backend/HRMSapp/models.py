from django.db import models

# Create your models here.
"""
HRMS Authentication Models.
Flat structure — one class per entity.
"""
import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils import timezone
from .managers import UserAccountManager


# ==============================================================================
# ROLE MASTER
# ==============================================================================

class Role(models.Model):
    """Dynamic role master — HR admin can add/edit roles at runtime."""
    ROLE_CHOICES = [
        ('SYSTEM_ADMIN', 'System Administrator'),
        ('HR_ADMIN', 'HR Administrator'),
        ('MANAGER', 'Manager'),
        ('EMPLOYEE', 'Employee'),
        ('KIOSK', 'Kiosk Terminal'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role_name = models.CharField(max_length=50, unique=True, choices=ROLE_CHOICES)
    code = models.CharField(max_length=30, unique=True, help_text="Internal code (e.g. 'hr_admin')")
    description = models.TextField(blank=True, null=True)
    level = models.IntegerField(default=10, help_text="Higher = more privileges")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'system_roles'
        ordering = ['-level']

    def __str__(self):
        return self.get_role_name_display()


# ==============================================================================
# COMPANY / DEPARTMENT STRUCTURE (minimal — for FK integrity)
# ==============================================================================

class CompanyStructure(models.Model):
    """Company/BU/Department/Location hierarchy (minimal for auth linkage)."""
    STRUCTURE_TYPES = [
        ('COMPANY', 'Company'),
        ('BUSINESS_UNIT', 'Business Unit'),
        ('DEPARTMENT', 'Department'),
        ('COST_CENTER', 'Cost Center'),
        ('LOCATION', 'Location'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=STRUCTURE_TYPES)
    parent = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='children'
    )
    cost_center_code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'company_structures'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.type})"

# ==============================================================================
# JOB POSITION (Headcount management with budget controls)
# ==============================================================================

class JobPosition(models.Model):
    """
    Job positions with budgeted vs actual headcount tracking.
    Enforces DB-level check to prevent exceeding headcount budget.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=100)
    grade_band = models.CharField(
        max_length=10,
        help_text="Grade band like 'G1', 'G2', 'M1', 'M2'"
    )
    department = models.ForeignKey(
        CompanyStructure,
        on_delete=models.PROTECT,
        related_name='positions',
        limit_choices_to={'type': 'DEPARTMENT'},
    )
    budgeted_count = models.IntegerField(default=1, help_text="Approved headcount for FY")
    actual_count = models.IntegerField(default=0, help_text="Currently filled headcount")
    salary_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    salary_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'job_positions'
        ordering = ['title']
        constraints = [
            models.CheckConstraint(
                check=models.Q(actual_count__lte=models.F('budgeted_count')),
                name='chk_headcount_within_budget',
            ),
            models.CheckConstraint(
                check=models.Q(budgeted_count__gte=0),
                name='chk_budgeted_count_positive',
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.grade_band}) - {self.department.name}"

    @property
    def vacancy_count(self):
        return max(0, self.budgeted_count - self.actual_count)

    @property
    def is_full(self):
        return self.actual_count >= self.budgeted_count
# ==============================================================================
# EMPLOYEE MASTER
# ==============================================================================

class Employee(models.Model):
    """Employee master — single source of truth for HR data."""
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('PROBATION', 'Probation'),
        ('SUSPENDED', 'Suspended'),
        ('TERMINATED', 'Terminated'),
    ]
    GENDER_CHOICES = [
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.CharField(max_length=20, unique=True, help_text="e.g. EMP-2026-001")

    # Personal
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    official_email = models.EmailField(max_length=100, unique=True)
    personal_email = models.EmailField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=20)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=15, choices=GENDER_CHOICES, blank=True, null=True)

    # Employment
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PROBATION')
    reporting_manager = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='reportees'
    )
    position = models.ForeignKey(                               # ← NEW
        'JobPosition',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='employees',
    )
    structure_location = models.ForeignKey(
        CompanyStructure, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='employees'
    )
    date_of_joining = models.DateField()
    date_of_exit = models.DateField(null=True, blank=True)

    bank_account_encrypted = models.TextField(blank=True, null=True)
    bank_ifsc_code = models.CharField(max_length=20, blank=True, null=True)
    pan_number_encrypted = models.TextField(blank=True, null=True)
    aadhaar_number_encrypted = models.TextField(blank=True, null=True)
    uan_number_encrypted = models.TextField(blank=True, null=True)
    # Soft-delete + audit
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employees'
        ordering = ['employee_id']

    def __str__(self):
        return f"{self.employee_id} - {self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


# ==============================================================================
# EMPLOYEE DOCUMENTS (contracts, IDs, certificates with expiry alerts)
# ==============================================================================

class EmployeeDocument(models.Model):
    """
    Document repository per employee with expiry-alert tracking.
    Celery workers scan expiry_date daily and fire notifications at 90/60/30 days.
    """
    DOCUMENT_TYPE_CHOICES = [
        ('CONTRACT', 'Employment Contract'),
        ('OFFER_LETTER', 'Offer Letter'),
        ('ID_PROOF', 'ID Proof'),
        ('ADDRESS_PROOF', 'Address Proof'),
        ('EDUCATION', 'Education Certificate'),
        ('EXPERIENCE', 'Experience Certificate'),
        ('PAN', 'PAN Card'),
        ('AADHAAR', 'Aadhaar Card'),
        ('PASSPORT', 'Passport'),
        ('VISA', 'Visa'),
        ('WORK_PERMIT', 'Work Permit'),
        ('MEDICAL', 'Medical Certificate'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    document_type = models.CharField(
        max_length=20,
        choices=DOCUMENT_TYPE_CHOICES,
        default='OTHER',
    )
    document_name = models.CharField(max_length=150)
    file_path = models.FileField(upload_to='employee_documents/%Y/%m/')
    file_size_kb = models.IntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True, null=True)

    expiry_date = models.DateField(null=True, blank=True)
    alert_fired_count = models.IntegerField(
        default=0,
        help_text="Number of expiry alerts already sent by Celery worker"
    )

    uploaded_by = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name='uploaded_documents',
        null=True, blank=True,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'employee_documents'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['employee', 'document_type']),
            models.Index(fields=['expiry_date']),
        ]

    def __str__(self):
        return f"{self.employee.employee_id} - {self.document_name}"

    @property
    def is_expired(self):
        if not self.expiry_date:
            return False
        from django.utils import timezone
        return self.expiry_date < timezone.now().date()

    @property
    def days_until_expiry(self):
        if not self.expiry_date:
            return None
        from django.utils import timezone
        delta = self.expiry_date - timezone.now().date()
        return delta.days
# ==============================================================================
# USER ACCOUNT (AUTH MODEL)
# ==============================================================================

class UserAccount(AbstractBaseUser, PermissionsMixin):
    """
    Custom authentication user tied 1-to-1 with an Employee.
    Supports AD/LDAP flag, MFA, lockout tracking.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.OneToOneField(
        Employee, on_delete=models.CASCADE, related_name='user_account'
    )

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(max_length=150, unique=True)

    # AD/LDAP + MFA
    is_ldap_user = models.BooleanField(default=False)
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret_encrypted = models.TextField(blank=True, null=True)

    # Lockout tracking
    failed_login_attempts = models.IntegerField(default=0)
    is_locked_out = models.BooleanField(default=False)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    # Roles (many-to-many)
    roles = models.ManyToManyField(Role, related_name='user_accounts', blank=True)

    # Django admin flags
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    password_changed_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserAccountManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'user_accounts'
        ordering = ['-created_at']

    def __str__(self):
        return self.email  

    def get_role_codes(self):
        return list(self.roles.filter(is_active=True).values_list('role_name', flat=True))

    def has_role(self, role_name):
        return self.roles.filter(role_name=role_name, is_active=True).exists()


# ==============================================================================
# ACTIVE SESSION TRACKING (for JWT blacklist / device management)
# ==============================================================================

class UserActiveSession(models.Model):
    """Tracks active JWT sessions for device management & forced logout."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        UserAccount, on_delete=models.CASCADE, related_name='active_sessions'
    )
    device_fingerprint = models.CharField(max_length=255)
    refresh_token_jti = models.CharField(max_length=255, unique=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True, null=True)
    is_valid = models.BooleanField(default=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_active_sessions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['refresh_token_jti', 'is_valid']),
        ]

    def __str__(self):
        return f"{self.user.username} @ {self.ip_address}"




# ==============================================================================
# EMPLOYEE FIELD CHANGE AUDIT LOG (matches reference schema)
# ==============================================================================

class EmployeeAuditLog(models.Model):
    """
    Immutable audit log for changes to Employee master data.
    Every field update (salary, designation, department, etc.) is logged here.
    Required for 7-year retention compliance.
    """
    id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='field_audit_logs'
    )
    modified_by = models.ForeignKey(
        Employee, on_delete=models.PROTECT, related_name='changes_made'
    )
    field_name = models.CharField(max_length=50)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'employee_audit_logs'
        ordering = ['-changed_at']
        indexes = [
            models.Index(fields=['employee', '-changed_at']),
        ]

    def __str__(self):
        return f"{self.employee.employee_id}: {self.field_name} @ {self.changed_at}"

# ==============================================================================
# AUDIT LOG
# ==============================================================================

class AuthAuditLog(models.Model):
    """Immutable audit log for authentication events."""
    EVENT_CHOICES = [
        ('LOGIN_SUCCESS', 'Login Success'),
        ('LOGIN_FAILED', 'Login Failed'),
        ('LOGOUT', 'Logout'),
        ('TOKEN_REFRESH', 'Token Refresh'),
        ('PASSWORD_CHANGE', 'Password Change'),
        ('ACCOUNT_LOCKED', 'Account Locked'),
        ('ACCOUNT_UNLOCKED', 'Account Unlocked'),
        ('MFA_VERIFIED', 'MFA Verified'),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        UserAccount, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='audit_logs'
    )
    username_attempted = models.CharField(max_length=150, blank=True, null=True)
    event_type = models.CharField(max_length=30, choices=EVENT_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'auth_audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} - {self.username_attempted or self.user} @ {self.created_at}"