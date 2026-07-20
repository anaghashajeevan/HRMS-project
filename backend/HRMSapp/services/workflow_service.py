"""
Approval workflow engine.
Resolves approvers, creates approval actions, moves through steps.
"""
import logging
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from ..models import (
    ApprovalWorkflow, ApprovalWorkflowStep, LifecycleChangeRequest,
    LifecycleApprovalAction, Employee, UserAccount, Notification
)

logger = logging.getLogger(__name__)


class WorkflowService:
    """Handles workflow execution for lifecycle requests."""

    @staticmethod
    def get_active_workflow(module='LIFECYCLE'):
        """Get the active workflow for a module."""
        return ApprovalWorkflow.objects.filter(
            module=module, is_active=True
        ).prefetch_related('steps').first()

    @staticmethod
    def resolve_approvers(step: ApprovalWorkflowStep, employee: Employee) -> list:
        """
        Resolve who should approve at this step based on approver_type.
        Returns list of Employee objects.
        """
        approver_type = step.approver_type

        if approver_type == 'REPORTING_MANAGER':
            return [employee.reporting_manager] if employee.reporting_manager else []

        if approver_type == 'SKIP_LEVEL_MANAGER':
            if employee.reporting_manager and employee.reporting_manager.reporting_manager:
                return [employee.reporting_manager.reporting_manager]
            return []

        if approver_type == 'DEPARTMENT_HEAD':
            # Return first employee flagged as department head
            # For now, fall back to reporting manager
            return [employee.reporting_manager] if employee.reporting_manager else []

        if approver_type == 'HR_ADMIN':
            users = UserAccount.objects.filter(
                is_active=True,
                roles__role_name='HR_ADMIN',
            ).select_related('employee').distinct()
            return [u.employee for u in users if u.employee]

        if approver_type == 'SYSTEM_ADMIN':
            users = UserAccount.objects.filter(
                is_active=True,
                roles__role_name='SYSTEM_ADMIN',
            ).select_related('employee').distinct()
            return [u.employee for u in users if u.employee]

        if approver_type == 'SPECIFIC_EMPLOYEE':
            return [step.specific_employee] if step.specific_employee else []

        return []

    @staticmethod
    @transaction.atomic
    def start_workflow(lifecycle_request: LifecycleChangeRequest):
        """Create the first pending approval action and notify approvers."""
        workflow = lifecycle_request.workflow
        first_step = workflow.steps.order_by('step_number').first()
        
        if not first_step:
            raise ValueError("Workflow has no steps configured")

        WorkflowService._create_pending_actions(lifecycle_request, first_step)

    @staticmethod
    @transaction.atomic
    def _create_pending_actions(lifecycle_request, step):
        """Create PENDING actions for all resolved approvers of this step."""
        approvers = WorkflowService.resolve_approvers(step, lifecycle_request.employee)
        
        if not approvers:
            logger.warning(f"No approvers resolved for step {step.step_number}")
            return

        due_at = timezone.now() + timedelta(hours=step.sla_hours)
        
        for approver in approvers:
            action = LifecycleApprovalAction.objects.create(
                request=lifecycle_request,
                step_number=step.step_number,
                step_name=step.step_name,
                assigned_to=approver,
                due_at=due_at,
            )
            # Send notification to this approver
            WorkflowService._notify_approver(action)

    @staticmethod
    def _notify_approver(action: LifecycleApprovalAction):
        """Send in-app + email notification to approver."""
        from ..tasks import send_approval_notification_email
        
        req = action.request
        
        # In-app notification
        Notification.objects.create(
            recipient=action.assigned_to,
            notification_type='APPROVAL_REQUEST',
            title=f'Approval Required: {req.get_change_type_display()}',
            message=(
                f'{req.requested_by.full_name} raised a {req.get_change_type_display()} '
                f'request for {req.employee.full_name} ({req.employee.employee_id}). '
                f'Please review and approve.'
            ),
            link=f'/approvals/{req.id}',
            metadata={
                'request_id': str(req.id),
                'request_number': req.request_number,
                'step_number': action.step_number,
            }
        )
        
        # Email (async via Celery)
        send_approval_notification_email.delay(str(action.id))

    @staticmethod
    @transaction.atomic
    def approve_action(action_id, approver: Employee, comments=''):
        """
        Approve a pending action.
        If all actions in current step are approved → move to next step.
        If last step → complete workflow.
        """
        action = LifecycleApprovalAction.objects.select_for_update().get(id=action_id)
        
        if action.status != 'PENDING':
            raise ValueError("This action is already processed")
        
        if action.assigned_to.id != approver.id:
            raise PermissionError("You are not the assigned approver")
        
        # Mark this action as approved
        action.status = 'APPROVED'
        action.acted_at = timezone.now()
        action.comments = comments
        action.save()
        
        request = action.request
        
        # Check if all actions in current step are approved
        pending_in_step = LifecycleApprovalAction.objects.filter(
            request=request,
            step_number=action.step_number,
            status='PENDING'
        ).exists()
        
        if pending_in_step:
            # Wait for other approvers in same step
            return {'status': 'step_pending', 'message': 'Waiting for other approvers'}
        
        # Move to next step
        total_steps = request.workflow.steps.count()
        next_step_number = action.step_number + 1
        
        if next_step_number > total_steps:
            # 🎉 Workflow complete!
            WorkflowService._complete_workflow(request, approver)
            return {'status': 'completed', 'message': 'Request fully approved'}
        
        # Move to next step
        next_step = request.workflow.steps.get(step_number=next_step_number)
        request.current_step_number = next_step_number
        request.save(update_fields=['current_step_number'])
        
        WorkflowService._create_pending_actions(request, next_step)
        return {'status': 'moved_next', 'message': f'Moved to step {next_step_number}'}

    @staticmethod
    @transaction.atomic
    def reject_action(action_id, approver: Employee, reason: str):
        """Reject a pending action → entire workflow rejected."""
        action = LifecycleApprovalAction.objects.select_for_update().get(id=action_id)
        
        if action.status != 'PENDING':
            raise ValueError("This action is already processed")
        
        if action.assigned_to.id != approver.id:
            raise PermissionError("You are not the assigned approver")
        
        action.status = 'REJECTED'
        action.acted_at = timezone.now()
        action.comments = reason
        action.save()
        
        # Reject the entire request
        request = action.request
        request.status = 'REJECTED'
        request.rejection_reason = reason
        request.completed_at = timezone.now()
        request.save()
        
        # Cancel other pending actions in same step
        LifecycleApprovalAction.objects.filter(
            request=request,
            status='PENDING'
        ).update(status='REJECTED', acted_at=timezone.now())
        
        # Notify requester + employee
        WorkflowService._notify_rejection(request, approver, reason)
        return {'status': 'rejected'}

    @staticmethod
    def _notify_rejection(request, rejector, reason):
        """Notify requester about rejection."""
        Notification.objects.create(
            recipient=request.requested_by,
            notification_type='APPROVAL_REJECTED',
            title=f'Request Rejected: {request.request_number}',
            message=(
                f'Your {request.get_change_type_display()} request for '
                f'{request.employee.full_name} was rejected by {rejector.full_name}. '
                f'Reason: {reason}'
            ),
            link=f'/lifecycle-requests/{request.id}',
        )

    @staticmethod
    def _complete_workflow(request: LifecycleChangeRequest, final_approver: Employee):
        """
        Called when workflow is fully approved.
        Triggers Celery task to apply changes + generate letter.
        """
        from ..tasks import apply_lifecycle_changes_and_generate_letter
        
        request.status = 'APPROVED'
        request.completed_at = timezone.now()
        request.save()
        
        # Queue post-approval task
        apply_lifecycle_changes_and_generate_letter.delay(str(request.id))
        
        # Notify requester
        Notification.objects.create(
            recipient=request.requested_by,
            notification_type='APPROVAL_APPROVED',
            title=f'Request Approved: {request.request_number}',
            message=(
                f'Your {request.get_change_type_display()} request for '
                f'{request.employee.full_name} has been fully approved. '
                f'Letter is being generated.'
            ),
            link=f'/lifecycle-requests/{request.id}',
        )


def generate_request_number():
    """Generate unique LCR number: LCR-2026-0001"""
    year = timezone.now().year
    prefix = f"LCR-{year}-"
    last = LifecycleChangeRequest.objects.filter(
        request_number__startswith=prefix
    ).order_by('-request_number').first()
    
    if last:
        try:
            seq = int(last.request_number.split('-')[-1]) + 1
        except (ValueError, IndexError):
            seq = LifecycleChangeRequest.objects.count() + 1
    else:
        seq = 1
    
    return f"{prefix}{seq:04d}"