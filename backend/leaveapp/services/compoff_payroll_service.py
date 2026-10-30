"""Reconcile comp-off credits when weekend/holiday work is paid in payroll."""
from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.utils import timezone


def _off_day_dates(row):
    snapshot = row.input_snapshot or {}
    locked = snapshot.get('locked_inputs') or {}
    day_data = locked.get('day_data') or snapshot.get('day_data') or {}
    day_map = day_data.get('day_map') or {}
    return {day for day, status in day_map.items() if status == 'off_day_worked'}


@transaction.atomic
def post_paid_compoff_for_run(run, actor=None):
    """Consume comp-off credits that correspond to dates paid as extra days."""
    if run.run_type != 'REGULAR':
        return {'posted_days': '0.0', 'items': []}

    from leaveapp.models import CompOffCreditLog, LeaveBalance, LeaveType
    from payrollapp.models import PayrollAuditLog, PayrollRunEmployee

    compoff_type = LeaveType.objects.filter(code='COMP_OFF').first()
    if not compoff_type:
        return {'posted_days': '0.0', 'items': [], 'warning': 'COMP_OFF leave type is not configured.'}

    logs = []
    for row in PayrollRunEmployee.objects.filter(run=run, status='CALCULATED').select_related('employee'):
        dates = _off_day_dates(row)
        if not dates:
            continue
        logs.extend(CompOffCreditLog.objects.select_for_update().filter(
            employee=row.employee, credit_date__in=dates,
        ).order_by('credit_date'))

    postings = []
    by_balance = defaultdict(list)
    for log in logs:
        if log.paid_in_payroll_run_id:
            continue
        by_balance[(log.employee_id, log.credit_date.year)].append(log)

    for (employee_id, year), entries in by_balance.items():
        balance = LeaveBalance.objects.select_for_update().filter(
            employee_id=employee_id, leave_type=compoff_type, year=year,
        ).first()
        available = max(balance.available, Decimal('0')) if balance else Decimal('0')
        for entry in entries:
            credit_days = Decimal(entry.comp_off_days)
            available_before = available
            posted_days = min(credit_days, available)
            if balance and posted_days:
                balance.encashed += posted_days
                available -= posted_days
            entry.paid_in_payroll_run_id = str(run.id)
            entry.paid_comp_off_days = posted_days
            entry.paid_at = timezone.now()
            entry.save(update_fields=['paid_in_payroll_run_id', 'paid_comp_off_days', 'paid_at'])
            postings.append({
                'employee_code': entry.employee.employee_id,
                'credit_date': entry.credit_date.isoformat(),
                'year': year,
                'credited_days': str(credit_days),
                'posted_days': str(posted_days),
                'balance_id': str(balance.id) if balance else None,
                'balance_available_before_posting': str(available_before),
            })
        if balance:
            balance.save(update_fields=['encashed', 'updated_at'])

    if postings:
        PayrollAuditLog.objects.create(
            run=run,
            action='COMPOFF_CASH_OUT_POSTED',
            reason='Comp-off credits were consumed after corresponding regular payroll payments were reconciled.',
            performed_by=getattr(actor, 'employee', None),
            new_values={
                'credit_count': len(postings),
                'posted_days': str(sum((Decimal(item['posted_days']) for item in postings), Decimal('0'))),
                'items': postings,
            },
        )
    return {
        'posted_days': str(sum((Decimal(item['posted_days']) for item in postings), Decimal('0'))),
        'items': postings,
    }


@transaction.atomic
def reverse_paid_compoff_for_run(run, actor=None):
    """Restore comp-off balance postings when a paid regular run is reversed."""
    from leaveapp.models import CompOffCreditLog, LeaveBalance
    from payrollapp.models import PayrollAuditLog

    entries = list(CompOffCreditLog.objects.select_for_update().filter(
        paid_in_payroll_run_id=str(run.id),
    ).select_related('employee'))
    if not entries:
        return

    by_balance = defaultdict(Decimal)
    posted = []
    for entry in entries:
        by_balance[(entry.employee_id, entry.credit_date.year)] += Decimal(entry.paid_comp_off_days)
        posted.append({
            'employee_code': entry.employee.employee_id,
            'credit_date': entry.credit_date.isoformat(),
            'year': entry.credit_date.year,
            'restored_days': str(entry.paid_comp_off_days),
        })

    for (employee_id, year), days in by_balance.items():
        balance = LeaveBalance.objects.select_for_update().filter(
            employee_id=employee_id, leave_type__code='COMP_OFF', year=year,
        ).first()
        if balance and days:
            balance.encashed = max(Decimal('0'), balance.encashed - days)
            balance.save(update_fields=['encashed', 'updated_at'])

    CompOffCreditLog.objects.filter(paid_in_payroll_run_id=str(run.id)).update(
        paid_in_payroll_run_id='', paid_comp_off_days=0, paid_at=None,
    )
    PayrollAuditLog.objects.create(
        run=run,
        action='COMPOFF_CASH_OUT_REVERSED',
        reason='Comp-off balance postings were restored because the regular payroll run was reversed.',
        performed_by=getattr(actor, 'employee', None),
        new_values={'items': posted},
    )
