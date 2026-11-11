from rest_framework import serializers
from django.utils import timezone
from pathlib import Path
from decimal import Decimal

from HRMSapp.models import Employee
from .models import (
    CandidateApplication, CandidateApplicationHistory, HiringApprovalAction, HiringRequisition, RecruitmentCandidate, RecruitmentEmailTemplate,
    RecruitmentSettings, RecruitmentStage, InterviewScorecard, OfferRule, CandidateInterview,
    CandidateInterviewEvaluation,
    CandidateBackgroundCheck,
    CandidateOffer, CandidateOfferApproval,
)
from .services import available_openings


class RecruitmentSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecruitmentSettings
        fields = ['allowed_requester_roles', 'updated_at']
        read_only_fields = ['updated_at']

    def validate_allowed_requester_roles(self, value):
        allowed = {'SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'REPORTING_MANAGER', 'HOD'}
        if not isinstance(value, list) or not value or any(role not in allowed for role in value):
            raise serializers.ValidationError(
                'Select one or more roles from SYSTEM_ADMIN, HR_ADMIN, MANAGER, REPORTING_MANAGER, HOD.'
            )
        return list(dict.fromkeys(value))


class HiringApprovalActionSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    class Meta:
        model = HiringApprovalAction
        fields = ['id', 'step_number', 'step_name', 'assigned_to', 'assigned_to_name', 'status', 'comments', 'acted_at', 'due_at']


class HiringRequisitionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = HiringRequisition
        fields = [
            'department', 'position', 'grade_band', 'location', 'openings',
            'is_replacement', 'replacing_employee', 'reason', 'target_start_date',
        ]

    def validate_openings(self, value):
        if value < 1:
            raise serializers.ValidationError('At least one opening is required.')
        return value

    def validate_target_start_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError('Target start date cannot be in the past.')
        return value

    def validate_reason(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError('Provide a reason of at least 10 characters.')
        return value.strip()

    def validate_replacing_employee(self, employee):
        if employee and employee.is_deleted:
            raise serializers.ValidationError('Select an active employee.')
        return employee


class HiringRequisitionSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    position_title = serializers.CharField(source='position.title', read_only=True)
    position_grade = serializers.CharField(source='position.grade_band', read_only=True)
    location_name = serializers.CharField(source='location.name', read_only=True)
    replacing_employee_name = serializers.CharField(source='replacing_employee.full_name', read_only=True, default=None)
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    approval_actions = HiringApprovalActionSerializer(many=True, read_only=True)
    available_openings_now = serializers.SerializerMethodField()

    class Meta:
        model = HiringRequisition
        fields = [
            'id', 'requisition_number', 'requested_by', 'requested_by_name',
            'department', 'department_name', 'position', 'position_title', 'position_grade',
            'grade_band', 'location', 'location_name', 'openings', 'is_replacement',
            'replacing_employee', 'replacing_employee_name', 'reason', 'target_start_date',
            'budgeted_count_at_request', 'filled_count_at_request', 'available_openings_now',
            'status', 'workflow', 'workflow_name', 'workflow_steps_snapshot',
            'current_step_number', 'rejection_reason', 'approval_actions',
            'completed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_available_openings_now(self, requisition):
        return available_openings(requisition.position, exclude_requisition_id=requisition.pk)[0]


class ApprovalDecisionSerializer(serializers.Serializer):
    comments = serializers.CharField(required=False, allow_blank=True, max_length=4000)


class RejectionDecisionSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=2, max_length=4000)


class RecruitmentStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecruitmentStage
        fields = ['id', 'code', 'name', 'order', 'is_active', 'is_terminal', 'terminal_outcome', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        terminal = attrs.get('is_terminal', getattr(self.instance, 'is_terminal', False))
        outcome = attrs.get('terminal_outcome', getattr(self.instance, 'terminal_outcome', 'OPEN'))
        if terminal and outcome == 'OPEN':
            raise serializers.ValidationError({'terminal_outcome': 'Choose HIRED or REJECTED for a terminal stage.'})
        if not terminal and outcome != 'OPEN':
            raise serializers.ValidationError({'terminal_outcome': 'A non-terminal stage must use the OPEN outcome.'})
        return attrs


class RecruitmentEmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecruitmentEmailTemplate
        fields = ['id', 'name', 'purpose', 'subject', 'body', 'is_active', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError('Email body cannot be empty.')
        return value


class InterviewScorecardSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewScorecard
        fields = ['id', 'name', 'description', 'criteria', 'is_active', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate_criteria(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError('Add at least one scoring criterion.')
        if any(not isinstance(item, dict) or not str(item.get('label', '')).strip() for item in value):
            raise serializers.ValidationError('Every criterion needs a label.')
        labels = [str(item.get('label', '')).strip() for item in value]
        if len(set(labels)) != len(labels):
            raise serializers.ValidationError('Criterion labels must be unique so interview ratings can be saved.')
        weights = []
        for item in value:
            try:
                weight = float(item.get('weight', 0))
            except (TypeError, ValueError):
                weight = 0
            if weight <= 0:
                raise serializers.ValidationError('Each criterion needs a positive weight.')
            weights.append(weight)
        if round(sum(weights), 2) != 100:
            raise serializers.ValidationError('Criterion weights must add up to 100%.')
        return value


class OfferRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = OfferRule
        fields = [
            'id', 'name', 'grade_band', 'currency', 'minimum_salary', 'maximum_salary',
            'maximum_signing_bonus', 'required_approvers', 'is_active', 'created_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate_required_approvers(self, value):
        valid = {choice[0] for choice in OfferRule.APPROVER_CHOICES}
        if not isinstance(value, list) or not value or any(role not in valid for role in value):
            raise serializers.ValidationError('Choose at least one valid offer approver role.')
        return list(dict.fromkeys(value))

    def validate(self, attrs):
        minimum = attrs.get('minimum_salary', getattr(self.instance, 'minimum_salary', None))
        maximum = attrs.get('maximum_salary', getattr(self.instance, 'maximum_salary', None))
        if minimum is not None and maximum is not None and maximum < minimum:
            raise serializers.ValidationError({'maximum_salary': 'Maximum salary must be at least the minimum salary.'})
        return attrs


class CandidateOfferCreateSerializer(serializers.Serializer):
    application = serializers.PrimaryKeyRelatedField(queryset=CandidateApplication.objects.select_related('stage', 'requisition'))
    annual_salary = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0'))
    signing_bonus = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0'), required=False, default=Decimal('0'))
    joining_date = serializers.DateField()
    expires_on = serializers.DateField()
    notes = serializers.CharField(required=False, allow_blank=True, max_length=10000)

    def validate(self, attrs):
        if attrs['joining_date'] < timezone.localdate():
            raise serializers.ValidationError({'joining_date': 'Joining date cannot be in the past.'})
        if attrs['expires_on'] < timezone.localdate():
            raise serializers.ValidationError({'expires_on': 'Offer expiry date cannot be in the past.'})
        if attrs['expires_on'] >= attrs['joining_date']:
            raise serializers.ValidationError({'expires_on': 'Offer expiry date must be before the joining date.'})
        return attrs


class CandidateOfferApprovalSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    class Meta:
        model = CandidateOfferApproval
        fields = ['id', 'role_code', 'assigned_to', 'assigned_to_name', 'status', 'comments', 'acted_at']


class CandidateOfferSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source='application.candidate.full_name', read_only=True)
    candidate_email = serializers.EmailField(source='application.candidate.email', read_only=True)
    application_id = serializers.UUIDField(source='application.id', read_only=True)
    requisition_number = serializers.CharField(source='application.requisition.requisition_number', read_only=True)
    position_title = serializers.CharField(source='application.requisition.position.title', read_only=True)
    grade_band = serializers.CharField(source='application.requisition.grade_band', read_only=True)
    rule_name = serializers.CharField(source='rule.name', read_only=True)
    approvals = CandidateOfferApprovalSerializer(many=True, read_only=True)
    my_approval_id = serializers.SerializerMethodField()
    employee_id = serializers.UUIDField(read_only=True, allow_null=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True, allow_null=True)
    offer_letter_filename = serializers.SerializerMethodField()
    class Meta:
        model = CandidateOffer
        fields = ['id', 'application_id', 'candidate_name', 'candidate_email', 'requisition_number', 'position_title', 'grade_band',
                  'rule', 'rule_name', 'currency', 'annual_salary', 'signing_bonus', 'joining_date', 'expires_on',
                  'status', 'notes', 'approvals', 'my_approval_id', 'employee_id', 'employee_name',
                  'offer_letter_filename', 'offer_letter_sent_at', 'offer_letter_error',
                  'created_at', 'approved_at', 'sent_at', 'responded_at']

    def get_my_approval_id(self, offer):
        request = self.context.get('request')
        employee = getattr(getattr(request, 'user', None), 'employee', None)
        approval = offer.approvals.filter(assigned_to=employee, status='PENDING').first() if employee else None
        return str(approval.pk) if approval else None

    def get_offer_letter_filename(self, offer):
        return offer.offer_letter.name.rsplit('/', 1)[-1] if offer.offer_letter else ''


class CandidateApplicationCreateSerializer(serializers.Serializer):
    requisition = serializers.PrimaryKeyRelatedField(
        queryset=HiringRequisition.objects.filter(status='APPROVED'),
    )
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=30)
    resume = serializers.FileField()
    internal_notes = serializers.CharField(required=False, allow_blank=True, max_length=10000)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_first_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('Enter the candidate first name.')
        return value.strip()

    def validate_phone(self, value):
        if not value.strip():
            raise serializers.ValidationError('Enter the candidate phone number.')
        return value.strip()

    def validate_resume(self, value):
        extension = Path(value.name).suffix.lower()
        if extension not in {'.pdf', '.doc', '.docx'}:
            raise serializers.ValidationError('Resume must be a PDF, DOC, or DOCX file.')
        if value.size > 4 * 1024 * 1024:
            raise serializers.ValidationError('Resume must be 4 MB or smaller.')
        return value

    def validate(self, attrs):
        requisition = attrs['requisition']
        if requisition.status != 'APPROVED':
            raise serializers.ValidationError({'requisition': 'Applications can only be added to approved requisitions.'})
        if CandidateApplication.objects.filter(
            requisition=requisition,
            candidate__email__iexact=attrs['email'],
        ).exists():
            raise serializers.ValidationError({'email': 'This candidate already has an application for this requisition.'})
        return attrs


class CandidateScreeningDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['PASS', 'HOLD', 'REJECT'])
    notes = serializers.CharField(min_length=2, max_length=10000)

    def validate_notes(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Add screening notes before saving the decision.')
        return value


class CandidateApplicationHistorySerializer(serializers.ModelSerializer):
    from_stage_name = serializers.CharField(source='from_stage.name', read_only=True, allow_null=True)
    to_stage_name = serializers.CharField(source='to_stage.name', read_only=True)
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True, allow_null=True)

    class Meta:
        model = CandidateApplicationHistory
        fields = ['id', 'from_stage_name', 'to_stage_name', 'decision', 'notes', 'changed_by_name', 'created_at']


class CandidateBackgroundCheckSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source='application.candidate.full_name', read_only=True)
    application_id = serializers.UUIDField(source='application.id', read_only=True)

    class Meta:
        model = CandidateBackgroundCheck
        fields = ['id', 'application_id', 'candidate_name', 'check_type', 'label', 'contact_or_provider',
                  'requested_date', 'completed_date', 'is_required', 'status', 'outcome',
                  'result_summary', 'notes', 'created_by', 'updated_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'application_id', 'candidate_name', 'created_by', 'updated_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        status_value = attrs.get('status', getattr(self.instance, 'status', 'PENDING'))
        outcome = attrs.get('outcome', getattr(self.instance, 'outcome', 'PENDING'))
        completed_date = attrs.get('completed_date', getattr(self.instance, 'completed_date', None))
        if status_value == 'COMPLETED' and (outcome == 'PENDING' or completed_date is None):
            raise serializers.ValidationError('Completed checks need a final outcome and completion date.')
        if status_value != 'COMPLETED' and outcome != 'PENDING':
            raise serializers.ValidationError('Set a check to Completed before recording its outcome.')
        if status_value == 'COMPLETED' and completed_date is None:
            raise serializers.ValidationError({'completed_date': 'Enter the date the check was completed.'})
        return attrs


class CandidateApplicationSerializer(serializers.ModelSerializer):
    candidate_id = serializers.UUIDField(source='candidate.id', read_only=True)
    candidate_name = serializers.CharField(source='candidate.full_name', read_only=True)
    candidate_email = serializers.EmailField(source='candidate.email', read_only=True)
    candidate_phone = serializers.CharField(source='candidate.phone', read_only=True)
    resume_filename = serializers.SerializerMethodField()
    requisition_number = serializers.CharField(source='requisition.requisition_number', read_only=True)
    position_title = serializers.CharField(source='requisition.position.title', read_only=True)
    department_name = serializers.CharField(source='requisition.department.name', read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    stage_code = serializers.CharField(source='stage.code', read_only=True)
    screening_history = CandidateApplicationHistorySerializer(source='history', many=True, read_only=True)

    class Meta:
        model = CandidateApplication
        fields = [
            'id', 'candidate_id', 'candidate_name', 'candidate_email', 'candidate_phone',
            'resume_filename', 'requisition', 'requisition_number', 'position_title',
            'department_name', 'stage', 'stage_name', 'stage_code', 'internal_notes',
            'screening_decision', 'screening_notes', 'screening_history', 'created_at', 'updated_at',
        ]

    def get_resume_filename(self, application):
        if not application.candidate.resume:
            return ''
        return application.candidate.resume_original_filename or Path(application.candidate.resume.name).name


class CandidateApplicationRequisitionOptionSerializer(serializers.ModelSerializer):
    position_title = serializers.CharField(source='position.title', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = HiringRequisition
        fields = ['id', 'requisition_number', 'position_title', 'department_name', 'grade_band', 'openings']


class CandidateInterviewScheduleSerializer(serializers.ModelSerializer):
    application = serializers.PrimaryKeyRelatedField(
        queryset=CandidateApplication.objects.filter(stage__code='interview', stage__is_terminal=False),
    )
    scorecard = serializers.PrimaryKeyRelatedField(queryset=InterviewScorecard.objects.filter(is_active=True))
    interviewers = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Employee.objects.filter(is_deleted=False),
    )

    class Meta:
        model = CandidateInterview
        fields = ['id', 'application', 'round_name', 'scheduled_at', 'duration_minutes', 'meeting_details', 'scorecard', 'interviewers']
        read_only_fields = ['id']

    def validate_round_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('Enter an interview round name.')
        return value.strip()

    def validate_scheduled_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError('Schedule the interview for a future date and time.')
        return value

    def validate_duration_minutes(self, value):
        if value < 15 or value > 480:
            raise serializers.ValidationError('Interview duration must be between 15 minutes and 8 hours.')
        return value

    def validate_interviewers(self, value):
        if not value:
            raise serializers.ValidationError('Assign at least one interviewer.')
        if len({employee.pk for employee in value}) != len(value):
            raise serializers.ValidationError('An interviewer can only be assigned once.')
        return value


class CandidateInterviewEvaluationCreateSerializer(serializers.Serializer):
    ratings = serializers.DictField(child=serializers.IntegerField(min_value=1, max_value=5))
    comments = serializers.CharField(min_length=2, max_length=10000)
    recommendation = serializers.ChoiceField(choices=['PASS', 'HOLD', 'REJECT'])

    def validate_comments(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Add interviewer comments before submitting the scorecard.')
        return value

    def validate(self, attrs):
        interview = self.context['interview']
        criteria = interview.scorecard.criteria
        labels = [str(item.get('label', '')).strip() for item in criteria if isinstance(item, dict)]
        if not labels or len(labels) != len(criteria):
            raise serializers.ValidationError({'ratings': 'The selected scorecard has invalid criteria.'})
        if len(set(labels)) != len(labels):
            raise serializers.ValidationError({'ratings': 'Scorecard criterion labels must be unique.'})
        if set(attrs['ratings']) != set(labels):
            raise serializers.ValidationError({'ratings': 'Provide a 1–5 rating for every scorecard criterion.'})
        return attrs


class CandidateInterviewEvaluationSerializer(serializers.ModelSerializer):
    interviewer_name = serializers.CharField(source='interviewer.full_name', read_only=True)
    weighted_score = serializers.SerializerMethodField()

    class Meta:
        model = CandidateInterviewEvaluation
        fields = ['id', 'interviewer', 'interviewer_name', 'ratings', 'comments', 'recommendation', 'weighted_score', 'submitted_at']

    def get_weighted_score(self, evaluation):
        criteria = evaluation.interview.scorecard.criteria
        weights = {str(item.get('label', '')).strip(): float(item.get('weight', 0)) for item in criteria}
        return round(sum(evaluation.ratings.get(label, 0) * weight for label, weight in weights.items()) / 100, 2)


class CandidateInterviewSerializer(serializers.ModelSerializer):
    candidate_application = serializers.UUIDField(source='application.id', read_only=True)
    candidate_name = serializers.CharField(source='application.candidate.full_name', read_only=True)
    candidate_email = serializers.EmailField(source='application.candidate.email', read_only=True)
    requisition_number = serializers.CharField(source='application.requisition.requisition_number', read_only=True)
    position_title = serializers.CharField(source='application.requisition.position.title', read_only=True)
    current_stage = serializers.CharField(source='application.stage.name', read_only=True)
    current_stage_code = serializers.CharField(source='application.stage.code', read_only=True)
    resume_filename = serializers.CharField(source='application.candidate.resume_original_filename', read_only=True)
    scorecard_name = serializers.CharField(source='scorecard.name', read_only=True)
    scorecard_criteria = serializers.JSONField(source='scorecard.criteria', read_only=True)
    interviewers = serializers.SerializerMethodField()
    evaluations = serializers.SerializerMethodField()
    my_evaluation_id = serializers.SerializerMethodField()

    class Meta:
        model = CandidateInterview
        fields = [
            'id', 'candidate_application', 'candidate_name', 'candidate_email', 'requisition_number',
            'position_title', 'current_stage', 'current_stage_code', 'resume_filename', 'round_name', 'scheduled_at', 'duration_minutes',
            'meeting_details', 'scorecard', 'scorecard_name', 'scorecard_criteria', 'interviewers',
            'status', 'evaluations', 'my_evaluation_id', 'created_at',
        ]

    def get_interviewers(self, interview):
        return [{
            'id': str(employee.pk),
            'full_name': employee.full_name,
            'employee_id': employee.employee_id,
        } for employee in interview.interviewers.all()]

    def get_evaluations(self, interview):
        evaluations = interview.evaluations.all()
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            employee = getattr(user, 'employee', None)
            evaluations = evaluations.filter(interviewer=employee) if employee else evaluations.none()
        return CandidateInterviewEvaluationSerializer(evaluations, many=True).data

    def get_my_evaluation_id(self, interview):
        employee = getattr(getattr(self, 'context', {}).get('request'), 'user', None)
        employee = getattr(employee, 'employee', None)
        evaluation = interview.evaluations.filter(interviewer=employee).first() if employee else None
        return str(evaluation.pk) if evaluation else None

