"""Exit gratuity estimate based on the approved exit-date salary assignment."""
import calendar
from decimal import Decimal, ROUND_HALF_UP

PAISE = Decimal('0.01')


def _add_months(value, months):
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def _completed_years(start_date, end_date):
    years = max(end_date.year - start_date.year, 0)
    anniversary = _add_months(start_date, years * 12)
    if anniversary > end_date:
        years -= 1
    return max(years, 0)


def _service_year_units(start_date, end_date, completed_years):
    """Count a remaining service fraction only when it exceeds six months."""
    remainder_start = _add_months(start_date, completed_years * 12)
    six_month_mark = _add_months(remainder_start, 6)
    return completed_years + (1 if end_date > six_month_mark else 0)


def _salary_basis_from_assignment(assignment, as_of_date):
    from .assignment_service import AssignmentService

    breakdown = AssignmentService.preview_breakdown(
        assignment.structure, assignment.ctc_monthly, as_of_date=as_of_date,
    )
    basic = Decimal('0')
    dearness_allowance = Decimal('0')
    components = []
    for earning in breakdown.get('earnings', []):
        code = str(earning.get('code') or '').strip().upper()
        name = ' '.join(str(earning.get('name') or '').casefold().split())
        amount = Decimal(str(earning.get('amount') or '0'))
        if code == 'BASIC' or name in {'basic', 'basic salary'}:
            basic += amount
            components.append({'code': code or 'BASIC', 'name': earning.get('name'), 'amount': str(amount)})
        elif code in {'DA', 'DEARNESS_ALLOWANCE'} or name == 'dearness allowance':
            dearness_allowance += amount
            components.append({'code': code or 'DA', 'name': earning.get('name'), 'amount': str(amount)})
    return {
        'basic_monthly': basic.quantize(PAISE, rounding=ROUND_HALF_UP),
        'dearness_allowance_monthly': dearness_allowance.quantize(PAISE, rounding=ROUND_HALF_UP),
        'gratuity_wage_monthly': (basic + dearness_allowance).quantize(PAISE, rounding=ROUND_HALF_UP),
        'gratuity_wage_components': components,
    }


def gratuity_salary_basis(assignment, as_of_date):
    """Public helper used when freezing exit settlement inputs."""
    return _salary_basis_from_assignment(assignment, as_of_date)


def preview_exit_gratuity(exit_request):
    """Return the requested 5-year gratuity estimate and an auditable breakdown."""
    snapshot = exit_request.frozen_snapshot or {}
    assignment_data = snapshot.get('salary_assignment') or {}
    wage = assignment_data.get('gratuity_wage_monthly')
    basic = assignment_data.get('gratuity_basic_monthly')
    dearness_allowance = assignment_data.get('gratuity_da_monthly')
    components = assignment_data.get('gratuity_wage_components')

    if wage is None:
        # Approved exits created before this feature have a frozen assignment ID
        # but no gratuity basis. Resolve that same assignment for their preview.
        from ..models import EmployeeSalaryAssignment
        assignment = EmployeeSalaryAssignment.objects.filter(
            pk=assignment_data.get('assignment_id'), employee=exit_request.employee,
        ).select_related('structure').first()
        if assignment:
            basis = _salary_basis_from_assignment(assignment, exit_request.proposed_exit_date)
            wage = basis['gratuity_wage_monthly']
            basic = basis['basic_monthly']
            dearness_allowance = basis['dearness_allowance_monthly']
            components = basis['gratuity_wage_components']
        else:
            # Preserve older frozen Basic data if its assignment is unavailable;
            # no DA is inferred when the assignment cannot be checked.
            basic = Decimal(str(assignment_data.get('basic_monthly') or '0'))
            dearness_allowance = Decimal('0')
            wage = basic
            components = []

    basic = Decimal(str(basic or '0'))
    dearness_allowance = Decimal(str(dearness_allowance or '0'))
    wage = Decimal(str(wage or '0'))
    joining_date = exit_request.employee.date_of_joining
    exit_date = exit_request.proposed_exit_date
    completed_years = _completed_years(joining_date, exit_date) if joining_date else 0
    eligible = completed_years >= 5
    counted_years = _service_year_units(joining_date, exit_date, completed_years) if joining_date else 0
    amount = (
        (wage * Decimal('15') * Decimal(counted_years) / Decimal('26'))
        .quantize(PAISE, rounding=ROUND_HALF_UP)
        if eligible else Decimal('0.00')
    )
    if eligible:
        detail = (
            f'Eligible: {completed_years} completed service years; {counted_years} year(s) counted. '
            f'({basic} Basic + {dearness_allowance} DA) × 15 × {counted_years} ÷ 26.'
        )
    else:
        detail = (
            f'Not eligible: {completed_years} completed service year(s); '
            'at least 5 completed years are required under the configured policy.'
        )
    return {
        'eligible': eligible,
        'completed_service_years': completed_years,
        'service_years_counted': counted_years,
        'joining_date': joining_date.isoformat() if joining_date else None,
        'exit_date': exit_date.isoformat(),
        'basic_monthly': str(basic.quantize(PAISE, rounding=ROUND_HALF_UP)),
        'dearness_allowance_monthly': str(dearness_allowance.quantize(PAISE, rounding=ROUND_HALF_UP)),
        'last_drawn_salary_monthly': str(wage.quantize(PAISE, rounding=ROUND_HALF_UP)),
        'wage_components': components or [],
        'formula': '(Basic + DA) × 15 × service years ÷ 26',
        'amount': str(amount),
        'detail': detail,
        'taxable': False,
    }
