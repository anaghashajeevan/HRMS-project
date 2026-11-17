from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from HRMSapp.models import CompanyStructure, Employee, EmployeeDocument, JobPosition, Notification
from HRMSapp.permissions import IsHRAdmin
from recruitmentapp.models import CandidateOffer
from .models import OnboardingCase, OnboardingTask, OnboardingTaskSubmission, OnboardingTemplate
from .serializers import OnboardingCaseSerializer, OnboardingStartSerializer, OnboardingTaskSerializer, OnboardingTemplateSerializer
from .services import template_matches_employee


class OnboardingTemplateViewSet(ModelViewSet):
    queryset = OnboardingTemplate.objects.select_related('department', 'position', 'location', 'created_by').prefetch_related('tasks')
    serializer_class = OnboardingTemplateSerializer
    permission_classes = [IsAuthenticated, IsHRAdmin]
    filterset_fields = ['is_active', 'department', 'position']
    search_fields = ['name', 'description', 'department__name', 'position__title']
    ordering_fields = ['name', 'created_at', 'updated_at']

    def perform_create(self, serializer):
        serializer.save(created_by=getattr(self.request.user, 'employee', None))


class OnboardingSetupOptionsView(APIView):
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request):
        departments = CompanyStructure.objects.filter(
            type__in=['DEPARTMENT', 'TEAM'], is_active=True,
        ).order_by('name')
        positions = JobPosition.objects.filter(is_active=True).select_related('department').order_by('title')
        locations = CompanyStructure.objects.filter(type__in=['LOCATION', 'HQ'], is_active=True).order_by('name')
        employees = Employee.objects.filter(is_deleted=False).select_related('position').order_by('first_name', 'last_name')
        active_templates = list(OnboardingTemplate.objects.filter(is_active=True).select_related('department', 'position', 'location'))
        accepted_offers = CandidateOffer.objects.filter(
            status='ACCEPTED', employee__isnull=False, onboarding_case__isnull=True,
        ).select_related(
            'employee', 'employee__position', 'employee__position__department',
            'employee__department', 'application__candidate',
        ).order_by('-responded_at', '-created_at')
        offers = []
        for offer in accepted_offers:
            employee = offer.employee
            compatible_template_ids = [
                str(template.pk) for template in active_templates
                if template_matches_employee(template, employee)
            ]
            offers.append({
                'id': str(offer.pk),
                'candidate_name': offer.application.candidate.full_name,
                'employee_id': str(employee.pk),
                'employee_number': employee.employee_id,
                'employee_name': employee.full_name,
                'position_title': employee.position.title if employee.position_id else '',
                'joining_date': offer.joining_date,
                'compatible_template_ids': compatible_template_ids,
            })
        return Response({
            'departments': [{
                'id': str(row.pk),
                'name': row.name,
                'type': row.type,
                'parent_name': row.parent.name if row.parent_id else '',
                'path': row.path or row.name,
            } for row in departments],
            'positions': [{'id': str(row.pk), 'title': row.title, 'department_name': row.department.name if row.department_id else ''} for row in positions],
            'locations': [{
                'id': str(row.pk),
                'name': row.name,
                'type': row.type,
                'parent_name': row.parent.name if row.parent_id else '',
                'path': row.path or row.name,
            } for row in locations],
            'employees': [{
                'id': str(row.pk), 'employee_number': row.employee_id,
                'full_name': row.full_name,
                'position_title': row.position.title if row.position_id else '',
            } for row in employees],
            'accepted_offers': offers,
        })


class OnboardingCaseViewSet(ModelViewSet):
    queryset = OnboardingCase.objects.select_related(
        'offer', 'offer__application__candidate', 'employee', 'template', 'started_by',
    ).prefetch_related('tasks')
    serializer_class = OnboardingCaseSerializer
    permission_classes = [IsAuthenticated, IsHRAdmin]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return OnboardingStartSerializer
        return OnboardingCaseSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        case = serializer.save()
        output = OnboardingCaseSerializer(case, context={'request': request})
        return Response(output.data, status=201)


class OnboardingTaskViewSet(ModelViewSet):
    serializer_class = OnboardingTaskSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        queryset = OnboardingTask.objects.select_related(
            'case__employee', 'case__offer', 'assigned_to',
        ).prefetch_related('submissions__employee_document')
        if user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN'):
            return queryset
        employee = getattr(user, 'employee', None)
        if employee is None:
            return queryset.none()
        queryset = queryset.filter(assigned_to=employee)
        if user.has_role('MANAGER') or user.has_role('REPORTING_MANAGER'):
            from django.db.models import Q
            queryset = queryset | OnboardingTask.objects.filter(
                case__employee__reporting_manager=employee,
            ).select_related('case__employee', 'case__offer', 'assigned_to').prefetch_related('submissions__employee_document')
        return queryset.distinct().order_by('due_date', 'order')

    def _is_hr(self, user):
        return user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN')

    def _ensure_can_update(self, task, user):
        employee = getattr(user, 'employee', None)
        if self._is_hr(user) or (employee and task.assigned_to_id == employee.pk):
            return employee
        raise PermissionDenied('Only the assigned owner or HR can update this onboarding task.')

    @action(detail=True, methods=['post'], url_path='progress')
    def progress(self, request, pk=None):
        task = self.get_object()
        employee = self._ensure_can_update(task, request.user)
        new_status = request.data.get('status')
        allowed = {'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'}
        if self._is_hr(request.user):
            allowed.add('WAIVED')
        if new_status not in allowed:
            raise ValidationError({'status': 'Choose a valid task status.'})
        notes = str(request.data.get('completion_notes', '')).strip()
        if new_status == 'BLOCKED' and len(notes) < 2:
            raise ValidationError({'completion_notes': 'Add a short explanation when blocking a task.'})
        if new_status == 'COMPLETED' and task.task_type == 'DOCUMENT':
            verified = task.submissions.filter(status='VERIFIED').exists()
            if not verified:
                raise ValidationError({'status': 'HR must verify a submitted document before this task can be completed.'})
        task.status = new_status
        task.completion_notes = notes
        task.completed_at = timezone.now() if new_status in {'COMPLETED', 'WAIVED'} else None
        task.save(update_fields=['status', 'completion_notes', 'completed_at', 'updated_at'])
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=['post'], url_path='assign')
    def assign(self, request, pk=None):
        if not self._is_hr(request.user):
            raise PermissionDenied('Only HR can reassign onboarding tasks.')
        task = self.get_object()
        assignee_id = request.data.get('assigned_to')
        assignee = Employee.objects.filter(pk=assignee_id, is_deleted=False).first() if assignee_id else None
        if assignee_id and assignee is None:
            raise ValidationError({'assigned_to': 'Choose an active employee.'})
        task.assigned_to = assignee
        task.save(update_fields=['assigned_to', 'updated_at'])
        if assignee:
            Notification.objects.create(
                recipient=assignee, notification_type='SYSTEM',
                title=f'Onboarding task assigned: {task.title}',
                message=f'{task.title} is assigned to you for {task.case.employee.full_name}.',
                link='/onboarding/my-tasks',
                metadata={'onboarding_case_id': str(task.case_id), 'onboarding_task_id': str(task.pk)},
            )
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=['post'], url_path='upload-document', parser_classes=[MultiPartParser, FormParser])
    def upload_document(self, request, pk=None):
        task = self.get_object()
        uploader = self._ensure_can_update(task, request.user)
        if task.task_type != 'DOCUMENT':
            raise ValidationError({'detail': 'This checklist item is not a document submission task.'})
        if task.status in {'COMPLETED', 'WAIVED'}:
            raise ValidationError({'detail': 'Reopen the task before uploading a replacement document.'})
        file_obj = request.FILES.get('file')
        if not file_obj:
            raise ValidationError({'file': 'Choose a document to upload.'})
        document = EmployeeDocument.objects.create(
            employee=task.case.employee,
            document_type=task.employee_document_type,
            document_name=str(request.data.get('document_name') or task.title)[:150],
            file_path=file_obj,
            file_size_kb=round(file_obj.size / 1024),
            mime_type=getattr(file_obj, 'content_type', ''),
            uploaded_by=uploader,
        )
        OnboardingTaskSubmission.objects.create(task=task, employee_document=document)
        task.status = 'IN_PROGRESS'
        task.completion_notes = ''
        task.save(update_fields=['status', 'completion_notes', 'updated_at'])
        return Response(self.get_serializer(task).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='review-document')
    def review_document(self, request, pk=None):
        if not self._is_hr(request.user):
            raise PermissionDenied('Only HR can review onboarding documents.')
        task = self.get_object()
        submission_id = request.data.get('submission_id')
        decision = request.data.get('decision')
        comments = str(request.data.get('comments', '')).strip()
        if decision not in {'VERIFY', 'REJECT'}:
            raise ValidationError({'decision': 'Choose VERIFY or REJECT.'})
        if decision == 'REJECT' and len(comments) < 2:
            raise ValidationError({'comments': 'Explain what needs to be corrected.'})
        submission = task.submissions.filter(pk=submission_id).first()
        if submission is None:
            raise ValidationError({'submission_id': 'That document submission does not belong to this task.'})
        if submission.status != 'PENDING_REVIEW':
            raise ValidationError({'submission_id': 'Only documents awaiting review can be reviewed.'})
        submission.status = 'VERIFIED' if decision == 'VERIFY' else 'REJECTED'
        submission.review_comments = comments
        submission.reviewed_by = getattr(request.user, 'employee', None)
        submission.reviewed_at = timezone.now()
        submission.save(update_fields=['status', 'review_comments', 'reviewed_by', 'reviewed_at'])
        if decision == 'VERIFY':
            task.status = 'COMPLETED'
            task.completed_at = timezone.now()
            task.completion_notes = comments
        else:
            task.status = 'IN_PROGRESS'
            task.completed_at = None
            task.completion_notes = comments
        task.save(update_fields=['status', 'completed_at', 'completion_notes', 'updated_at'])
        return Response(self.get_serializer(task).data)
