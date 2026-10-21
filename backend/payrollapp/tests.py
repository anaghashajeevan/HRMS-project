from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from .services.day_reconciliation_service import DayReconciliationService
from .services.payroll_calculation_service import PayrollCalculationService


class CalendarDayProrationTests(SimpleTestCase):
    def test_uses_calendar_divisor_for_28_29_30_and_31_day_months(self):
        for year, month, days in (
            (2025, 2, 28),
            (2024, 2, 29),
            (2026, 4, 30),
            (2026, 5, 31),
        ):
            with self.subTest(year=year, month=month):
                self.assertEqual(monthrange(year, month)[1], days)
                amount = PayrollCalculationService.prorate_monthly_amount(
                    Decimal('31000.00'), Decimal(days), days,
                )
                self.assertEqual(amount, Decimal('31000.00'))

    def test_prorates_partial_month_without_rounding_daily_rate_first(self):
        self.assertEqual(
            PayrollCalculationService.prorate_monthly_amount(
                Decimal('12500.00'), Decimal('19'), 31,
            ),
            Decimal('7661.29'),
        )

    def test_zero_days_produces_zero(self):
        self.assertEqual(
            PayrollCalculationService.prorate_monthly_amount(
                Decimal('12500.00'), Decimal('0'), 28,
            ),
            Decimal('0.00'),
        )


class CalendarDayReconciliationTests(SimpleTestCase):
    @staticmethod
    def employee(joined, exited=None):
        return SimpleNamespace(
            date_of_joining=joined,
            date_of_exit=exited,
            location=None,
            structure_location=None,
        )

    @staticmethod
    def present_weekdays(start, end, absent=()):
        absent = set(absent)
        present = set()
        current = start
        while current <= end:
            if current.weekday() < 5 and current not in absent:
                present.add(current)
            current += timedelta(days=1)
        return present

    def reconcile(self, employee, start, end, leaves=(), absent=()):
        with (
            patch.object(DayReconciliationService, '_get_approved_leaves', return_value=list(leaves)),
            patch.object(DayReconciliationService, '_get_holiday_dates', return_value=set()),
            patch.object(
                DayReconciliationService, '_get_present_dates',
                return_value=self.present_weekdays(start, end, absent),
            ),
            patch.object(DayReconciliationService, '_get_comp_off_dates', return_value=set()),
        ):
            return DayReconciliationService.reconcile(employee, start, end)

    def test_full_month_payable_days_cover_all_month_lengths(self):
        for year, month, expected_days in (
            (2025, 2, 28),
            (2024, 2, 29),
            (2026, 4, 30),
            (2026, 5, 31),
        ):
            with self.subTest(year=year, month=month):
                start = date(year, month, 1)
                end = date(year, month, expected_days)
                result = self.reconcile(self.employee(start), start, end)
                self.assertEqual(result['eligible_calendar_days'], Decimal(expected_days))
                self.assertEqual(result['payable_days'], Decimal(expected_days))
                self.assertEqual(result['lop_days'], Decimal('0'))

    def test_joining_and_exit_dates_bound_eligible_days(self):
        start, end = date(2026, 3, 1), date(2026, 3, 31)
        result = self.reconcile(
            self.employee(date(2026, 3, 11), date(2026, 3, 28)), start, end,
        )
        self.assertEqual(result['eligible_calendar_days'], Decimal('18'))
        self.assertEqual(result['payable_days'], Decimal('18'))
        self.assertEqual(result['lop_days'], Decimal('0'))

    def test_full_lop_half_day_lop_and_paid_half_day_are_reconciled_once(self):
        start, end = date(2026, 3, 1), date(2026, 3, 31)
        full_lop_day = date(2026, 3, 4)
        half_lop_day = date(2026, 3, 5)
        half_paid_day = date(2026, 3, 6)

        def leave(day, is_lop, is_half_day, code):
            return SimpleNamespace(
                start_date=day,
                end_date=day,
                is_lop=is_lop,
                is_half_day=is_half_day,
                application_number=f'LEAVE-{day.day}',
                leave_type=SimpleNamespace(code=code),
            )

        result = self.reconcile(
            self.employee(start), start, end,
            leaves=[
                leave(full_lop_day, True, False, 'LOP'),
                leave(half_lop_day, True, True, 'LOP'),
                leave(half_paid_day, False, True, 'CL'),
            ],
            absent=[full_lop_day, half_lop_day, half_paid_day],
        )
        self.assertEqual(result['lop_days'], Decimal('1.5'))
        self.assertEqual(result['paid_leave_days'], Decimal('0.5'))
        self.assertEqual(result['payable_days'], Decimal('29.5'))
        self.assertEqual(result['eligible_calendar_days'], Decimal('31'))

