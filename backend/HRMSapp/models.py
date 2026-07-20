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
from django_cryptography.fields import encrypt

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

    # Encrypted PII fields (AES-256 at rest via django-cryptography)
    bank_account_encrypted = encrypt(models.TextField(blank=True, null=True))
    bank_ifsc_code = models.CharField(max_length=20, blank=True, null=True)  # Not sensitive — plain text OK
    pan_number_encrypted = encrypt(models.TextField(blank=True, null=True))
    aadhaar_number_encrypted = encrypt(models.TextField(blank=True, null=True))
    uan_number_encrypted = encrypt(models.TextField(blank=True, null=True))
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
        ('LETTER_PROMOTION', 'Promotion Letter'),
        ('LETTER_TRANSFER', 'Transfer Letter'),
        ('LETTER_REDESIGNATION', 'Re-designation Letter'),
        ('LETTER_CONFIRMATION', 'Confirmation Letter'),
        ('LETTER_MANAGER_CHANGE', 'Manager Change Letter'),
        ('PERFORMANCE_LETTER', 'Performance Rating Letter'),
        ('APPRAISAL_LETTER', 'Appraisal Letter'),
        ('PIP_LETTER', 'PIP Letter'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    document_type = models.CharField(
        max_length=30,
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
        Employee,
        on_delete=models.SET_NULL,   # ← Changed
        related_name='changes_made',
        null=True,                    # ← Added
        blank=True,                   # ← Added
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


# ==============================================================================
# SYSTEM SETTINGS (Only for Employee ID configuration)
# ==============================================================================

class SystemSetting(models.Model):
    """
    Key-value store for Employee ID configuration.
    Only employee_id related settings — nothing else.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=100, unique=True, help_text="Unique setting key")
    value = models.CharField(max_length=255, help_text="Setting value")
    description = models.TextField(blank=True, null=True)
    is_editable = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='updated_settings'
    )

    class Meta:
        db_table = 'system_settings'
        ordering = ['key']

    def __str__(self):
        return f"{self.key} = {self.value}"

    @classmethod
    def get_value(cls, key, default=None):
        """Helper to fetch a setting value with fallback."""
        try:
            return cls.objects.get(key=key).value
        except cls.DoesNotExist:
            return default

    @classmethod
    def set_value(cls, key, value, description=None):
        """Helper to create or update a setting."""
        setting, _ = cls.objects.update_or_create(
            key=key,
            defaults={
                'value': str(value),
                'description': description or '',
            }
        )
        return setting


# ==============================================================================
# PASSWORD RESET OTP
# ==============================================================================

class PasswordResetOTP(models.Model):
    """OTP-based password reset tokens."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'UserAccount',
        on_delete=models.CASCADE,
        related_name='password_reset_otps',
    )
    otp_hash = models.CharField(max_length=128, help_text="Hashed OTP")
    reset_token = models.CharField(
        max_length=64, blank=True,
        help_text="Token issued after OTP verified — used to set new password"
    )
    
    is_used = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    
    attempts = models.IntegerField(default=0)
    max_attempts = models.IntegerField(default=5)
    
    expires_at = models.DateTimeField()
    verified_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'password_reset_otps'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['reset_token']),
        ]

    def __str__(self):
        return f"OTP for {self.user.email} - {'Used' if self.is_used else 'Active'}"

    def is_expired(self):
        from django.utils import timezone as dj_tz
        return dj_tz.now() > self.expires_at

    def is_valid(self):
        return not self.is_used and not self.is_expired() and self.attempts < self.max_attempts
# ==============================================================================
# APPROVAL WORKFLOW ENGINE
# ==============================================================================

class ApprovalWorkflow(models.Model):
    """
    Configurable approval workflow.
    Currently supports LIFECYCLE module.
    Only ONE active workflow per module at a time.
    """
    MODULE_CHOICES = [
        ('LIFECYCLE', 'Lifecycle Change'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    module = models.CharField(max_length=30, choices=MODULE_CHOICES)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        'Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_workflows'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'approval_workflows'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['module'],
                condition=models.Q(is_active=True),
                name='unique_active_workflow_per_module'
            )
        ]

    def __str__(self):
        return f"{self.get_module_display()} - {self.name}"


class ApprovalWorkflowStep(models.Model):
    """A single step in an approval workflow."""
    APPROVER_TYPE_CHOICES = [
        ('REPORTING_MANAGER', 'Reporting Manager'),
        ('SKIP_LEVEL_MANAGER', 'Skip-Level Manager'),
        ('DEPARTMENT_HEAD', 'Department Head'),
        ('HR_ADMIN', 'Any HR Admin'),
        ('SYSTEM_ADMIN', 'Any System Admin'),
        ('SPECIFIC_EMPLOYEE', 'Specific Employee'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        ApprovalWorkflow, on_delete=models.CASCADE, related_name='steps'
    )
    step_number = models.IntegerField()
    step_name = models.CharField(max_length=100)
    approver_type = models.CharField(max_length=30, choices=APPROVER_TYPE_CHOICES)
    specific_employee = models.ForeignKey(
        'Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    sla_hours = models.IntegerField(default=48)

    class Meta:
        db_table = 'approval_workflow_steps'
        ordering = ['workflow', 'step_number']
        unique_together = [('workflow', 'step_number')]

    def __str__(self):
        return f"Step {self.step_number}: {self.step_name}"


class LetterTemplate(models.Model):
    """AI-generated or manual letter templates for PDF generation."""
    TEMPLATE_TYPE_CHOICES = [
        ('PROMOTION', 'Promotion Letter'),
        ('TRANSFER', 'Transfer Letter'),
        ('REDESIGNATION', 'Re-designation Letter'),
        ('CONFIRMATION', 'Confirmation Letter'),
        ('MANAGER_CHANGE', 'Manager Change Letter'),
        ('PERFORMANCE_RATING', 'Performance Rating Letter'),
        ('APPRAISAL_LETTER', 'Appraisal Letter'),
        ('PIP_LETTER', 'Performance Improvement Plan Letter'),
    ]
    CREATION_METHOD_CHOICES = [
        ('AI', 'AI Generated'),
        ('MANUAL', 'Manually Created'),
        ('AI_EDITED', 'AI Generated + Edited'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    template_type = models.CharField(max_length=30, choices=TEMPLATE_TYPE_CHOICES)
    subject = models.CharField(max_length=200)
    body_html = models.TextField()
    creation_method = models.CharField(max_length=20, choices=CREATION_METHOD_CHOICES)
    ai_prompt = models.TextField(blank=True, null=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        'Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_letter_templates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'letter_templates'
        ordering = ['-is_default', 'name']

    def __str__(self):
        return f"{self.get_template_type_display()} - {self.name}"


class LifecycleChangeRequest(models.Model):
    """Lifecycle change request that flows through approval workflow."""
    CHANGE_TYPE_CHOICES = [
        ('PROMOTION', 'Promotion'),
        ('TRANSFER', 'Transfer'),
        ('REDESIGNATION', 'Re-designation'),
        ('MANAGER_CHANGE', 'Manager Change'),
        ('CONFIRMATION', 'Confirmation'),
    ]
    STATUS_CHOICES = [
        ('IN_PROGRESS', 'In Progress'),
        ('APPROVED', 'Approved & Applied'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_number = models.CharField(max_length=30, unique=True)

    employee = models.ForeignKey(
        'Employee', on_delete=models.CASCADE, related_name='lifecycle_requests'
    )
    change_type = models.CharField(max_length=20, choices=CHANGE_TYPE_CHOICES)

    # Current snapshot
    current_position = models.ForeignKey(
        'JobPosition', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    current_manager = models.ForeignKey(
        'Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    current_location = models.ForeignKey(
        'CompanyStructure', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    current_status = models.CharField(max_length=15, blank=True)

    # Proposed
    proposed_position = models.ForeignKey(
        'JobPosition', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    proposed_manager = models.ForeignKey(
        'Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    proposed_location = models.ForeignKey(
        'CompanyStructure', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    proposed_status = models.CharField(max_length=15, blank=True)

    effective_date = models.DateField()
    reason = models.TextField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IN_PROGRESS')
    current_step_number = models.IntegerField(default=1)

    workflow = models.ForeignKey(
        ApprovalWorkflow, on_delete=models.PROTECT, related_name='requests'
    )
    requested_by = models.ForeignKey(
        'Employee', on_delete=models.PROTECT, related_name='raised_lifecycle_requests'
    )

    completed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)

    letter_template = models.ForeignKey(
        LetterTemplate, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    generated_document = models.ForeignKey(
        'EmployeeDocument', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lifecycle_change_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.request_number} - {self.employee.full_name}"


class LifecycleApprovalAction(models.Model):
    """Records each approval action + pending approvals."""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(
        LifecycleChangeRequest, on_delete=models.CASCADE, related_name='approval_actions'
    )
    step_number = models.IntegerField()
    step_name = models.CharField(max_length=100)

    assigned_to = models.ForeignKey(
        'Employee', on_delete=models.PROTECT,
        related_name='pending_lifecycle_approvals'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    acted_at = models.DateTimeField(null=True, blank=True)
    comments = models.TextField(blank=True, null=True)
    due_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'lifecycle_approval_actions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['assigned_to', 'status']),
        ]


# ==============================================================================
# NOTIFICATION MODEL (In-App Notifications)
# ==============================================================================

class Notification(models.Model):
    """In-app notifications for users."""
    TYPE_CHOICES = [
        ('APPROVAL_REQUEST', 'Approval Request'),
        ('APPROVAL_APPROVED', 'Request Approved'),
        ('APPROVAL_REJECTED', 'Request Rejected'),
        ('LETTER_GENERATED', 'Letter Generated'),
        ('SYSTEM', 'System Notification'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        'Employee', on_delete=models.CASCADE, related_name='notifications'
    )
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    link = models.CharField(max_length=500, blank=True, help_text="Frontend URL to navigate to")
    metadata = models.JSONField(default=dict, blank=True)

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read', '-created_at']),
        ]



# KRA and KPI module =======

class RatingScale(models.Model):
    """
    Company-wide performance rating scale.
    Typically 5 bands: Outstanding, Exceeds, Meets, Needs Improvement, Unsatisfactory.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rating = models.IntegerField(unique=True, help_text="1 to 5")
    label = models.CharField(max_length=50, help_text="e.g. 'Outstanding'")
    description = models.TextField(blank=True)
    min_percent = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Minimum score % to qualify (e.g. 120.00)"
    )
    max_percent = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Maximum score % (use 999.00 for open-ended)"
    )
    color_code = models.CharField(
        max_length=7, default='#3B82F6',
        help_text="Hex color for UI (e.g. #16A34A for green)"
    )
    triggers_pip = models.BooleanField(
        default=False,
        help_text="Triggers Performance Improvement Plan if TRUE"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rating_scales'
        ordering = ['-rating']

    def __str__(self):
        return f"{self.rating} - {self.label}"


# ------------------------------------------------------------------------------
# ORGANIZATIONAL PRIORITIES (CEO-set, yearly)
# ------------------------------------------------------------------------------

class OrganizationalPriority(models.Model):
    """
    Company-wide strategic priorities set by top management.
    Cascades down to departmental KRAs and employee scorecards.
    """
    REVIEW_FREQUENCY_CHOICES = [
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('HALF_YEARLY', 'Half-Yearly'),
        ('YEARLY', 'Yearly'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    financial_year = models.CharField(
        max_length=20,
        help_text="e.g. 'FY 2026-27'"
    )
    priority_number = models.IntegerField(help_text="Priority rank (1-8)")
    title = models.CharField(max_length=200)
    description = models.TextField()
    target = models.CharField(
        max_length=200,
        help_text="Organizational target (e.g. 'Grow revenue by 20%')"
    )
    owner = models.ForeignKey(
        'Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='owned_org_priorities',
        help_text="Executive owner (CFO, CTO, etc.)"
    )
    review_frequency = models.CharField(
        max_length=20,
        choices=REVIEW_FREQUENCY_CHOICES,
        default='QUARTERLY'
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        'Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_org_priorities'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'organizational_priorities'
        ordering = ['financial_year', 'priority_number']
        unique_together = [('financial_year', 'priority_number')]

    def __str__(self):
        return f"{self.financial_year} - #{self.priority_number}: {self.title}"


# ------------------------------------------------------------------------------
# DEPARTMENTAL KRA (Per department, per FY)
# ------------------------------------------------------------------------------

class DepartmentalKRA(models.Model):
    """
    Department-level KRAs that cascade from organizational priorities.
    Created by Department Heads / HR.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    department = models.ForeignKey(
        'CompanyStructure',
        on_delete=models.CASCADE,
        related_name='departmental_kras',
        limit_choices_to={'type': 'DEPARTMENT'}
    )
    financial_year = models.CharField(max_length=20)
    linked_priority = models.ForeignKey(
        OrganizationalPriority,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='departmental_kras',
        help_text="Which org priority this KRA supports"
    )
    name = models.CharField(max_length=200)
    description = models.TextField()
    weight_in_dept = models.DecimalField(
        max_digits=5, decimal_places=2,
        default=10.0,
        help_text="Weight % within department objectives"
    )
    owner = models.ForeignKey(
        'Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='owned_dept_kras',
        help_text="Department head or accountable person"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departmental_kras'
        ordering = ['department', '-financial_year', 'name']

    def __str__(self):
        return f"{self.department.name} - {self.name} ({self.financial_year})"


class DepartmentalKPI(models.Model):
    """KPIs under departmental KRAs."""
    KPI_TYPE_CHOICES = [
        ('NUMERIC_UP', 'Numeric (Higher is Better)'),
        ('NUMERIC_DOWN', 'Numeric (Lower is Better)'),
        ('PERCENTAGE', 'Percentage'),
        ('RATING', 'Rating (1-5)'),
        ('BOOLEAN', 'Yes/No'),
        ('CURRENCY', 'Currency'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dept_kra = models.ForeignKey(
        DepartmentalKRA,
        on_delete=models.CASCADE,
        related_name='kpis'
    )
    name = models.CharField(max_length=200)
    kpi_type = models.CharField(max_length=20, choices=KPI_TYPE_CHOICES)
    formula = models.TextField(
        blank=True,
        help_text="How this KPI is calculated"
    )
    target = models.CharField(max_length=100)
    data_source = models.CharField(
        max_length=200,
        blank=True,
        help_text="e.g. CRM, ERP, Manual"
    )
    weight = models.DecimalField(
        max_digits=5, decimal_places=2,
        default=100.0,
        help_text="Weight % within this KRA"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'departmental_kpis'
        ordering = ['dept_kra', 'name']

    def __str__(self):
        return f"{self.dept_kra.name} - {self.name}"


# ------------------------------------------------------------------------------
# KRA LIBRARY (Master pool of role-based KRAs)
# ------------------------------------------------------------------------------

class KRALibrary(models.Model):
    """
    Master library of KRAs available for employee scorecards.
    Employees pick from this library when building their scorecard.
    """
    KRA_SOURCE_CHOICES = [
        ('ROLE', 'Role-Based (specific to job position)'),
        ('COMMON', 'Common (applies to all employees)'),
        ('DEPARTMENTAL', 'Departmental (specific to department)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField()
    kra_source = models.CharField(
        max_length=20,
        choices=KRA_SOURCE_CHOICES,
        default='ROLE'
    )
    applicable_positions = models.ManyToManyField(
        'JobPosition',
        blank=True,
        related_name='library_kras',
        help_text="Which job positions can use this KRA (empty = all)"
    )
    applicable_departments = models.ManyToManyField(
        'CompanyStructure',
        blank=True,
        related_name='library_kras',
        limit_choices_to={'type': 'DEPARTMENT'},
        help_text="Which departments can use this KRA (empty = all)"
    )
    peer_rating_required = models.BooleanField(
        default=False,
        help_text="If TRUE, peers must rate this KRA during review"
    )
    is_mandatory = models.BooleanField(
        default=False,
        help_text="If TRUE, auto-added to every applicable employee's scorecard"
    )
    suggested_weight_min = models.DecimalField(
        max_digits=5, decimal_places=2,
        default=5.0,
        help_text="Suggested minimum weight %"
    )
    suggested_weight_max = models.DecimalField(
        max_digits=5, decimal_places=2,
        default=30.0,
        help_text="Suggested maximum weight %"
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        'Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_kras'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kra_library'
        ordering = ['kra_source', 'name']

    def __str__(self):
        return f"[{self.kra_source}] {self.name}"


class KPILibraryItem(models.Model):
    """
    KPI options within a library KRA.
    Employees pick 1-3 KPIs per KRA from these options.
    """
    INDICATOR_TYPE_CHOICES = [
        ('OUTPUT', 'Output (Revenue, Volume)'),
        ('QUALITY', 'Quality (Defects, Complaints)'),
        ('EFFICIENCY', 'Efficiency (Cost, Time)'),
        ('TIMELINESS', 'Timeliness (On-time delivery)'),
        ('COMPLIANCE', 'Compliance (Audits)'),
        ('CAPABILITY', 'Capability (Skills, Training)'),
    ]
    KPI_TYPE_CHOICES = [
        ('NUMERIC_UP', 'Numeric (Higher is Better)'),
        ('NUMERIC_DOWN', 'Numeric (Lower is Better)'),
        ('PERCENTAGE', 'Percentage'),
        ('RATING', 'Rating (1-5)'),
        ('BOOLEAN', 'Yes/No'),
        ('CURRENCY', 'Currency'),
    ]
    MEASUREMENT_FREQUENCY_CHOICES = [
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('HALF_YEARLY', 'Half-Yearly'),
        ('YEARLY', 'Yearly'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kra = models.ForeignKey(
        KRALibrary,
        on_delete=models.CASCADE,
        related_name='kpi_options'
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    indicator_type = models.CharField(
        max_length=20,
        choices=INDICATOR_TYPE_CHOICES,
        default='OUTPUT'
    )
    kpi_type = models.CharField(
        max_length=20,
        choices=KPI_TYPE_CHOICES,
        default='NUMERIC_UP'
    )
    default_formula = models.TextField(
        blank=True,
        help_text="e.g. 'Total revenue / Number of clients'"
    )
    default_data_source = models.CharField(
        max_length=200,
        blank=True,
        help_text="e.g. 'CRM Dashboard'"
    )
    measurement_frequency = models.CharField(
        max_length=20,
        choices=MEASUREMENT_FREQUENCY_CHOICES,
        default='QUARTERLY'
    )
    suggested_baseline = models.CharField(max_length=100, blank=True)
    suggested_target_minimum = models.CharField(max_length=100, blank=True)
    suggested_target_expected = models.CharField(max_length=100, blank=True)
    suggested_target_exceptional = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'kpi_library_items'
        ordering = ['kra', 'name']

    def __str__(self):
        return f"{self.kra.name} → {self.name}"



class PerformanceCycle(models.Model):
    """
    A performance review cycle with phase-based timeline.
    Supports monthly, quarterly, or yearly cycles.
    """
    CYCLE_TYPE_CHOICES = [
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('HALF_YEARLY', 'Half-Yearly'),
        ('YEARLY', 'Yearly'),
    ]
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ACTIVE', 'Active'),
        ('CLOSED', 'Closed'),
        ('ARCHIVED', 'Archived'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, help_text="e.g. 'FY 2026 Q1 Review'")
    cycle_type = models.CharField(max_length=20, choices=CYCLE_TYPE_CHOICES)
    financial_year = models.CharField(max_length=20, help_text="e.g. 'FY 2026-27'")
    
    period_start = models.DateField()
    period_end = models.DateField()
    
    # Phase timeline (all configurable)
    goal_setting_start = models.DateField(help_text="Employee builds scorecard")
    goal_setting_end = models.DateField()
    
    manager_review_start = models.DateField(
        help_text="Manager reviews & customizes scorecard"
    )
    manager_review_end = models.DateField()
    
    working_start = models.DateField(help_text="Working period begins")
    working_end = models.DateField()
    
    peer_rating_start = models.DateField(help_text="Peer rating window")
    peer_rating_end = models.DateField()
    
    self_review_start = models.DateField(help_text="Employee self-review")
    self_review_end = models.DateField()
    
    final_review_start = models.DateField(help_text="Manager final review & scoring")
    final_review_end = models.DateField()
    
    finalization_start = models.DateField(help_text="HR closes cycle")
    finalization_end = models.DateField()
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    applicable_departments = models.ManyToManyField(
        'CompanyStructure',
        blank=True,
        related_name='performance_cycles',
        limit_choices_to={'type': 'DEPARTMENT'},
        help_text="Departments this cycle applies to (empty = all)"
    )
    
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_perf_cycles'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'performance_cycles'
        ordering = ['-period_start']

    def __str__(self):
        return f"{self.name} ({self.get_cycle_type_display()})"

    @property
    def current_phase(self):
        """Determine which phase we're currently in based on today's date."""
        from django.utils import timezone
        today = timezone.now().date()
        
        if today < self.goal_setting_start:
            return 'NOT_STARTED'
        if self.goal_setting_start <= today <= self.goal_setting_end:
            return 'GOAL_SETTING'
        if self.manager_review_start <= today <= self.manager_review_end:
            return 'MANAGER_REVIEW'
        if self.working_start <= today <= self.working_end:
            return 'WORKING'
        if self.peer_rating_start <= today <= self.peer_rating_end:
            return 'PEER_RATING'
        if self.self_review_start <= today <= self.self_review_end:
            return 'SELF_REVIEW'
        if self.final_review_start <= today <= self.final_review_end:
            return 'FINAL_REVIEW'
        if self.finalization_start <= today <= self.finalization_end:
            return 'FINALIZATION'
        if today > self.finalization_end:
            return 'COMPLETED'
        return 'UNKNOWN'


# ------------------------------------------------------------------------------
# EMPLOYEE SCORECARD (per employee, per cycle)
# ------------------------------------------------------------------------------

class EmployeeScorecard(models.Model):
    """
    An employee's scorecard for a specific performance cycle.
    Auto-created when cycle activates for applicable employees.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft - Employee Building'),
        ('SUBMITTED', 'Submitted for Manager Review'),
        ('MANAGER_REVIEWING', 'Manager Reviewing'),
        ('SENT_BACK', 'Sent Back for Revision'),
        ('APPROVED', 'Approved by Manager'),
        ('SIGNED_OFF', 'Signed Off - Active'),
        ('SELF_REVIEW_PENDING', 'Self Review Pending'),
        ('SELF_REVIEWED', 'Self Review Complete'),
        ('MANAGER_REVIEW_PENDING', 'Final Review Pending'),
        ('MANAGER_REVIEWED', 'Final Review Complete'),
        ('FINALIZED', 'Finalized'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        'Employee', on_delete=models.CASCADE, related_name='scorecards'
    )
    cycle = models.ForeignKey(
        PerformanceCycle, on_delete=models.CASCADE, related_name='scorecards'
    )
    
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='DRAFT')
    
    # Sign-off tracking
    employee_signed_off_at = models.DateTimeField(null=True, blank=True)
    manager_signed_off_at = models.DateTimeField(null=True, blank=True)
    manager_signed_off_by = models.ForeignKey(
        'Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='manager_signoffs'
    )
    
    # Return-for-revision tracking
    sent_back_reason = models.TextField(blank=True, null=True)
    sent_back_at = models.DateTimeField(null=True, blank=True)
    
    # Final scores (calculated at cycle end)
    self_score = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Employee's self-assessment score"
    )
    peer_score = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Aggregated peer score"
    )
    manager_score = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Manager's assessment score"
    )
    final_score = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Auto-calculated final weighted score"
    )
    final_rating = models.IntegerField(
        null=True, blank=True,
        help_text="Rating band (1-5) based on final_score"
    )
    
    # Metadata
    total_weight = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Sum of all KRA weights (should be 100)"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_scorecards'
        ordering = ['-created_at']
        unique_together = [('employee', 'cycle')]
        indexes = [
            models.Index(fields=['employee', 'cycle']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f"{self.employee.full_name} - {self.cycle.name}"


# ------------------------------------------------------------------------------
# EMPLOYEE KRA (per scorecard)
# ------------------------------------------------------------------------------

class EmployeeKRA(models.Model):
    """
    A KRA assigned to an employee for a specific cycle.
    Can be from library or custom-added.
    """
    KRA_SOURCE_CHOICES = [
        ('LIBRARY', 'From KRA Library'),
        ('CUSTOM', 'Custom (Manager/Employee Added)'),
        ('MANDATORY', 'Mandatory (Auto-added)'),
        ('INHERITED', 'Inherited (from dept/common)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scorecard = models.ForeignKey(
        EmployeeScorecard, on_delete=models.CASCADE, related_name='kras'
    )
    library_kra = models.ForeignKey(
        'KRALibrary', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='employee_kras',
        help_text="Source library KRA (nullable if custom)"
    )
    
    # Snapshot fields (in case library KRA changes later)
    name = models.CharField(max_length=200)
    description = models.TextField()
    weight = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Weight % within scorecard"
    )
    peer_rating_required = models.BooleanField(default=False)
    kra_source = models.CharField(
        max_length=20, choices=KRA_SOURCE_CHOICES, default='LIBRARY'
    )
    
    # Optional linkage to org priority
    linked_priority = models.ForeignKey(
        'OrganizationalPriority', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
        help_text="Which org priority this KRA supports"
    )
    
    # Employee's rationale for including this KRA
    rationale = models.TextField(
        blank=True,
        help_text="Why the employee/manager included this KRA"
    )
    
    # Auto-calculated KRA score (after review)
    kra_score = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_kras'
        ordering = ['scorecard', 'display_order', 'name']

    def __str__(self):
        return f"{self.scorecard.employee.full_name} - {self.name}"


# ------------------------------------------------------------------------------
# EMPLOYEE KPI (per KRA)
# ------------------------------------------------------------------------------

class EmployeeKPI(models.Model):
    """
    A KPI under an EmployeeKRA.
    Contains target, self actual, manager actual, and calculated score.
    """
    KPI_TYPE_CHOICES = [
        ('NUMERIC_UP', 'Numeric (Higher is Better)'),
        ('NUMERIC_DOWN', 'Numeric (Lower is Better)'),
        ('PERCENTAGE', 'Percentage'),
        ('RATING', 'Rating (1-5)'),
        ('BOOLEAN', 'Yes/No'),
        ('CURRENCY', 'Currency'),
    ]
    INDICATOR_TYPE_CHOICES = [
        ('OUTPUT', 'Output'),
        ('QUALITY', 'Quality'),
        ('EFFICIENCY', 'Efficiency'),
        ('TIMELINESS', 'Timeliness'),
        ('COMPLIANCE', 'Compliance'),
        ('CAPABILITY', 'Capability'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_kra = models.ForeignKey(
        EmployeeKRA, on_delete=models.CASCADE, related_name='kpis'
    )
    library_kpi = models.ForeignKey(
        'KPILibraryItem', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='employee_kpis'
    )
    
    # Definition
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    indicator_type = models.CharField(
        max_length=20, choices=INDICATOR_TYPE_CHOICES, default='OUTPUT'
    )
    kpi_type = models.CharField(max_length=20, choices=KPI_TYPE_CHOICES)
    
    formula = models.TextField(blank=True)
    baseline = models.CharField(max_length=100, blank=True)
    
    # Three-tier targets
    target_minimum = models.CharField(max_length=100, blank=True)
    target_expected = models.CharField(max_length=100)
    target_exceptional = models.CharField(max_length=100, blank=True)
    
    data_source = models.CharField(max_length=200, blank=True)
    weight_in_kra = models.DecimalField(
        max_digits=5, decimal_places=2, default=100.0,
        help_text="Weight % within its KRA"
    )
    
    # Action plan (employee's plan to achieve)
    action_plan = models.TextField(
        blank=True,
        help_text="Employee's plan for how they'll achieve target"
    )
    
    # Self review data
    self_actual = models.CharField(max_length=200, blank=True)
    self_rating = models.IntegerField(null=True, blank=True, help_text="1-5")
    self_comment = models.TextField(blank=True)
    self_reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Manager review data
    manager_actual = models.CharField(max_length=200, blank=True)
    manager_rating = models.IntegerField(null=True, blank=True, help_text="1-5")
    manager_comment = models.TextField(blank=True)
    manager_override_reason = models.TextField(
        blank=True,
        help_text="Reason if manager_actual differs from self_actual"
    )
    manager_reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Auto-calculated score
    weighted_score = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_kpis'
        ordering = ['employee_kra', 'display_order', 'name']

    def __str__(self):
        return f"{self.employee_kra.name} → {self.name}"


# ------------------------------------------------------------------------------
# EMPLOYEE KPI EVIDENCE (file uploads for KPIs)
# ------------------------------------------------------------------------------

class EmployeeKPIEvidence(models.Model):
    """Evidence files uploaded by employee to support KPI achievement."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kpi = models.ForeignKey(
        EmployeeKPI, on_delete=models.CASCADE, related_name='evidences'
    )
    file = models.FileField(upload_to='kpi_evidences/%Y/%m/')
    file_name = models.CharField(max_length=200)
    file_size_kb = models.IntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True)
    description = models.CharField(max_length=500, blank=True)
    uploaded_by = models.ForeignKey(
        'Employee', on_delete=models.SET_NULL, null=True,
        related_name='uploaded_kpi_evidences'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'employee_kpi_evidences'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.kpi.name} - {self.file_name}"



class KRAPeerNomination(models.Model):
    """
    Records which peers are nominated to rate a specific KRA of an employee.
    Only created for KRAs where peer_rating_required = True.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_kra = models.ForeignKey(
        'EmployeeKRA',
        on_delete=models.CASCADE,
        related_name='peer_nominations',
    )
    nominated_peer = models.ForeignKey(
        'Employee',
        on_delete=models.CASCADE,
        related_name='peer_nominations_received',
    )
    nominated_by = models.ForeignKey(
        'Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='peer_nominations_made',
        help_text="Manager who selected this peer",
    )
    nominated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'kra_peer_nominations'
        ordering = ['-nominated_at']
        unique_together = [('employee_kra', 'nominated_peer')]
        indexes = [
            models.Index(fields=['nominated_peer', '-nominated_at']),
        ]

    def __str__(self):
        return f"{self.nominated_peer.full_name} → {self.employee_kra.name}"


# ------------------------------------------------------------------------------
# PEER RATING (Peer's actual submission)
# ------------------------------------------------------------------------------

class PeerRating(models.Model):
    """
    A peer's rating submission for a specific KRA.
    Comments visible only to HR & Manager (not to the employee being rated).
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUBMITTED', 'Submitted'),
        ('DECLINED', 'Declined'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nomination = models.OneToOneField(
        KRAPeerNomination,
        on_delete=models.CASCADE,
        related_name='rating',
    )

    # Rating
    rating = models.IntegerField(
        null=True, blank=True,
        help_text="1-5 rating scale",
    )

    # Comments (visible only to HR & Manager)
    strengths_comment = models.TextField(
        blank=True,
        help_text="What the person does well (HR/Manager only)",
    )
    improvements_comment = models.TextField(
        blank=True,
        help_text="Areas for improvement (HR/Manager only)",
    )
    additional_comments = models.TextField(
        blank=True,
        help_text="Any other feedback (HR/Manager only)",
    )

    # Anonymity — peer's identity not shown to the rated employee
    is_anonymous_to_employee = models.BooleanField(
        default=True,
        help_text="If TRUE, employee never sees which peer gave which rating",
    )

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING'
    )
    decline_reason = models.TextField(blank=True)

    submitted_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Deadline based on cycle's peer_rating_end date",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'peer_ratings'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'due_at']),
        ]

    def __str__(self):
        return f"Rating by {self.nomination.nominated_peer.full_name} - {self.get_status_display()}"