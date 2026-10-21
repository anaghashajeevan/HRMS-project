"""
Day Reconciliation Service.

Builds a day-by-day status map for an employee over a pay period,
reconciling attendance + leave + holidays into a SINGLE source of truth.

This eliminates double-counting between attendance gaps and leave records.

Day states (one per calendar day in the eligible range):
  - weekend         → not payable, not LOP
  - holiday         → not payable, not LOP
  - paid_leave      → payable (counted toward payable_days)
  - lop_leave       → LOP (counted toward lop_days)
  - half_day_paid   → 0.5 payable
  - half_day_lop    → 0.5 LOP, 0.5 payable
  - present         → payable
  - absent          → LOP (no leave covering the absence)
  - comp_off        → recorded separately in leave management; not payroll attendance
  - before_joining  → excluded (outside eligible range)
  - after_exit      → excluded (outside eligible range)

Final tallies:
  - eligible_calendar_days = DOJ-aware/DOE-aware count
  - payable_days = sum of fully/half payable days
  - lop_days = sum of fully/half LOP days
  - payable_days counts attendance and paid leave on scheduled workdays,
    plus attendance on weekends/holidays as extra paid days.
  - weekends and holidays without attendance are excluded from both payable
    and LOP counts. Salary is prorated using the full calendar-day divisor.
"""

import logging
from datetime import timedelta, date
from decimal import Decimal

from django.db.models import Q, Value
from django.db.models.functions import Replace, Trim, Upper

logger = logging.getLogger(__name__)


class DayStatus:
    """Possible status for a single calendar day."""
    WEEKEND = 'weekend'
    HOLIDAY = 'holiday'
    OFF_DAY_WORKED = 'off_day_worked'
    PAID_LEAVE = 'paid_leave'
    LOP_LEAVE = 'lop_leave'
    HALF_DAY_PAID = 'half_day_paid'
    HALF_DAY_LOP = 'half_day_lop'
    PRESENT = 'present'
    ABSENT = 'absent'
    COMP_OFF = 'comp_off'
    BEFORE_JOINING = 'before_joining'
    AFTER_EXIT = 'after_exit'


class DayReconciliationService:
    """Builds the day-by-day status map for payroll calculation."""

    @staticmethod
    def reconcile(employee, period_start, period_end, saturday_is_working=False):
        """
        Build day-by-day status for an employee over a pay period.

        Args:
            employee: HRMSapp.Employee instance
            period_start: date (first day of pay period)
            period_end: date (last day of pay period)

        Returns:
            {
                'days_in_month': int,
                'eligible_calendar_days': Decimal,
                'payable_days': Decimal,     # attended/paid workdays + off-day attendance
                'lop_days': Decimal,
                'paid_leave_days': Decimal,
                'day_map': {date: status},   # per-day status for audit
                'summary': {                 # counts by category
                    'weekends': int,
                    'holidays': int,
                    'present': int,
                    'absent': int,
                    'paid_leave': Decimal,
                    'lop_leave': Decimal,
                    'half_days_paid': int,
                    'half_days_lop': int,
                },
                'leave_breakdown': [         # for audit snapshot
                    {'type': 'CL', 'days': 1.0, 'is_lop': False},
                    ...
                ],
            }
        """
        days_in_month = (period_end - period_start).days + 1

        # Salary is prorated against all calendar days in the pay period.
        # The payable numerator below counts actual payable work/leave days;
        # attendance on an otherwise-off day adds one payable day for that
        # employee only.
        period_holidays = DayReconciliationService._get_holiday_dates(
            employee, period_start, period_end,
        )

        salary_divisor_days = days_in_month

        def is_scheduled_workday(day):
            return day.weekday() < 5 or (saturday_is_working and day.weekday() == 5)

        # 1. Determine eligible range (DOJ/DOE aware)
        eligible_start = max(period_start, employee.date_of_joining)

        doe = getattr(employee, 'date_of_exit', None)
        if doe:
            eligible_end = min(period_end, doe)
        else:
            eligible_end = period_end

        if eligible_start > eligible_end:
            # Not eligible for any day in this period
            return {
                'days_in_month': days_in_month,
                'salary_divisor_days': salary_divisor_days,
                'eligible_calendar_days': Decimal('0'),
                'payable_days': Decimal('0'),
                'lop_days': Decimal('0'),
                'paid_leave_days': Decimal('0'),
                'day_map': {},
                'summary': {
                    'weekends': 0, 'holidays': 0, 'off_day_worked': 0,
                    'present': 0, 'absent': 0,
                    'paid_leave': Decimal('0'), 'lop_leave': Decimal('0'),
                    'half_days_paid': 0, 'half_days_lop': 0,
                },
                'leave_breakdown': [],
            }

        eligible_days = (eligible_end - eligible_start).days + 1

        # 2. Holidays for eligible dates (location-aware).
        holiday_dates = {day for day in period_holidays if eligible_start <= day <= eligible_end}

        # 3. Fetch approved leaves overlapping the eligible range
        leaves = DayReconciliationService._get_approved_leaves(
            employee, eligible_start, eligible_end,
        )

        # Build leave day lookup using the leave application's actual working-
        # day total and partial LOP balance. `is_lop` means some/all of the
        # request is LOP; `lop_days` determines how much is actually unpaid.
        leave_day_map = {}
        for leave in leaves:
            leave_start = max(leave.start_date, eligible_start)
            leave_end = min(leave.end_date, eligible_end)
            leave_holidays = DayReconciliationService._get_holiday_dates(
                employee, leave.start_date, leave.end_date,
            )
            leave_dates = []
            current = leave.start_date
            while current <= leave.end_date:
                if current.weekday() < 5 and current not in leave_holidays:
                    leave_dates.append(current)
                current += timedelta(days=1)

            requested_days = Decimal(str(leave.total_days or 0))
            if leave.is_half_day:
                requested_days = min(requested_days or Decimal('0.5'), Decimal('0.5'))
            if requested_days <= 0:
                requested_days = Decimal('0.5') if leave.is_half_day else Decimal(len(leave_dates))

            if not leave.leave_type.is_paid:
                unpaid_days = requested_days
            else:
                unpaid_days = Decimal(str(leave.lop_days or 0))
                if leave.is_lop and unpaid_days <= 0:
                    unpaid_days = requested_days
            unpaid_days = min(max(unpaid_days, Decimal('0')), requested_days)

            # Leave applications do not store which specific dates used the
            # remaining paid balance. Allocate LOP from the last leave date
            # backward, giving a stable, auditable date-level split.
            remaining_days = requested_days
            day_units = {}
            for leave_date in leave_dates:
                if remaining_days <= 0:
                    break
                units = min(Decimal('1'), remaining_days)
                day_units[leave_date] = units
                remaining_days -= units
            unpaid_by_date = {}
            remaining_unpaid = unpaid_days
            for leave_date in reversed(list(day_units)):
                unpaid = min(day_units[leave_date], remaining_unpaid)
                unpaid_by_date[leave_date] = unpaid
                remaining_unpaid -= unpaid
            for leave_date, units in day_units.items():
                if not eligible_start <= leave_date <= eligible_end:
                    continue
                unpaid = unpaid_by_date.get(leave_date, Decimal('0'))
                leave_day_map[leave_date] = {
                    'leave': leave,
                    'units': units,
                    'lop_units': unpaid,
                    'paid_units': units - unpaid,
                }

        # 4. Fetch attendance (optional — only PRESENT days matter)
        attendance_dates = DayReconciliationService._get_present_dates(
            employee, eligible_start, eligible_end,
        )

        # 5. Build day-by-day status map. Comp-off credits do not create pay:
        # only verified attendance from the attendance app does.
        day_map = {}
        summary = {
            'weekends': 0, 'holidays': 0,
            'off_day_worked': 0,
            'present': 0, 'absent': 0,
            'paid_leave': Decimal('0'), 'lop_leave': Decimal('0'),
            'half_days_paid': 0, 'half_days_lop': 0,
        }

        payable_days = Decimal('0')
        lop_days = Decimal('0')
        paid_leave_days = Decimal('0')

        current = eligible_start
        while current <= eligible_end:
            is_holiday = current in holiday_dates
            scheduled_today = is_scheduled_workday(current) and not is_holiday
            leave_data = leave_day_map.get(current)
            is_present = current in attendance_dates

            # Nonworking weekend/holiday dates never create LOP from missing
            # attendance. If the employee did work, count that date as an
            # additional payable day for this employee only.
            if not scheduled_today:
                if is_present:
                    day_map[current] = DayStatus.OFF_DAY_WORKED
                    payable_days += Decimal('1.0')
                    summary['off_day_worked'] += 1
                    summary['present'] += 1
                elif is_holiday:
                    day_map[current] = DayStatus.HOLIDAY
                    summary['holidays'] += 1
                else:
                    day_map[current] = DayStatus.WEEKEND
                    summary['weekends'] += 1

            elif leave_data and is_present:
                # A verified attendance record wins over a leave record for
                # that date; do not charge LOP or double-count the leave.
                day_map[current] = DayStatus.PRESENT
                payable_days += Decimal('1.0')
                summary['present'] += 1

            elif leave_data:
                units = leave_data['units']
                unpaid = leave_data['lop_units']
                paid = leave_data['paid_units']
                lop_days += unpaid
                payable_days += paid
                paid_leave_days += paid
                if units == Decimal('0.5'):
                    if unpaid:
                        payable_days += Decimal('0.5')
                        day_map[current] = DayStatus.HALF_DAY_LOP
                        summary['half_days_lop'] += 1
                    else:
                        payable_days += Decimal('0.5')
                        day_map[current] = DayStatus.HALF_DAY_PAID
                        summary['half_days_paid'] += 1
                elif unpaid == units:
                    day_map[current] = DayStatus.LOP_LEAVE
                    summary['lop_leave'] += unpaid
                elif unpaid:
                    day_map[current] = DayStatus.HALF_DAY_LOP
                    summary['half_days_lop'] += 1
                    summary['paid_leave'] += paid
                else:
                    day_map[current] = DayStatus.PAID_LEAVE
                    summary['paid_leave'] += paid

            elif is_present:
                day_map[current] = DayStatus.PRESENT
                payable_days += Decimal('1.0')
                summary['present'] += 1

            else:
                # A scheduled workday with no attendance and no approved leave is LOP.
                day_map[current] = DayStatus.ABSENT
                lop_days += Decimal('1.0')
                summary['absent'] += 1

            current += timedelta(days=1)

        # 7. Build leave breakdown for audit
        leave_breakdown = []
        for leave in leaves:
            leave_start = max(leave.start_date, eligible_start)
            leave_end = min(leave.end_date, eligible_end)
            period_leave_entries = [
                value for day, value in leave_day_map.items()
                if leave_start <= day <= leave_end and value['leave'].pk == leave.pk
            ]
            days_in_period = sum(
                (value['units'] for value in period_leave_entries), Decimal('0'),
            )
            unpaid_days = sum(
                (value['lop_units'] for value in period_leave_entries), Decimal('0'),
            )
            leave_breakdown.append({
                'application_number': leave.application_number,
                'type': leave.leave_type.code,
                'days': str(days_in_period),
                'lop_days': str(min(unpaid_days, days_in_period)),
                'paid_days': str(max(days_in_period - unpaid_days, Decimal('0'))),
                'start_date': str(leave_start),
                'end_date': str(leave_end),
                'is_lop': unpaid_days > 0,
                'is_half_day': leave.is_half_day,
            })

        return {
            'days_in_month': days_in_month,
            'salary_divisor_days': salary_divisor_days,
            'eligible_calendar_days': Decimal(str(eligible_days)),
            'payable_days': payable_days,
            'lop_days': lop_days,
            'paid_leave_days': paid_leave_days,
            'day_map': {str(k): v for k, v in day_map.items()},  # JSON-safe
            'summary': {
                **{k: v for k, v in summary.items() if not isinstance(v, Decimal)},
                'paid_leave': str(summary['paid_leave']),
                'lop_leave': str(summary['lop_leave']),
            },
            'leave_breakdown': leave_breakdown,
        }

    # ==========================================================================
    # HELPERS
    # ==========================================================================

    @staticmethod
    def _get_approved_leaves(employee, start, end):
        from leaveapp.models import LeaveApplication
        return LeaveApplication.objects.filter(
            employee=employee,
            status='APPROVED',
            start_date__lte=end,
            end_date__gte=start,
        ).select_related('leave_type')

    @staticmethod
    def _get_holiday_dates(employee, start, end):
        """Get holiday dates (location-aware), returns set of date objects."""
        from leaveapp.models import Holiday

        qs = Holiday.objects.filter(
            date__gte=start,
            date__lte=end,
            is_active=True,
        )

        emp_location = employee.location or employee.structure_location

        if emp_location and emp_location.type in ('LOCATION', 'HQ', 'COMPANY'):
            qs = qs.filter(
                Q(applicable_to_all_locations=True) |
                Q(applicable_locations=emp_location)
            )
        else:
            qs = qs.filter(applicable_to_all_locations=True)

        return set(qs.distinct().values_list('date', flat=True))

    @staticmethod
    def _get_present_dates(employee, start, end):
        """Get dates when employee was present (from attendance)."""
        try:
            from attendanceapp.models import DailyAttendance
        except ImportError:
            return set()

        from attendanceapp.models import normalize_employee_code

        normalized_code = Replace(
            Replace(Upper(Trim('employee_code')), Value('-'), Value('')),
            Value(' '), Value(''),
        )
        qs = DailyAttendance.objects.filter(
            attendance_date__gte=start,
            attendance_date__lte=end,
        ).annotate(
            payroll_employee_code=normalized_code,
        ).filter(
            payroll_employee_code=normalize_employee_code(employee.employee_id),
        ).filter(
            (
                Q(status='present')
                & Q(missing_punch=False)
                & Q(punch_in__isnull=False)
                & Q(punch_out__isnull=False)
            )
            | Q(
                is_manual_override=True,
                manual_status__in=(
                    'WFH', 'Site Visit', 'Manual Present',
                    'SITE_VISIT', 'MANUAL_PRESENT',
                ),
            )
        )

        return set(qs.values_list('attendance_date', flat=True))

    @staticmethod
    def _get_comp_off_dates(employee, start, end):
        """Get dates for which comp-off was credited (worked weekend/holiday)."""
        try:
            from leaveapp.models import CompOffCreditLog
        except ImportError:
            return set()

        qs = CompOffCreditLog.objects.filter(
            employee=employee,
            credit_date__gte=start,
            credit_date__lte=end,
        )

        return set(qs.values_list('credit_date', flat=True))
