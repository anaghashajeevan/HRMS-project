import calendar
from datetime import timedelta

from django.db import transaction

from HRMSapp.models import ProbationCycle, ProbationPolicy


def add_months(value, months):
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def get_employee_policy(employee):
    if not employee.position_id or not employee.department_id:
        return None
    return ProbationPolicy.objects.filter(
        position_id=employee.position_id,
        department_id=employee.department_id,
    ).select_related('position', 'department').first()


def _cycle_dates(start_date, policy):
    if not policy:
        return None, None, 7
    boundary = add_months(start_date, policy.probation_months)
    return boundary - timedelta(days=1), policy.probation_months, policy.reminder_days_before


@transaction.atomic
def start_probation_cycle(employee, event_type='STARTED', start_date=None):
    employee.probation_cycles.filter(is_current=True).update(is_current=False)
    policy = get_employee_policy(employee)
    start_date = start_date or employee.date_of_joining
    end_date, months, lead_days = _cycle_dates(start_date, policy)
    return ProbationCycle.objects.create(
        employee=employee,
        policy=policy,
        event_type=event_type,
        start_date=start_date,
        end_date=end_date,
        probation_months=months,
        reminder_days_before=lead_days,
    )


@transaction.atomic
def refresh_current_probation_cycle(employee):
    return start_probation_cycle(
        employee, event_type='POLICY_UPDATED', start_date=employee.date_of_joining
    )
