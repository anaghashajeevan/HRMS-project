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
from django.db.models import Q
from django.utils import timezone

from HRMSapp.models import Employee
from ..models import (
    PayrollRun, PayrollRunEmployee, PayrollRunComponentDetail, PayrollRunAdjustment,
    ArrearsLog,
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
    def create_run(cls, pay_calendar_id, run_type, user, payment_date=None, exit_request=None):
        """Create a new PayrollRun in OPEN status."""
        cal = PayCalendar.objects.select_for_update().get(id=pay_calendar_id)

        if run_type == 'FNF':
            if exit_request is None or exit_request.status != 'APPROVED':
                raise RunLifecycleError('An approved exit request is required for an F&F run.')
            if exit_request.proposed_exit_date.year != cal.year or exit_request.proposed_exit_date.month != cal.month:
                raise RunLifecycleError('The pay calendar must match the approved last working date month.')
            existing_fnf = PayrollRun.objects.filter(exit_request=exit_request).exclude(status='REVERSED').first()
            if existing_fnf:
                raise RunLifecycleError(f'An F&F run already exists for this exit (status: {existing_fnf.status}).')
        elif exit_request is not None:
            raise RunLifecycleError('An exit request can only be linked to an F&F run.')

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
            exit_request=exit_request,
            payment_date=payment_date,
            status='OPEN',
            formula_version='1.0',
            prepared_by=cls._actor_employee(user),
        )

        cls._audit(run, user, 'RUN_CREATED', None, 'OPEN',
                   reason=f'{run_type} run created',
                   new_values={
                       'payment_date': str(payment_date) if payment_date else None,
                       'exit_request_id': str(exit_request.id) if exit_request else None,
                   })

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

        if action == 'approve' and target == 'APPROVED' and run.prepared_by_id:
            cls._notify_run_preparer(run)
        elif action == 'return' and run.prepared_by_id:
            cls._schedule_lifecycle_email('returned', run.id, run.prepared_by_id)
        elif action == 'mark-paid':
            cls._notify_run_employees_paid(run)

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

        if run.run_type == 'FNF' and not run.exit_request_id:
            raise RunLifecycleError('This F&F run is not linked to an approved exit request.')

        if run.run_type == 'ARREARS':
            cls._handle_lock_arrears(run, user)
            return

        # Lock the calendar
        if run.run_type != 'OFF_CYCLE' and cal.status == 'OPEN':
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
        if run.run_type == 'FNF':
            eligible_assignments = eligible_assignments.filter(employee_id=run.exit_request.employee_id)

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
                if run.run_type not in ('FNF', 'OFF_CYCLE'):
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
            day_data = (
                {
                    'salary_divisor_days': 0, 'eligible_calendar_days': Decimal('0'),
                    'payable_days': Decimal('0'), 'lop_days': Decimal('0'),
                    'paid_leave_days': Decimal('0'), 'day_map': {}, 'summary': {},
                    'leave_breakdown': [],
                }
                if run.run_type in ('OFF_CYCLE', 'FNF')
                else DayReconciliationService.reconcile(
                    employee, period_start, period_end,
                    saturday_is_working=cal.saturday_is_working,
                )
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
                # Keep the locked attendance snapshot and the row summary in
                # sync even when salary calculation later fails (for example,
                # because a structure formula is invalid).
                eligible_calendar_days=day_data['eligible_calendar_days'],
                payable_days=day_data['payable_days'],
                lop_days=day_data['lop_days'],
                paid_leave_days=day_data['paid_leave_days'],
                salary_divisor_days=day_data['salary_divisor_days'],
                status='PENDING',
                input_snapshot={'locked_inputs': locked_inputs},
            ))

        if not bulk:
            raise RunLifecycleError(
                'No eligible employees were found for this pay period. Check that at least one ACTIVE or PROBATION employee has a salary assignment effective during the calendar period.'
            )

        PayrollRunEmployee.objects.bulk_create(bulk)

        logger.info(f'Run {run.id}: locked with {len(bulk)} employees (type={run.run_type})')

    @classmethod
    def _handle_lock_arrears(cls, run, user):
        """Load only unsettled arrears items and reserve them for this run."""
        cal = run.pay_calendar
        items = list(ArrearsLog.objects.select_for_update().filter(
            settled_in_run__isnull=True,
        ).filter(
            Q(reserved_in_run__isnull=True) | Q(reserved_in_run=run),
        ).select_related('employee', 'component').order_by(
            'employee__employee_id', 'from_period', 'component_label',
        ))
        if not items:
            raise RunLifecycleError('There are no unsettled arrears items available for this run.')

        PayrollRunEmployee.objects.filter(run=run).delete()
        employees = {}
        for item in items:
            employees.setdefault(item.employee_id, item.employee)
        employee_totals = {}
        for item in items:
            employee_totals[item.employee_id] = employee_totals.get(item.employee_id, Decimal('0')) + item.arrears_amount
        payable_employee_ids = {employee_id for employee_id, total in employee_totals.items() if total > 0}
        if not payable_employee_ids:
            raise RunLifecycleError(
                'There are no positive net arrears available to pay. Overpayment recovery must be handled through a payroll deduction.'
            )
        unpaid_recovery_employees = [
            employees[employee_id].full_name for employee_id, total in employee_totals.items()
            if total <= 0
        ]
        # Payment batches are outgoing employee payments. Leave zero/negative
        # net recovery groups available for a separate deduction workflow.
        items = [item for item in items if item.employee_id in payable_employee_ids]
        employees = {employee_id: employee for employee_id, employee in employees.items()
                     if employee_id in payable_employee_ids}

        assignment_map = {}
        for employee_id, employee in employees.items():
            assignment = EmployeeSalaryAssignment.objects.filter(
                employee_id=employee_id, effective_from__lte=cal.period_end,
            ).order_by('-effective_from').first()
            if assignment is None:
                assignment = EmployeeSalaryAssignment.objects.filter(
                    employee_id=employee_id,
                ).order_by('-effective_from').first()
            if assignment is None:
                raise RunLifecycleError(
                    f'{employee.full_name} has arrears but no salary assignment to apply the payroll tax profile.'
                )
            assignment_map[employee_id] = assignment

        PayrollRunEmployee.objects.bulk_create([
            PayrollRunEmployee(
                run=run, employee=employee,
                salary_assignment=assignment_map[employee_id],
                days_in_month=cal.days_in_month,
                input_snapshot={'run_type': 'ARREARS', 'locked_at': timezone.now().isoformat()},
                status='PENDING',
            ) for employee_id, employee in employees.items()
        ], batch_size=500)
        for item in items:
            if item.reserved_in_run_id is None:
                item.reserved_in_run = run
                item.save(update_fields=['reserved_in_run'])
            amount = abs(item.arrears_amount)
            if amount == 0:
                continue
            if not PayrollRunAdjustment.objects.filter(arrears_item=item).exists():
                is_earning = item.arrears_amount > 0
                label = f"Arrears · {item.component.code if item.component_id else item.component_label} · {item.from_period:%b %Y}"
                PayrollRunAdjustment.objects.create(
                    run=run,
                    employee=item.employee,
                    arrears_item=item,
                    adjustment_type='VARIABLE_EARNING' if is_earning else 'DEDUCTION',
                    category='ARREARS' if is_earning else 'DEDUCTION_CORRECTION',
                    label=label,
                    amount=amount,
                    taxable=is_earning and bool((item.calculation_snapshot or {}).get('is_taxable', False)),
                    reference_period_start=item.from_period,
                    reference_period_end=item.to_period,
                    reason=item.reason or 'Retroactive salary correction',
                    created_by=cls._actor_employee(user),
                )
        PayrollAuditLog.objects.create(
            run=run,
            action='ARREARS_ITEMS_RESERVED',
            reason='Unsettled arrears items loaded into this run for payroll review.',
            performed_by=cls._actor_employee(user),
            new_values={
                'item_count': len(items),
                'employee_count': len(employees),
                'total_arrears': str(sum((item.arrears_amount for item in items), Decimal('0'))),
                'items': [{
                    'employee_code': item.employee.employee_id,
                    'component': item.component.code if item.component_id else item.component_label,
                    'from_period': str(item.from_period),
                    'to_period': str(item.to_period),
                    'amount': str(item.arrears_amount),
                } for item in items],
                'recovery_only_employees_not_loaded': unpaid_recovery_employees,
            },
        )

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

        if run.run_type == 'ARREARS':
            reserved_items = list(ArrearsLog.objects.select_for_update().filter(
                reserved_in_run=run, settled_in_run__isnull=True,
            ))
            if reserved_items:
                PayrollRunAdjustment.objects.filter(
                    run=run, arrears_item__in=reserved_items,
                ).delete()
                ArrearsLog.objects.filter(id__in=[item.id for item in reserved_items]).update(
                    reserved_in_run=None,
                )

        # Keep run adjustments (for example, manually entered variable pay) intact.
        # The employee rows contain only locked snapshots and are rebuilt on the
        # next lock, allowing attendance, leave, and eligibility to be refreshed.
        employee_rows.delete()

        if run.run_type != 'OFF_CYCLE' and run.pay_calendar.status == 'LOCKED':
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
        if run.run_type == 'REGULAR':
            from reimbursementapp.services import recalculate_claim_and_batch_totals
            run_employee_ids = set(PayrollRunEmployee.objects.filter(run=run).values_list('employee_id', flat=True))
            for claim in claims:
                if claim.employee_id not in run_employee_ids:
                    continue
                claim = recalculate_claim_and_batch_totals(claim)
                if claim.total_approved_amount <= 0:
                    continue
                PayrollRunAdjustment.objects.create(
                    run=run,
                    employee=claim.employee,
                    adjustment_type='REIMBURSEMENT',
                    category='REIMBURSEMENT',
                    taxable=False,
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

        if run.run_type == 'OFF_CYCLE' and not PayrollRunAdjustment.objects.filter(run=run).exists():
            raise RunLifecycleError('Add at least one employee pay item before calculating this off-cycle run.')

        for re in run_employees:
            if run.run_type == 'OFF_CYCLE' and not PayrollRunAdjustment.objects.filter(
                run=run, employee=re.employee,
            ).exists():
                re.status = 'EXCLUDED'
                re.error_message = 'No off-cycle pay item was entered for this employee.'
                re.save(update_fields=['status', 'error_message', 'updated_at'])
                continue
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

        if run.run_type == 'ARREARS':
            nonpayable = PayrollRunEmployee.objects.filter(
                run=run, status='CALCULATED', net_pay__lte=0,
            ).select_related('employee')
            if nonpayable.exists():
                names = ', '.join(row.employee.full_name for row in nonpayable[:5])
                raise RunLifecycleError(
                    f'Net arrears after configured deductions are zero or negative for {names}. '
                    'No payment can be issued; recover amounts owed back through a payroll deduction.'
                )

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
        if run.run_type == 'FNF':
            if not run.exit_request_id:
                raise RunLifecycleError('This F&F run is not linked to an exit request.')
            from ..models import PayrollRunAdjustment
            from .exit_service import refresh_settlement_snapshot
            from .full_final_service import preview_full_final

            exit_request = run.exit_request
            refresh_settlement_snapshot(exit_request, user, for_run=run)
            settlement = preview_full_final(exit_request)
            if exit_request.frozen_snapshot.get('reserved_arrears_count'):
                raise RunLifecycleError(
                    'This employee has arrears reserved in another payroll run. Complete or reverse that run before refreshing F&F.'
                )
            source_reason = f'F&F exit request {exit_request.id}'
            desired = []
            for line in settlement['lines']:
                amount = Decimal(line['amount'])
                if amount <= 0 or line['code'] == 'OUTSTANDING_ARREARS':
                    continue
                if line['code'] == 'RECOVERIES':
                    desired.append({
                        'adjustment_type': 'DEDUCTION', 'category': 'OTHER',
                        'label': line['label'], 'amount': abs(amount), 'taxable': False,
                    })
                elif line['code'] in ('SALARY_THROUGH_EXIT', 'LEAVE_ENCASHMENT', 'OTHER_DUES', 'GRATUITY'):
                    desired.append({
                        'adjustment_type': 'VARIABLE_EARNING',
                        'category': 'FNF_SALARY' if line['code'] == 'SALARY_THROUGH_EXIT' else 'OTHER',
                        'label': line['label'], 'amount': amount,
                        'taxable': line.get('taxable', True),
                    })

            for arrears_item in ArrearsLog.objects.filter(
                reserved_in_run=run, settled_in_run__isnull=True,
            ).select_related('component').order_by('from_period', 'created_at'):
                amount = arrears_item.arrears_amount
                if amount == 0:
                    continue
                is_earning = amount > 0
                label = (
                    f"Arrears · {arrears_item.component.code if arrears_item.component_id else arrears_item.component_label} · "
                    f"{arrears_item.from_period:%b %Y}"
                )
                desired.append({
                    'adjustment_type': 'VARIABLE_EARNING' if is_earning else 'DEDUCTION',
                    'category': 'ARREARS' if is_earning else 'DEDUCTION_CORRECTION',
                    'label': label, 'amount': abs(amount),
                    'taxable': is_earning and bool((arrears_item.calculation_snapshot or {}).get('is_taxable', False)),
                    'arrears_item': arrears_item,
                })

            existing = list(PayrollRunAdjustment.objects.filter(
                run=run, employee=exit_request.employee, reason=source_reason,
            ))
            old_values = [{
                'adjustment_type': item.adjustment_type, 'category': item.category,
                'label': item.label, 'amount': str(item.amount), 'taxable': item.taxable,
            } for item in existing]
            remaining = list(existing)
            for values in desired:
                matched = next((item for item in remaining
                                if item.adjustment_type == values['adjustment_type']
                                and item.label == values['label']), None)
                if matched:
                    for field in ('category', 'amount', 'taxable'):
                        setattr(matched, field, values[field])
                    update_fields = ['category', 'amount', 'taxable']
                    if 'arrears_item' in values:
                        matched.arrears_item = values['arrears_item']
                        update_fields.append('arrears_item')
                    matched.save(update_fields=update_fields)
                    remaining.remove(matched)
                else:
                    PayrollRunAdjustment.objects.create(
                        run=run, employee=exit_request.employee,
                        reason=source_reason, created_by=getattr(user, 'employee', None),
                        **values,
                    )
            for obsolete in remaining:
                obsolete.delete()
            audit_desired = [{
                **{key: value for key, value in values.items() if key != 'arrears_item'},
                'amount': str(values['amount']),
            } for values in desired]
            PayrollAuditLog.objects.create(
                run=run, employee=exit_request.employee,
                action='FNF_SETTLEMENT_ADJUSTMENTS_REFRESHED',
                reason=reason.strip(), performed_by=getattr(user, 'employee', None),
                old_values={'adjustments': old_values},
                new_values={'adjustments': audit_desired},
            )
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
            RunLifecycleService._schedule_lifecycle_email(
                'approval_request', run.id, action.assigned_to_id, approval_action_id=action.id,
            )

    @staticmethod
    def _schedule_lifecycle_email(event, run_id, recipient_id, approval_action_id=None):
        from HRMSapp.tasks import send_payroll_lifecycle_email

        def enqueue():
            try:
                send_payroll_lifecycle_email.delay(
                    event, str(run_id), str(recipient_id),
                    str(approval_action_id) if approval_action_id else None,
                )
            except Exception:
                logger.exception(
                    'Could not queue payroll lifecycle email: event=%s run=%s recipient=%s',
                    event, run_id, recipient_id,
                )

        transaction.on_commit(enqueue)

    @classmethod
    def _notify_run_preparer(cls, run):
        from HRMSapp.models import Notification

        title = 'Payroll run approved'
        message = f'The {run.get_run_type_display().lower()} payroll run for {run.pay_calendar} was approved.'
        Notification.objects.create(
            recipient=run.prepared_by,
            notification_type='APPROVAL_APPROVED',
            title=title,
            message=message,
            link=f'/payroll/runs/{run.id}',
            metadata={'run_id': str(run.id), 'status': 'APPROVED'},
        )
        cls._schedule_lifecycle_email('approved', run.id, run.prepared_by_id)

    @classmethod
    def _notify_run_employees_paid(cls, run):
        from HRMSapp.models import Notification

        employees = PayrollRunEmployee.objects.filter(
            run=run, status='CALCULATED',
        ).select_related('employee')
        for row in employees:
            Notification.objects.create(
                recipient=row.employee,
                notification_type='SYSTEM',
                title='Payroll marked paid',
                message=f'Payroll for {run.pay_calendar} has been marked paid. To access your payslip, submit a request from Payslips; it will be available after approval.',
                link='/payslips',
                metadata={'run_id': str(run.id), 'run_type': run.run_type, 'status': 'PAID'},
            )
            cls._schedule_lifecycle_email('paid', run.id, row.employee_id)

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

        if run.run_type == 'REGULAR':
            from leaveapp.services.compoff_payroll_service import post_paid_compoff_for_run
            post_paid_compoff_for_run(run, user)

        if run.run_type in ('ARREARS', 'FNF'):
            arrears_items = list(ArrearsLog.objects.select_for_update().filter(
                reserved_in_run=run, settled_in_run__isnull=True,
            ))
            if run.run_type == 'ARREARS' and not arrears_items:
                raise RunLifecycleError('This arrears run has no reserved unsettled arrears items to settle.')
            if arrears_items:
                total_arrears = sum((item.arrears_amount for item in arrears_items), Decimal('0'))
                for item in arrears_items:
                    item.settled_in_run = run
                    item.reserved_in_run = None
                    item.save(update_fields=['settled_in_run', 'reserved_in_run'])
                PayrollAuditLog.objects.create(
                    run=run,
                    action='ARREARS_ITEMS_SETTLED',
                    reason='Arrears items settled after all payroll payment lines were reconciled.',
                    performed_by=cls._actor_employee(user),
                    new_values={
                        'item_count': len(arrears_items),
                        'employee_count': len({item.employee_id for item in arrears_items}),
                        'total_arrears': str(total_arrears),
                        'items': [{
                            'employee_code': item.employee.employee_id,
                            'component': item.component.code if item.component_id else item.component_label,
                            'from_period': str(item.from_period),
                            'to_period': str(item.to_period),
                            'amount': str(item.arrears_amount),
                        } for item in arrears_items],
                    },
                )

        if run.run_type == 'FNF':
            if not run.exit_request_id:
                raise RunLifecycleError('This F&F run is not linked to an exit request.')
            from leaveapp.models import LeaveBalance
            from .leave_encashment_service import preview_exit_encashment

            exit_request = run.exit_request
            encashment = preview_exit_encashment(exit_request)
            balances = {}
            posted_lines = []
            for line in encashment['lines']:
                balance = balances.get(line['balance_id'])
                if balance is None:
                    balance = LeaveBalance.objects.select_for_update().filter(
                        id=line['balance_id'], employee=exit_request.employee,
                    ).first()
                    if balance is None:
                        raise RunLifecycleError(
                            f"The frozen leave balance for {line['leave_type_code']} ({line['year']}) no longer exists."
                        )
                    balances[line['balance_id']] = balance

                days = Decimal(line['encashable_days'])
                if balance.available < days:
                    raise RunLifecycleError(
                        f"The current {line['leave_type_code']} balance is below the {days} days approved for encashment. "
                        'Correct the leave balance through the approved leave adjustment workflow before retrying payment.'
                    )
                balance.encashed += days
                balance.save(update_fields=['encashed', 'updated_at'])
                posted_lines.append({
                    'balance_id': line['balance_id'],
                    'leave_type_code': line['leave_type_code'],
                    'leave_type_name': line['leave_type_name'],
                    'year': line['year'],
                    'days': str(days),
                    'amount': line['amount'],
                })

            if posted_lines:
                PayrollAuditLog.objects.create(
                    run=run, employee=exit_request.employee,
                    action='FNF_LEAVE_ENCASHMENT_POSTED',
                    reason='Leave encashment posted after all F&F payment lines were reconciled.',
                    performed_by=cls._actor_employee(user),
                    new_values={
                        'exit_request_id': str(exit_request.id),
                        'leave_balances': posted_lines,
                        'total_encashable_days': encashment['total_encashable_days'],
                        'total_amount': encashment['total_amount'],
                    },
                )

            employee = exit_request.employee
            if employee.status != 'TERMINATED':
                old_status = employee.status
                employee.status = 'TERMINATED'
                employee.save(update_fields=['status'])
                PayrollAuditLog.objects.create(
                    run=run, employee=employee, action='EMPLOYEE_EXIT_COMPLETED',
                    reason='F&F payment reconciled; employee exit completed.',
                    performed_by=cls._actor_employee(user),
                    old_values={'status': old_status},
                    new_values={
                        'status': 'TERMINATED',
                        'date_of_exit': exit_request.proposed_exit_date.isoformat(),
                        'exit_request_id': str(exit_request.id),
                    },
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

        if run.run_type == 'REGULAR':
            from leaveapp.services.compoff_payroll_service import reverse_paid_compoff_for_run
            reverse_paid_compoff_for_run(run, user)

        arrears_item_ids = list(ArrearsLog.objects.select_for_update().filter(
            Q(reserved_in_run=run) | Q(settled_in_run=run),
        ).values_list('id', flat=True))
        if arrears_item_ids:
            PayrollRunAdjustment.objects.filter(
                run=run, arrears_item_id__in=arrears_item_ids,
            ).delete()
            ArrearsLog.objects.filter(id__in=arrears_item_ids).update(
                reserved_in_run=None, settled_in_run=None,
            )

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
        if run.run_type == 'ARREARS':
            raise RunLifecycleError('Employees with generated arrears cannot be excluded from their settlement run.')
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
