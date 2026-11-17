from django.contrib import admin

from .models import (
    CandidateApplication,
    CandidateApplicationHistory,
    CandidateInterview,
    CandidateInterviewEvaluation,
    CandidateOffer,
    HiringApprovalAction,
    HiringRequisition,
    InterviewScorecard,
    OfferRule,
    RecruitmentCandidate,
    RecruitmentEmailTemplate,
    RecruitmentSettings,
    RecruitmentStage,CandidateOfferApproval,
)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
class CreatedByMixin:
    """Auto-fill `created_by` with the logged-in user's Employee record, if any."""
    created_by_field = 'created_by'

    def save_model(self, request, obj, form, change):
        if not change and hasattr(obj, self.created_by_field):
            if getattr(obj, f'{self.created_by_field}_id', None) is None:
                employee = getattr(request.user, 'employee', None)
                if employee is not None:
                    setattr(obj, self.created_by_field, employee)
        super().save_model(request, obj, form, change)


# --------------------------------------------------------------------------
# Settings / configuration
# --------------------------------------------------------------------------
@admin.register(RecruitmentSettings)
class RecruitmentSettingsAdmin(admin.ModelAdmin):
    """Singleton (pk=1): no adding a second row, no deleting."""
    list_display = ('id', 'allowed_requester_roles', 'updated_by', 'updated_at')
    readonly_fields = ('updated_at',)
    raw_id_fields = ('updated_by',)

    def has_add_permission(self, request):
        return not RecruitmentSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        employee = getattr(request.user, 'employee', None)
        if employee is not None:
            obj.updated_by = employee
        super().save_model(request, obj, form, change)


@admin.register(RecruitmentStage)
class RecruitmentStageAdmin(admin.ModelAdmin):
    list_display = ('order', 'name', 'code', 'is_active', 'is_terminal', 'terminal_outcome')
    list_display_links = ('name',)
    list_filter = ('is_active', 'is_terminal', 'terminal_outcome')
    search_fields = ('name', 'code')
    prepopulated_fields = {'code': ('name',)}
    ordering = ('order', 'name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(RecruitmentEmailTemplate)
class RecruitmentEmailTemplateAdmin(CreatedByMixin, admin.ModelAdmin):
    list_display = ('name', 'purpose', 'subject', 'is_active', 'updated_at')
    list_filter = ('purpose', 'is_active')
    search_fields = ('name', 'subject', 'body')
    raw_id_fields = ('created_by',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(InterviewScorecard)
class InterviewScorecardAdmin(CreatedByMixin, admin.ModelAdmin):
    list_display = ('name', 'criteria_count', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'description')
    raw_id_fields = ('created_by',)
    readonly_fields = ('created_at', 'updated_at')

    @admin.display(description='Criteria')
    def criteria_count(self, obj):
        return len(obj.criteria) if isinstance(obj.criteria, list) else 0


@admin.register(OfferRule)
class OfferRuleAdmin(CreatedByMixin, admin.ModelAdmin):
    list_display = (
        'name', 'grade_band', 'currency', 'minimum_salary', 'maximum_salary',
        'maximum_signing_bonus', 'is_active',
    )
    list_filter = ('is_active', 'currency')
    search_fields = ('name', 'grade_band')
    raw_id_fields = ('created_by',)
    readonly_fields = ('created_at', 'updated_at')


# --------------------------------------------------------------------------
# Hiring requisitions
# --------------------------------------------------------------------------
class HiringApprovalActionInline(admin.TabularInline):
    model = HiringApprovalAction
    extra = 0
    fields = ('step_number', 'step_name', 'assigned_to', 'status', 'comments', 'acted_at', 'due_at')
    readonly_fields = ('acted_at',)
    raw_id_fields = ('assigned_to',)
    ordering = ('step_number', 'created_at')


@admin.register(HiringRequisition)
class HiringRequisitionAdmin(admin.ModelAdmin):
    list_display = (
        'requisition_number', 'position', 'department', 'location', 'grade_band',
        'openings', 'status', 'current_step_number', 'target_start_date', 'created_at',
    )
    list_filter = ('status', 'is_replacement', 'grade_band', 'department', 'location')
    search_fields = (
        'requisition_number', 'position__title', 'grade_band',
        'requested_by__first_name', 'requested_by__last_name',
    )
    date_hierarchy = 'created_at'
    list_select_related = ('position', 'department', 'location', 'requested_by')
    raw_id_fields = ('requested_by', 'department', 'position', 'location', 'replacing_employee', 'workflow')
    readonly_fields = ('id', 'workflow_steps_snapshot', 'completed_at', 'created_at', 'updated_at')
    inlines = [HiringApprovalActionInline]
    fieldsets = (
        (None, {'fields': ('id', 'requisition_number', 'requested_by', 'status', 'rejection_reason')}),
        ('Position', {'fields': (
            'department', 'position', 'grade_band', 'location', 'openings', 'target_start_date',
        )}),
        ('Replacement', {'fields': ('is_replacement', 'replacing_employee', 'reason')}),
        ('Headcount snapshot', {'fields': ('budgeted_count_at_request', 'filled_count_at_request')}),
        ('Workflow', {'fields': (
            'workflow', 'current_step_number', 'workflow_steps_snapshot', 'completed_at',
        )}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )


@admin.register(HiringApprovalAction)
class HiringApprovalActionAdmin(admin.ModelAdmin):
    list_display = ('requisition', 'step_number', 'step_name', 'assigned_to', 'status', 'due_at', 'acted_at')
    list_filter = ('status',)
    search_fields = (
        'requisition__requisition_number', 'step_name',
        'assigned_to__first_name', 'assigned_to__last_name',
    )
    list_select_related = ('requisition', 'assigned_to')
    raw_id_fields = ('requisition', 'assigned_to')
    readonly_fields = ('created_at',)


# --------------------------------------------------------------------------
# Candidates & applications
# --------------------------------------------------------------------------
class CandidateApplicationInline(admin.TabularInline):
    model = CandidateApplication
    extra = 0
    fields = ('requisition', 'stage', 'screening_decision', 'created_at')
    readonly_fields = ('created_at',)
    raw_id_fields = ('requisition',)
    show_change_link = True


@admin.register(RecruitmentCandidate)
class RecruitmentCandidateAdmin(CreatedByMixin, admin.ModelAdmin):
    list_display = ('full_name', 'email', 'phone', 'resume_original_filename', 'created_at')
    search_fields = ('first_name', 'last_name', 'email', 'phone')
    date_hierarchy = 'created_at'
    raw_id_fields = ('created_by',)
    readonly_fields = ('id', 'resume_file', 'created_at', 'updated_at')
    inlines = [CandidateApplicationInline]
    fieldsets = (
        (None, {'fields': ('id', 'first_name', 'last_name', 'email', 'phone')}),
        # Resumes live in private storage and are served through authenticated
        # views only, so we show the stored path instead of a (broken) public URL.
        ('Resume', {'fields': ('resume', 'resume_file', 'resume_original_filename')}),
        ('Audit', {'fields': ('created_by', 'created_at', 'updated_at')}),
    )

    @admin.display(description='Stored file')
    def resume_file(self, obj):
        return obj.resume.name if obj and obj.resume else '-'


class CandidateApplicationHistoryInline(admin.TabularInline):
    model = CandidateApplicationHistory
    extra = 0
    can_delete = False
    fields = ('from_stage', 'to_stage', 'decision', 'notes', 'changed_by', 'created_at')
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


class CandidateInterviewInline(admin.TabularInline):
    model = CandidateInterview
    extra = 0
    fields = ('round_name', 'scheduled_at', 'duration_minutes', 'scorecard', 'status')
    raw_id_fields = ('scorecard',)
    show_change_link = True


@admin.register(CandidateApplication)
class CandidateApplicationAdmin(CreatedByMixin, admin.ModelAdmin):
    list_display = ('candidate', 'requisition', 'stage', 'screening_decision', 'created_at')
    list_filter = ('stage', 'screening_decision')
    search_fields = (
        'candidate__first_name', 'candidate__last_name', 'candidate__email',
        'requisition__requisition_number',
    )
    date_hierarchy = 'created_at'
    list_select_related = ('candidate', 'requisition', 'stage')
    raw_id_fields = ('candidate', 'requisition', 'created_by')
    readonly_fields = ('id', 'created_at', 'updated_at')
    inlines = [CandidateInterviewInline, CandidateApplicationHistoryInline]


@admin.register(CandidateApplicationHistory)
class CandidateApplicationHistoryAdmin(admin.ModelAdmin):
    """Audit trail: view-only."""
    list_display = ('application', 'from_stage', 'to_stage', 'decision', 'changed_by', 'created_at')
    list_filter = ('decision', 'to_stage')
    search_fields = (
        'application__candidate__first_name', 'application__candidate__last_name',
        'application__candidate__email',
    )
    date_hierarchy = 'created_at'
    list_select_related = ('application__candidate', 'from_stage', 'to_stage', 'changed_by')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# --------------------------------------------------------------------------
# Interviews
# --------------------------------------------------------------------------
class CandidateInterviewEvaluationInline(admin.StackedInline):
    model = CandidateInterviewEvaluation
    extra = 0
    fields = ('interviewer', 'ratings', 'comments', 'recommendation', 'submitted_at')
    readonly_fields = ('submitted_at',)
    raw_id_fields = ('interviewer',)


@admin.register(CandidateInterview)
class CandidateInterviewAdmin(CreatedByMixin, admin.ModelAdmin):
    list_display = ('application', 'round_name', 'scheduled_at', 'duration_minutes', 'scorecard', 'status')
    list_filter = ('status', 'scorecard')
    search_fields = (
        'round_name', 'application__candidate__first_name',
        'application__candidate__last_name', 'application__candidate__email',
    )
    date_hierarchy = 'scheduled_at'
    list_select_related = ('application__candidate', 'scorecard')
    raw_id_fields = ('application', 'scorecard', 'interviewers', 'created_by')
    readonly_fields = ('id', 'created_at', 'updated_at')
    inlines = [CandidateInterviewEvaluationInline]


@admin.register(CandidateInterviewEvaluation)
class CandidateInterviewEvaluationAdmin(admin.ModelAdmin):
    list_display = ('interview', 'interviewer', 'recommendation', 'submitted_at')
    list_filter = ('recommendation',)
    search_fields = (
        'interviewer__first_name', 'interviewer__last_name',
        'interview__application__candidate__first_name',
        'interview__application__candidate__last_name',
    )
    list_select_related = ('interview', 'interviewer')
    raw_id_fields = ('interview', 'interviewer')
    readonly_fields = ('submitted_at',)


# --------------------------------------------------------------------------
# Offers
# --------------------------------------------------------------------------
class CandidateOfferApprovalInline(admin.TabularInline):
    model = CandidateOfferApproval
    extra = 0
    fields = ('role_code', 'assigned_to', 'status', 'comments', 'acted_at')
    readonly_fields = ('acted_at',)
    raw_id_fields = ('assigned_to',)
 
 
@admin.register(CandidateOffer)
class CandidateOfferAdmin(CreatedByMixin, admin.ModelAdmin):
    list_display = (
        'application', 'rule', 'currency', 'annual_salary', 'signing_bonus',
        'joining_date', 'expires_on', 'status', 'created_at',
    )
    list_filter = ('status', 'currency', 'rule')
    search_fields = (
        'application__candidate__first_name', 'application__candidate__last_name',
        'application__candidate__email', 'application__requisition__requisition_number',
    )
    date_hierarchy = 'created_at'
    list_select_related = ('application__candidate', 'application__requisition', 'rule')
    raw_id_fields = ('application', 'rule', 'employee', 'employee_document', 'created_by')
    readonly_fields = (
        'id', 'approved_at', 'sent_at', 'responded_at',
        'offer_letter_sent_at', 'offer_letter_error', 'created_at', 'updated_at',
    )
    inlines = [CandidateOfferApprovalInline]
    fieldsets = (
        (None, {'fields': ('id', 'application', 'rule', 'status', 'notes')}),
        ('Compensation', {'fields': (
            'currency', 'annual_salary', 'signing_bonus', 'joining_date', 'expires_on',
        )}),
        ('Offer letter', {'fields': ('offer_letter', 'offer_letter_sent_at', 'offer_letter_error')}),
        ('Hire record', {'fields': ('employee', 'employee_document')}),
        ('Lifecycle', {'fields': ('approved_at', 'sent_at', 'responded_at')}),
        ('Audit', {'fields': ('created_by', 'created_at', 'updated_at')}),
    )
 
 
@admin.register(CandidateOfferApproval)
class CandidateOfferApprovalAdmin(admin.ModelAdmin):
    list_display = ('offer', 'role_code', 'assigned_to', 'status', 'acted_at')
    list_filter = ('status', 'role_code')
    search_fields = (
        'offer__application__candidate__first_name', 'offer__application__candidate__last_name',
        'assigned_to__first_name', 'assigned_to__last_name',
    )
    list_select_related = ('offer__application__candidate', 'assigned_to')
    raw_id_fields = ('offer', 'assigned_to')
    readonly_fields = ('created_at',)
 