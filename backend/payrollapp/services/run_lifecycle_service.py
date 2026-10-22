"""
Pay Run Lifecycle Service
─────────────────────────
Manages state transitions:
  OPEN → LOCKED → CALCULATED → UNDER_REVIEW → APPROVED → FINALIZED → PAID
  UNDER_REVIEW → CALCULATED (return)
  PAID → REVERSED

Segregation of duties:
  - Approver ≠ Preparer
  - Reversal requires FINANCE_HEAD / HR_ADMIN role

Every transition is audit-logged.
"""

import logging
from datetime import date
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from HRMSapp.models import Employee
from ..models import (
    PayrollRun, PayrollRunEmployee, PayrollRunComponentDetail,
    PayCalendar, EmployeeSalaryAssignment, PayrollAuditLog,
)
from .payroll_calculation_service import PayrollCalculationService, FORMULA_VERSION
from .day_reconciliation_service import DayReconciliationService

logger = logging.getLogger(__name__)

# ---------- valid transitions ----------
VALID_TRANSITIONS = {
    'lock':           ('OPEN',         'LOCKED'),
    'reopen':         ('LOCKED',       'OPEN'),
    'calculate':      ('LOCKED',       'CALCULATED'),
    'recalculate':    ('CALCULATED',   'CALCULATED'),
    'refresh-calculation': ('CALCULATED', 'CALCULATED'),
    'submit-review':  ('CALCULATED',   'UNDER_REVIEW'),
    'approve':        ('UNDER_REVIEW', 'APPROVED'),
    'return':         ('UNDER_REVIEW', 'CALCULATED'),
    'finalize':       ('APPROVED',     'FINALIZED'),
    'mark-paid':      ('FINALIZED',    'PAID'),
    'reverse':        ('PAID',         'REVERSED'),
}

TIMESTAMP_FIELDS = {
    'LOCKED':       'input_locked_at',
    'CALCULATED':   'calculation_completed_at',
    'APPROVED':     'approved_at',
    'FINALIZED':    'finalized_at',
    'PAID':         'paid_at',
    'REVERSED':     'reversed_at',
}


class RunLifecycleError(Exception):
    pass


class RunLifecycleService:
    """Handles all pay-run state transitions with audit logging."""

    @staticmethod
    def _actor_employee(user):
        employee = getattr(user, 'employee', None)
        if employee is None:
            raise RunLifecycleError('The signed-in user must be linked to an employee record for payroll actions.')
        return employee

    # ──────────────────────────────────────────
    # Public: create run
    # ──────────────────────────────────────────
    @classmethod
    @transaction.atomic
    def create_run(cls, pay_calendar_id, run_type, user):
        """Create a new PayrollRun in OPEN status."""
        cal = PayCalendar.objects.select_for_update().get(id=pay_calendar_id)

        # Check for duplicate REGULAR run in same calendar
        if run_type == 'REGULAR':
            existing = PayrollRun.objects.filter(
                pay_calendar=cal, run_type='REGULAR'
            ).exclude(status='REVERSED').first()
            if existing:
                raise RunLifecycleError(
                    f'A REGULAR run already exists for {cal.year}-{cal.month:02d} '
                    f'(status: {existing.status}).'
                )

        run = PayrollRun.objects.create(
            pay_calendar=cal,
            run_type=run_type,
            status='OPEN',
            formula_version='1.0',
            prepared_by=cls._actor_employee(user),
        )

        cls._audit(run, user, 'RUN_CREATED', None, 'OPEN',
                   reason=f'{run_type} run created')

        return run

    # ──────────────────────────────────────────
    # Public: transition
    # ──────────────────────────────────────────
    @classmethod
    @transaction.atomic
    def transition(cls, run_id, action, user, reason=None):
        """Execute a lifecycle transition on a pay run."""
        if action not in VALID_TRANSITIONS:
            raise RunLifecycleError(f'Unknown action: {action}')

        expected_from, target = VALID_TRANSITIONS[action]

        run = PayrollRun.objects.select_for_update().get(id=run_id)

        if run.status != expected_from:
            raise RunLifecycleError(
                f'Cannot {action}: run is {run.status}, expected {expected_from}.'
            )

        # ── Per-action logic ──
        handler = getattr(cls, f'_handle_{action.replace("-", "_")}', None)
        if handler:
            handler_target = handler(run, user, reason)
            if action == 'approve' and handler_target:
                target = handler_target

        # ── Update status ──
        old_status = run.status
        run.status = target

        # Timestamp
        ts_field = TIMESTAMP_FIELDS.get(target)
        if ts_field:
            setattr(run, ts_field, timezone.now())

        run.save()

        # Audit
        cls._audit(run, user, f'STATUS_{action.upper().replace("-", "_")}',
                   old_status, target, reason=reason)

        return run

    # ──────────────────────────────────────────
    # Action handlers
    # ──────────────────────────────────────────
    @classmethod
    def _handle_lock(cls, run, user, reason):
        """
        OPEN → LOCKED
        Populate PayrollRunEmployee rows for all eligible employees.
        """
        cal = run.pay_calendar
        period_start = cal.period_start
        period_end = cal.period_end

        # Lock the calendar
        if cal.status != 'LOCKED':
            cal.status = 'LOCKED'
            cal.input_locked_at = timezone.now()
            cal.save(update_fields=['status', 'input_locked_at'])

        # Find eligible employees: active, with current salary assignment
        eligible_assignments = EmployeeSalaryAssignment.objects.filter(
            effective_from__lte=period_end,
        ).filter(
            # effective_to is null (open) OR effective_to >= period_start
            **{}  # handled below
        ).select_related('employee', 'structure')

        # Manual filter for effective_to
        assignments = []
        for a in eligible_assignments:
            if a.effective_to and a.effective_to < period_start:
                continue
            # HRMS stores status codes in uppercase (ACTIVE / PROBATION).
            # Treat both as eligible for a regular monthly payroll run.
            emp = a.employee
            employee_status = (emp.status or '').strip().upper()
            if employee_status not in ('ACTIVE', 'PROBATION'):
                # Include if FNF run or if they were active during period
                if run.run_type != 'FNF':
                    # For regular runs: skip terminated employees
                    # unless their DOE is within or after period_start
                    if emp.date_of_exit and emp.date_of_exit < period_start:
                        continue
            assignments.append(a)

        # Prefer the assignment active on the period's final day. If the
        # employee exited or the salary history ends mid-period, fall back to
        # the latest assignment overlapping the period.
        emp_assignment_map = {}
        overlapping_assignment_map = {}
        for a in assignments:
            emp_id = a.employee_id
            current_overlap = overlapping_assignment_map.get(emp_id)
            if current_overlap is None or a.effective_from > current_overlap.effective_from:
                overlapping_assignment_map[emp_id] = a

            active_on_period_end = (
                a.effective_from <= period_end
                and (a.effective_to is None or a.effective_to >= period_end)
            )
            current_active = emp_assignment_map.get(emp_id)
            if active_on_period_end and (
                current_active is None or a.effective_from > current_active.effective_from
            ):
                emp_assignment_map[emp_id] = a

        for emp_id, assignment in overlapping_assignment_map.items():
            emp_assignment_map.setdefault(emp_id, assignment)

        # Clear existing employee rows (idempotent re-lock)
        PayrollRunEmployee.objects.filter(run=run).delete()

        bulk = []
        for emp_id, assignment in emp_assignment_map.items():
            employee = assignment.employee
            day_data = DayReconciliationService.reconcile(
                employee, period_start, period_end,
                saturday_is_working=cal.saturday_is_working,
            )
            locked_inputs = {
                'locked_at': timezone.now().isoformat(),
                'work_schedule': {
                    'saturday_is_working': cal.saturday_is_working,
                    'sunday_is_working': False,
                },
                'salary_assignment_id': str(assignment.id),
                'salary_assignment': {
                    'structure_name': assignment.structure.name,
                    'ctc_monthly': str(assignment.ctc_monthly),
                    'ctc_annual': str(assignment.ctc_annual),
                    'effective_from': str(assignment.effective_from),
                    'effective_to': str(assignment.effective_to) if assignment.effective_to else None,
                },
                'employee_date_of_joining': str(employee.date_of_joining),
                'employee_date_of_exit': str(employee.date_of_exit) if employee.date_of_exit else None,
                'day_data': {
                    'salary_divisor_days': day_data['salary_divisor_days'],
                    'eligible_calendar_days': str(day_data['eligible_calendar_days']),
                    'payable_days': str(day_data['payable_days']),
                    'lop_days': str(day_data['lop_days']),
                    'paid_leave_days': str(day_data['paid_leave_days']),
                    'day_map': day_data['day_map'],
                    'summary': day_data['summary'],
                    'leave_breakdown': day_data['leave_breakdown'],
                },
            }
            bulk.append(PayrollRunEmployee(
                run=run,
                employee_id=emp_id,
                salary_assignment=assignment,
                days_in_month=cal.days_in_month,
                salary_divisor_days=day_data['salary_divisor_days'],
                status='PENDING',
                input_snapshot={'locked_inputs': locked_inputs},
            ))

        if not bulk:
            raise RunLifecycleError(
                'No eligible employees were found for this pay period. Check that at least one ACTIVE or PROBATION employee has a salary assignment effective during the calendar period.'
            )

        PayrollRunEmployee.objects.bulk_create(bulk)

        logger.info(f'Run {run.id}: locked with {len(bulk)} employees')

    @classmethod
    def _handle_reopen(cls, run, user, reason):
        """Reopen only an untouched LOCKED run, discard its frozen inputs, and audit the change."""
        if not reason or not reason.strip():
            raise RunLifecycleError('A reason is required to reopen payroll inputs.')

        employee_rows = PayrollRunEmployee.objects.select_for_update().filter(run=run)
        row_count = employee_rows.count()
        if employee_rows.exclude(status__in=('PENDING', 'EXCLUDED')).exists():
            raise RunLifecycleError(
                'This run contains calculated or failed employee rows. Only a locked, uncalculated run can be reopened.'
            )
        if PayrollRunComponentDetail.objects.filter(run_employee__run=run).exists():
            raise RunLifecycleError(
                'This run already has payroll calculation details and cannot be reopened. Return it for correction instead.'
            )
        if run.payment_batches.exists():
            raise RunLifecycleError('A run with a payment batch cannot be reopened.')
        if run.pay_calendar.status == 'CLOSED':
            raise RunLifecycleError('This pay calendar is closed and cannot be reopened.')

        # Keep run adjustments (for example, manually entered variable pay) intact.
        # The employee rows contain only locked snapshots and are rebuilt on the
        # next lock, allowing attendance, leave, and eligibility to be refreshed.
        employee_rows.delete()

        if run.pay_calendar.status == 'LOCKED':
            another_locked_run = PayrollRun.objects.filter(
                pay_calendar=run.pay_calendar,
                status__in=('LOCKED', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'FINALIZED', 'PAID'),
            ).exclude(id=run.id).exists()
            if not another_locked_run:
                run.pay_calendar.status = 'OPEN'
                run.pay_calendar.input_locked_at = None
                run.pay_calendar.save(update_fields=['status', 'input_locked_at', 'updated_at'])

        run.input_locked_at = None
        run.total_employees = 0
        run.total_gross = Decimal('0')
        run.total_deductions = Decimal('0')
        run.total_reimbursements = Decimal('0')
        run.total_net = Decimal('0')
        run.total_employer_cost = Decimal('0')
        run.total_ctc = Decimal('0')
        cls._audit(
            run, user, 'RUN_INPUTS_REOPENED', 'LOCKED', 'OPEN',
            reason=reason.strip(),
            old_values={'locked_employee_rows_discarded': row_count},
            new_values={'employee_rows': 0, 'run_adjustments_preserved': True},
        )

    @classmethod
    def _handle_calculate(cls, run, user, reason):
        """
        LOCKED → CALCULATED
        Calculate payroll for each employee (synchronous for now).
        """
        calc_service = PayrollCalculationService()
        # Upgrade pending locked rows to the calendar-day salary divisor. Keep
        # the locked attendance/leave reconciliation intact: locking freezes
        # those inputs, while the divisor is derived from the pay period.
        legacy_rows = list(PayrollRunEmployee.objects.filter(
            run=run, status='PENDING',
        ).select_related('employee'))
        upgraded_count = 0
        for run_emp in legacy_rows:
            locked_inputs = (run_emp.input_snapshot or {}).get('locked_inputs', {})
            old_day_data = locked_inputs.get('day_data', {})
            calendar_days = run.pay_calendar.days_in_month
            if old_day_data.get('salary_divisor_days') == calendar_days:
                continue
            if not all(key in old_day_data for key in (
                'eligible_calendar_days', 'payable_days', 'lop_days', 'paid_leave_days',
            )):
                day_data = DayReconciliationService.reconcile(
                    run_emp.employee,
                    run.pay_calendar.period_start,
                    run.pay_calendar.period_end,
                    saturday_is_working=run.pay_calendar.saturday_is_working,
                )
                old_day_data = {
                    'eligible_calendar_days': str(day_data['eligible_calendar_days']),
                    'payable_days': str(day_data['payable_days']),
                    'lop_days': str(day_data['lop_days']),
                    'paid_leave_days': str(day_data['paid_leave_days']),
                    'day_map': day_data['day_map'],
                    'summary': day_data['summary'],
                    'leave_breakdown': day_data['leave_breakdown'],
                }
            old_day_data['salary_divisor_days'] = calendar_days
            locked_inputs['day_data'] = old_day_data
            locked_inputs['salary_divisor_policy'] = 'CALENDAR_DAYS'
            locked_inputs['salary_divisor_updated_at'] = timezone.now().isoformat()
            run_emp.input_snapshot = {'locked_inputs': locked_inputs}
            run_emp.salary_divisor_days = calendar_days
            run_emp.save(update_fields=[
                'input_snapshot', 'salary_divisor_days', 'updated_at',
            ])
            upgraded_count += 1
        if upgraded_count:
            cls._audit(
                run, user, 'LOCKED_INPUTS_UPGRADED', 'LOCKED', 'LOCKED',
                reason='Applied calendar-day salary divisor to pending employee inputs.',
                new_values={'employees_refreshed': upgraded_count},
            )
        # Import approved monthly reimbursement claims once into this run.
        # Their source_claim one-to-one relation prevents duplicate payrolls.
        from ..models import PayrollRunAdjustment
        calendar = run.pay_calendar
        from reimbursementapp.models import ReimbursementClaim
        claims = ReimbursementClaim.objects.filter(
            batch__month=calendar.month,
            batch__year=calendar.year,
            # Expense approval is the actual source of truth: the current
            # reimbursement approval endpoints update expense items and the
            # approved total, but older claims may still have SUBMITTED status.
            expense_items__status='APPROVED',
        ).exclude(
            # A claim in a batch already sent/closed by the reimbursement
            # workflow must not be paid a second time through payroll.
            batch__status__in=['SENT', 'CLOSED'],
        ).exclude(
            # The OneToOne link prevents the same approved claim being paid
            # again in another payroll run.
            payroll_adjustment__isnull=False,
        ).select_related('employee', 'batch').distinct()
        from reimbursementapp.services import recalculate_claim_and_batch_totals
        run_employee_ids = set(PayrollRunEmployee.objects.filter(run=run).values_list('employee_id', flat=True))
        for claim in claims:
            if claim.employee_id not in run_employee_ids:
                continue
            # Refresh totals and the claim-level status from approved expense
            # rows so older claims with stale denormalized fields are handled.
            claim = recalculate_claim_and_batch_totals(claim)
            if claim.total_approved_amount <= 0:
                continue
            PayrollRunAdjustment.objects.create(
                run=run,
                employee=claim.employee,
                adjustment_type='REIMBURSEMENT',
                label=f'Reimbursement — {claim.batch.title or calendar}',
                amount=claim.total_approved_amount,
                reason=f'Imported from reimbursement claim {claim.pk}',
                source_claim=claim,
            )
        run_employees = PayrollRunEmployee.objects.filter(
            run=run
        ).exclude(status='EXCLUDED').select_related('employee', 'salary_assignment')

        total_gross = Decimal('0')
        total_deductions = Decimal('0')
        total_net = Decimal('0')
        total_employer = Decimal('0')
        total_reimbursements = Decimal('0')
        total_ctc = Decimal('0')
        calc_count = 0
        error_count = 0

        for re in run_employees:
            try:
                calc_service.calculate_for_run(run, re.employee)
                re.refresh_from_db()
                total_gross += re.gross_pay or Decimal('0')
                total_deductions += re.total_deductions or Decimal('0')
                total_net += re.net_pay or Decimal('0')
                total_employer += re.total_employer_cost or Decimal('0')
                total_reimbursements += re.total_reimbursements or Decimal('0')
                total_ctc += re.total_ctc or Decimal('0')
                calc_count += 1
            except Exception as e:
                logger.error(f'Calc error for employee {re.employee_id}: {e}')
                re.status = 'ERROR'
                re.error_message = str(e)[:1000]
                re.save(update_fields=['status', 'error_message'])
                error_count += 1

        run.total_gross = total_gross
        run.total_deductions = total_deductions
        run.total_net = total_net
        run.total_employer_cost = total_employer
        run.total_reimbursements = total_reimbursements
        run.total_ctc = total_ctc
        run.total_employees = PayrollRunEmployee.objects.filter(run=run).exclude(status='EXCLUDED').count()
        run.formula_version = FORMULA_VERSION
        run.save(update_fields=[
            'total_gross', 'total_deductions', 'total_net',
            'total_employer_cost', 'total_employees', 'formula_version',
            'total_reimbursements', 'total_ctc',
        ])

        logger.info(
            f'Run {run.id}: calculated {calc_count}, errors {error_count}'
        )

    @classmethod
    def _handle_recalculate(cls, run, user, reason):
        """Retry failed calculations or refresh inputs for a returned run."""
        if not run.returned_by_id:
            has_errors = PayrollRunEmployee.objects.filter(
                run=run, status='ERROR',
            ).exists()
            if not has_errors:
                raise RunLifecycleError(
                    'Recalculation is available for a returned run or a run with failed employee calculations.'
                )
            # Keep the frozen attendance and leave inputs. This path is for
            # retrying after a calculation fix, such as corrected CTC balancing.
            cls._handle_calculate(run, user, reason)
            return

        refreshed = 0
        employees = PayrollRunEmployee.objects.filter(
            run=run,
        ).exclude(status='EXCLUDED').select_related('employee')
        for run_emp in employees:
            day_data = DayReconciliationService.reconcile(
                run_emp.employee,
                run.pay_calendar.period_start,
                run.pay_calendar.period_end,
                saturday_is_working=run.pay_calendar.saturday_is_working,
            )
            snapshot = run_emp.input_snapshot or {}
            locked_inputs = snapshot.get('locked_inputs', {})
            previous_day_data = locked_inputs.get('day_data')
            history = locked_inputs.setdefault('reconciliation_history', [])
            if previous_day_data:
                history.append({
                    'refreshed_at': timezone.now().isoformat(),
                    'reason': reason or 'Returned run recalculation',
                    'day_data': previous_day_data,
                })
            locked_inputs['day_data'] = {
                'salary_divisor_days': day_data['salary_divisor_days'],
                'eligible_calendar_days': str(day_data['eligible_calendar_days']),
                'payable_days': str(day_data['payable_days']),
                'lop_days': str(day_data['lop_days']),
                'paid_leave_days': str(day_data['paid_leave_days']),
                'day_map': day_data['day_map'],
                'summary': day_data['summary'],
                'leave_breakdown': day_data['leave_breakdown'],
            }
            locked_inputs['reconciled_at'] = timezone.now().isoformat()
            run_emp.input_snapshot = {**snapshot, 'locked_inputs': locked_inputs}
            run_emp.eligible_calendar_days = day_data['eligible_calendar_days']
            run_emp.salary_divisor_days = day_data['salary_divisor_days']
            run_emp.payable_days = day_data['payable_days']
            run_emp.lop_days = day_data['lop_days']
            run_emp.paid_leave_days = day_data['paid_leave_days']
            run_emp.save(update_fields=[
                'input_snapshot', 'eligible_calendar_days', 'salary_divisor_days',
                'payable_days', 'lop_days', 'paid_leave_days', 'updated_at',
            ])
            refreshed += 1

        cls._handle_calculate(run, user, reason)
        run.returned_by = None
        run.return_reason = ''
        run.save(update_fields=['returned_by', 'return_reason', 'updated_at'])
        cls._audit(
            run, user, 'RECONCILIATION_INPUTS_REFRESHED', 'CALCULATED', 'CALCULATED',
            reason=reason or 'Refreshed attendance and leave inputs for returned run.',
            new_values={'employees_refreshed': refreshed},
        )

    @classmethod
    def _handle_refresh_calculation(cls, run, user, reason):
        """Refresh a calculated run using current payroll data, preserving locked day inputs."""
        if not reason or not reason.strip():
            raise RunLifecycleError('A reason is required to refresh a calculated payroll run.')
        if run.returned_by_id:
            raise RunLifecycleError('Use Recalculate for a returned run so refreshed attendance is recorded in its history.')
        if PayrollRunEmployee.objects.filter(run=run, status='ERROR').exists():
            raise RunLifecycleError('Use Retry Calculation while employee calculation errors remain.')
        cls._handle_calculate(run, user, reason.strip())

    @classmethod
    def _handle_submit_review(cls, run, user, reason):
        """CALCULATED → UNDER_REVIEW only when every included employee succeeded."""
        included = PayrollRunEmployee.objects.filter(run=run).exclude(status='EXCLUDED')
        if not included.exists():
            raise RunLifecycleError('A run with no included employees cannot be submitted for review.')
        invalid = included.exclude(status='CALCULATED')
        if invalid.exists():
            raise RunLifecycleError(
                f'{invalid.count()} employee record(s) are pending or have calculation errors.'
            )

        from HRMSapp.models import ApprovalWorkflow
        from HRMSapp.services.workflow_service import WorkflowService
        from ..models import PayrollRunApprovalAction

        workflow = ApprovalWorkflow.objects.filter(
            module='PAYROLL', is_active=True,
        ).prefetch_related('steps').first()
        if not workflow or not workflow.steps.exists():
            raise RunLifecycleError(
                'Configure and activate a Payroll Runs workflow in Settings → Approval Workflow before submitting this run.'
            )
        cycle = (PayrollRunApprovalAction.objects.filter(run=run).order_by('-cycle')
                 .values_list('cycle', flat=True).first() or 0) + 1
        rows = []
        for step in workflow.steps.order_by('step_number'):
            approvers = WorkflowService.resolve_approvers(step, run.prepared_by)
            preparer_is_configured = any(
                employee and employee.id == run.prepared_by_id
                for employee in approvers
            )
            approver_ids = {
                employee.id for employee in approvers
                if employee and employee.id != run.prepared_by_id
            }
            if not approver_ids:
                if preparer_is_configured:
                    preparer_name = (
                        getattr(run.prepared_by, 'full_name', '')
                        or getattr(run.prepared_by, 'username', '')
                        or str(run.prepared_by)
                    )
                    detail = (
                        f'{preparer_name}, who prepared this run, is assigned to this step. '
                        'The preparer cannot approve their own payroll run. Assign a different approver '
                        'in Settings → Approval Workflow and submit again.'
                    )
                else:
                    detail = (
                        'No eligible approver is configured for this step. Check that its selected '
                        'employee or role has an active employee account in Settings → Approval Workflow.'
                    )
                raise RunLifecycleError(
                    f'Workflow step {step.step_number} ({step.step_name}): {detail}'
                )
            rows.extend(PayrollRunApprovalAction(
                run=run, workflow=workflow, cycle=cycle,
                step_number=step.step_number, step_name=step.step_name,
                assigned_to_id=approver_id,
            ) for approver_id in approver_ids)
        PayrollRunApprovalAction.objects.bulk_create(rows)
        first_step_number = min(row.step_number for row in rows)
        cls._notify_payroll_approvers(run, cycle, first_step_number)

    @classmethod
    def _handle_approve(cls, run, user, reason):
        """
        UNDER_REVIEW → APPROVED
        Segregation: approver must differ from preparer.
        """
        from ..models import PayrollRunApprovalAction

        actor_employee = RunLifecycleService._actor_employee(user)
        latest_cycle = PayrollRunApprovalAction.objects.filter(run=run).order_by('-cycle').values_list('cycle', flat=True).first()
        if latest_cycle:
            current_step = PayrollRunApprovalAction.objects.filter(
                run=run, cycle=latest_cycle, status='PENDING',
            ).order_by('step_number').values_list('step_number', flat=True).first()
            if current_step is None:
                raise RunLifecycleError('This approval cycle has no pending approvals.')
            action = PayrollRunApprovalAction.objects.select_for_update().filter(
                run=run, cycle=latest_cycle, step_number=current_step,
                assigned_to=actor_employee, status='PENDING',
            ).first()
            if not action:
                raise RunLifecycleError('You are not an assigned approver for the current payroll approval step.')
            action.status = 'APPROVED'
            action.acted_by = actor_employee
            action.acted_at = timezone.now()
            action.comments = reason or ''
            action.save(update_fields=['status', 'acted_by', 'acted_at', 'comments'])
            if PayrollRunApprovalAction.objects.filter(
                run=run, cycle=latest_cycle, step_number=current_step, status='PENDING',
            ).exists():
                cls._audit(run, user, 'APPROVAL_STEP_APPROVED', 'UNDER_REVIEW', 'UNDER_REVIEW',
                           reason=reason, new_values={'step_number': current_step, 'step_name': action.step_name})
                return 'UNDER_REVIEW'
            if PayrollRunApprovalAction.objects.filter(
                run=run, cycle=latest_cycle, status='PENDING',
            ).exists():
                next_step = PayrollRunApprovalAction.objects.filter(
                    run=run, cycle=latest_cycle, status='PENDING',
                ).order_by('step_number').values_list('step_number', flat=True).first()
                if not PayrollRunApprovalAction.objects.filter(
                    run=run, cycle=latest_cycle, step_number=next_step,
                    status='APPROVED',
                ).exists():
                    cls._notify_payroll_approvers(run, latest_cycle, next_step)
                cls._audit(run, user, 'APPROVAL_STEP_APPROVED', 'UNDER_REVIEW', 'UNDER_REVIEW',
                           reason=reason, new_values={'step_number': current_step, 'next_step_number': next_step})
                return 'UNDER_REVIEW'
            run.approved_by = actor_employee
            run.approved_at = timezone.now()
            return 'APPROVED'

        if run.prepared_by_id and run.prepared_by_id == actor_employee.id:
            raise RunLifecycleError(
                'Segregation of duties: approver cannot be the same as preparer.'
            )
        if run.returned_by_id and run.returned_by_id == actor_employee.id:
            raise RunLifecycleError(
                'Segregation of duties: the person who returned the run cannot approve it.'
            )
        run.approved_by = RunLifecycleService._actor_employee(user)
        return 'APPROVED'

    @classmethod
    def _handle_return(cls, run, user, reason):
        """UNDER_REVIEW → CALCULATED with reason."""
        if not reason:
            raise RunLifecycleError('A reason is required when returning a run.')
        actor_employee = RunLifecycleService._actor_employee(user)
        from ..models import PayrollRunApprovalAction
        latest_cycle = PayrollRunApprovalAction.objects.filter(run=run).order_by('-cycle').values_list('cycle', flat=True).first()
        if latest_cycle:
            current_step = PayrollRunApprovalAction.objects.filter(
                run=run, cycle=latest_cycle, status='PENDING',
            ).order_by('step_number').values_list('step_number', flat=True).first()
            action = PayrollRunApprovalAction.objects.select_for_update().filter(
                run=run, cycle=latest_cycle, step_number=current_step,
                assigned_to=actor_employee, status='PENDING',
            ).first()
            if not action:
                raise RunLifecycleError('You are not an assigned approver for the current payroll approval step.')
            action.status = 'RETURNED'
            action.acted_by = actor_employee
            action.acted_at = timezone.now()
            action.comments = reason
            action.save(update_fields=['status', 'acted_by', 'acted_at', 'comments'])
            PayrollRunApprovalAction.objects.filter(
                run=run, cycle=latest_cycle, status='PENDING',
            ).update(status='CANCELLED', comments='Cancelled because the run was returned for correction.')
        run.returned_by = actor_employee
        run.return_reason = reason
        if run.prepared_by_id:
            from HRMSapp.models import Notification
            Notification.objects.create(
                recipient=run.prepared_by,
                notification_type='SYSTEM',
                title='Payroll run returned for correction',
                message=f'{actor_employee.full_name} returned the payroll run: {reason}',
                link=f'/payroll/runs/{run.id}',
                metadata={'run_id': str(run.id), 'reason': reason},
            )

    @staticmethod
    def _notify_payroll_approvers(run, cycle, step_number):
        from HRMSapp.models import Notification
        from ..models import PayrollRunApprovalAction

        actions = PayrollRunApprovalAction.objects.filter(
            run=run, cycle=cycle, step_number=step_number, status='PENDING',
        ).select_related('assigned_to')
        for action in actions:
            Notification.objects.create(
                recipient=action.assigned_to,
                notification_type='APPROVAL_REQUEST',
                title=f'Payroll approval required — {run.pay_calendar}',
                message=f'Please review payroll run {run.id}, step {step_number}: {action.step_name}.',
                link=f'/payroll/runs/{run.id}',
                metadata={
                    'run_id': str(run.id), 'cycle': cycle,
                    'step_number': step_number,
                    'approval_action_id': str(action.id),
                },
            )

    @classmethod
    def _handle_finalize(cls, run, user, reason):
        """APPROVED → FINALIZED."""
        run.finalized_by = RunLifecycleService._actor_employee(user)

    @classmethod
    def _handle_mark_paid(cls, run, user, reason):
        """FINALIZED → PAID."""
        from ..models import PayrollRunAdjustment, PaymentBatch
        from reimbursementapp.models import MonthlyReimbursementBatch

        payment_batch = PaymentBatch.objects.filter(run=run, is_repayment=False).exclude(
            status='CANCELLED',
        ).order_by('-created_at').first()
        if not payment_batch or payment_batch.status != 'RECONCILED':
            raise RunLifecycleError(
                'Create a bank payment batch and reconcile every payment line with a UTR before marking this run paid.'
            )

        batch_ids = PayrollRunAdjustment.objects.filter(
            run=run, source_claim__isnull=False,
        ).values_list('source_claim__batch_id', flat=True).distinct()
        for batch in MonthlyReimbursementBatch.objects.filter(id__in=batch_ids):
            approved_claims = batch.claims.filter(
                status__in=['APPROVED', 'PARTIALLY_APPROVED'],
                total_approved_amount__gt=0,
            )
            if approved_claims.exists() and not approved_claims.filter(
                payroll_adjustment__isnull=True,
            ).exists():
                batch.status = 'SENT'
                batch.save(update_fields=['status', 'updated_at'])

    @classmethod
    def _handle_reverse(cls, run, user, reason):
        """
        PAID → REVERSED
        Only allowed for HR_ADMIN / SYSTEM_ADMIN (Finance Head placeholder).
        Creates a REVERSAL run with negated amounts.
        """
        user_roles = set()
        if hasattr(user, 'roles'):
            user_roles = set(user.roles.values_list('code', flat=True))
        elif hasattr(user, 'role_codes'):
            user_roles = set(user.role_codes)

        allowed_roles = {'HR_ADMIN', 'SYSTEM_ADMIN', 'FINANCE_HEAD', 'CFO'}
        if not user_roles & allowed_roles:
            raise RunLifecycleError(
                'Only Finance Head / HR Admin can reverse a pay run.'
            )

        if not reason:
            raise RunLifecycleError('A reason is required for reversal.')

        # Create reversal run
        reversal = PayrollRun.objects.create(
            pay_calendar=run.pay_calendar,
            run_type='REVERSAL',
            status='FINALIZED',
            formula_version=run.formula_version,
            prepared_by=cls._actor_employee(user),
            finalized_by=cls._actor_employee(user),
        )

        # Negate all employee amounts
        run_employees = PayrollRunEmployee.objects.filter(
            run=run, status='CALCULATED'
        ).select_related('employee', 'salary_assignment')

        total_gross = Decimal('0')
        total_deductions = Decimal('0')
        total_net = Decimal('0')
        total_employer = Decimal('0')
        total_reimbursements = Decimal('0')
        total_ctc = Decimal('0')

        for re in run_employees:
            neg_re = PayrollRunEmployee.objects.create(
                run=reversal,
                employee=re.employee,
                salary_assignment=re.salary_assignment,
                eligible_calendar_days=re.eligible_calendar_days,
                days_in_month=re.days_in_month,
                payable_days=re.payable_days,
                lop_days=re.lop_days,
                paid_leave_days=re.paid_leave_days,
                gross_pay=-(re.gross_pay or Decimal('0')),
                total_earnings=-(re.total_earnings or Decimal('0')),
                total_deductions=-(re.total_deductions or Decimal('0')),
                total_reimbursements=-(re.total_reimbursements or Decimal('0')),
                total_employer_cost=-(re.total_employer_cost or Decimal('0')),
                total_ctc=-(re.total_ctc or Decimal('0')),
                net_pay=-(re.net_pay or Decimal('0')),
                input_snapshot=re.input_snapshot,
                status='CALCULATED',
            )

            # Negate component details
            details = PayrollRunComponentDetail.objects.filter(run_employee=re)
            for d in details:
                PayrollRunComponentDetail.objects.create(
                    run_employee=neg_re,
                    component=d.component,
                    amount=-(d.amount or Decimal('0')),
                    is_earning=d.is_earning,
                    is_employer_cost=d.is_employer_cost,
                    is_reimbursement=d.is_reimbursement,
                    component_label=d.component_label,
                    formula_used=d.formula_used,
                    rule_reference=d.rule_reference,
                )

            total_gross += neg_re.gross_pay
            total_deductions += neg_re.total_deductions
            total_net += neg_re.net_pay
            total_employer += neg_re.total_employer_cost
            total_reimbursements += neg_re.total_reimbursements
            total_ctc += neg_re.total_ctc

        reversal.total_gross = total_gross
        reversal.total_deductions = total_deductions
        reversal.total_net = total_net
        reversal.total_employer_cost = total_employer
        reversal.total_reimbursements = total_reimbursements
        reversal.total_ctc = total_ctc
        reversal.total_employees = PayrollRunEmployee.objects.filter(run=reversal).count()
        reversal.save(update_fields=[
            'total_gross', 'total_deductions', 'total_net',
            'total_employer_cost', 'total_employees',
            'total_reimbursements', 'total_ctc',
        ])

        cls._audit(reversal, user, 'REVERSAL_CREATED', None, 'FINALIZED',
                   reason=f'Reversal of run {run.id}: {reason}')

        logger.info(f'Reversal run {reversal.id} created for run {run.id}')

    # ──────────────────────────────────────────
    # Exclude / include employee
    # ──────────────────────────────────────────
    @classmethod
    @transaction.atomic
    def exclude_employee(cls, run_id, run_employee_id, user, reason):
        """Mark a PayrollRunEmployee as EXCLUDED."""
        run = PayrollRun.objects.get(id=run_id)
        if run.status not in ('OPEN', 'LOCKED', 'CALCULATED'):
            raise RunLifecycleError(
                f'Cannot exclude employees when run is {run.status}.'
            )

        re = PayrollRunEmployee.objects.select_for_update().get(
            id=run_employee_id, run=run
        )
        old_status = re.status
        re.status = 'EXCLUDED'
        re.error_message = f'Excluded by {user.email}: {reason}'
        re.save(update_fields=['status', 'error_message'])

        cls._audit(run, user, 'EMPLOYEE_EXCLUDED', old_status, 'EXCLUDED',
                   reason=reason, employee=re.employee)

        # Recalculate totals if run was CALCULATED
        if run.status == 'CALCULATED':
            cls._recalc_totals(run)

    @classmethod
    def _recalc_totals(cls, run):
        """Recalculate run totals from employee rows."""
        from django.db.models import Sum
        agg = PayrollRunEmployee.objects.filter(
            run=run, status='CALCULATED'
        ).aggregate(
            gross=Sum('gross_pay'),
            ded=Sum('total_deductions'),
            net=Sum('net_pay'),
            emp_cost=Sum('total_employer_cost'),
            reimbursements=Sum('total_reimbursements'),
            ctc=Sum('total_ctc'),
        )
        run.total_gross = agg['gross'] or 0
        run.total_deductions = agg['ded'] or 0
        run.total_net = agg['net'] or 0
        run.total_employer_cost = agg['emp_cost'] or 0
        run.total_reimbursements = agg['reimbursements'] or 0
        run.total_ctc = agg['ctc'] or 0
        run.total_employees = PayrollRunEmployee.objects.filter(run=run).exclude(status='EXCLUDED').count()
        run.save(update_fields=[
            'total_gross', 'total_deductions', 'total_net',
            'total_employer_cost', 'total_employees',
            'total_reimbursements', 'total_ctc',
        ])

    # ──────────────────────────────────────────
    # Variance report
    # ──────────────────────────────────────────
    @classmethod
    def get_variance(cls, run_id):
        """
        Compare this run's per-employee net pay with the previous month's
        REGULAR run for the same employees.
        """
        run = PayrollRun.objects.select_related('pay_calendar').get(id=run_id)
        cal = run.pay_calendar

        # Find previous month's regular run
        prev_month = cal.month - 1
        prev_year = cal.year
        if prev_month < 1:
            prev_month = 12
            prev_year -= 1

        prev_run = PayrollRun.objects.filter(
            pay_calendar__year=prev_year,
            pay_calendar__month=prev_month,
            run_type='REGULAR',
        ).exclude(status='REVERSED').first()

        current_emps = PayrollRunEmployee.objects.filter(
            run=run, status='CALCULATED'
        ).select_related('employee')

        prev_map = {}
        if prev_run:
            for pre in PayrollRunEmployee.objects.filter(
                run=prev_run, status='CALCULATED'
            ).select_related('employee'):
                prev_map[pre.employee_id] = pre

        variance = []
        for ce in current_emps:
            prev = prev_map.get(ce.employee_id)
            prev_net = prev.net_pay if prev else Decimal('0')
            diff = (ce.net_pay or Decimal('0')) - prev_net
            pct = (diff / prev_net * 100) if prev_net else None

            variance.append({
                'employee_id': str(ce.employee_id),
                'employee_name': f'{ce.employee.first_name} {ce.employee.last_name}',
                'employee_code': ce.employee.employee_id,
                'current_net': str(ce.net_pay or 0),
                'previous_net': str(prev_net),
                'difference': str(diff),
                'percentage': str(pct.quantize(Decimal('0.01'))) if pct is not None else None,
                'is_new': prev is None,
            })

        # Sort by absolute difference descending
        variance.sort(key=lambda x: abs(Decimal(x['difference'])), reverse=True)
        return variance

    # ──────────────────────────────────────────
    # Audit helper
    # ──────────────────────────────────────────
    @classmethod
    def _audit(cls, run, user, action, from_status, to_status,
               reason=None, employee=None, old_values=None, new_values=None):
        PayrollAuditLog.objects.create(
            run=run,
            employee=employee,
            action=action,
            run_status_from=from_status or '',
            run_status_to=to_status or '',
            old_values=old_values or {},
            new_values=new_values or {},
            reason=reason or '',
            performed_by=cls._actor_employee(user),
        )
