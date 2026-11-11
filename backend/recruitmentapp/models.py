import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible
from django.utils import timezone


def default_requester_roles():
    return ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'REPORTING_MANAGER', 'HOD']


@deconstructible
class PrivateResumeStorage(FileSystemStorage):
    """Store candidate resumes outside MEDIA_ROOT for authenticated downloads."""
    def __init__(self):
        super().__init__(location=Path(settings.BASE_DIR) / 'private_uploads', base_url=None)


def candidate_resume_path(instance, filename):
    suffix = Path(filename).suffix.lower()
    return f'recruitment/resumes/{uuid.uuid4().hex}{suffix}'


class RecruitmentSettings(models.Model):
    """Initial hiring controls. Configure permitted requisition creators."""
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    allowed_requester_roles = models.JSONField(default=default_requester_roles)
    updated_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_recruitment_settings',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recruitment_settings'


class RecruitmentStage(models.Model):
    OUTCOME_CHOICES = [('OPEN', 'Open'), ('HIRED', 'Hired'), ('REJECTED', 'Rejected')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=100)
    order = models.PositiveSmallIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    is_terminal = models.BooleanField(default=False)
    terminal_outcome = models.CharField(max_length=12, choices=OUTCOME_CHOICES, default='OPEN')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recruitment_stages'
        ordering = ['order', 'name']
        constraints = [
            models.UniqueConstraint(fields=['order'], condition=models.Q(is_active=True), name='unique_active_recruitment_stage_order'),
            models.CheckConstraint(
                condition=(models.Q(is_terminal=True) | models.Q(terminal_outcome='OPEN')),
                name='nonterminal_recruitment_stage_open',
            ),
        ]


class RecruitmentEmailTemplate(models.Model):
    PURPOSE_CHOICES = [
        ('APPLICATION_RECEIVED', 'Application Received'),
        ('STAGE_UPDATE', 'Application Stage Update'),
        ('INTERVIEW_INVITATION', 'Interview Invitation'),
        ('REJECTION', 'Application Rejection'),
        ('OFFER', 'Offer Email'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    purpose = models.CharField(max_length=30, choices=PURPOSE_CHOICES)
    subject = models.CharField(max_length=200)
    body = models.TextField()
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recruitment_email_templates'
        ordering = ['purpose', 'name']


class InterviewScorecard(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    criteria = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'interview_scorecards'
        ordering = ['name']


class OfferRule(models.Model):
    APPROVER_CHOICES = [
        ('HR_ADMIN', 'HR Administrator'),
        ('FINANCE_ADMIN', 'Finance Approver'),
        ('SYSTEM_ADMIN', 'System Administrator'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    grade_band = models.CharField(max_length=20)
    currency = models.CharField(max_length=3, default='INR')
    minimum_salary = models.DecimalField(max_digits=12, decimal_places=2)
    maximum_salary = models.DecimalField(max_digits=12, decimal_places=2)
    maximum_signing_bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    required_approvers = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recruitment_offer_rules'
        ordering = ['grade_band', 'name']
        constraints = [
            models.CheckConstraint(condition=models.Q(maximum_salary__gte=models.F('minimum_salary')), name='offer_rule_salary_range_valid'),
            models.CheckConstraint(condition=models.Q(maximum_signing_bonus__gte=0), name='offer_rule_bonus_nonnegative'),
            models.UniqueConstraint(fields=['grade_band'], condition=models.Q(is_active=True), name='unique_active_offer_rule_grade'),
        ]


class HiringRequisition(models.Model):
    STATUS_CHOICES = [
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('FILLED', 'Filled'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]
    ACTIVE_RESERVATION_STATUSES = ('PENDING_APPROVAL', 'APPROVED')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition_number = models.CharField(max_length=30, unique=True)
    requested_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.PROTECT, related_name='hiring_requisitions',
    )
    department = models.ForeignKey(
        'HRMSapp.CompanyStructure', on_delete=models.PROTECT, related_name='hiring_requisitions',
    )
    position = models.ForeignKey(
        'HRMSapp.JobPosition', on_delete=models.PROTECT, related_name='hiring_requisitions',
    )
    grade_band = models.CharField(max_length=20)
    location = models.ForeignKey(
        'HRMSapp.CompanyStructure', on_delete=models.PROTECT, related_name='requisitions_at_location',
    )
    openings = models.PositiveSmallIntegerField()
    is_replacement = models.BooleanField(default=False)
    replacing_employee = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='replacement_requisitions',
    )
    reason = models.TextField()
    target_start_date = models.DateField()
    budgeted_count_at_request = models.PositiveIntegerField()
    filled_count_at_request = models.PositiveIntegerField()
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='PENDING_APPROVAL')
    workflow = models.ForeignKey(
        'HRMSapp.ApprovalWorkflow', on_delete=models.PROTECT, related_name='hiring_requisitions',
    )
    workflow_steps_snapshot = models.JSONField(default=list)
    current_step_number = models.PositiveSmallIntegerField(default=1)
    rejection_reason = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hiring_requisitions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['position', 'status']),
            models.Index(fields=['requested_by', 'status']),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(openings__gt=0), name='requisition_openings_positive'),
        ]

    def __str__(self):
        return f'{self.requisition_number} - {self.position.title}'


class HiringApprovalAction(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(
        HiringRequisition, on_delete=models.CASCADE, related_name='approval_actions',
    )
    step_number = models.PositiveSmallIntegerField()
    step_name = models.CharField(max_length=100)
    assigned_to = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.PROTECT, related_name='hiring_approval_actions',
    )
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='PENDING')
    comments = models.TextField(blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hiring_approval_actions'
        ordering = ['step_number', 'created_at']
        indexes = [models.Index(fields=['assigned_to', 'status'])]


class RecruitmentCandidate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30)
    resume = models.FileField(
        upload_to=candidate_resume_path,
        storage=PrivateResumeStorage(),
    )
    resume_original_filename = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='recruitment_candidates_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recruitment_candidates'
        ordering = ['last_name', 'first_name', 'email']

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()


class CandidateApplication(models.Model):
    SCREENING_DECISIONS = [
        ('PENDING', 'Pending'),
        ('PASS', 'Pass'),
        ('HOLD', 'Hold'),
        ('REJECT', 'Reject'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        RecruitmentCandidate, on_delete=models.CASCADE, related_name='applications',
    )
    requisition = models.ForeignKey(
        HiringRequisition, on_delete=models.PROTECT, related_name='candidate_applications',
    )
    stage = models.ForeignKey(
        RecruitmentStage, on_delete=models.PROTECT, related_name='candidate_applications',
    )
    screening_decision = models.CharField(max_length=10, choices=SCREENING_DECISIONS, default='PENDING')
    screening_notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='candidate_applications_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'candidate_applications'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['candidate', 'requisition'], name='unique_candidate_per_requisition'),
        ]


class CandidateApplicationHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        CandidateApplication, on_delete=models.CASCADE, related_name='history',
    )
    from_stage = models.ForeignKey(
        RecruitmentStage, on_delete=models.PROTECT, null=True, blank=True,
        related_name='candidate_history_from',
    )
    to_stage = models.ForeignKey(
        RecruitmentStage, on_delete=models.PROTECT, related_name='candidate_history_to',
    )
    decision = models.CharField(max_length=10, choices=CandidateApplication.SCREENING_DECISIONS)
    notes = models.TextField(blank=True)
    changed_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='candidate_application_history_actions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'candidate_application_history'
        ordering = ['-created_at']


class CandidateBackgroundCheck(models.Model):
    TYPE_CHOICES = [('REFERENCE', 'Reference check'), ('BACKGROUND', 'Background check')]
    STATUS_CHOICES = [('PENDING', 'Pending'), ('IN_PROGRESS', 'In progress'), ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled')]
    OUTCOME_CHOICES = [('PENDING', 'Pending'), ('PASS', 'Pass'), ('FAIL', 'Fail'), ('UNABLE_TO_VERIFY', 'Unable to verify')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(CandidateApplication, on_delete=models.CASCADE, related_name='background_checks')
    check_type = models.CharField(max_length=12, choices=TYPE_CHOICES)
    label = models.CharField(max_length=120)
    contact_or_provider = models.CharField(max_length=255, blank=True)
    requested_date = models.DateField(default=timezone.localdate)
    completed_date = models.DateField(null=True, blank=True)
    is_required = models.BooleanField(default=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='PENDING')
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, default='PENDING')
    result_summary = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey('HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='background_checks_created')
    updated_by = models.ForeignKey('HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='background_checks_updated')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'candidate_background_checks'
        ordering = ['application', 'check_type', 'label']

    def __str__(self):
        return f'{self.label} - {self.application.candidate.full_name}'


class CandidateOffer(models.Model):
    STATUS_CHOICES = [
        ('PENDING_APPROVAL', 'Pending approval'), ('APPROVED', 'Approved'),
        ('SENT', 'Sent'), ('ACCEPTED', 'Accepted'), ('DECLINED', 'Declined'),
        ('REJECTED', 'Rejected by approver'), ('WITHDRAWN', 'Withdrawn'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.OneToOneField(CandidateApplication, on_delete=models.PROTECT, related_name='offer')
    rule = models.ForeignKey(OfferRule, on_delete=models.PROTECT, related_name='candidate_offers')
    employee = models.ForeignKey('HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='recruitment_offers')
    employee_document = models.OneToOneField('HRMSapp.EmployeeDocument', on_delete=models.SET_NULL, null=True, blank=True, related_name='recruitment_offer')
    offer_letter = models.FileField(upload_to='recruitment/offers/%Y/%m/', blank=True)
    currency = models.CharField(max_length=3)
    annual_salary = models.DecimalField(max_digits=12, decimal_places=2)
    signing_bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    joining_date = models.DateField()
    expires_on = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING_APPROVAL')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey('HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='recruitment_offers_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    offer_letter_sent_at = models.DateTimeField(null=True, blank=True)
    offer_letter_error = models.TextField(blank=True)

    class Meta:
        db_table = 'candidate_offers'
        ordering = ['-created_at']


class CandidateOfferApproval(models.Model):
    STATUS_CHOICES = [('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    offer = models.ForeignKey(CandidateOffer, on_delete=models.CASCADE, related_name='approvals')
    role_code = models.CharField(max_length=30)
    assigned_to = models.ForeignKey('HRMSapp.Employee', on_delete=models.PROTECT, related_name='recruitment_offer_approvals')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    comments = models.TextField(blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'candidate_offer_approvals'
        ordering = ['created_at']
        constraints = [models.UniqueConstraint(fields=['offer', 'role_code'], name='unique_offer_approval_role')]


class CandidateInterview(models.Model):
    STATUS_CHOICES = [
        ('SCHEDULED', 'Scheduled'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        CandidateApplication, on_delete=models.CASCADE, related_name='interviews',
    )
    round_name = models.CharField(max_length=120)
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveSmallIntegerField(default=60)
    meeting_details = models.TextField(blank=True)
    scorecard = models.ForeignKey(
        InterviewScorecard, on_delete=models.PROTECT, related_name='interviews',
    )
    interviewers = models.ManyToManyField(
        'HRMSapp.Employee', related_name='recruitment_interviews',
    )
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='SCHEDULED')
    created_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='recruitment_interviews_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'candidate_interviews'
        ordering = ['scheduled_at', 'round_name']


class CandidateInterviewEvaluation(models.Model):
    RECOMMENDATION_CHOICES = [
        ('PASS', 'Pass'),
        ('HOLD', 'Hold'),
        ('REJECT', 'Reject'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    interview = models.ForeignKey(
        CandidateInterview, on_delete=models.CASCADE, related_name='evaluations',
    )
    interviewer = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.PROTECT, related_name='recruitment_interview_evaluations',
    )
    ratings = models.JSONField(default=dict)
    comments = models.TextField()
    recommendation = models.CharField(max_length=10, choices=RECOMMENDATION_CHOICES)
    submitted_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'candidate_interview_evaluations'
        ordering = ['interviewer__first_name', 'interviewer__last_name']
        constraints = [
            models.UniqueConstraint(fields=['interview', 'interviewer'], name='unique_interview_evaluation_per_interviewer'),
        ]

