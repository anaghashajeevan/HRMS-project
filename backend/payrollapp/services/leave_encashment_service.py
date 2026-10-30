"""Read-only exit leave encashment preview based on approved exit snapshots."""
from decimal import Decimal, ROUND_HALF_UP

PAISE = Decimal('0.01')


class LeaveEncashmentError(Exception):
    pass


def preview_exit_encashment(exit_request):
    if exit_request.status != 'APPROVED' or not exit_request.frozen_snapshot:
        raise LeaveEncashmentError('Leave encashment can be previewed after the exit request is approved.')
    exit_date = exit_request.proposed_exit_date
    assignment = exit_request.frozen_snapshot.get('salary_assignment')
    if not assignment:
        raise LeaveEncashmentError('No salary assignment covered the approved exit date.')
    salary_basis = {
        'FIXED': Decimal(
            assignment.get('fixed_salary_monthly') or assignment['gross_monthly']
        ),
        'BASIC': Decimal(assignment['basic_monthly']),
        'GROSS': Decimal(assignment['gross_monthly']),
        'CTC': Decimal(assignment['ctc_monthly']),
    }
    lines = []
    capped_days_by_type = {}
    total_days = Decimal('0')
    total_amount = Decimal('0')
    for balance in exit_request.frozen_snapshot.get('leave_balances', []):
        if not balance.get('can_encash'):
            continue
        available = max(Decimal(balance.get('available', '0')), Decimal('0'))
        if available <= 0:
            continue
        annual_cap = Decimal(balance.get('max_encashment_days') or '0')
        if annual_cap <= 0:
            continue
        days = min(available, annual_cap)
        cap = balance.get('max_exit_encashment_days')
        if cap is not None:
            already_capped = capped_days_by_type.get(balance['leave_type_id'], Decimal('0'))
            remaining = max(Decimal(cap) - already_capped, Decimal('0'))
            days = min(days, remaining)
        if days <= 0:
            continue
        basis_code = balance.get('encashment_basis', 'FIXED').upper()
        monthly_basis = salary_basis.get(basis_code)
        if monthly_basis is None:
            raise LeaveEncashmentError(f'Unsupported salary basis "{basis_code}" for leave type {balance["leave_type_code"]}.')
        divisor = Decimal(balance.get('encashment_divisor_days') or '0')
        if divisor <= 0:
            raise LeaveEncashmentError(f'Encashment divisor must be greater than zero for leave type {balance["leave_type_code"]}.')
        daily_rate = monthly_basis / divisor
        amount = (days * daily_rate).quantize(PAISE, rounding=ROUND_HALF_UP)
        capped_days_by_type[balance['leave_type_id']] = capped_days_by_type.get(balance['leave_type_id'], Decimal('0')) + days
        total_days += days
        total_amount += amount
        lines.append({
            'balance_id': balance['balance_id'], 'leave_type_id': balance['leave_type_id'],
            'leave_type_code': balance['leave_type_code'], 'leave_type_name': balance['leave_type_name'],
            'year': balance['year'], 'available_days': str(available), 'encashable_days': str(days),
            'salary_basis': basis_code, 'monthly_salary_basis': str(monthly_basis),
            'divisor_days': str(divisor), 'daily_rate': str(daily_rate.quantize(PAISE, rounding=ROUND_HALF_UP)),
            'amount': str(amount),
        })
    return {
        'exit_request_id': str(exit_request.id), 'employee_id': str(exit_request.employee_id),
        'exit_date': exit_date.isoformat(), 'salary_assignment_id': assignment['assignment_id'],
        'salary_assignment_effective_from': assignment['effective_from'],
        'salary_structure': assignment['structure_name'], 'salary_basis_monthly': {
            'BASIC': str(salary_basis['BASIC']), 'GROSS': str(salary_basis['GROSS']), 'CTC': str(salary_basis['CTC']),
        },
        'lines': lines, 'total_encashable_days': str(total_days),
        'total_amount': str(total_amount.quantize(PAISE, rounding=ROUND_HALF_UP)),
    }
