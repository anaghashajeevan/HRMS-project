"""Retroactive salary assignment arrears calculation and generation."""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import re

from django.db import transaction
from django.utils import timezone

from ..models import (
    ArrearsLog, PayrollAuditLog, PayrollRunComponentDetail,
    PayrollRunEmployee,
)

CENT = Decimal('0.01')


class ArrearsError(Exception):
    pass


def _money(value):
    return Decimal(str(value or '0')).quantize(CENT, rounding=ROUND_HALF_UP)


def _json_safe(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, (date,)):
        return value.isoformat()
    return value


def _component_key(component_id, label):
    if component_id:
        return f'id:{component_id}'
    normalized = (label or 'Adjustment').strip().casefold()
    if normalized.startswith('weekend/holiday work'):
        normalized = 'weekend/holiday work'
    elif normalized.startswith('leave / lop deduction'):
        normalized = 'leave / lop deduction'
    return f'label:{normalized}'


def _correction_component_label(key, paid, due, expected_snapshot):
    paid_label = paid.get('label') or ''
    due_label = due.get('label') or ''
    if key == 'label:weekend/holiday work':
        old_match = re.search(r'\(([\d.]+)\s+days?\)', paid_label, re.IGNORECASE)
        old_transition = re.search(r'\([\d.]+\s*→\s*([\d.]+)\s+days?\)', paid_label, re.IGNORECASE)
        new_match = re.search(r'\(([\d.]+)\s+days?\)', due_label, re.IGNORECASE)
        old_days = old_match.group(1) if old_match else old_transition.group(1) if old_transition else '0'
        new_days = new_match.group(1) if new_match else str(expected_snapshot.get('off_day_worked', '0'))
        return f'Weekend/Holiday Work ({old_days} → {new_days} days)'
    if key == 'label:leave / lop deduction':
        old_match = re.search(r'\(([\d.]+)\s+unpaid days?\)', paid_label, re.IGNORECASE)
        old_transition = re.search(r'\([\d.]+\s*→\s*([\d.]+)\s+unpaid days?\)', paid_label, re.IGNORECASE)
        old_days = old_match.group(1) if old_match else old_transition.group(1) if old_transition else '0'
        new_days = str(expected_snapshot.get('unpaid_salary_days', '0'))
        return f'Leave / LOP Deduction ({old_days} → {new_days} unpaid days)'
    return due_label or paid_label or 'Payroll adjustment'


def _is_calculated_unlinked_component(label):
    """Recognize formula-generated payroll lines that have no SalaryComponent FK."""
    normalized = (label or '').strip().casefold()
    return normalized.startswith((
        'special allowance (balancing)',
        'weekend/holiday work',
        'leave / lop deduction',
    ))


def _frozen_day_data(row):
    snapshot = row.input_snapshot or {}
    locked = snapshot.get('locked_inputs') or {}
    day_data = locked.get('day_data') or {}
    if not day_data:
        day_data = {
            'eligible_calendar_days': snapshot.get('eligible_calendar_days', row.eligible_calendar_days),
            'payable_days': snapshot.get('payable_days', row.payable_days),
            'lop_days': snapshot.get('lop_days', row.lop_days),
            'paid_leave_days': snapshot.get('paid_leave_days', row.paid_leave_days),
            'salary_divisor_days': snapshot.get('salary_divisor_days', row.salary_divisor_days),
            'summary': snapshot.get('attendance_summary') or {},
            'leave_breakdown': snapshot.get('leaves') or [],
            'day_map': {},
        }
    required = ('eligible_calendar_days', 'payable_days', 'lop_days', 'paid_leave_days')
    if any(day_data.get(key) is None for key in required):
        raise ArrearsError(
            f'{row.run.pay_calendar}: frozen attendance/payroll inputs are incomplete; this period cannot be recalculated safely.'
        )
    return day_data


def _row_components(row):
    values = {}
    for detail in row.component_details.select_related('component').all():
        if detail.is_employer_cost or detail.is_reimbursement:
            continue
        if detail.component_id and detail.component.code == 'TDS':
            # TDS is recalculated on the arrears payment date by the off-cycle engine.
            continue
        # Compare salary components and recalculated LOP only. Exclude bonuses,
        # reimbursements, and manually entered corrections from the old run.
        if not detail.component_id and not _is_calculated_unlinked_component(detail.component_label):
            continue
        label = detail.component.code if detail.component_id else (detail.component_label or 'Adjustment')
        key = _component_key(detail.component_id, label)
        values[key] = {
            'component_id': str(detail.component_id) if detail.component_id else None,
            'component_code': detail.component.code if detail.component_id else None,
            'label': label,
            'amount': Decimal(detail.amount),
            'is_earning': detail.is_earning,
            'is_taxable': bool(detail.component.is_taxable) if detail.component_id else False,
        }
    return values


def _preview_components(result):
    values = {}
    for component in result.get('components', []):
        if component.get('is_employer_cost') or component.get('is_reimbursement'):
            continue
        component_id = component.get('component_id')
        label = component.get('name') or component.get('code') or 'Adjustment'
        if component.get('code') == 'TDS':
            continue
        if not component_id and not _is_calculated_unlinked_component(label):
            continue
        key = _component_key(component_id, label)
        values[key] = {
            'component_id': str(component_id) if component_id else None,
            'component_code': component.get('code'),
            'label': component.get('name') or label,
            'amount': Decimal(component['amount']),
            'is_earning': bool(component.get('is_earning')),
            'is_taxable': bool(component.get('is_taxable', False)),
        }
    return values


def _period_items(assignment):
    """Calculate component deltas for paid regular runs overlapping an assignment."""
    from .payroll_calculation_service import PayrollCalculationService
    from ..models import EmployeeSalaryAssignment

    runs = PayrollRunEmployee.objects.filter(
        employee=assignment.employee,
        run__run_type='REGULAR', run__status='PAID',
        run__pay_calendar__period_end__gte=assignment.effective_from,
    ).select_related('run__pay_calendar', 'salary_assignment').prefetch_related(
        'component_details__component',
    ).order_by('run__pay_calendar__period_start')

    output = []
    for paid_row in runs:
        period = paid_row.run.pay_calendar
        old_assignment = paid_row.salary_assignment
        if old_assignment is None:
            raise ArrearsError(f'{period}: the paid payroll row has no salary assignment reference.')
        overlap_start = max(period.period_start, assignment.effective_from)
        overlap_end = min(
            period.period_end,
            assignment.effective_to if assignment.effective_to else period.period_end,
        )
        if overlap_start > overlap_end:
            continue
        days_in_period = Decimal(str((period.period_end - period.period_start).days + 1))
        affected_days = Decimal(str((overlap_end - overlap_start).days + 1))
        period_factor = affected_days / days_in_period

        frozen_days = _frozen_day_data(paid_row)
        expected = PayrollCalculationService.preview_calculate(
            assignment.employee,
            period.period_start,
            period.period_end,
            days_in_month=period.days_in_month,
            run=paid_row.run,
            frozen_day_data=frozen_days,
            assignment_override=assignment,
        )
        if not expected.get('ok'):
            raise ArrearsError(f'{period}: recalculation failed: {expected.get("error", "unknown error")}')

        actual_components = _row_components(paid_row)
        prior_items = list(ArrearsLog.objects.filter(
            employee=assignment.employee, source_run=paid_row.run,
        ).select_related('component'))
        if any(item.settled_in_run_id is None for item in prior_items):
            raise ArrearsError(
                f'{period} already has generated arrears that are not paid. Settle or reverse those items before generating another correction for this period.'
            )
        # Count arrears already paid against this source period so a later
        # backdated change compares with cumulative payment, not just regular pay.
        for item in prior_items:
            label = item.component.code if item.component_id else item.component_label
            key = _component_key(item.component_id, label)
            is_earning = bool((item.calculation_snapshot or {}).get('is_earning', True))
            is_taxable = bool((item.calculation_snapshot or {}).get('is_taxable', False))
            current = actual_components.setdefault(key, {
                'component_id': str(item.component_id) if item.component_id else None,
                'component_code': item.component.code if item.component_id else None,
                'label': label, 'amount': Decimal('0'), 'is_earning': is_earning,
                'is_taxable': is_taxable,
            })
            current['amount'] += item.arrears_amount if is_earning else -item.arrears_amount
        expected_components = _preview_components(expected)
        keys = list(dict.fromkeys([*actual_components.keys(), *expected_components.keys()]))
        lines = []
        for key in keys:
            actual = actual_components.get(key, {})
            due = expected_components.get(key, {})
            component_id = due.get('component_id') or actual.get('component_id')
            label = due.get('label') or actual.get('label') or 'Payroll adjustment'
            is_earning = due.get('is_earning', actual.get('is_earning', True))
            is_taxable = due.get('is_taxable', actual.get('is_taxable', False))
            if component_id:
                # The foreign key is validated again while persisting.
                component_code = due.get('component_code') or actual.get('component_code') or label
            else:
                component_code = None
            old_full = actual.get('amount', Decimal('0'))
            new_full = due.get('amount', Decimal('0'))
            component_delta = _money((new_full - old_full) * period_factor)
            # Stored component deductions are positive; their impact on net pay is negative.
            net_delta = component_delta if is_earning else -component_delta
            if abs(net_delta) < CENT:
                continue
            lines.append({
                'component_id': component_id,
                'component_code': component_code,
                'component_label': label,
                'is_earning': is_earning,
                'is_taxable': is_taxable,
                'old_amount': str(_money(old_full * period_factor)),
                'new_amount': str(_money(new_full * period_factor)),
                'arrears_amount': str(net_delta),
                'source_period_start': period.period_start.isoformat(),
                'source_period_end': period.period_end.isoformat(),
                'effective_from': assignment.effective_from.isoformat(),
                'affected_days': str(affected_days),
                'days_in_period': str(days_in_period),
            })
        if lines:
            output.append({
                'source_run_id': str(paid_row.run_id),
                'period_start': period.period_start.isoformat(),
                'period_end': period.period_end.isoformat(),
                'lines': lines,
            })
    return output


def preview_assignment_arrears(assignment):
    existing = list(ArrearsLog.objects.filter(
        source_assignment=assignment,
    ).select_related('component', 'source_run').order_by('from_period', 'component_label'))
    if existing:
        periods = []
        for item in existing:
            period_key = (item.source_run_id, item.from_period, item.to_period)
            period = next((row for row in periods if (row['source_run_id'], row['period_start'], row['period_end']) == (
                str(period_key[0]), period_key[1].isoformat(), period_key[2].isoformat(),
            )), None)
            line = {
                'component_id': str(item.component_id) if item.component_id else None,
                'component_code': item.component.code if item.component_id else None,
                'component_label': item.component.name if item.component_id else item.component_label,
                'old_amount': str(item.old_amount), 'new_amount': str(item.new_amount),
                'arrears_amount': str(item.arrears_amount),
            }
            if period is None:
                period = {'source_run_id': str(item.source_run_id) if item.source_run_id else None,
                          'period_start': item.from_period.isoformat(), 'period_end': item.to_period.isoformat(), 'lines': []}
                periods.append(period)
            period['lines'].append(line)
        return _summary(assignment, periods, generated=True)

    periods = _period_items(assignment)
    return _summary(assignment, periods, generated=False)


def _paid_run_correction_period(run_id, employee_id, refresh_attendance=False):
    """Recalculate one employee's paid regular period against its actual pay."""
    from ..models import PayrollRun
    from .payroll_calculation_service import PayrollCalculationService

    try:
        paid_row = PayrollRunEmployee.objects.select_related(
            'run__pay_calendar', 'salary_assignment__structure', 'employee',
        ).prefetch_related('component_details__component').get(
            run_id=run_id, employee_id=employee_id,
        )
    except PayrollRunEmployee.DoesNotExist:
        raise ArrearsError('This employee does not have a payroll row in the selected run.')

    run = paid_row.run
    if run.run_type != 'REGULAR' or run.status != 'PAID':
        raise ArrearsError('Corrections can only be generated from a paid regular payroll run.')
    if paid_row.salary_assignment is None:
        raise ArrearsError('The paid payroll row has no salary assignment reference.')

    prior_items = list(ArrearsLog.objects.filter(
        employee_id=employee_id, source_run=run,
    ).select_related('component'))
    if any(item.settled_in_run_id is None for item in prior_items):
        raise ArrearsError(
            'This paid period already has unsettled arrears. Settle or reverse them before generating another correction.'
        )

    actual = _row_components(paid_row)
    # Compare against the cumulative paid amount, including earlier settled
    # corrections, so repeating a correction does not pay it twice.
    for item in prior_items:
        label = item.component.code if item.component_id else item.component_label
        key = _component_key(item.component_id, label)
        earning = bool((item.calculation_snapshot or {}).get('is_earning', True))
        entry = actual.setdefault(key, {
            'component_id': str(item.component_id) if item.component_id else None,
            'component_code': item.component.code if item.component_id else None,
            'label': label, 'amount': Decimal('0'), 'is_earning': earning,
            'is_taxable': bool((item.calculation_snapshot or {}).get('is_taxable', False)),
        })
        entry['amount'] += item.arrears_amount if earning else -item.arrears_amount

    day_data = None if refresh_attendance else _frozen_day_data(paid_row)
    expected = PayrollCalculationService.preview_calculate(
        paid_row.employee,
        run.pay_calendar.period_start,
        run.pay_calendar.period_end,
        days_in_month=run.pay_calendar.days_in_month,
        run=run,
        frozen_day_data=day_data,
        assignment_override=paid_row.salary_assignment,
    )
    if not expected.get('ok'):
        raise ArrearsError(f"{run.pay_calendar}: recalculation failed: {expected.get('error', 'unknown error')}")

    due_components = _preview_components(expected)
    expected_snapshot = expected.get('input_snapshot') or {}
    # Historical salary-assignment arrears are separate, settled payments.
    # Include them in the recalculated baseline too; otherwise comparing an
    # old assignment to a paid total that already contains an increment can
    # create a false negative correction for that increment.
    for item in prior_items:
        label = item.component.code if item.component_id else item.component_label
        key = _component_key(item.component_id, label)
        earning = bool((item.calculation_snapshot or {}).get('is_earning', True))
        entry = due_components.setdefault(key, {
            'component_id': str(item.component_id) if item.component_id else None,
            'component_code': item.component.code if item.component_id else None,
            'label': label,
            'amount': Decimal('0'),
            'is_earning': earning,
            'is_taxable': bool((item.calculation_snapshot or {}).get('is_taxable', False)),
        })
        entry['amount'] += item.arrears_amount if earning else -item.arrears_amount
    keys = list(dict.fromkeys([*actual.keys(), *due_components.keys()]))
    lines = []
    for key in keys:
        paid = actual.get(key, {})
        due = due_components.get(key, {})
        earning = due.get('is_earning', paid.get('is_earning', True))
        delta = _money(due.get('amount', Decimal('0')) - paid.get('amount', Decimal('0')))
        net_delta = delta if earning else -delta
        if abs(net_delta) < CENT:
            continue
        lines.append({
            'component_id': due.get('component_id') or paid.get('component_id'),
            'component_code': due.get('component_code') or paid.get('component_code'),
            'component_label': _correction_component_label(key, paid, due, expected_snapshot),
            'is_earning': earning,
            'is_taxable': due.get('is_taxable', paid.get('is_taxable', False)),
            'old_amount': str(_money(paid.get('amount', Decimal('0')))),
            'new_amount': str(_money(due.get('amount', Decimal('0')))),
            'arrears_amount': str(net_delta),
            'source_period_start': run.pay_calendar.period_start.isoformat(),
            'source_period_end': run.pay_calendar.period_end.isoformat(),
            'recalculation_basis': 'CURRENT_ATTENDANCE_AND_LEAVE' if refresh_attendance else 'ORIGINAL_FROZEN_INPUTS',
            'input_snapshot': _json_safe(expected.get('input_snapshot') or {}),
        })

    return {
        'source_run_id': str(run.id),
        'period_start': run.pay_calendar.period_start.isoformat(),
        'period_end': run.pay_calendar.period_end.isoformat(),
        'lines': lines,
        'recalculation_basis': 'CURRENT_ATTENDANCE_AND_LEAVE' if refresh_attendance else 'ORIGINAL_FROZEN_INPUTS',
    }, paid_row


def preview_paid_run_arrears(run_id, employee_id, refresh_attendance=False):
    period, paid_row = _paid_run_correction_period(run_id, employee_id, refresh_attendance)
    total = sum((Decimal(line['arrears_amount']) for line in period['lines']), Decimal('0'))
    return {
        'source_run_id': str(run_id),
        'employee_name': paid_row.employee.full_name,
        'employee_code': paid_row.employee.employee_id,
        'periods': [period],
        'total_arrears': str(_money(total)),
        'generated': False,
        'can_generate': bool(period['lines']),
        'notice': (
            'Uses corrected attendance and leave currently recorded in the system. Previously settled arrears are included in the comparison baseline.'
            if refresh_attendance else
            'Uses the exact attendance and leave inputs locked in the paid run; current calculation and date-effective statutory rules are applied. Previously settled arrears are included in the comparison baseline.'
        ),
    }


@transaction.atomic
def generate_paid_run_arrears(run_id, employee_id, actor, reason, refresh_attendance=False):
    if not reason or not reason.strip():
        raise ArrearsError('Enter a reason for generating these arrears items.')
    from ..models import PayrollRun

    try:
        run = PayrollRun.objects.select_for_update().get(pk=run_id)
    except PayrollRun.DoesNotExist:
        raise ArrearsError('The selected payroll run was not found.')
    preview = preview_paid_run_arrears(run_id, employee_id, refresh_attendance)
    if preview['generated']:
        raise ArrearsError('Arrears items already exist for this employee and paid period.')
    if not preview['periods']:
        raise ArrearsError('No payroll component differences were found for this paid period.')

    period = preview['periods'][0]
    created = []
    from ..models import SalaryComponent
    for line in period['lines']:
        component = None
        if line.get('component_id'):
            component = SalaryComponent.objects.filter(pk=line['component_id']).first()
            if component is None:
                raise ArrearsError(f"Salary component {line.get('component_code') or line['component_label']} no longer exists.")
        created.append(ArrearsLog(
            employee_id=employee_id,
            component=component,
            component_label=line['component_label'],
            from_period=date.fromisoformat(period['period_start']),
            to_period=date.fromisoformat(period['period_end']),
            old_amount=line['old_amount'],
            new_amount=line['new_amount'],
            arrears_amount=line['arrears_amount'],
            source_run=run,
            calculation_snapshot={
                **line,
                'correction_type': 'PAID_PERIOD_RECALCULATION',
                'is_earning': line['is_earning'],
                'is_taxable': line['is_taxable'],
            },
            reason=reason.strip(),
            created_by=getattr(actor, 'employee', None),
        ))
    ArrearsLog.objects.bulk_create(created)
    PayrollAuditLog.objects.create(
        employee_id=employee_id,
        action='ARREARS_PERIOD_CORRECTION_GENERATED',
        reason=reason.strip(),
        performed_by=getattr(actor, 'employee', None),
        new_values={
            'source_run_id': str(run.id),
            'period_start': period['period_start'],
            'period_end': period['period_end'],
            'recalculation_basis': period['recalculation_basis'],
            'item_count': len(created),
            'total_arrears': preview['total_arrears'],
            'items': [{
                'component': line['component_code'] or line['component_label'],
                'previously_paid': line['old_amount'],
                'now_due': line['new_amount'],
                'arrears_amount': line['arrears_amount'],
            } for line in period['lines']],
        },
    )
    return {
        **preview,
        'generated': True,
        'can_generate': False,
        'notice': f"Generated {len(created)} auditable component correction item(s).",
    }


def _summary(assignment, periods, generated):
    total = sum((Decimal(line['arrears_amount']) for period in periods for line in period['lines']), Decimal('0'))
    return {
        'assignment_id': str(assignment.id),
        'employee_name': assignment.employee.full_name,
        'employee_code': assignment.employee.employee_id,
        'effective_from': assignment.effective_from.isoformat(),
        'reason': assignment.reason,
        'periods': periods,
        'total_arrears': str(_money(total)),
        'generated': generated,
        'can_generate': bool(periods) and not generated,
        'notice': (
            'Previously generated items are shown read-only.' if generated else
            'Calculation uses paid regular-run component details and the attendance/leave inputs saved with each run.'
        ),
    }


@transaction.atomic
def generate_assignment_arrears(assignment, actor, reason):
    if not reason or not reason.strip():
        raise ArrearsError('Enter a reason for generating these arrears items.')
    assignment = type(assignment).objects.select_for_update().select_related(
        'employee', 'structure',
    ).get(pk=assignment.pk)
    preview = preview_assignment_arrears(assignment)
    if preview['generated']:
        raise ArrearsError('Arrears items have already been generated for this salary assignment.')
    if not preview['periods']:
        raise ArrearsError('No paid regular payroll periods overlap this retroactive salary assignment.')

    from ..models import SalaryComponent
    created = []
    for period in preview['periods']:
        for line in period['lines']:
            component = None
            if line.get('component_id'):
                component = SalaryComponent.objects.filter(pk=line['component_id']).first()
                if component is None:
                    raise ArrearsError(f"Salary component {line['component_code']} no longer exists.")
            created.append(ArrearsLog(
                employee=assignment.employee,
                component=component,
                component_label=line['component_label'],
                from_period=date.fromisoformat(period['period_start']),
                to_period=date.fromisoformat(period['period_end']),
                old_amount=line['old_amount'], new_amount=line['new_amount'],
                arrears_amount=line['arrears_amount'],
                source_assignment=assignment,
                source_run_id=period['source_run_id'],
                calculation_snapshot=line,
                reason=reason.strip(),
                created_by=getattr(actor, 'employee', None),
            ))
    ArrearsLog.objects.bulk_create(created)
    PayrollAuditLog.objects.create(
        employee=assignment.employee,
        action='ARREARS_ITEMS_GENERATED',
        reason=reason.strip(),
        performed_by=getattr(actor, 'employee', None),
        new_values={
            'assignment_effective_from': assignment.effective_from.isoformat(),
            'period_count': len(preview['periods']),
            'item_count': len(created),
            'total_arrears': preview['total_arrears'],
            'items': [{
                'period_start': period['period_start'],
                'period_end': period['period_end'],
                'component': line['component_code'] or line['component_label'],
                'previously_paid': line['old_amount'],
                'now_due': line['new_amount'],
                'arrears_amount': line['arrears_amount'],
            } for period in preview['periods'] for line in period['lines']],
        },
    )
    return preview_assignment_arrears(assignment)


def list_arrears(employee=None):
    qs = ArrearsLog.objects.select_related(
        'employee', 'component', 'source_assignment', 'source_run',
        'reserved_in_run', 'settled_in_run',
    ).order_by('-from_period', 'employee__employee_id', 'component_label')
    if employee is not None:
        qs = qs.filter(employee=employee)
    return qs
