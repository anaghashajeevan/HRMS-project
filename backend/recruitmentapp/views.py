from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from django.utils.text import get_valid_filename
import mimetypes
from django.utils import timezone
from uuid import UUID
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from HRMSapp.models import ApprovalWorkflow, CompanyStructure, Employee, JobPosition, Notification, UserAccount
from HRMSapp.permissions import IsHRAdmin, IsHRAdminOrRecruitmentManager
from .models import (
    CandidateApplication, CandidateApplicationHistory, CandidateInterview,
    CandidateInterviewEvaluation, HiringApprovalAction, HiringRequisition,
    RecruitmentCandidate, RecruitmentStage, InterviewScorecard, CandidateBackgroundCheck,
    CandidateOffer, CandidateOfferApproval,
    CandidateDocument,
    RecruitmentTaskScorecard, CandidateTaskAssessment,
)
from .serializers import (
    ApprovalDecisionSerializer,
    CandidateApplicationCreateSerializer,
    CandidateScreeningDecisionSerializer,
    CandidateApplicationRequisitionOptionSerializer,
    CandidateApplicationSerializer,
    CandidateInterviewEvaluationCreateSerializer,
    CandidateInterviewEvaluationSerializer,
    CandidateInterviewScheduleSerializer,
    CandidateInterviewSerializer,
    HiringRequisitionCreateSerializer,
    HiringRequisitionSerializer,
    RecruitmentSettingsSerializer,
    RejectionDecisionSerializer,
    RecruitmentStageSerializer,
    RecruitmentEmailTemplateSerializer,
    InterviewScorecardSerializer,
    OfferRuleSerializer,
    CandidateBackgroundCheckSerializer,
    CandidateOfferCreateSerializer, CandidateOfferSerializer,
    CandidateDocumentSerializer, CandidateDocumentUploadSerializer,
    RecruitmentTaskScorecardSerializer, CandidateTaskAssessmentCreateSerializer,
    CandidateTaskAssessmentResultSerializer, CandidateTaskAssessmentSerializer,
)
from .models import RecruitmentEmailTemplate, OfferRule
from .services import (
    approve_requisition_action,
    cancel_requisition,
    create_requisition,
    get_recruitment_settings,
    reject_requisition_action,
    available_openings,
)
from .offer_services import deliver_accepted_offer_letter, link_accepted_offer_to_employee, send_candidate_offer_email


def _is_hr(user):
    return user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')


def _is_hiring_manager(user):
    """Managers can work on recruitment items tied to requests they own or approve."""
    return user.has_role('MANAGER') or user.has_role('REPORTING_MANAGER')


def _can_access_recruitment(user):
    return _is_hr(user) or _is_hiring_manager(user)


def _recruitment_requisition_scope(user):
    requisitions = HiringRequisition.objects.all()
    if _is_hr(user) or _is_hiring_manager(user):
        return requisitions
    return requisitions.none()


def _recruitment_application_scope(user):
    applications = CandidateApplication.objects.all()
    if _is_hr(user):
        return applications
    return applications.filter(requisition__in=_recruitment_requisition_scope(user))


def _require_recruitment_access(user):
    if not _can_access_recruitment(user):
        raise PermissionDenied('Only HR, managers, and reporting managers can access this recruitment workflow.')


def _next_active_application_stage(current_stage):
    """Return the next configured open stage in the recruitment pipeline."""
    return RecruitmentStage.objects.filter(
        is_active=True,
        is_terminal=False,
        order__gt=current_stage.order,
    ).order_by('order').first()


def _offer_workflow_steps(workflow):
    return [{
        'step_number': step.step_number, 'step_name': step.step_name,
        'approver_type': step.approver_type,
        'specific_employee': str(step.specific_employee_id) if step.specific_employee_id else None,
        'sla_hours': step.sla_hours,
    } for step in workflow.steps.order_by('step_number')]


def _offer_approvers_for_step(step, offer):
    requester = offer.created_by
    req = offer.application.requisition
    kind = step['approver_type']
    if kind == 'REPORTING_MANAGER':
        people = [requester.reporting_manager] if requester and requester.reporting_manager_id else []
    elif kind == 'SKIP_LEVEL_MANAGER':
        manager = requester.reporting_manager if requester and requester.reporting_manager_id else None
        people = [manager.reporting_manager] if manager and manager.reporting_manager_id else []
    elif kind == 'DEPARTMENT_HEAD':
        head = req.department.department_head
        people = [head] if head else []
    elif kind in {'HR_ADMIN', 'SYSTEM_ADMIN', 'FINANCE_ADMIN'}:
        roles = {'HR_ADMIN'} if kind == 'HR_ADMIN' else {'SYSTEM_ADMIN'} if kind == 'SYSTEM_ADMIN' else {'FINANCE', 'FINANCE_ADMIN', 'FINANCE_HEAD', 'CFO'}
        accounts = UserAccount.objects.filter(is_active=True, roles__role_name__in=roles).select_related('employee').distinct()
        people = [account.employee for account in accounts if account.employee_id]
    elif kind == 'SPECIFIC_EMPLOYEE':
        people = list(Employee.objects.filter(pk=step.get('specific_employee'), is_deleted=False))
    else:
        people = []
    return list({person.pk: person for person in people if person and (not requester or person.pk != requester.pk)}.values())


def _create_offer_step_approvals(offer, step):
    approvers = _offer_approvers_for_step(step, offer)
    if not approvers:
        raise ValidationError({'detail': f'No eligible approver was found for offer workflow step "{step["step_name"]}".'})
    CandidateOfferApproval.objects.bulk_create([
        CandidateOfferApproval(offer=offer, role_code=step['approver_type'], step_number=step['step_number'],
                               step_name=step['step_name'], assigned_to=person)
        for person in approvers
    ])
    for person in approvers:
        Notification.objects.create(
            recipient=person,
            notification_type='APPROVAL_REQUEST',
            title=f'Offer approval required: {offer.application.candidate.full_name}',
            message=f'Review the offer for {offer.application.candidate.full_name} at step "{step["step_name"]}".',
            link='/recruitment/offers',
            metadata={'offer_id': str(offer.pk), 'step_number': step['step_number']},
        )


class RecruitmentSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(RecruitmentSettingsSerializer(get_recruitment_settings()).data)

    def patch(self, request):
        settings_obj = get_recruitment_settings()
        serializer = RecruitmentSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=getattr(request.user, 'employee', None))
        return Response(serializer.data)


class HiringRequisitionViewSet(ModelViewSet):
    queryset = HiringRequisition.objects.select_related(
        'requested_by', 'department', 'position', 'location', 'replacing_employee', 'workflow',
    ).prefetch_related('approval_actions__assigned_to')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    http_method_names = ['get', 'post']
    filterset_fields = ['status', 'department', 'position', 'requested_by']
    ordering_fields = ['created_at', 'target_start_date', 'requisition_number']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(pk__in=_recruitment_requisition_scope(self.request.user))

    def get_serializer_class(self):
        return HiringRequisitionCreateSerializer if self.action == 'create' else HiringRequisitionSerializer

    def create(self, request, *args, **kwargs):
        employee = getattr(request.user, 'employee', None)
        if not employee:
            raise PermissionDenied('Your account must be linked to an employee profile to request hiring.')
        allowed_roles = get_recruitment_settings().allowed_requester_roles
        if not (_is_hiring_manager(request.user) or any(request.user.has_role(role) for role in allowed_roles)):
            raise PermissionDenied('Your role is not allowed to open hiring requisitions.')

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            requisition = create_requisition(requester=employee, data=serializer.validated_data)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        response_serializer = HiringRequisitionSerializer(requisition, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-pending-approvals')
    def my_pending_approvals(self, request):
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response([])
        requisitions = self.get_queryset().filter(
            approval_actions__assigned_to=employee,
            approval_actions__status='PENDING',
            status='PENDING_APPROVAL',
        ).distinct()
        return Response(self.get_serializer(requisitions, many=True).data)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        requisition = self.get_object()
        employee = getattr(request.user, 'employee', None)
        if not employee:
            raise PermissionDenied('Your account must be linked to an employee profile to approve.')
        action_obj = HiringApprovalAction.objects.filter(
            requisition=requisition, assigned_to=employee, status='PENDING',
        ).first()
        if not action_obj:
            raise PermissionDenied('You have no pending approval for this requisition.')
        serializer = ApprovalDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            message = approve_requisition_action(
                action=action_obj, approver=employee,
                comments=serializer.validated_data.get('comments', ''),
            )
        except (ValueError, PermissionError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        requisition.refresh_from_db()
        return Response({'detail': message, 'requisition': HiringRequisitionSerializer(requisition).data})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        requisition = self.get_object()
        employee = getattr(request.user, 'employee', None)
        if not employee:
            raise PermissionDenied('Your account must be linked to an employee profile to reject.')
        action_obj = HiringApprovalAction.objects.filter(
            requisition=requisition, assigned_to=employee, status='PENDING',
        ).first()
        if not action_obj:
            raise PermissionDenied('You have no pending approval for this requisition.')
        serializer = RejectionDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reject_requisition_action(
                action=action_obj, approver=employee,
                reason=serializer.validated_data['reason'],
            )
        except (ValueError, PermissionError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        requisition.refresh_from_db()
        return Response({'detail': 'Requisition rejected; its openings are released.', 'requisition': HiringRequisitionSerializer(requisition).data})

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        requisition = self.get_object()
        if not (_is_hr(request.user) or requisition.requested_by_id == getattr(request.user, 'employee_id', None)):
            raise PermissionDenied('Only the requester or HR can cancel this requisition.')
        try:
            cancel_requisition(requisition)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        requisition.refresh_from_db()
        return Response({'detail': 'Requisition cancelled; its openings are released.', 'requisition': HiringRequisitionSerializer(requisition).data})


class PositionOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed_roles = get_recruitment_settings().allowed_requester_roles
        if not _is_hr(request.user) and not (_is_hiring_manager(request.user) or any(request.user.has_role(role) for role in allowed_roles)):
            return Response({'positions': [], 'locations': []})
        replacement_id = request.query_params.get('replacing_employee')
        replacing_employee = None
        if replacement_id:
            replacing_employee = Employee.objects.filter(pk=replacement_id, is_deleted=False).first()
        positions = JobPosition.objects.filter(is_active=True).select_related('department').order_by('title')
        payload = []
        for position in positions:
            available, filled, reserved = available_openings(
                position, replacing_employee=replacing_employee,
            )
            payload.append({
                'id': str(position.pk),
                'title': position.title,
                'grade_band': position.grade_band,
                'department_id': str(position.department_id),
                'department_name': position.department.name,
                'budgeted_count': position.budgeted_count,
                'filled_count': filled,
                'reserved_openings': reserved,
                'available_openings': available,
            })
        locations = CompanyStructure.objects.filter(
            is_active=True, type__in=['LOCATION', 'HQ'],
        ).order_by('name').values('id', 'name', 'type')
        return Response({'positions': payload, 'locations': list(locations)})


class ReplacementEmployeeOptionsView(APIView):
    """Return employees eligible for replacement requests to authorized requesters.

    The general employee endpoint intentionally limits managers to their direct
    reports. Replacement requisitions need a company-wide list, so expose only
    the minimal fields needed by this form and only to permitted recruiters.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed_roles = get_recruitment_settings().allowed_requester_roles
        if not _is_hr(request.user) and not (_is_hiring_manager(request.user) or any(request.user.has_role(role) for role in allowed_roles)):
            raise PermissionDenied('You are not allowed to view replacement employee options.')

        # Include every non-deleted employee with an assigned position. The
        # form filters this list by the position selected for the requisition.
        # Do not filter by employment status here: HR may be replacing an
        # employee who has already left but whose position is still recorded.
        employees = Employee.objects.filter(
            is_deleted=False,
            position__isnull=False,
        ).select_related('position').order_by('first_name', 'last_name', 'employee_id')
        return Response([{
            'id': str(employee.pk),
            'full_name': employee.full_name,
            'employee_id': employee.employee_id,
            'position_id': str(employee.position_id),
        } for employee in employees])


class RecruitmentRuleViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, IsHRAdminOrRecruitmentManager]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def perform_create(self, serializer):
        serializer.save(created_by=getattr(self.request.user, 'employee', None))


class RecruitmentStageViewSet(RecruitmentRuleViewSet):
    queryset = RecruitmentStage.objects.all()
    serializer_class = RecruitmentStageSerializer

    permission_classes = [IsAuthenticated, IsHRAdminOrRecruitmentManager]


class RecruitmentEmailTemplateViewSet(RecruitmentRuleViewSet):
    queryset = RecruitmentEmailTemplate.objects.all()
    serializer_class = RecruitmentEmailTemplateSerializer


class InterviewScorecardViewSet(RecruitmentRuleViewSet):
    queryset = InterviewScorecard.objects.all()
    serializer_class = InterviewScorecardSerializer


class RecruitmentTaskScorecardViewSet(RecruitmentRuleViewSet):
    queryset = RecruitmentTaskScorecard.objects.all()
    serializer_class = RecruitmentTaskScorecardSerializer


class OfferRuleViewSet(RecruitmentRuleViewSet):
    queryset = OfferRule.objects.all()
    serializer_class = OfferRuleSerializer


class CandidateApplicationOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_recruitment_access(request.user)
        requisitions = _recruitment_requisition_scope(request.user).filter(status='APPROVED').select_related(
            'position', 'department',
        ).order_by('-created_at')
        return Response(CandidateApplicationRequisitionOptionSerializer(requisitions, many=True).data)


class CandidateApplicationsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        _require_recruitment_access(request.user)
        applications = _recruitment_application_scope(request.user).select_related(
            'candidate', 'requisition', 'requisition__position', 'requisition__department', 'stage',
        ).prefetch_related('history__from_stage', 'history__to_stage', 'history__changed_by').all()
        requisition_id = request.query_params.get('requisition')
        stage_id = request.query_params.get('stage')
        decision = request.query_params.get('decision')
        try:
            if requisition_id:
                applications = applications.filter(requisition_id=UUID(requisition_id))
            if stage_id:
                applications = applications.filter(stage_id=UUID(stage_id))
        except (ValueError, TypeError):
            raise ValidationError({'detail': 'Requisition and stage filters must be valid IDs.'})
        if decision:
            if decision not in dict(CandidateApplication.SCREENING_DECISIONS):
                raise ValidationError({'decision': 'Choose a valid application decision filter.'})
            applications = applications.filter(screening_decision=decision)
        return Response(CandidateApplicationSerializer(applications, many=True).data)

    def post(self, request):
        _require_recruitment_access(request.user)
        serializer = CandidateApplicationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        if not _recruitment_requisition_scope(request.user).filter(pk=values['requisition'].pk, status='APPROVED').exists():
            raise PermissionDenied('You can add candidates only to approved requisitions you requested or are assigned to approve.')
        employee = getattr(request.user, 'employee', None)

        with transaction.atomic():
            candidate, created = RecruitmentCandidate.objects.get_or_create(
                email=values['email'],
                defaults={
                    'first_name': values['first_name'],
                    'last_name': values.get('last_name', ''),
                    'phone': values['phone'],
                    'resume': values['resume'],
                    'resume_original_filename': values['resume'].name[:255],
                    'created_by': employee,
                },
            )
            if not created:
                old_resume_name = candidate.resume.name if candidate.resume else None
                candidate.first_name = values['first_name']
                candidate.last_name = values.get('last_name', '')
                candidate.phone = values['phone']
                candidate.resume = values['resume']
                candidate.resume_original_filename = values['resume'].name[:255]
                candidate.save(update_fields=['first_name', 'last_name', 'phone', 'resume', 'resume_original_filename', 'updated_at'])
                if old_resume_name:
                    transaction.on_commit(lambda: candidate.resume.storage.delete(old_resume_name))

            stage = RecruitmentStage.objects.filter(code='new', is_active=True, is_terminal=False).first()
            if stage is None:
                stage = RecruitmentStage.objects.filter(is_active=True, is_terminal=False).order_by('order').first()
            if stage is None:
                raise PermissionDenied('Configure at least one active non-terminal recruitment stage before adding candidates.')

            application = CandidateApplication.objects.create(
                candidate=candidate,
                requisition=values['requisition'],
                stage=stage,
                internal_notes=values.get('internal_notes', '').strip(),
                created_by=employee,
            )
            CandidateApplicationHistory.objects.create(
                application=application,
                from_stage=None,
                to_stage=stage,
                decision='PENDING',
                notes='Application created',
                changed_by=employee,
            )

        return Response(CandidateApplicationSerializer(application).data, status=status.HTTP_201_CREATED)


class CandidateApplicationScreeningView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        _require_recruitment_access(request.user)
        serializer = CandidateScreeningDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data['decision']
        notes = serializer.validated_data['notes']

        with transaction.atomic():
            application = _recruitment_application_scope(request.user).select_for_update().select_related('stage').filter(pk=pk).first()
            if application is None:
                return Response({'detail': 'Candidate application not found.'}, status=status.HTTP_404_NOT_FOUND)
            if application.stage.is_terminal or application.stage.code not in {'new', 'screening'}:
                return Response(
                    {'detail': 'Screening decisions are available only in the New or Screening stages.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            next_stage = application.stage
            if decision == 'REJECT':
                next_stage = RecruitmentStage.objects.filter(
                    is_active=True, is_terminal=True, terminal_outcome='REJECTED',
                ).order_by('order').first()
                if next_stage is None:
                    return Response({'detail': 'Configure an active Rejected stage before rejecting candidates.'}, status=status.HTTP_400_BAD_REQUEST)
            elif decision == 'PASS':
                next_stage = _next_active_application_stage(application.stage)
                if next_stage is None:
                    return Response({'detail': 'There is no next active recruitment stage configured.'}, status=status.HTTP_400_BAD_REQUEST)

            previous_stage = application.stage
            application.stage = next_stage
            application.screening_decision = decision
            application.screening_notes = notes
            application.save(update_fields=['stage', 'screening_decision', 'screening_notes', 'updated_at'])
            CandidateApplicationHistory.objects.create(
                application=application,
                from_stage=previous_stage,
                to_stage=next_stage,
                decision=decision,
                notes=notes,
                changed_by=getattr(request.user, 'employee', None),
            )

        application = CandidateApplication.objects.select_related(
            'candidate', 'requisition', 'requisition__position', 'requisition__department', 'stage',
        ).prefetch_related('history__from_stage', 'history__to_stage', 'history__changed_by').get(pk=pk)
        return Response(CandidateApplicationSerializer(application).data)


class CandidateApplicationResumeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        application = CandidateApplication.objects.select_related('candidate').filter(pk=pk).first()
        if application is None or not application.candidate.resume:
            return Response({'detail': 'Resume not found.'}, status=status.HTTP_404_NOT_FOUND)
        employee = getattr(request.user, 'employee', None)
        if not _is_hr(request.user) and not (
            (employee is not None and application.interviews.filter(interviewers=employee).exists())
            or (_is_hiring_manager(request.user) and _recruitment_application_scope(request.user).filter(pk=application.pk).exists())
        ):
            raise PermissionDenied('Only HR, an assigned interviewer, or a manager responsible for this requisition can download this resume.')
        file_handle = application.candidate.resume.open('rb')
        filename = get_valid_filename(
            application.candidate.resume_original_filename
            or application.candidate.resume.name.rsplit('/', 1)[-1]
        )
        content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        return FileResponse(file_handle, as_attachment=True, filename=filename, content_type=content_type)


class CandidateInterviewOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_recruitment_access(request.user)
        applications = _recruitment_application_scope(request.user).filter(
            stage__code='interview', stage__is_terminal=False,
        ).select_related('candidate', 'requisition', 'requisition__position').order_by('-updated_at')
        scorecards = InterviewScorecard.objects.filter(is_active=True).order_by('name').values(
            'id', 'name', 'criteria',
        )
        interviewers = Employee.objects.filter(
            is_deleted=False,
        ).prefetch_related('user_account__roles').order_by('first_name', 'last_name', 'employee_id')
        return Response({
            'applications': [{
                'id': str(application.pk),
                'candidate_name': application.candidate.full_name,
                'candidate_email': application.candidate.email,
                'requisition_number': application.requisition.requisition_number,
                'position_title': application.requisition.position.title,
            } for application in applications],
            'scorecards': list(scorecards),
            'interviewers': [{
                'id': str(person.pk),
                'employee_id': person.employee_id,
                'full_name': person.full_name,
                'role_names': [role.role_name for role in person.user_account.roles.all() if role.is_active]
                    if hasattr(person, 'user_account') else [],
            } for person in interviewers],
        })


class CandidateInterviewsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        interviews = CandidateInterview.objects.select_related(
            'application', 'application__candidate', 'application__requisition',
            'application__requisition__position', 'application__stage', 'scorecard',
        ).prefetch_related('interviewers', 'evaluations__interviewer')
        if not _is_hr(request.user):
            employee = getattr(request.user, 'employee', None)
            manager_apps = _recruitment_application_scope(request.user)
            if _is_hiring_manager(request.user):
                interviews = interviews.filter(
                    Q(interviewers=employee) | Q(application__in=manager_apps),
                ).distinct()
            elif employee is None:
                return Response([])
            else:
                interviews = interviews.filter(interviewers=employee)
        interview_status = request.query_params.get('status')
        if interview_status:
            if interview_status not in dict(CandidateInterview.STATUS_CHOICES):
                raise ValidationError({'status': 'Choose a valid interview status.'})
            interviews = interviews.filter(status=interview_status)
        interviews = interviews.order_by('-scheduled_at', '-created_at')
        return Response(CandidateInterviewSerializer(interviews, many=True, context={'request': request}).data)

    def post(self, request):
        _require_recruitment_access(request.user)
        serializer = CandidateInterviewScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not _recruitment_application_scope(request.user).filter(pk=serializer.validated_data['application'].pk).exists():
            raise PermissionDenied('You can schedule interviews only for requisitions you requested or are assigned to approve.')
        interview = serializer.save(created_by=getattr(request.user, 'employee', None))
        interview = CandidateInterview.objects.select_related(
            'application', 'application__candidate', 'application__requisition',
            'application__requisition__position', 'application__stage', 'scorecard',
        ).prefetch_related('interviewers', 'evaluations__interviewer').get(pk=interview.pk)
        return Response(
            CandidateInterviewSerializer(interview, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class CandidateInterviewEvaluationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        employee = getattr(request.user, 'employee', None)
        if employee is None:
            raise PermissionDenied('Your account must be linked to an employee profile to submit an interview scorecard.')
        interview = CandidateInterview.objects.select_related('scorecard').prefetch_related('interviewers').filter(pk=pk).first()
        if interview is None:
            return Response({'detail': 'Interview not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not interview.interviewers.filter(pk=employee.pk).exists():
            raise PermissionDenied('You are not assigned to this interview.')
        if interview.status != 'SCHEDULED':
            return Response({'detail': 'This interview is no longer accepting evaluations.'}, status=status.HTTP_400_BAD_REQUEST)
        if interview.scheduled_at > timezone.now():
            return Response({'detail': 'The scorecard can be submitted after the scheduled interview time.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CandidateInterviewEvaluationCreateSerializer(
            data=request.data, context={'interview': interview},
        )
        serializer.is_valid(raise_exception=True)
        evaluation, _ = CandidateInterviewEvaluation.objects.update_or_create(
            interview=interview,
            interviewer=employee,
            defaults=serializer.validated_data,
        )
        if interview.evaluations.count() == interview.interviewers.count():
            interview.status = 'COMPLETED'
            interview.save(update_fields=['status', 'updated_at'])
        return Response(CandidateInterviewEvaluationSerializer(evaluation).data, status=status.HTTP_201_CREATED)


class CandidateInterviewOutcomeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        _require_recruitment_access(request.user)
        serializer = CandidateScreeningDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data['decision']
        notes = serializer.validated_data['notes']

        with transaction.atomic():
            application = _recruitment_application_scope(request.user).select_for_update().select_related('stage').filter(pk=pk).first()
            if application is None:
                return Response({'detail': 'Candidate application not found.'}, status=status.HTTP_404_NOT_FOUND)
            if application.stage.code != 'interview' or application.stage.is_terminal:
                return Response({'detail': 'Interview outcomes can only be recorded while the candidate is in Interview.'}, status=status.HTTP_400_BAD_REQUEST)
            interviews = application.interviews.exclude(status='CANCELLED')
            if not interviews.exists() or interviews.exclude(status='COMPLETED').exists():
                return Response({'detail': 'Complete every scheduled interview and evaluation before recording the outcome.'}, status=status.HTTP_400_BAD_REQUEST)

            next_stage = application.stage
            if decision == 'REJECT':
                next_stage = RecruitmentStage.objects.filter(
                    is_active=True, is_terminal=True, terminal_outcome='REJECTED',
                ).order_by('order').first()
                if next_stage is None:
                    return Response({'detail': 'Configure an active Rejected stage before rejecting candidates.'}, status=status.HTTP_400_BAD_REQUEST)
            elif decision == 'PASS':
                next_stage = RecruitmentStage.objects.filter(
                    is_active=True, is_terminal=False, order__gt=application.stage.order,
                ).order_by('order').first()
                if next_stage is None:
                    return Response({'detail': 'There is no next active recruitment stage configured.'}, status=status.HTTP_400_BAD_REQUEST)

            previous_stage = application.stage
            application.stage = next_stage
            application.screening_decision = decision
            application.screening_notes = notes
            application.save(update_fields=['stage', 'screening_decision', 'screening_notes', 'updated_at'])
            CandidateApplicationHistory.objects.create(
                application=application,
                from_stage=previous_stage,
                to_stage=next_stage,
                decision=decision,
                notes=notes,
                changed_by=getattr(request.user, 'employee', None),
            )

        application = CandidateApplication.objects.select_related(
            'candidate', 'requisition', 'requisition__position', 'requisition__department', 'stage',
        ).prefetch_related('history__from_stage', 'history__to_stage', 'history__changed_by').get(pk=pk)
        return Response(CandidateApplicationSerializer(application).data)


class CandidateTaskAssessmentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_recruitment_access(request.user)
        applications = _recruitment_application_scope(request.user).filter(
            Q(stage__code='tasks', stage__is_terminal=False) | Q(task_assessments__isnull=False),
        ).select_related('candidate', 'requisition', 'requisition__position', 'stage').distinct().order_by('-updated_at')
        assessments = CandidateTaskAssessment.objects.filter(application__in=applications).select_related(
            'application__candidate', 'scorecard', 'assessed_by',
        )
        return Response({
            'applications': [{
                'id': str(app.pk), 'candidate_name': app.candidate.full_name,
                'candidate_email': app.candidate.email,
                'requisition_number': app.requisition.requisition_number,
                'position_title': app.requisition.position.title,
                'current_stage_code': app.stage.code,
                'is_current_task_stage': app.stage.code == 'tasks' and not app.stage.is_terminal,
            } for app in applications],
            'scorecards': RecruitmentTaskScorecardSerializer(
                RecruitmentTaskScorecard.objects.filter(is_active=True).order_by('name'), many=True,
            ).data,
            'assessments': CandidateTaskAssessmentSerializer(assessments, many=True).data,
        })

    def post(self, request):
        _require_recruitment_access(request.user)
        serializer = CandidateTaskAssessmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = _recruitment_application_scope(request.user).select_related('stage').filter(
            pk=serializer.validated_data['application'].pk,
        ).first()
        if application is None:
            return Response({'detail': 'Candidate application not found.'}, status=status.HTTP_404_NOT_FOUND)
        if application.stage.code != 'tasks' or application.stage.is_terminal:
            return Response({'detail': 'Task assessments can only be added while the candidate is in Tasks.'}, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        assessment = CandidateTaskAssessment.objects.create(
            application=application, scorecard=data['scorecard'], task_title=data['task_title'],
            task_details=data.get('task_details', ''), criteria_snapshot=data['scorecard'].criteria,
        )
        assessment = CandidateTaskAssessment.objects.select_related('application__candidate', 'scorecard', 'assessed_by').get(pk=assessment.pk)
        return Response(CandidateTaskAssessmentSerializer(assessment).data, status=status.HTTP_201_CREATED)


class CandidateTaskAssessmentResultView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        _require_recruitment_access(request.user)
        assessment = CandidateTaskAssessment.objects.select_related(
            'application', 'application__stage', 'application__candidate', 'scorecard', 'assessed_by',
        ).filter(application__in=_recruitment_application_scope(request.user), pk=pk).first()
        if assessment is None:
            return Response({'detail': 'Candidate task assignment not found.'}, status=status.HTTP_404_NOT_FOUND)
        if assessment.application.stage.code != 'tasks' or assessment.application.stage.is_terminal:
            return Response({'detail': 'Task results can only be recorded while the candidate is in Tasks.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CandidateTaskAssessmentResultSerializer(assessment, data=request.data)
        serializer.is_valid(raise_exception=True)
        assessment.ratings = serializer.validated_data['ratings']
        assessment.comments = serializer.validated_data.get('comments', '')
        assessment.assessed_by = getattr(request.user, 'employee', None)
        assessment.save(update_fields=['ratings', 'comments', 'assessed_by', 'updated_at'])
        return Response(CandidateTaskAssessmentSerializer(assessment).data)


class CandidateTaskOutcomeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        _require_recruitment_access(request.user)
        serializer = CandidateScreeningDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data['decision']
        notes = serializer.validated_data['notes']
        with transaction.atomic():
            application = _recruitment_application_scope(request.user).select_for_update().select_related('stage').filter(pk=pk).first()
            if application is None:
                return Response({'detail': 'Candidate application not found.'}, status=status.HTTP_404_NOT_FOUND)
            if application.stage.code != 'tasks' or application.stage.is_terminal:
                return Response({'detail': 'Task outcomes can only be recorded while the candidate is in Tasks.'}, status=status.HTTP_400_BAD_REQUEST)
            if decision == 'PASS':
                task_assessments = list(application.task_assessments.all())
                if not task_assessments:
                    return Response({'detail': 'Assign at least one candidate task before advancing.'}, status=status.HTTP_400_BAD_REQUEST)
                if any(not assessment.is_assessed for assessment in task_assessments):
                    return Response({'detail': 'Enter results for every assigned task before advancing.'}, status=status.HTTP_400_BAD_REQUEST)
                next_stage = _next_active_application_stage(application.stage)
                if next_stage is None:
                    return Response({'detail': 'There is no next active recruitment stage configured.'}, status=status.HTTP_400_BAD_REQUEST)
            elif decision == 'REJECT':
                next_stage = RecruitmentStage.objects.filter(is_active=True, is_terminal=True, terminal_outcome='REJECTED').order_by('order').first()
                if next_stage is None:
                    return Response({'detail': 'Configure an active Rejected stage before rejecting candidates.'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                next_stage = application.stage
            previous_stage = application.stage
            application.stage = next_stage
            application.screening_decision = decision
            application.screening_notes = notes
            application.save(update_fields=['stage', 'screening_decision', 'screening_notes', 'updated_at'])
            CandidateApplicationHistory.objects.create(
                application=application, from_stage=previous_stage, to_stage=next_stage,
                decision=decision, notes=notes, changed_by=getattr(request.user, 'employee', None),
            )
        application = CandidateApplication.objects.select_related(
            'candidate', 'requisition', 'requisition__position', 'requisition__department', 'stage',
        ).prefetch_related('history__from_stage', 'history__to_stage', 'history__changed_by').get(pk=pk)
        return Response(CandidateApplicationSerializer(application).data)


class CandidateBackgroundChecksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_recruitment_access(request.user)
        applications = _recruitment_application_scope(request.user).filter(
            Q(stage__code='reference-check', stage__is_terminal=False)
            | Q(background_checks__isnull=False),
        ).select_related('candidate', 'requisition', 'requisition__position', 'stage').distinct().order_by('-updated_at')
        checks = CandidateBackgroundCheck.objects.select_related('application', 'application__candidate', 'created_by', 'updated_by')
        if not _is_hr(request.user):
            checks = checks.filter(application__in=applications)
        return Response({
            'applications': [{
                'id': str(application.pk),
                'candidate_name': application.candidate.full_name,
                'candidate_email': application.candidate.email,
                'requisition_number': application.requisition.requisition_number,
                'position_title': application.requisition.position.title,
                'current_stage_code': application.stage.code,
                'is_current_reference_stage': application.stage.code == 'reference-check' and not application.stage.is_terminal,
            } for application in applications],
            'checks': CandidateBackgroundCheckSerializer(checks, many=True).data,
        })

    def post(self, request):
        _require_recruitment_access(request.user)
        application_id = request.data.get('application')
        application = _recruitment_application_scope(request.user).select_related('stage').filter(pk=application_id).first()
        if application is None:
            return Response({'detail': 'Candidate application not found.'}, status=status.HTTP_404_NOT_FOUND)
        if application.stage.code != 'reference-check' or application.stage.is_terminal:
            return Response({'detail': 'Checks can only be added while the candidate is in Reference Check.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = CandidateBackgroundCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        check = serializer.save(application=application, created_by=getattr(request.user, 'employee', None), updated_by=getattr(request.user, 'employee', None))
        return Response(CandidateBackgroundCheckSerializer(check).data, status=status.HTTP_201_CREATED)


class CandidateBackgroundCheckDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        _require_recruitment_access(request.user)
        check = CandidateBackgroundCheck.objects.select_related('application', 'application__stage').filter(
            pk=pk, application__in=_recruitment_application_scope(request.user),
        ).first()
        if check is None:
            return Response({'detail': 'Reference/background check not found.'}, status=status.HTTP_404_NOT_FOUND)
        if check.application.stage.code != 'reference-check' or check.application.stage.is_terminal:
            return Response({'detail': 'Checks can only be updated while the candidate is in Reference Check.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = CandidateBackgroundCheckSerializer(check, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        check = serializer.save(updated_by=getattr(request.user, 'employee', None))
        return Response(CandidateBackgroundCheckSerializer(check).data)


class CandidateReferenceCheckOutcomeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        _require_recruitment_access(request.user)
        serializer = CandidateScreeningDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data['decision']
        notes = serializer.validated_data['notes']
        with transaction.atomic():
            application = _recruitment_application_scope(request.user).select_for_update().select_related('stage').filter(pk=pk).first()
            if application is None:
                return Response({'detail': 'Candidate application not found.'}, status=status.HTTP_404_NOT_FOUND)
            if application.stage.code != 'reference-check' or application.stage.is_terminal:
                return Response({'detail': 'Reference check outcomes can only be recorded at Reference Check.'}, status=status.HTTP_400_BAD_REQUEST)
            required_checks = list(application.background_checks.filter(is_required=True))
            if decision == 'PASS' and any(check.status != 'COMPLETED' or check.outcome != 'PASS' for check in required_checks):
                return Response({'detail': 'Complete and pass every required reference/background check before advancing to Offer.'}, status=status.HTTP_400_BAD_REQUEST)
            if decision == 'REJECT':
                next_stage = RecruitmentStage.objects.filter(is_active=True, is_terminal=True, terminal_outcome='REJECTED').order_by('order').first()
                if next_stage is None:
                    return Response({'detail': 'Configure an active Rejected stage before rejecting candidates.'}, status=status.HTTP_400_BAD_REQUEST)
            elif decision == 'PASS':
                next_stage = _next_active_application_stage(application.stage)
                if next_stage is None:
                    return Response({'detail': 'There is no next active recruitment stage configured.'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                next_stage = application.stage

            previous_stage = application.stage
            application.stage = next_stage
            application.screening_decision = decision
            application.screening_notes = notes
            application.save(update_fields=['stage', 'screening_decision', 'screening_notes', 'updated_at'])
            CandidateApplicationHistory.objects.create(
                application=application, from_stage=previous_stage, to_stage=next_stage,
                decision=decision, notes=notes, changed_by=getattr(request.user, 'employee', None),
            )
        application = CandidateApplication.objects.select_related('candidate', 'requisition', 'requisition__position', 'requisition__department', 'stage').prefetch_related('history__from_stage', 'history__to_stage', 'history__changed_by').get(pk=pk)
        return Response(CandidateApplicationSerializer(application).data)


class CandidateOffersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = CandidateOffer.objects.select_related(
            'application', 'application__candidate', 'application__requisition',
            'application__requisition__position', 'rule', 'employee',
        ).prefetch_related('approvals__assigned_to')
        if not _is_hr(request.user):
            employee = getattr(request.user, 'employee', None)
            if employee is None:
                return Response([])
            queryset = queryset.filter(approvals__assigned_to=employee).distinct()
        return Response(CandidateOfferSerializer(queryset, many=True, context={'request': request}).data)

    def post(self, request):
        if not _is_hr(request.user):
            raise PermissionDenied('Only HR can prepare candidate offers.')
        serializer = CandidateOfferCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        application = values['application']
        if application.stage.code != 'offer' or application.stage.is_terminal:
            raise ValidationError({'application': 'Offers can only be prepared for candidates in the Offer stage.'})
        if CandidateOffer.objects.filter(application=application).exists():
            raise ValidationError({'application': 'An offer already exists for this candidate. Update the existing offer instead.'})
        rule = OfferRule.objects.filter(grade_band=application.requisition.grade_band, is_active=True).first()
        if rule is None:
            raise ValidationError({'application': f'No active offer rule is configured for grade {application.requisition.grade_band}.'})
        salary = values['annual_salary']
        bonus = values['signing_bonus']
        if salary < rule.minimum_salary or salary > rule.maximum_salary:
            raise ValidationError({'annual_salary': f'Salary must be between {rule.currency} {rule.minimum_salary} and {rule.maximum_salary} for {rule.grade_band}.'})
        if bonus > rule.maximum_signing_bonus:
            raise ValidationError({'signing_bonus': f'Signing bonus cannot exceed {rule.currency} {rule.maximum_signing_bonus}.'})
        workflow = ApprovalWorkflow.objects.filter(module='RECRUITMENT_OFFER', is_active=True).prefetch_related('steps').first()
        if workflow is None:
            raise ValidationError({'detail': 'Configure and activate a Recruitment Offers workflow in Approval Workflow Settings before preparing offers.'})
        workflow_steps = _offer_workflow_steps(workflow)
        if not workflow_steps:
            raise ValidationError({'detail': 'The active Recruitment Offers workflow has no approval steps.'})
        with transaction.atomic():
            offer = CandidateOffer.objects.create(
                application=application, rule=rule, workflow=workflow,
                workflow_steps_snapshot=workflow_steps, current_step_number=workflow_steps[0]['step_number'], currency=rule.currency,
                annual_salary=salary, signing_bonus=bonus, joining_date=values['joining_date'],
                expires_on=values['expires_on'], notes=values.get('notes', '').strip(),
                created_by=getattr(request.user, 'employee', None),
            )
            _create_offer_step_approvals(offer, workflow_steps[0])
        offer = CandidateOffer.objects.select_related('application', 'application__candidate', 'application__requisition', 'application__requisition__position', 'rule').prefetch_related('approvals__assigned_to').get(pk=offer.pk)
        return Response(CandidateOfferSerializer(offer, context={'request': request}).data, status=status.HTTP_201_CREATED)


class CandidateOfferOptionsView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request):
        applications = CandidateApplication.objects.filter(stage__code='offer', stage__is_terminal=False).select_related(
            'candidate', 'requisition', 'requisition__position',
        ).order_by('-updated_at')
        offered_ids = set(CandidateOffer.objects.values_list('application_id', flat=True))
        rules = OfferRule.objects.filter(is_active=True).order_by('grade_band')
        accepted_offers = CandidateOffer.objects.filter(status='ACCEPTED').select_related(
            'application__candidate', 'application__requisition',
            'application__requisition__position', 'application__requisition__department',
            'application__requisition__location', 'employee',
        ).order_by('-responded_at')
        return Response({
            'applications': [{
                'id': str(application.pk), 'candidate_name': application.candidate.full_name,
                'candidate_email': application.candidate.email,
                'requisition_number': application.requisition.requisition_number,
                'position_title': application.requisition.position.title,
                'grade_band': application.requisition.grade_band,
            } for application in applications if application.pk not in offered_ids],
            'rules': OfferRuleSerializer(rules, many=True).data,
            'employees': [{
                'id': str(employee.pk), 'employee_id': employee.employee_id,
                'full_name': employee.full_name, 'official_email': employee.official_email,
            } for employee in Employee.objects.filter(is_deleted=False).order_by('first_name', 'last_name')],
            'accepted_offers': [{
                'id': str(offer.pk),
                'candidate_name': offer.application.candidate.full_name,
                'first_name': offer.application.candidate.first_name,
                'last_name': offer.application.candidate.last_name,
                'candidate_email': offer.application.candidate.email,
                'phone_number': offer.application.candidate.phone,
                'date_of_joining': offer.joining_date.isoformat(),
                'position_id': str(offer.application.requisition.position_id),
                'position_title': offer.application.requisition.position.title,
                'department_id': str(offer.application.requisition.department_id),
                'location_id': str(offer.application.requisition.location_id),
                'employee_name': offer.employee.full_name if offer.employee_id else None,
            } for offer in accepted_offers],
        })


class CandidateOfferApprovalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        employee = getattr(request.user, 'employee', None)
        if employee is None:
            raise PermissionDenied('Your account must be linked to an employee profile to approve offers.')
        decision = request.data.get('decision')
        comments = str(request.data.get('comments', '')).strip()
        if decision not in {'APPROVE', 'REJECT'}:
            raise ValidationError({'decision': 'Choose APPROVE or REJECT.'})
        if len(comments) < 2:
            raise ValidationError({'comments': 'Add a short comment before submitting your decision.'})
        with transaction.atomic():
            offer = CandidateOffer.objects.select_for_update().filter(pk=pk).first()
            if offer is None:
                return Response({'detail': 'Offer not found.'}, status=status.HTTP_404_NOT_FOUND)
            if offer.status != 'PENDING_APPROVAL':
                raise ValidationError({'detail': 'This offer is no longer awaiting approval.'})
            approval = CandidateOfferApproval.objects.select_for_update().filter(
                offer=offer, step_number=offer.current_step_number, assigned_to=employee, status='PENDING'
            ).first()
            if approval is None:
                raise PermissionDenied('You are not an assigned approver for this offer.')
            approval.status = 'APPROVED' if decision == 'APPROVE' else 'REJECTED'
            approval.comments = comments
            approval.acted_at = timezone.now()
            approval.save(update_fields=['status', 'comments', 'acted_at'])
            if decision == 'REJECT':
                offer.status = 'REJECTED'
            elif not offer.approvals.filter(step_number=offer.current_step_number, status='PENDING').exists():
                next_step = next((step for step in offer.workflow_steps_snapshot if step['step_number'] > offer.current_step_number), None)
                if next_step:
                    offer.current_step_number = next_step['step_number']
                    offer.save(update_fields=['current_step_number', 'updated_at'])
                    _create_offer_step_approvals(offer, next_step)
                else:
                    offer.status = 'APPROVED'
                    offer.approved_at = timezone.now()
            offer.save(update_fields=['status', 'approved_at', 'current_step_number', 'updated_at'])
        offer = CandidateOffer.objects.select_related('application', 'application__candidate', 'application__requisition', 'application__requisition__position', 'rule').prefetch_related('approvals__assigned_to').get(pk=pk)
        return Response(CandidateOfferSerializer(offer, context={'request': request}).data)


class CandidateOfferActionView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request, pk, action):
        offer = CandidateOffer.objects.select_related(
            'application', 'application__candidate', 'application__requisition',
            'application__requisition__position', 'application__requisition__department',
            'application__requisition__location', 'application__stage', 'rule', 'employee',
        ).prefetch_related('approvals__assigned_to').filter(pk=pk).first()
        if offer is None:
            return Response({'detail': 'Offer not found.'}, status=status.HTTP_404_NOT_FOUND)
        if action == 'send':
            with transaction.atomic():
                locked_offer = CandidateOffer.objects.select_for_update().get(pk=pk)
                if locked_offer.status not in {'PENDING_APPROVAL', 'APPROVED'}:
                    raise ValidationError({'detail': f'This offer cannot be sent from its current status ({locked_offer.get_status_display()}).'})
                approvals = list(locked_offer.approvals.select_related('assigned_to').all())
                rejected = [a for a in approvals if a.status == 'REJECTED']
                pending = [a for a in approvals if a.status == 'PENDING']
                # Reconcile stale offer status against the approval records. This
                # also handles offers approved before the status update was saved.
                if rejected:
                    locked_offer.status = 'REJECTED'
                    locked_offer.save(update_fields=['status', 'updated_at'])
                    raise ValidationError({'detail': 'This offer has a rejected approval and cannot be sent.'})
                if not approvals:
                    raise ValidationError({'detail': 'This offer has no approval records. Recreate the offer with an active offer rule and approvers.'})
                if pending:
                    pending_names = ', '.join(f'{a.role_code} ({a.assigned_to.full_name})' for a in pending)
                    raise ValidationError({'detail': f'Offer approvals are still pending: {pending_names}.'})
                if all(a.status == 'APPROVED' for a in approvals):
                    if locked_offer.status != 'APPROVED':
                        locked_offer.status = 'APPROVED'
                        locked_offer.approved_at = locked_offer.approved_at or timezone.now()
                        locked_offer.save(update_fields=['status', 'approved_at', 'updated_at'])
                else:
                    raise ValidationError({'detail': 'Offer approval records are not all approved; refresh and review the approval history.'})
                offer.status = locked_offer.status
            if offer.status != 'APPROVED':
                raise ValidationError({'detail': f'Offer must be approved before sending (current status: {offer.status}).'})
            try:
                send_candidate_offer_email(offer)
            except Exception as exc:
                raise ValidationError({'detail': f'Offer email was not sent: {exc}'})
            offer.status = 'SENT'
            offer.sent_at = timezone.now()
            offer.save(update_fields=['status', 'sent_at', 'updated_at'])
        elif action == 'response':
            decision = request.data.get('decision')
            notes = str(request.data.get('notes', '')).strip()
            if offer.status != 'SENT':
                raise ValidationError({'detail': 'Record the candidate response after the offer has been sent.'})
            if decision not in {'ACCEPTED', 'DECLINED'}:
                raise ValidationError({'decision': 'Choose ACCEPTED or DECLINED.'})
            if len(notes) < 2:
                raise ValidationError({'notes': 'Record a brief note about the candidate response.'})
            with transaction.atomic():
                offer = CandidateOffer.objects.select_for_update().select_related('application', 'application__stage').get(pk=pk)
                if offer.status != 'SENT':
                    raise ValidationError({'detail': 'This offer is no longer awaiting a response.'})
                offer.status = decision
                offer.responded_at = timezone.now()
                offer.notes = f'{offer.notes}\nCandidate response: {notes}'.strip()
                offer.save(update_fields=['status', 'responded_at', 'notes', 'updated_at'])
                if decision == 'ACCEPTED':
                    hired_stage = RecruitmentStage.objects.filter(is_active=True, is_terminal=True, terminal_outcome='HIRED').order_by('order').first()
                    if hired_stage is None:
                        raise ValidationError({'detail': 'Configure an active Hired stage before recording an accepted offer.'})
                    application = offer.application
                    previous_stage = application.stage
                    application.stage = hired_stage
                    application.screening_decision = 'PASS'
                    application.screening_notes = f'Offer accepted. {notes}'[:10000]
                    application.save(update_fields=['stage', 'screening_decision', 'screening_notes', 'updated_at'])
                    CandidateApplicationHistory.objects.create(
                        application=application, from_stage=previous_stage, to_stage=hired_stage,
                        decision='PASS', notes=f'Offer accepted. {notes}',
                        changed_by=getattr(request.user, 'employee', None),
                    )
            if decision == 'ACCEPTED':
                offer = CandidateOffer.objects.select_related(
                    'application', 'application__candidate', 'application__requisition',
                    'application__requisition__position', 'application__requisition__department',
                    'application__requisition__location', 'rule', 'employee',
                ).get(pk=pk)
                deliver_accepted_offer_letter(offer, uploaded_by=getattr(request.user, 'employee', None))
        elif action == 'retry-letter':
            if offer.status != 'ACCEPTED':
                raise ValidationError({'detail': 'The formal letter can only be delivered after the candidate accepts.'})
            deliver_accepted_offer_letter(offer, uploaded_by=getattr(request.user, 'employee', None), force_resend=True)
        else:
            raise ValidationError({'action': 'Unknown offer action.'})
        offer = CandidateOffer.objects.select_related(
            'application', 'application__candidate', 'application__requisition',
            'application__requisition__position', 'rule', 'employee',
        ).prefetch_related('approvals__assigned_to').get(pk=pk)
        return Response(CandidateOfferSerializer(offer, context={'request': request}).data)


class CandidateOfferEmployeeLinkView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request, pk):
        offer = CandidateOffer.objects.select_related('application', 'application__candidate', 'application__requisition', 'created_by').filter(pk=pk).first()
        if offer is None:
            return Response({'detail': 'Offer not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            employee = Employee.objects.get(pk=request.data.get('employee'), is_deleted=False)
        except (Employee.DoesNotExist, ValueError, TypeError):
            raise ValidationError({'employee': 'Choose an active employee profile.'})
        try:
            link_accepted_offer_to_employee(offer, employee, uploaded_by=getattr(request.user, 'employee', None))
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)})
        offer = CandidateOffer.objects.select_related('application', 'application__candidate', 'application__requisition', 'application__requisition__position', 'rule', 'employee').prefetch_related('approvals__assigned_to').get(pk=pk)
        return Response(CandidateOfferSerializer(offer, context={'request': request}).data)


class CandidateOfferLetterView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request, pk):
        offer = CandidateOffer.objects.filter(pk=pk, status='ACCEPTED').first()
        if offer is None or not offer.offer_letter:
            return Response({'detail': 'The accepted offer letter PDF is not available yet.'}, status=status.HTTP_404_NOT_FOUND)
        handle = offer.offer_letter.open('rb')
        filename = offer.offer_letter.name.rsplit('/', 1)[-1]
        return FileResponse(handle, as_attachment=True, filename=filename, content_type='application/pdf')


class CandidateOfferDocumentsView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, pk):
        offer = CandidateOffer.objects.filter(pk=pk).first()
        if offer is None:
            return Response({'detail': 'Offer not found.'}, status=status.HTTP_404_NOT_FOUND)
        documents = CandidateDocument.objects.filter(application=offer.application).select_related('uploaded_by', 'reviewed_by', 'employee_document')
        return Response(CandidateDocumentSerializer(documents, many=True).data)

    def post(self, request, pk):
        offer = CandidateOffer.objects.select_related('application__candidate').filter(pk=pk).first()
        if offer is None:
            return Response({'detail': 'Offer not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CandidateDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded_file = serializer.validated_data['file']
        document = CandidateDocument(
            candidate=offer.application.candidate,
            application=offer.application,
            document_type=serializer.validated_data['document_type'],
            document_name=serializer.validated_data['document_name'].strip(),
            original_filename=uploaded_file.name[:255],
            file_size_kb=max(1, round(uploaded_file.size / 1024)),
            mime_type=getattr(uploaded_file, 'content_type', '') or mimetypes.guess_type(uploaded_file.name)[0] or '',
            uploaded_by=getattr(request.user, 'employee', None),
        )
        document.file.save(uploaded_file.name, uploaded_file, save=True)
        return Response(CandidateDocumentSerializer(document).data, status=status.HTTP_201_CREATED)


class CandidateOfferDocumentDetailView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get_object(self, pk, document_id):
        return CandidateDocument.objects.filter(application__offer__pk=pk, pk=document_id).first()

    def get(self, request, pk, document_id):
        document = self.get_object(pk, document_id)
        if document is None or not document.file:
            return Response({'detail': 'Candidate document not found.'}, status=status.HTTP_404_NOT_FOUND)
        filename = get_valid_filename(document.original_filename or document.document_name)
        return FileResponse(document.file.open('rb'), as_attachment=True, filename=filename, content_type=document.mime_type or 'application/octet-stream')

    def patch(self, request, pk, document_id):
        document = self.get_object(pk, document_id)
        if document is None:
            return Response({'detail': 'Candidate document not found.'}, status=status.HTTP_404_NOT_FOUND)
        decision = request.data.get('status')
        if decision not in {'RECEIVED', 'VERIFIED', 'REJECTED'}:
            raise ValidationError({'status': 'Choose Received, Verified, or Needs replacement.'})
        document.status = decision
        document.review_notes = str(request.data.get('review_notes', '')).strip()[:4000]
        document.reviewed_by = getattr(request.user, 'employee', None)
        document.reviewed_at = timezone.now()
        document.save(update_fields=['status', 'review_notes', 'reviewed_by', 'reviewed_at'])
        if decision == 'VERIFIED':
            offer = CandidateOffer.objects.select_related('application__candidate', 'created_by').filter(pk=pk).first()
            if offer and offer.employee_id:
                from .offer_services import link_accepted_offer_to_employee
                link_accepted_offer_to_employee(offer, offer.employee, uploaded_by=getattr(request.user, 'employee', None))
                document.refresh_from_db()
        return Response(CandidateDocumentSerializer(document).data)

