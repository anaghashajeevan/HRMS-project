from django.db import models

# Create your models here.
"""
Policy Management models.
Covers: Authoring, Versioning, Approval, Distribution, Acknowledgment, Compliance.
All models use UUID primary keys.
"""

import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


# ==============================================================================
# 1. POLICY CATEGORY
# ==============================================================================

class PolicyCategory(models.Model):
    """Categories: HR, IT, Safety, Compliance, Finance, etc."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True, help_text="Short code like HR, IT, SAFETY")
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Lucide icon name (e.g., shield, laptop)")
    color_code = models.CharField(max_length=7, default='#3B82F6')
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'policy_categories'
        ordering = ['display_order', 'name']
        verbose_name = 'Policy Category'
        verbose_name_plural = 'Policy Categories'

    def __str__(self):
        return f"{self.code} - {self.name}"


# ==============================================================================
# 2. POLICY (Main record)
# ==============================================================================

class Policy(models.Model):
    """A company policy document with versioning + distribution."""

    STATUS_DRAFT = 'DRAFT'
    STATUS_IN_REVIEW = 'IN_REVIEW'
    STATUS_APPROVED = 'APPROVED'
    STATUS_PUBLISHED = 'PUBLISHED'
    STATUS_ARCHIVED = 'ARCHIVED'
    STATUS_EXPIRED = 'EXPIRED'

    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_IN_REVIEW, 'In Review'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_PUBLISHED, 'Published'),
        (STATUS_ARCHIVED, 'Archived'),
        (STATUS_EXPIRED, 'Expired'),
    ]

    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Basic info
    policy_number = models.CharField(max_length=30, unique=True, help_text="Auto-generated: POL-HR-001")
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True, help_text="Brief summary shown in policy library")
    category = models.ForeignKey(
        PolicyCategory,
        on_delete=models.PROTECT,
        related_name='policies',
    )
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='MEDIUM')
    tags = models.CharField(max_length=500, blank=True, help_text="Comma-separated tags for search")

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)

    # Current published version
    current_version = models.ForeignKey(
        'PolicyVersion',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='current_for_policy',
    )

    # ===========================================================================
    # APPLICABILITY — Who must see this policy
    # ===========================================================================
    applies_to_all = models.BooleanField(
        default=True,
        help_text="If True, all active employees receive this policy"
    )
    applicable_departments = models.ManyToManyField(
        'HRMSapp.CompanyStructure',
        blank=True,
        related_name='applicable_policies',
        limit_choices_to={'type': 'DEPARTMENT'},
    )
    applicable_positions = models.ManyToManyField(
        'HRMSapp.JobPosition',
        blank=True,
        related_name='applicable_policies',
    )
    applicable_locations = models.ManyToManyField(
        'HRMSapp.CompanyStructure',
        blank=True,
        related_name='location_policies',
        limit_choices_to={'type__in': ['LOCATION', 'COMPANY']},
    )
    # Employee status filter
    applicable_employee_statuses = models.CharField(
        max_length=100,
        default='ACTIVE,PROBATION',
        help_text="Comma-separated: ACTIVE,PROBATION,SUSPENDED"
    )

    # ===========================================================================
    # ACKNOWLEDGMENT SETTINGS
    # ===========================================================================
    requires_acknowledgment = models.BooleanField(default=True)
    acknowledgment_deadline_days = models.IntegerField(
        default=14,
        help_text="Days after publishing to acknowledge"
    )
    is_mandatory = models.BooleanField(
        default=False,
        help_text="If True, pushed to new employees automatically (onboarding)"
    )
    acknowledgment_text = models.TextField(
        default='I have read and understood this policy and agree to comply with its terms.',
        help_text="Text shown in the acknowledgment checkbox"
    )

    # ===========================================================================
    # REVIEW CYCLE
    # ===========================================================================
    review_interval_months = models.IntegerField(
        default=12,
        help_text="Review every N months (0 = no auto-review)"
    )
    next_review_date = models.DateField(null=True, blank=True)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)

    # ===========================================================================
    # DATES
    # ===========================================================================
    effective_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    # ===========================================================================
    # OWNERSHIP
    # ===========================================================================
    policy_owner = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='owned_policies',
        help_text="Employee responsible for this policy"
    )
    created_by = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_policies',
    )
    return_comments = models.TextField(
        blank=True,
        help_text="Comments from approver requesting changes"
    )
    returned_at = models.DateTimeField(null=True, blank=True)
    returned_by = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='returned_policies',
        help_text="Approver who returned the policy"
    )
    return_count = models.IntegerField(
        default=0,
        help_text="How many times this policy has been returned"
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'policies'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['status', 'is_active']),
            models.Index(fields=['category', 'status']),
        ]

    def __str__(self):
        return f"{self.policy_number} - {self.title}"

    @property
    def is_published(self):
        return self.status == self.STATUS_PUBLISHED

    @property
    def is_expired(self):
        if not self.expiry_date:
            return False
        return self.expiry_date < timezone.localdate()

    @property
    def needs_review(self):
        if not self.next_review_date:
            return False
        return self.next_review_date <= timezone.localdate()


# ==============================================================================
# 3. POLICY VERSION (Content + version history)
# ==============================================================================

class PolicyVersion(models.Model):
    """Each edit creates a new version. Old versions archived for audit."""

    CONTENT_TYPE_CHOICES = [
        ('HTML', 'Rich Text (HTML)'),
        ('PDF', 'PDF Upload'),
        ('DOCX', 'Word Document'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    policy = models.ForeignKey(
        Policy,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    version_number = models.CharField(
        max_length=10,
        help_text="Semantic version like 1.0, 1.1, 2.0"
    )

    # Content — either rich text or uploaded file
    content_html = models.TextField(blank=True, help_text="Rich text content")
    content_file = models.FileField(
        upload_to='policies/documents/%Y/%m/',
        null=True, blank=True,
        help_text="Uploaded PDF or DOCX"
    )
    content_type = models.CharField(
        max_length=10,
        choices=CONTENT_TYPE_CHOICES,
        default='HTML',
    )

    # Change tracking
    change_summary = models.TextField(
        blank=True,
        help_text="What changed in this version (shown to employees)"
    )

    # Authoring
    created_by = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='policy_versions_created',
    )

    # Publication status
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)

    # Effective period
    effective_from = models.DateField(
        help_text="This version is effective from this date"
    )
    effective_to = models.DateField(
        null=True, blank=True,
        help_text="This version is effective until this date (set when new version published)"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'policy_versions'
        ordering = ['policy', '-created_at']
        unique_together = [('policy', 'version_number')]

    def __str__(self):
        return f"{self.policy.policy_number} v{self.version_number}"


# ==============================================================================
# 4. POLICY APPROVAL (Workflow trail for policy changes)
# ==============================================================================

class PolicyApproval(models.Model):
    """Track approval steps for a policy version."""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('RETURNED', 'Returned for Changes')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    version = models.ForeignKey(
        PolicyVersion,
        on_delete=models.CASCADE,
        related_name='approvals',
    )
    step_number = models.IntegerField()
    step_name = models.CharField(max_length=100)

    approver = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.PROTECT,
        related_name='policy_approvals',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    acted_at = models.DateTimeField(null=True, blank=True)
    comments = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'policy_approvals'
        ordering = ['version', 'step_number']

    def __str__(self):
        return f"{self.version} Step {self.step_number} - {self.status}"


# ==============================================================================
# 5. POLICY DISTRIBUTION (Who should see + acknowledge)
# ==============================================================================

class PolicyDistribution(models.Model):
    """Track which employees received a policy and their acknowledgment status."""

    ACKNOWLEDGMENT_METHOD_CHOICES = [
        ('CHECKBOX', 'Checkbox Acknowledgment'),
        ('SIGNATURE', 'Digital Signature'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    policy = models.ForeignKey(
        Policy,
        on_delete=models.CASCADE,
        related_name='distributions',
    )
    version = models.ForeignKey(
        PolicyVersion,
        on_delete=models.CASCADE,
        related_name='distributions',
    )
    employee = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.CASCADE,
        related_name='policy_distributions',
    )

    # Distribution
    distributed_at = models.DateTimeField(auto_now_add=True)
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)

    # Reading
    first_opened_at = models.DateTimeField(null=True, blank=True)
    last_viewed_at = models.DateTimeField(null=True, blank=True)
    total_views = models.IntegerField(default=0)
    total_time_spent_seconds = models.IntegerField(default=0)

    # Acknowledgment
    acknowledged = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledgment_method = models.CharField(
        max_length=20,
        choices=ACKNOWLEDGMENT_METHOD_CHOICES,
        default='CHECKBOX',
    )
    acknowledgment_ip = models.GenericIPAddressField(null=True, blank=True)

    # Deadline
    deadline = models.DateField()
    is_overdue = models.BooleanField(default=False)

    # Reminders
    reminders_sent = models.IntegerField(default=0)
    last_reminder_at = models.DateTimeField(null=True, blank=True)

    # Invalidation (when policy updated to new version)
    is_invalidated = models.BooleanField(
        default=False,
        help_text="Set True when policy updated — employee must re-acknowledge new version"
    )
    invalidated_at = models.DateTimeField(null=True, blank=True)
    invalidation_reason = models.CharField(max_length=200, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'policy_distributions'
        ordering = ['-distributed_at']
        indexes = [
            models.Index(fields=['employee', 'acknowledged']),
            models.Index(fields=['policy', 'acknowledged']),
            models.Index(fields=['deadline', 'is_overdue']),
        ]
        unique_together = [('policy', 'version', 'employee')]

    def __str__(self):
        status = "✅ Acknowledged" if self.acknowledged else "⏳ Pending"
        return f"{self.employee.employee_id} - {self.policy.title} - {status}"

    @property
    def days_until_deadline(self):
        if not self.deadline:
            return None
        return (self.deadline - timezone.localdate()).days

    @property
    def is_deadline_passed(self):
        return self.deadline < timezone.localdate()


# ==============================================================================
# 6. POLICY READ LOG (Detailed view tracking)
# ==============================================================================

class PolicyReadLog(models.Model):
    """Detailed log of when employee viewed the policy."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    distribution = models.ForeignKey(
        PolicyDistribution,
        on_delete=models.CASCADE,
        related_name='read_logs',
    )
    employee = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.CASCADE,
        related_name='policy_read_logs',
    )

    viewed_at = models.DateTimeField(auto_now_add=True)
    time_spent_seconds = models.IntegerField(
        default=0,
        help_text="How long the policy was open (approximate)"
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        db_table = 'policy_read_logs'
        ordering = ['-viewed_at']

    def __str__(self):
        return f"{self.employee.employee_id} viewed at {self.viewed_at}"


# ==============================================================================
# 7. POLICY REMINDER LOG (Track sent reminders)
# ==============================================================================

class PolicyReminderLog(models.Model):
    """Track acknowledgment reminders sent to employees/managers."""

    REMINDER_TYPE_CHOICES = [
        ('EMAIL_EMPLOYEE', 'Email to Employee'),
        ('NOTIFICATION_EMPLOYEE', 'In-App to Employee'),
        ('EMAIL_MANAGER', 'Escalation Email to Manager'),
        ('NOTIFICATION_MANAGER', 'Escalation Notification to Manager'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    distribution = models.ForeignKey(
        PolicyDistribution,
        on_delete=models.CASCADE,
        related_name='reminder_logs',
    )
    reminder_type = models.CharField(max_length=30, choices=REMINDER_TYPE_CHOICES)
    sent_at = models.DateTimeField(auto_now_add=True)
    sent_to_email = models.EmailField(blank=True)
    sent_to_name = models.CharField(max_length=200, blank=True)
    days_before_deadline = models.IntegerField(
        default=0,
        help_text="Negative means days AFTER deadline (overdue)"
    )

    class Meta:
        db_table = 'policy_reminder_logs'
        ordering = ['-sent_at']

    def __str__(self):
        return f"{self.reminder_type} at {self.sent_at}"


# ==============================================================================
# 8. POLICY COMMENT (Employee Q&A on policies)
# ==============================================================================

class PolicyComment(models.Model):
    """Employee questions/comments on a policy. Supports threading."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    policy = models.ForeignKey(
        Policy,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    employee = models.ForeignKey(
        'HRMSapp.Employee',
        on_delete=models.CASCADE,
        related_name='policy_comments',
    )
    parent = models.ForeignKey(
        'self',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='replies',
        help_text="For threaded replies"
    )

    content = models.TextField()

    is_resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(
        'HRMSapp.Employee',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='resolved_policy_comments',
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    is_visible = models.BooleanField(
        default=True,
        help_text="HR can hide inappropriate comments"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'policy_comments'
        ordering = ['-created_at']

    def __str__(self):
        return f"Comment by {self.employee.employee_id} on {self.policy.title}"