"""Read-only F&F calculation preview from frozen exit inputs."""
import calendar
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from .leave_encashment_service import preview_exit_encashment
from .gratuity_service import preview_exit_gratuity

CENT = Decimal('0.01')


class FullFinalError(Exception):
    pass


def _money(value):
    return Decimal(str(value or '0')).quantize(CENT, rounding=ROUND_HALF_UP)


def preview_full_final(exit_request):
    if exit_request.status != 'APPROVED' or not exit_request.frozen_snapshot:
        raise FullFinalError('F&F can be reviewed after the exit request is approved.')

    exit_date = exit_request.proposed_exit_date
    month_start = exit_date.replace(day=1)
    days_in_month = calendar.monthrange(exit_date.year, exit_date.month)[1]
    snapshot = exit_request.frozen_snapshot
    assignment = snapshot.get('salary_assignment')
    lines = []

    if assignment:
        eligible_start = max(month_start, date.fromisoformat(assignment['effective_from']))
        gross_monthly = Decimal(assignment['gross_monthly'])
        # Reconcile attendance only through the approved last working day.
        # F&F owns the unpaid balance, so it must account for LOP here and
        # must not re-run the month-wide LOP deduction later.
        from .day_reconciliation_service import DayReconciliationService
        from ..models import PayCalendar

        calendar_row = PayCalendar.objects.filter(
            year=exit_date.year, month=exit_date.month,
        ).first()
        day_data = DayReconciliationService.reconcile(
            exit_request.employee,
            eligible_start,
            exit_date,
            saturday_is_working=calendar_row.saturday_is_working if calendar_row else False,
        )
        salary_days_due = max(
            Decimal(str(day_data['eligible_calendar_days']))
            - Decimal(str(day_data['lop_days']))
            + Decimal(str(day_data.get('summary', {}).get('off_day_worked', 0))),
            Decimal('0'),
        )
        gross_salary_due = _money(gross_monthly * salary_days_due / days_in_month)
        already_paid = sum((
            Decimal(pay.get('salary_earned') or pay.get('gross_pay') or '0')
            for pay in snapshot.get('completed_payroll', [])
            if date.fromisoformat(pay['period_start']) <= exit_date
            and date.fromisoformat(pay['period_end']) >= month_start
        ), Decimal('0'))
        salary_amount = max(_money(gross_salary_due - already_paid), Decimal('0.00'))
        lines.append({
            'code': 'SALARY_THROUGH_EXIT', 'label': 'Salary through last working day',
            'period': f'{eligible_start.isoformat()} to {exit_date.isoformat()}',
            'amount': str(salary_amount), 'detail':
                f'Salary is prorated over {days_in_month} calendar days after attendance and LOP reconciliation; '
                f'salary already earned in overlapping paid payroll periods deducted: ₹{_money(already_paid)}.',
        })

    encashment = preview_exit_encashment(exit_request)
    lines.append({
        'code': 'LEAVE_ENCASHMENT', 'label': 'Eligible leave encashment',
        'amount': encashment['total_amount'],
        'detail': f"{encashment['total_encashable_days']} days under frozen leave policies.",
    })

    warnings = []
    gratuity = preview_exit_gratuity(exit_request)
    lines.append({
        'code': 'GRATUITY', 'label': 'Gratuity',
        'amount': gratuity['amount'], 'detail': gratuity['detail'],
        'taxable': gratuity['taxable'],
    })
    if gratuity['eligible']:
        warnings.append(
            'The gratuity estimate follows the configured formula; applicable tax exemption and statutory cap are not assessed here.'
        )

    arrears = snapshot.get('outstanding_arrears') or []
    reserved_arrears_count = int(snapshot.get('reserved_arrears_count') or 0)
    if reserved_arrears_count:
        warnings.append(
            f'{reserved_arrears_count} arrears item(s) are reserved in another payroll run. '
            'Complete or reverse that run before creating the F&F run.'
        )
    arrears_amount = _money(sum((Decimal(item.get('amount') or '0') for item in arrears), Decimal('0')))
    lines.append({
        'code': 'OUTSTANDING_ARREARS', 'label': 'Outstanding arrears',
        'amount': str(arrears_amount),
        'detail': f'{len(arrears)} unsettled item(s) by payroll period and component.' if arrears else 'No unsettled arrears items.',
    })

    inputs = snapshot.get('settlement_inputs') or {}
    try:
        recoveries = _money(inputs.get('recovery_amount'))
        other_dues = _money(inputs.get('other_dues_amount'))
        if recoveries < 0 or other_dues < 0:
            raise FullFinalError('Recovery and other dues amounts must not be negative.')
    except (InvalidOperation, ValueError):
        raise FullFinalError('Recovery and other dues must be valid amounts.')

    lines.extend([
        {'code': 'OTHER_DUES', 'label': 'Other dues', 'amount': str(other_dues),
         'detail': inputs.get('other_dues_notes') or 'As entered in the approved exit request.'},
        {'code': 'RECOVERIES', 'label': 'Recoveries', 'amount': str(-recoveries),
         'detail': inputs.get('recovery_notes') or 'As entered in the approved exit request.'},
    ])
    total = _money(sum((Decimal(line['amount']) for line in lines), Decimal('0')))
    return {
        'exit_request_id': str(exit_request.id), 'employee_id': str(exit_request.employee_id),
        'exit_date': exit_date.isoformat(), 'lines': lines,
        'total_before_statutory_deductions': str(total),
        'calculation_status': 'PREVIEW',
        'warnings': warnings,
        'notice': 'Review estimate only. Statutory deductions and payment are handled in the F&F payroll run.',
    }
