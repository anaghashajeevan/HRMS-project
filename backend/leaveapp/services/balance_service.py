# """
# Leave balance calculation service.
# """

# from datetime import date
# from decimal import Decimal

# from django.db import transaction
# from django.utils import timezone


# class LeaveBalanceService:
#     """Handles leave balance allocation, accrual, and rollover."""

#     @staticmethod
#     @transaction.atomic
#     def allocate_initial_balance(employee, year=None):
#         """
#         Create initial LeaveBalance records for a new employee.
#         Prorates yearly quotas based on join date.
#         """
#         from ..models import LeaveType, LeaveBalance

#         if year is None:
#             year = timezone.now().year

#         # Only allocate if year >= joining year
#         if employee.date_of_joining.year > year:
#             return []

#         # Get all active leave types
#         leave_types = LeaveType.objects.filter(is_active=True)

#         created_balances = []
#         for leave_type in leave_types:
#             # Skip if balance already exists
#             if LeaveBalance.objects.filter(
#                 employee=employee, leave_type=leave_type, year=year
#             ).exists():
#                 continue

#             # Calculate allocation based on accrual type
#             allocated = Decimal('0')
#             accrued = Decimal('0')

#             if leave_type.accrual_type == 'YEARLY':
#                 # Prorate based on months remaining in year
#                 if employee.date_of_joining.year == year:
#                     months_worked = 12 - employee.date_of_joining.month + 1
#                     allocated = leave_type.yearly_quota * Decimal(months_worked) / Decimal('12')
#                     allocated = allocated.quantize(Decimal('0.5'))
#                 else:
#                     allocated = leave_type.yearly_quota
#                 accrued = allocated  # Full amount available immediately

#             elif leave_type.accrual_type == 'MONTHLY':
#                 # Total allocation is yearly quota, but accrued monthly
#                 allocated = leave_type.yearly_quota
#                 # Calculate accrued so far this year
#                 today = timezone.localdate()
#                 if today.year == year:
#                     months_passed = today.month
#                     if employee.date_of_joining.year == year:
#                         months_passed = today.month - employee.date_of_joining.month + 1
#                     accrued = leave_type.accrual_per_period * Decimal(months_passed)
#                     accrued = accrued.quantize(Decimal('0.5'))
#                 else:
#                     accrued = Decimal('0')

#             elif leave_type.accrual_type == 'ON_DEMAND':
#                 # LOP, Comp-Off — no allocation
#                 allocated = Decimal('0')
#                 accrued = Decimal('0')

#             balance = LeaveBalance.objects.create(
#                 employee=employee,
#                 leave_type=leave_type,
#                 year=year,
#                 allocated=allocated,
#                 accrued_till_date=accrued,
#                 last_accrual_date=timezone.localdate(),
#             )
#             created_balances.append(balance)

#         return created_balances

#     @staticmethod
#     @transaction.atomic
#     def accrue_monthly(year=None, month=None):
#         """
#         Run monthly accrual for all employees.
#         Called on 1st of every month by cron/command.
#         """
#         from ..models import LeaveType, LeaveBalance
#         from HRMSapp.models import Employee

#         today = timezone.localdate()
#         if year is None:
#             year = today.year
#         if month is None:
#             month = today.month

#         # Get all monthly-accrual leave types
#         monthly_types = LeaveType.objects.filter(
#             is_active=True, accrual_type='MONTHLY'
#         )

#         # Get all active employees
#         employees = Employee.objects.filter(
#             is_deleted=False,
#             status__in=['ACTIVE', 'PROBATION'],
#         )

#         accrued_count = 0
#         for employee in employees:
#             for leave_type in monthly_types:
#                 balance, created = LeaveBalance.objects.get_or_create(
#                     employee=employee,
#                     leave_type=leave_type,
#                     year=year,
#                     defaults={
#                         'allocated': leave_type.yearly_quota,
#                         'accrued_till_date': Decimal('0'),
#                     }
#                 )

#                 # Skip if already accrued this month
#                 if balance.last_accrual_date and balance.last_accrual_date.month >= month:
#                     continue

#                 # Add accrual
#                 balance.accrued_till_date += leave_type.accrual_per_period
#                 balance.last_accrual_date = today
#                 balance.save()
#                 accrued_count += 1

#         return accrued_count

#     @staticmethod
#     def get_balance(employee, leave_type_code, year=None):
#         """Get balance for a specific employee + leave type + year."""
#         from ..models import LeaveBalance

#         if year is None:
#             year = timezone.now().year

#         try:
#             return LeaveBalance.objects.get(
#                 employee=employee,
#                 leave_type__code=leave_type_code,
#                 year=year,
#             )
#         except LeaveBalance.DoesNotExist:
#             return None


"""
Leave balance calculation service.
"""

from decimal import Decimal, InvalidOperation
import logging

from django.utils import timezone

logger = logging.getLogger(__name__)


class LeaveBalanceService:
    """Handles leave balance allocation, accrual, and rollover."""

    @staticmethod
    def allocate_initial_balance(employee, year=None):
        """
        Create initial LeaveBalance records for an employee.
        Each balance is saved independently (no bulk rollback).
        """
        from ..models import LeaveType, LeaveBalance

        if year is None:
            year = timezone.now().year

        result = {
            'created_count': 0,
            'skipped_count': 0,
            'balances': [],
            'errors': [],
        }

        leave_types = LeaveType.objects.filter(is_active=True)

        if not leave_types.exists():
            logger.warning("No active leave types found.")
            result['errors'].append('No active leave types configured')
            return result

        today = timezone.localdate()
        joining_date = employee.date_of_joining

        logger.info(
            f"Allocating balances for {employee.employee_id} - year={year}, "
            f"joining_date={joining_date}, active_types={leave_types.count()}"
        )

        for leave_type in leave_types:
            # NO TRANSACTION HERE — each create is independent
            try:
                # Skip if already exists
                if LeaveBalance.objects.filter(
                    employee=employee, leave_type=leave_type, year=year
                ).exists():
                    result['skipped_count'] += 1
                    logger.debug(f"  Skipped {leave_type.code}: already exists")
                    continue

                # Calculate allocation
                allocated = Decimal('0')
                accrued = Decimal('0')

                # Safe conversion
                yearly_quota = Decimal(str(leave_type.yearly_quota or 0))
                accrual_per_period = Decimal(str(leave_type.accrual_per_period or 0))

                if leave_type.accrual_type == 'YEARLY':
                    if joining_date.year == year:
                        months_remaining = 13 - joining_date.month
                        allocated = (
                            yearly_quota * Decimal(months_remaining) / Decimal('12')
                        )
                        # Round to 1 decimal place — SAFE quantize
                        allocated = allocated.quantize(Decimal('0.1'))
                    elif joining_date.year < year:
                        allocated = yearly_quota
                    else:
                        allocated = Decimal('0')
                    accrued = allocated

                elif leave_type.accrual_type == 'MONTHLY':
                    allocated = yearly_quota
                    if today.year == year:
                        if joining_date.year == year:
                            months_accrued = max(0, today.month - joining_date.month + 1)
                        elif joining_date.year < year:
                            months_accrued = today.month
                        else:
                            months_accrued = 0
                        accrued = (
                            accrual_per_period * Decimal(months_accrued)
                        ).quantize(Decimal('0.1'))
                    elif today.year > year:
                        accrued = allocated
                    else:
                        accrued = Decimal('0')

                elif leave_type.accrual_type == 'QUARTERLY':
                    allocated = yearly_quota
                    if today.year == year:
                        quarters_passed = (today.month - 1) // 3 + 1
                        accrued = (
                            accrual_per_period * Decimal(quarters_passed)
                        ).quantize(Decimal('0.1'))
                    else:
                        accrued = allocated if today.year > year else Decimal('0')

                elif leave_type.accrual_type == 'ON_DEMAND':
                    allocated = Decimal('0')
                    accrued = Decimal('0')

                # Log what we're about to create
                logger.info(
                    f"  Creating {leave_type.code}: allocated={allocated}, accrued={accrued}"
                )

                # Create the record
                balance = LeaveBalance.objects.create(
                    employee=employee,
                    leave_type=leave_type,
                    year=year,
                    allocated=allocated,
                    accrued_till_date=accrued,
                    last_accrual_date=today,
                )
                result['created_count'] += 1
                result['balances'].append(balance)
                logger.info(f"  ✅ Created balance ID: {balance.id}")

            except InvalidOperation as exc:
                error_msg = f"{leave_type.code}: Decimal error - {exc}"
                logger.error(f"  ❌ {error_msg}")
                result['errors'].append(error_msg)
            except Exception as exc:
                error_msg = f"{leave_type.code}: {type(exc).__name__} - {exc}"
                logger.exception(f"  ❌ {error_msg}")
                result['errors'].append(error_msg)

        logger.info(
            f"Done: {employee.employee_id} - "
            f"created={result['created_count']}, "
            f"skipped={result['skipped_count']}, "
            f"errors={len(result['errors'])}"
        )

        return result

    @staticmethod
    def get_balance(employee, leave_type_code, year=None):
        from ..models import LeaveBalance

        if year is None:
            year = timezone.now().year

        try:
            return LeaveBalance.objects.get(
                employee=employee,
                leave_type__code=leave_type_code,
                year=year,
            )
        except LeaveBalance.DoesNotExist:
            return None

    @staticmethod
    def accrue_monthly(year=None, month=None):
        """Run monthly accrual for all employees."""
        from ..models import LeaveType, LeaveBalance
        from HRMSapp.models import Employee

        today = timezone.localdate()
        if year is None:
            year = today.year
        if month is None:
            month = today.month

        monthly_types = LeaveType.objects.filter(is_active=True, accrual_type='MONTHLY')
        employees = Employee.objects.filter(
            is_deleted=False,
            status__in=['ACTIVE', 'PROBATION'],
        )

        accrued_count = 0
        for employee in employees:
            for leave_type in monthly_types:
                try:
                    balance, created = LeaveBalance.objects.get_or_create(
                        employee=employee,
                        leave_type=leave_type,
                        year=year,
                        defaults={
                            'allocated': Decimal(str(leave_type.yearly_quota)),
                            'accrued_till_date': Decimal('0'),
                        }
                    )

                    if balance.last_accrual_date and balance.last_accrual_date.month >= month:
                        continue

                    balance.accrued_till_date += Decimal(str(leave_type.accrual_per_period))
                    balance.last_accrual_date = today
                    balance.save()
                    accrued_count += 1
                except Exception as exc:
                    logger.exception(f"Accrual failed for {employee.employee_id}: {exc}")

        return accrued_count