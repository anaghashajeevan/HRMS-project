"""Submission and approval lifecycle for HR initiated employee exits."""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from HRMSapp.models import ApprovalWorkflow, Employee, Notification, UserAccount
from ..models import EmployeeExitApprovalAction, EmployeeExitRequest, PayrollAuditLog
from decimal import Decimal

class ExitRequestError(Exception):
    pass


def validate_exit_data(exit_request):
    """Return unresolved leave/payroll work that would make the exit snapshot incomplete."""
    from leaveapp.models import LeaveApplication
    from ..models import EmployeeSalaryAssignment, PayrollRun

    findings = []
    pending_leave = LeaveApplication.objects.filter(
        employee=exit_request.employee, status='PENDING',
    ).order_by('start_date')
    for application in pending_leave:
        findings.append({
            'code': 'PENDING_LEAVE', 'blocks_approval': True,
            'record_id': str(application.id), 'reference': application.application_number,
            'description': f'Leave request {application.application_number} ({application.start_date} to {application.end_date}) is still pending.',
        })

    unfinished_runs = PayrollRun.objects.filter(
        pay_calendar__period_start__lte=exit_request.proposed_exit_date,
    ).filter(
        Q(employees__employee=exit_request.employee) | Q(status='OPEN'),
    ).exclude(
        status__in=['PAID', 'REVERSED'],
    ).exclude(run_type__in=['FNF', 'REVERSAL']).select_related('pay_calendar').distinct().order_by(
        'pay_calendar__period_start', 'created_at',
    )
    for run in unfinished_runs:
        if run.status == 'OPEN':
            assignment_overlaps_period = EmployeeSalaryAssignment.objects.filter(
                employee=exit_request.employee,
                effective_from__lte=run.pay_calendar.period_end,
            ).filter(
                Q(effective_to__gte=run.pay_calendar.period_start) | Q(effective_to__isnull=True),
            ).exists()
            if not assignment_overlaps_period:
                continue
        findings.append({
            'code': 'UNFINISHED_PAYROLL', 'blocks_approval': True,
            'record_id': str(run.id), 'reference': f'{run.run_type} {run.pay_calendar.year}-{run.pay_calendar.month:02d}',
            'description': f'{run.run_type} payroll for {run.pay_calendar.year}-{run.pay_calendar.month:02d} is {run.status}.',
        })
    return {
        'can_approve': not findings,
        'findings': findings,
        'checked_at': timezone.now().isoformat(),
    }


def _settlement_baseline(request, include_reserved_in_run=None):
    """Capture the relevant leave balances and completed payroll results at approval."""
    from leaveapp.models import LeaveBalance
    from ..models import ArrearsLog, EmployeeSalaryAssignment, PayrollRunEmployee
    from .assignment_service import AssignmentService

    balances = []
    for balance in LeaveBalance.objects.filter(employee=request.employee).select_related('leave_type').order_by('year', 'leave_type__code'):
        balances.append({
            'balance_id': str(balance.id), 'leave_type_id': str(balance.leave_type_id),
            'leave_type_code': balance.leave_type.code, 'leave_type_name': balance.leave_type.name,
            'year': balance.year, 'allocated': str(balance.allocated),
            'accrued_till_date': str(balance.accrued_till_date), 'carried_forward': str(balance.carried_forward),
            'used': str(balance.used), 'pending': str(balance.pending), 'encashed': str(balance.encashed),
            'adjustment': str(balance.adjustment), 'available': str(balance.available),
            'can_encash': balance.leave_type.can_encash,
            'max_encashment_days': str(balance.leave_type.max_encashment_days),
            'max_exit_encashment_days': str(balance.leave_type.max_exit_encashment_days) if balance.leave_type.max_exit_encashment_days is not None else None,
            'encashment_basis': balance.leave_type.encashment_basis,
            'encashment_divisor_days': str(balance.leave_type.encashment_divisor_days),
        })

    payroll = []
    rows = PayrollRunEmployee.objects.filter(
        employee=request.employee,
        run__status='PAID',
        run__pay_calendar__period_start__lte=request.proposed_exit_date,
    ).select_related('run__pay_calendar').prefetch_related('component_details__component').order_by(
        'run__pay_calendar__period_start', 'run__created_at',
    )
    for row in rows:
        pay_snapshot = row.input_snapshot or {}
        salary_earned = pay_snapshot.get('fixed_gross_pay_prorated')
        if salary_earned is None:
            salary_earned = (
                Decimal(str(row.gross_pay or 0))
                - Decimal(str(pay_snapshot.get('leave_deduction') or 0))
                - Decimal(str(pay_snapshot.get('variable_earnings') or 0))
            )
        payroll.append({
            'run_id': str(row.run_id), 'run_type': row.run.run_type, 'run_status': row.run.status,
            'period_start': row.run.pay_calendar.period_start.isoformat(),
            'period_end': row.run.pay_calendar.period_end.isoformat(),
            'gross_pay': str(row.gross_pay), 'total_deductions': str(row.total_deductions),
            'net_pay': str(row.net_pay),
            # The gross_pay field shows full monthly structure earnings before
            # separate LOP/statutory deductions. F&F offsets the salary value
            # actually earned after attendance reconciliation instead.
            'salary_earned': str(max(Decimal(str(salary_earned)), Decimal('0'))),
            'components': [{
                'component_id': str(item.component_id) if item.component_id else None,
                'label': item.component.code if item.component_id else item.component_label,
                'amount': str(item.amount), 'is_earning': item.is_earning,
                'is_employer_cost': item.is_employer_cost,
            } for item in row.component_details.all()],
        })
    arrears_qs = ArrearsLog.objects.filter(
        employee=request.employee, settled_in_run__isnull=True,
        from_period__lte=request.proposed_exit_date,
    )
    if include_reserved_in_run is None:
        arrears_qs = arrears_qs.filter(reserved_in_run__isnull=True)
        reserved_arrears_count = ArrearsLog.objects.filter(
            employee=request.employee, settled_in_run__isnull=True,
            from_period__lte=request.proposed_exit_date, reserved_in_run__isnull=False,
        ).count()
    else:
        arrears_qs = arrears_qs.filter(
            Q(reserved_in_run__isnull=True) | Q(reserved_in_run=include_reserved_in_run),
        )
        reserved_arrears_count = ArrearsLog.objects.filter(
            employee=request.employee, settled_in_run__isnull=True,
            from_period__lte=request.proposed_exit_date, reserved_in_run__isnull=False,
        ).exclude(reserved_in_run=include_reserved_in_run).count()
    arrears = [{
        'arrears_id': str(item.id), 'from_period': item.from_period.isoformat(),
        'to_period': item.to_period.isoformat(),
        'component_code': item.component.code if item.component_id else item.component_label,
        'component_name': item.component.name if item.component_id else item.component_label,
        'amount': str(item.arrears_amount), 'reason': item.reason,
    } for item in arrears_qs.select_related('component').order_by('from_period', 'created_at')]

    assignment = EmployeeSalaryAssignment.objects.filter(
        employee=request.employee, effective_from__lte=request.proposed_exit_date,
    ).filter(Q(effective_to__gte=request.proposed_exit_date) | Q(effective_to__isnull=True)).select_related('structure').order_by('-effective_from').first()
    salary_snapshot = None
    if assignment:
        breakdown = AssignmentService.preview_breakdown(assignment.structure, assignment.ctc_monthly, as_of_date=request.proposed_exit_date)
        from .gratuity_service import gratuity_salary_basis
        gratuity_basis = gratuity_salary_basis(assignment, request.proposed_exit_date)
        salary_snapshot = {
            'assignment_id': str(assignment.id), 'effective_from': assignment.effective_from.isoformat(),
            'structure_name': assignment.structure.name, 'ctc_monthly': str(assignment.ctc_monthly),
            'basic_monthly': breakdown['basic_used'], 'gross_monthly': breakdown['gross'],
            'gratuity_basic_monthly': str(gratuity_basis['basic_monthly']),
            'gratuity_da_monthly': str(gratuity_basis['dearness_allowance_monthly']),
            'gratuity_wage_monthly': str(gratuity_basis['gratuity_wage_monthly']),
            'gratuity_wage_components': gratuity_basis['gratuity_wage_components'],
            'fixed_salary_monthly': str(
                assignment.fixed_salary_monthly
                if assignment.fixed_salary_monthly is not None
                else breakdown['fixed_salary_monthly']
            ),
        }
    return {
        'leave_balances': balances, 'completed_payroll': payroll,
        'salary_assignment': salary_snapshot, 'outstanding_arrears': arrears,
        'reserved_arrears_count': reserved_arrears_count,
    }


def refresh_settlement_snapshot(request, actor, for_run=None):
    """Refresh frozen settlement balances at final settlement preparation, with an audit record."""
    baseline = _settlement_baseline(request, include_reserved_in_run=for_run)
    if not baseline['salary_assignment']:
        raise ExitRequestError('No salary assignment covers the approved exit date.')
    old_snapshot = request.frozen_snapshot or {}
    request.frozen_snapshot = {
        'employee_id': str(request.employee_id),
        'proposed_exit_date': request.proposed_exit_date.isoformat(),
        'exit_type': request.exit_type,
        'reason': request.reason,
        'settlement_inputs': request.settlement_inputs,
        **baseline,
        'approved_at': request.approved_at.isoformat() if request.approved_at else None,
        'settlement_snapshot_refreshed_at': timezone.now().isoformat(),
    }
    request.save(update_fields=['frozen_snapshot', 'updated_at'])
    PayrollAuditLog.objects.create(
        employee=request.employee,
        action='EXIT_SETTLEMENT_SNAPSHOT_REFRESHED',
        old_values={
            'leave_balances': len(old_snapshot.get('leave_balances', [])),
            'completed_payroll_runs': len(old_snapshot.get('completed_payroll', [])),
        },
        new_values={
            'exit_request_id': str(request.id),
            'leave_balances': len(request.frozen_snapshot['leave_balances']),
            'completed_payroll_runs': len(request.frozen_snapshot['completed_payroll']),
            'outstanding_arrears': len(request.frozen_snapshot['outstanding_arrears']),
        },
        reason='Final settlement snapshot refreshed before F&F payroll run creation.',
        performed_by=getattr(actor, 'employee', None),
    )


def _approvers(step, employee):
    kind = step.approver_type
    if kind == 'REPORTING_MANAGER':
        return [employee.reporting_manager] if employee.reporting_manager_id else []
    if kind == 'SKIP_LEVEL_MANAGER':
        manager = employee.reporting_manager
        return [manager.reporting_manager] if manager and manager.reporting_manager_id else []
    if kind == 'DEPARTMENT_HEAD':
        return [employee.reporting_manager] if employee.reporting_manager_id else []
    if kind == 'SPECIFIC_EMPLOYEE':
        return [step.specific_employee] if step.specific_employee_id else []
    role = {'HR_ADMIN': 'HR_ADMIN', 'SYSTEM_ADMIN': 'SYSTEM_ADMIN'}.get(kind)
    if role:
        return [user.employee for user in UserAccount.objects.filter(
            is_active=True, roles__role_name=role,
        ).select_related('employee').distinct() if user.employee_id]
    return []


def _create_step_actions(request, step):
    people = [person for person in _approvers(step, request.employee) if person.id != request.requested_by_id]
    if not people:
        raise ExitRequestError(f'No approver could be resolved for workflow step {step.step_number} ({step.step_name}).')
    for person in people:
        action, created = EmployeeExitApprovalAction.objects.get_or_create(
            request=request, step_number=step.step_number, assigned_to=person,
            defaults={'workflow': request.workflow, 'step_name': step.step_name},
        )
        if created:
            Notification.objects.create(
                recipient=person,
                notification_type='APPROVAL_REQUEST',
                title='Employee exit approval required',
                message=f'Review the exit request for {request.employee.full_name} ({request.employee.employee_id}).',
                link='/payroll/exits',
                metadata={'exit_request_id': str(request.id), 'step_number': step.step_number},
            )


@transaction.atomic
def submit_exit_request(*, employee_id, actor, proposed_exit_date, exit_type, reason='', settlement_inputs=None):
    workflow = ApprovalWorkflow.objects.select_for_update().filter(module='EXIT', is_active=True).prefetch_related('steps').first()
    if not workflow:
        raise ExitRequestError('Configure an active Employee Exits workflow in Approval Workflow Settings first.')
    steps = list(workflow.steps.order_by('step_number'))
    if not steps:
        raise ExitRequestError('The Employee Exits workflow has no approval steps.')
    employee = Employee.objects.select_for_update().get(pk=employee_id)
    if (employee.status or '').strip().upper() not in ('ACTIVE', 'PROBATION'):
        raise ExitRequestError('Only active or probationary employees can start an exit request.')
    if proposed_exit_date < employee.date_of_joining:
        raise ExitRequestError('The proposed last working date cannot be before the joining date.')
    if employee.date_of_exit:
        raise ExitRequestError('This employee already has an exit date. Correct the existing record before submitting another request.')
    if EmployeeExitRequest.objects.filter(employee=employee, status='PENDING_APPROVAL').exists():
        raise ExitRequestError('This employee already has an exit request awaiting approval.')
    request = EmployeeExitRequest.objects.create(
        employee=employee, requested_by=getattr(actor, 'employee', None), workflow=workflow,
        proposed_exit_date=proposed_exit_date, exit_type=exit_type, reason=reason,
        settlement_inputs=settlement_inputs or {}, current_step_number=steps[0].step_number,
    )
    _create_step_actions(request, steps[0])
    PayrollAuditLog.objects.create(
        employee=employee, action='EXIT_REQUEST_SUBMITTED',
        new_values={'exit_request_id': str(request.id), 'proposed_exit_date': proposed_exit_date.isoformat(), 'exit_type': exit_type},
        reason=reason, performed_by=getattr(actor, 'employee', None),
    )
    return request


@transaction.atomic
def decide_exit_request(*, request_id, actor, decision, comments=''):
    request = EmployeeExitRequest.objects.select_for_update().select_related('employee', 'workflow').get(pk=request_id)
    actor_employee = getattr(actor, 'employee', None)
    if not actor_employee:
        raise ExitRequestError('Your user account is not linked to an employee record.')
    action = EmployeeExitApprovalAction.objects.select_for_update().filter(
        request=request, step_number=request.current_step_number, assigned_to=actor_employee, status='PENDING',
    ).first()
    if not action:
        raise ExitRequestError('You are not assigned to the current approval step.')
    if request.requested_by_id == actor_employee.id:
        raise ExitRequestError('The person who submitted an exit request cannot approve it.')
    if decision == 'reject' and not comments.strip():
        raise ExitRequestError('A reason is required when rejecting an exit request.')
    action.status = 'APPROVED' if decision == 'approve' else 'REJECTED'
    action.acted_by = actor_employee
    action.acted_at = timezone.now()
    action.comments = comments
    action.save(update_fields=['status', 'acted_by', 'acted_at', 'comments'])
    if decision == 'reject':
        request.status = 'REJECTED'
        request.rejection_reason = comments
        request.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        EmployeeExitApprovalAction.objects.filter(request=request, status='PENDING').update(status='CANCELLED')
        return request
    if EmployeeExitApprovalAction.objects.filter(request=request, step_number=action.step_number, status='PENDING').exists():
        return request
    next_step = request.workflow.steps.filter(step_number__gt=action.step_number).order_by('step_number').first()
    if next_step:
        request.current_step_number = next_step.step_number
        request.save(update_fields=['current_step_number', 'updated_at'])
        _create_step_actions(request, next_step)
        return request
    readiness = validate_exit_data(request)
    if not readiness['can_approve']:
        raise ExitRequestError('Resolve pending leave requests and unfinished payroll runs before final exit approval.')
    request.status = 'APPROVED'
    request.approved_by = actor_employee
    request.approved_at = timezone.now()
    request.frozen_snapshot = {
        'employee_id': str(request.employee_id),
        'proposed_exit_date': request.proposed_exit_date.isoformat(),
        'exit_type': request.exit_type,
        'reason': request.reason,
        'settlement_inputs': request.settlement_inputs,
        **_settlement_baseline(request),
        'approved_at': request.approved_at.isoformat(),
    }
    request.employee.date_of_exit = request.proposed_exit_date
    request.employee.save(update_fields=['date_of_exit'])
    request.save(update_fields=['status', 'approved_by', 'approved_at', 'frozen_snapshot', 'updated_at'])
    PayrollAuditLog.objects.create(
        employee=request.employee, action='EXIT_REQUEST_APPROVED',
        old_values={'date_of_exit': None},
        new_values={'exit_request_id': str(request.id), 'date_of_exit': request.proposed_exit_date.isoformat(), 'snapshot_counts': {
            'leave_balances': len(request.frozen_snapshot['leave_balances']),
            'completed_payroll_runs': len(request.frozen_snapshot['completed_payroll']),
        }},
        reason=comments, performed_by=actor_employee,
    )
    return request
