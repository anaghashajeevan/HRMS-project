import uuid

from django.db import models


class OnboardingTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    department = models.ForeignKey(
        'HRMSapp.CompanyStructure', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='onboarding_templates',
        limit_choices_to={'type__in': ['DEPARTMENT', 'TEAM']},
    )
    position = models.ForeignKey(
        'HRMSapp.JobPosition', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='onboarding_templates',
    )
    location = models.ForeignKey(
        'HRMSapp.CompanyStructure', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='onboarding_location_templates',
        limit_choices_to={'type__in': ['LOCATION', 'HQ']},
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_onboarding_templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'onboarding_templates'
        ordering = ['name']

    def __str__(self):
        return self.name


class OnboardingTemplateTask(models.Model):
    TASK_TYPE_CHOICES = [
        ('TASK', 'Task'),
        ('DOCUMENT', 'Document submission'),
        ('ACKNOWLEDGEMENT', 'Policy acknowledgement'),
    ]
    OWNER_TYPE_CHOICES = [
        ('EMPLOYEE', 'New employee'),
        ('HR', 'HR'),
        ('MANAGER', 'Reporting manager'),
        ('IT_ADMIN', 'IT / Administration'),
        ('OTHER', 'Other'),
    ]
    EMPLOYEE_DOCUMENT_TYPES = [
        ('ID_PROOF', 'ID Proof'), ('ADDRESS_PROOF', 'Address Proof'),
        ('EDUCATION', 'Education Certificate'), ('EXPERIENCE', 'Experience Certificate'),
        ('PAN', 'PAN Card'), ('AADHAAR', 'Aadhaar Card'), ('PASSPORT', 'Passport'),
        ('MEDICAL', 'Medical Certificate'), ('OTHER', 'Other'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(OnboardingTemplate, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    task_type = models.CharField(max_length=20, choices=TASK_TYPE_CHOICES, default='TASK')
    owner_type = models.CharField(max_length=20, choices=OWNER_TYPE_CHOICES, default='HR')
    owner_employee = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='onboarding_template_tasks',
    )
    employee_document_type = models.CharField(max_length=30, choices=EMPLOYEE_DOCUMENT_TYPES, default='OTHER')
    due_days_from_joining = models.SmallIntegerField(
        default=0,
        help_text='Negative values are due before joining; positive values are due after joining.',
    )
    is_required = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        db_table = 'onboarding_template_tasks'
        ordering = ['order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['template', 'order'], name='unique_onboarding_template_task_order'),
        ]

    def __str__(self):
        return f'{self.template.name}: {self.title}'


class OnboardingCase(models.Model):
    STATUS_CHOICES = [
        ('IN_PROGRESS', 'In progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    offer = models.OneToOneField(
        'recruitmentapp.CandidateOffer', on_delete=models.PROTECT,
        related_name='onboarding_case',
    )
    employee = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.PROTECT, related_name='onboarding_cases',
    )
    template = models.ForeignKey(
        OnboardingTemplate, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='onboarding_cases',
    )
    template_name_snapshot = models.CharField(max_length=150)
    joining_date = models.DateField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='IN_PROGRESS')
    started_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='started_onboarding_cases',
    )
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'onboarding_cases'
        ordering = ['-started_at']

    def __str__(self):
        return f'{self.employee.full_name} — {self.template_name_snapshot}'


class OnboardingTask(models.Model):
    STATUS_CHOICES = [
        ('NOT_STARTED', 'Not started'),
        ('IN_PROGRESS', 'In progress'),
        ('COMPLETED', 'Completed'),
        ('BLOCKED', 'Blocked'),
        ('WAIVED', 'Waived'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(OnboardingCase, on_delete=models.CASCADE, related_name='tasks')
    source_template_task = models.ForeignKey(
        OnboardingTemplateTask, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='created_onboarding_tasks',
    )
    assigned_to = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='assigned_onboarding_tasks',
    )
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    task_type = models.CharField(max_length=20, choices=OnboardingTemplateTask.TASK_TYPE_CHOICES, default='TASK')
    owner_type = models.CharField(max_length=20, choices=OnboardingTemplateTask.OWNER_TYPE_CHOICES, default='HR')
    employee_document_type = models.CharField(max_length=30, choices=OnboardingTemplateTask.EMPLOYEE_DOCUMENT_TYPES, default='OTHER')
    due_date = models.DateField(null=True, blank=True)
    is_required = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='NOT_STARTED')
    completion_notes = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'onboarding_tasks'
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.case.employee.full_name}: {self.title}'


class OnboardingTaskSubmission(models.Model):
    STATUS_CHOICES = [
        ('PENDING_REVIEW', 'Pending HR review'),
        ('VERIFIED', 'Verified'),
        ('REJECTED', 'Needs changes'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(OnboardingTask, on_delete=models.CASCADE, related_name='submissions')
    employee_document = models.ForeignKey(
        'HRMSapp.EmployeeDocument', on_delete=models.PROTECT,
        related_name='onboarding_submissions',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING_REVIEW')
    review_comments = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='reviewed_onboarding_submissions',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'onboarding_task_submissions'
        ordering = ['-submitted_at']
