from datetime import timedelta

from django.db import transaction
from django.db.models import Count, F
from django.utils import timezone

from HRMSapp.models import (
    ApprovalWorkflow,
    CompanyStructure,
    Employee,
    JobPosition,
    Notification,
    UserAccount,
)
from .models import HiringApprovalAction, HiringRequisition, RecruitmentSettings


FINANCE_ROLE_NAMES = {'FINANCE', 'FINANCE_ADMIN', 'FINANCE_HEAD', 'CFO'}


def get_recruitment_settings():
    return RecruitmentSettings.objects.get_or_create(pk=1)[0]


def _current_filled(position):
    return Employee.objects.filter(position=position, is_deleted=False).count()


def _reserved_openings(position, exclude_requisition_id=None):
    qs = HiringRequisition.objects.filter(
        position=position,
        status__in=HiringRequisition.ACTIVE_RESERVATION_STATUSES,
    )
    if exclude_requisition_id:
        qs = qs.exclude(pk=exclude_requisition_id)
    requisitions = list(qs.values('id', 'openings'))
    if not requisitions:
        return 0
    from .models import CandidateOffer
    fulfilled = dict(CandidateOffer.objects.filter(
        application__requisition_id__in=[row['id'] for row in requisitions],
        status='ACCEPTED', employee__isnull=False,
        employee__created_at__gte=F('responded_at'),
    ).values('application__requisition_id').annotate(count=Count('id')).values_list('application__requisition_id', 'count'))
    return sum(max(0, row['openings'] - fulfilled.get(row['id'], 0)) for row in requisitions)


def _active_replacement_employee_ids(position, exclude_requisition_id=None):
    qs = HiringRequisition.objects.filter(
        position=position,
        status__in=HiringRequisition.ACTIVE_RESERVATION_STATUSES,
        is_replacement=True,
        replacing_employee__position=position,
    )
    if exclude_requisition_id:
        qs = qs.exclude(pk=exclude_requisition_id)
    return set(qs.values_list('replacing_employee_id', flat=True))


def available_openings(position, exclude_requisition_id=None, replacing_employee=None):
    filled = _current_filled(position)
    credited_employee_ids = _active_replacement_employee_ids(position, exclude_requisition_id)
    if replacing_employee and replacing_employee.position_id == position.pk:
        credited_employee_ids.add(replacing_employee.pk)
    effective_filled = max(0, filled - len(credited_employee_ids))
    reserved = _reserved_openings(position, exclude_requisition_id)
    return max(0, position.budgeted_count - effective_filled - reserved), filled, reserved


def _workflow_steps(workflow):
    return [
        {
            'step_number': step.step_number,
            'step_name': step.step_name,
            'approver_type': step.approver_type,
            'specific_employee': str(step.specific_employee_id) if step.specific_employee_id else None,
            'sla_hours': step.sla_hours,
        }
        for step in workflow.steps.order_by('step_number')
    ]


def _approvers_for_step(step, requisition):
    approver_type = step['approver_type']
    requester = requisition.requested_by
    if approver_type == 'REPORTING_MANAGER':
        candidates = [requester.reporting_manager] if requester.reporting_manager_id else []
    elif approver_type == 'SKIP_LEVEL_MANAGER':
        manager = requester.reporting_manager
        candidates = [manager.reporting_manager] if manager and manager.reporting_manager_id else []
    elif approver_type == 'DEPARTMENT_HEAD':
        head = requisition.department.department_head
        candidates = [head] if head else []
    elif approver_type in {'HR_ADMIN', 'SYSTEM_ADMIN', 'FINANCE_ADMIN'}:
        if approver_type == 'HR_ADMIN':
            role_names = {'HR_ADMIN'}
        elif approver_type == 'SYSTEM_ADMIN':
            role_names = {'SYSTEM_ADMIN'}
        else:
            role_names = FINANCE_ROLE_NAMES
        users = UserAccount.objects.filter(
            is_active=True, roles__role_name__in=role_names,
        ).select_related('employee').distinct()
        candidates = [user.employee for user in users if user.employee_id]
    elif approver_type == 'SPECIFIC_EMPLOYEE':
        candidates = list(Employee.objects.filter(pk=step['specific_employee'], is_deleted=False))
    else:
        candidates = []

    # A requester cannot approve their own requisition.
    unique = {candidate.pk: candidate for candidate in candidates if candidate and candidate.pk != requester.pk}
    return list(unique.values())


def _notify(action):
    Notification.objects.create(
        recipient=action.assigned_to,
        notification_type='APPROVAL_REQUEST',
        title=f'Hiring approval required: {action.requisition.requisition_number}',
        message=(
            f'{action.requisition.requested_by.full_name} requested '
            f'{action.requisition.openings} opening(s) for '
            f'{action.requisition.position.title}. Please review step "{action.step_name}".'
        ),
        link='/recruitment/requisitions',
        metadata={
            'requisition_id': str(action.requisition_id),
            'requisition_number': action.requisition.requisition_number,
            'step_number': action.step_number,
        },
    )


def _create_step_actions(requisition, step):
    approvers = _approvers_for_step(step, requisition)
    if not approvers:
        raise ValueError(f'No approver could be resolved for workflow step "{step["step_name"]}".')
    due_at = timezone.now() + timedelta(hours=int(step['sla_hours']))
    for employee in approvers:
        action = HiringApprovalAction.objects.create(
            requisition=requisition,
            step_number=step['step_number'],
            step_name=step['step_name'],
            assigned_to=employee,
            due_at=due_at,
        )
        _notify(action)


@transaction.atomic
def create_requisition(*, requester, data):
    position = JobPosition.objects.select_for_update().select_related('department').get(pk=data['position'].pk)
    department = data['department']
    location = data['location']
    if not position.is_active:
        raise ValueError('Select an active position.')
    if position.department_id != department.pk:
        raise ValueError('The department must match the selected position.')
    if data['grade_band'].strip().casefold() != position.grade_band.strip().casefold():
        raise ValueError('The grade must match the selected position grade.')
    if department.type != 'DEPARTMENT':
        raise ValueError('Select a department, not a higher-level organization unit.')
    if location.type not in {'LOCATION', 'HQ'}:
        raise ValueError('Select a location or headquarters record.')
    is_replacement = data['is_replacement']
    replacing_employee = data.get('replacing_employee')
    if is_replacement and not replacing_employee:
        raise ValueError('Choose the employee being replaced.')
    if is_replacement and replacing_employee.position_id != position.pk:
        raise ValueError('The employee being replaced must hold the selected position.')
    if not is_replacement and replacing_employee:
        raise ValueError('A replacing employee is only valid for a replacement requisition.')
    if is_replacement and HiringRequisition.objects.filter(
        replacing_employee=replacing_employee,
        status__in=HiringRequisition.ACTIVE_RESERVATION_STATUSES,
    ).exists():
        raise ValueError('An active requisition already exists to replace this employee.')

    available, filled, _reserved = available_openings(
        position, replacing_employee=replacing_employee if is_replacement else None,
    )
    if data['openings'] > available:
        raise ValueError(
            f'Only {available} opening(s) remain for {position.title} '
            f'({filled} filled, {position.budgeted_count} budgeted, existing requisitions reserved). '
            'Increase the position budget before requesting more openings.'
        )

    workflow = ApprovalWorkflow.objects.filter(module='RECRUITMENT', is_active=True).first()
    if not workflow:
        raise ValueError('Configure and activate a Hiring Requisition approval workflow first.')
    steps = _workflow_steps(workflow)
    if not steps:
        raise ValueError('The active Hiring Requisition workflow must contain at least one step.')

    requisition = HiringRequisition.objects.create(
        requisition_number=f'HR-{timezone.localdate():%Y}-{uuid_suffix()}',
        requested_by=requester,
        department=department,
        position=position,
        grade_band=position.grade_band,
        location=location,
        openings=data['openings'],
        is_replacement=is_replacement,
        replacing_employee=replacing_employee,
        reason=data['reason'],
        target_start_date=data['target_start_date'],
        budgeted_count_at_request=position.budgeted_count,
        filled_count_at_request=filled,
        workflow=workflow,
        workflow_steps_snapshot=steps,
    )
    try:
        _create_step_actions(requisition, steps[0])
    except ValueError:
        requisition.delete()
        raise
    return requisition


def uuid_suffix():
    import uuid
    return uuid.uuid4().hex[:8].upper()


@transaction.atomic
def approve_requisition_action(*, action, approver, comments=''):
    action = HiringApprovalAction.objects.select_for_update().select_related('requisition').get(pk=action.pk)
    requisition = HiringRequisition.objects.select_for_update().get(pk=action.requisition_id)
    if requisition.status != 'PENDING_APPROVAL' or action.status != 'PENDING':
        raise ValueError('This approval is no longer pending.')
    if action.assigned_to_id != approver.pk:
        raise PermissionError('You are not assigned to approve this requisition.')

    action.status = 'APPROVED'
    action.comments = comments
    action.acted_at = timezone.now()
    action.save(update_fields=['status', 'comments', 'acted_at'])
    if HiringApprovalAction.objects.filter(
        requisition=requisition, step_number=action.step_number, status='PENDING',
    ).exists():
        return 'Waiting for the other approver(s) at this step.'

    next_step = next(
        (step for step in requisition.workflow_steps_snapshot if step['step_number'] > action.step_number),
        None,
    )
    if next_step:
        requisition.current_step_number = next_step['step_number']
        requisition.save(update_fields=['current_step_number', 'updated_at'])
        _create_step_actions(requisition, next_step)
        return f'Moved to {next_step["step_name"]}.'

    requisition.status = 'APPROVED'
    requisition.completed_at = timezone.now()
    requisition.save(update_fields=['status', 'completed_at', 'updated_at'])
    return 'Hiring requisition approved.'


@transaction.atomic
def reject_requisition_action(*, action, approver, reason):
    action = HiringApprovalAction.objects.select_for_update().select_related('requisition').get(pk=action.pk)
    requisition = HiringRequisition.objects.select_for_update().get(pk=action.requisition_id)
    if requisition.status != 'PENDING_APPROVAL' or action.status != 'PENDING':
        raise ValueError('This approval is no longer pending.')
    if action.assigned_to_id != approver.pk:
        raise PermissionError('You are not assigned to reject this requisition.')
    action.status = 'REJECTED'
    action.comments = reason
    action.acted_at = timezone.now()
    action.save(update_fields=['status', 'comments', 'acted_at'])
    requisition.status = 'REJECTED'
    requisition.rejection_reason = reason
    requisition.completed_at = timezone.now()
    requisition.save(update_fields=['status', 'rejection_reason', 'completed_at', 'updated_at'])
    requisition.approval_actions.filter(status='PENDING').update(status='CANCELLED')


@transaction.atomic
def cancel_requisition(requisition):
    requisition = HiringRequisition.objects.select_for_update().get(pk=requisition.pk)
    if requisition.status not in {'PENDING_APPROVAL', 'APPROVED'}:
        raise ValueError('Only pending or approved requisitions can be cancelled.')
    requisition.status = 'CANCELLED'
    requisition.completed_at = timezone.now()
    requisition.save(update_fields=['status', 'completed_at', 'updated_at'])
    requisition.approval_actions.filter(status='PENDING').update(status='CANCELLED')
    return requisition
