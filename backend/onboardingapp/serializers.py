from django.db import transaction
from datetime import timedelta
from rest_framework import serializers

from HRMSapp.models import Notification
from .models import OnboardingCase, OnboardingTask, OnboardingTaskSubmission, OnboardingTemplate, OnboardingTemplateTask
from .services import template_matches_employee
from recruitmentapp.models import CandidateOffer


class OnboardingTemplateTaskSerializer(serializers.ModelSerializer):
    task_type_display = serializers.CharField(source='get_task_type_display', read_only=True)
    owner_type_display = serializers.CharField(source='get_owner_type_display', read_only=True)
    owner_employee_name = serializers.CharField(source='owner_employee.full_name', read_only=True, default=None)

    class Meta:
        model = OnboardingTemplateTask
        fields = [
            'id', 'title', 'description', 'task_type', 'task_type_display',
            'owner_type', 'owner_type_display', 'due_days_from_joining',
            'owner_employee', 'owner_employee_name', 'employee_document_type',
            'is_required', 'order',
        ]
        read_only_fields = ['id', 'task_type_display', 'owner_type_display']


class OnboardingTemplateSerializer(serializers.ModelSerializer):
    tasks = OnboardingTemplateTaskSerializer(many=True)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    department_path = serializers.CharField(source='department.path', read_only=True, default=None)
    position_title = serializers.CharField(source='position.title', read_only=True, default=None)
    location_name = serializers.CharField(source='location.name', read_only=True, default=None)
    location_path = serializers.CharField(source='location.path', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, default=None)

    class Meta:
        model = OnboardingTemplate
        fields = [
            'id', 'name', 'description', 'department', 'department_name', 'department_path',
            'position', 'position_title', 'location', 'location_name', 'location_path', 'is_active', 'tasks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at', 'updated_at']

    def validate_department(self, value):
        if value and value.type not in {'DEPARTMENT', 'TEAM'}:
            raise serializers.ValidationError('Choose a department or team.')
        return value

    def validate_location(self, value):
        if value and value.type not in {'LOCATION', 'HQ'}:
            raise serializers.ValidationError('Choose a work location or HQ.')
        return value

    def validate_tasks(self, tasks):
        if not tasks:
            raise serializers.ValidationError('Add at least one onboarding checklist item.')
        orders = [item.get('order', index + 1) for index, item in enumerate(tasks)]
        if len(orders) != len(set(orders)):
            raise serializers.ValidationError('Checklist item order values must be unique.')
        if any(not item.get('title', '').strip() for item in tasks):
            raise serializers.ValidationError('Every checklist item needs a title.')
        return tasks

    @transaction.atomic
    def create(self, validated_data):
        tasks_data = validated_data.pop('tasks')
        template = OnboardingTemplate.objects.create(**validated_data)
        for index, task_data in enumerate(tasks_data, start=1):
            task_data['order'] = task_data.get('order') or index
            OnboardingTemplateTask.objects.create(template=template, **task_data)
        return template

    @transaction.atomic
    def update(self, instance, validated_data):
        tasks_data = validated_data.pop('tasks', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if tasks_data is not None:
            instance.tasks.all().delete()
            for index, task_data in enumerate(tasks_data, start=1):
                task_data['order'] = task_data.get('order') or index
                OnboardingTemplateTask.objects.create(template=instance, **task_data)
        return instance


class OnboardingTaskSerializer(serializers.ModelSerializer):
    task_type_display = serializers.CharField(source='get_task_type_display', read_only=True)
    owner_type_display = serializers.CharField(source='get_owner_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True, default=None)
    case_id = serializers.UUIDField(read_only=True)
    employee_name = serializers.CharField(source='case.employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='case.employee.employee_id', read_only=True)
    joining_date = serializers.DateField(source='case.joining_date', read_only=True)
    submissions = serializers.SerializerMethodField()

    class Meta:
        model = OnboardingTask
        fields = [
            'id', 'title', 'description', 'task_type', 'task_type_display',
            'owner_type', 'owner_type_display', 'due_date', 'is_required',
            'order', 'status', 'status_display', 'assigned_to', 'assigned_to_name',
            'completion_notes', 'completed_at', 'case_id', 'employee_name',
            'employee_number', 'joining_date', 'submissions',
        ]

    def get_submissions(self, task):
        request = self.context.get('request')
        rows = []
        for submission in task.submissions.select_related('employee_document').all():
            document_url = submission.employee_document.file_path.url if submission.employee_document.file_path else None
            if document_url and request:
                document_url = request.build_absolute_uri(document_url)
            rows.append({
                'id': str(submission.pk),
                'document_id': str(submission.employee_document_id),
                'document_name': submission.employee_document.document_name,
                'document_url': document_url,
                'status': submission.status,
                'review_comments': submission.review_comments,
                'submitted_at': submission.submitted_at,
            })
        return rows


class OnboardingCaseSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_id', read_only=True)
    candidate_name = serializers.CharField(source='offer.application.candidate.full_name', read_only=True)
    template_display = serializers.CharField(source='template_name_snapshot', read_only=True)
    tasks = OnboardingTaskSerializer(many=True, read_only=True)

    class Meta:
        model = OnboardingCase
        fields = [
            'id', 'offer', 'employee', 'employee_name', 'employee_number',
            'candidate_name', 'template', 'template_display', 'joining_date',
            'status', 'started_by', 'started_at', 'updated_at', 'tasks',
        ]
        read_only_fields = fields


class OnboardingStartSerializer(serializers.Serializer):
    offer = serializers.PrimaryKeyRelatedField(queryset=CandidateOffer.objects.all())
    template = serializers.PrimaryKeyRelatedField(queryset=OnboardingTemplate.objects.all())

    def validate(self, attrs):
        offer = attrs['offer']
        template = attrs['template']
        if offer.status != 'ACCEPTED':
            raise serializers.ValidationError({'offer': 'Onboarding can only start for an accepted offer.'})
        if not offer.employee_id:
            raise serializers.ValidationError({'offer': 'Link the accepted offer to its employee profile before starting onboarding.'})
        if OnboardingCase.objects.filter(offer=offer).exists():
            raise serializers.ValidationError({'offer': 'Onboarding has already been started for this offer.'})
        if not template.is_active:
            raise serializers.ValidationError({'template': 'Choose an active onboarding template.'})
        employee = offer.employee
        employee.position  # resolve the related position before template matching
        if not template_matches_employee(template, employee):
            raise serializers.ValidationError({'template': 'This template scope does not match the employee department, position, or location.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        offer = CandidateOffer.objects.select_for_update().select_related(
            'employee', 'application__candidate', 'employee__department', 'employee__position__department',
            'employee__location', 'employee__structure_location',
        ).get(pk=validated_data['offer'].pk)
        template = OnboardingTemplate.objects.prefetch_related('tasks').get(pk=validated_data['template'].pk)
        if offer.status != 'ACCEPTED' or not offer.employee_id:
            raise serializers.ValidationError({'offer': 'The offer must remain accepted and linked to an employee.'})
        if OnboardingCase.objects.filter(offer=offer).exists():
            raise serializers.ValidationError({'offer': 'Onboarding has already been started for this offer.'})
        if not template.is_active or not template_matches_employee(template, offer.employee):
            raise serializers.ValidationError({'template': 'Choose an active template whose scope matches this employee.'})
        case = OnboardingCase.objects.create(
            offer=offer, employee=offer.employee, template=template,
            template_name_snapshot=template.name, joining_date=offer.joining_date,
            started_by=getattr(getattr(self.context.get('request'), 'user', None), 'employee', None),
        )
        task_rows = []
        for task in template.tasks.all():
            if task.owner_type == 'EMPLOYEE':
                assigned_to = offer.employee
            elif task.owner_type == 'HR':
                assigned_to = case.started_by
            elif task.owner_type == 'MANAGER':
                assigned_to = offer.employee.reporting_manager
            else:
                assigned_to = task.owner_employee
            task_rows.append(OnboardingTask(
                case=case, source_template_task=task, title=task.title,
                description=task.description, task_type=task.task_type,
                owner_type=task.owner_type, assigned_to=assigned_to,
                employee_document_type=task.employee_document_type,
                due_date=offer.joining_date + timedelta(days=task.due_days_from_joining),
                is_required=task.is_required, order=task.order,
            ))
        OnboardingTask.objects.bulk_create(task_rows)
        for row in task_rows:
            if row.assigned_to_id:
                Notification.objects.create(
                    recipient=row.assigned_to,
                    notification_type='SYSTEM',
                    title=f'Onboarding task assigned: {row.title}',
                    message=f'{row.title} is assigned to you for {case.employee.full_name}.',
                    link='/onboarding/my-tasks',
                    metadata={'onboarding_case_id': str(case.pk), 'onboarding_task_id': str(row.pk)},
                )
        return case
