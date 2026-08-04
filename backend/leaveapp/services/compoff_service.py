"""
Compensatory Off (Comp-Off) auto-crediting service.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction, IntegrityError
from django.utils import timezone

logger = logging.getLogger(__name__)


FULL_DAY_MIN_HOURS = 6.0
HALF_DAY_MIN_HOURS = 3.0
COMP_OFF_LEAVE_CODE = 'COMP_OFF'


def _is_weekend(d: date) -> bool:
    return d.weekday() >= 5


def _get_holiday_dates_for_employee(employee, start_date, end_date):
    """Get holiday dates — uses location field (falls back to structure_location)."""
    try:
        from ..models import Holiday
        from django.db.models import Q

        qs = Holiday.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
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
    except Exception:
        return set()


def _should_credit_comp_off(day: date, holiday_dates: set) -> tuple[bool, str]:
    if _is_weekend(day):
        day_name = 'Saturday' if day.weekday() == 5 else 'Sunday'
        return True, f'Worked on {day_name}'
    if day in holiday_dates:
        return True, 'Worked on holiday'
    return False, 'Regular working day'


def _calculate_comp_off_days(worked_hours: float) -> tuple[Decimal, str]:
    if worked_hours >= FULL_DAY_MIN_HOURS:
        return Decimal('1.0'), f'Full day worked ({worked_hours:.1f}h)'
    elif worked_hours >= HALF_DAY_MIN_HOURS:
        return Decimal('0.5'), f'Half day worked ({worked_hours:.1f}h)'
    else:
        return Decimal('0'), f'Insufficient hours ({worked_hours:.1f}h)'


class CompOffService:
    """Auto-credit comp-off for weekend/holiday work — DUPLICATE-SAFE."""

    @staticmethod
    def credit_comp_off_for_day(employee, attendance_row, day: date, force: bool = False):
        """
        Check a single day + credit comp-off if applicable.
        DUPLICATE-SAFE: uses atomic get_or_create pattern.
        """
        from ..models import LeaveType, LeaveBalance, CompOffCreditLog
        
        # 1. Check if day qualifies
        holiday_dates = _get_holiday_dates_for_employee(employee, day, day)
        qualifies, day_reason = _should_credit_comp_off(day, holiday_dates)
        
        if not qualifies:
            return {'credited': False, 'reason': day_reason, 'comp_off_days': 0}
        
        # 2. Check attendance
        if not attendance_row:
            return {'credited': False, 'reason': 'No attendance', 'comp_off_days': 0}
        
        worked_hours = (attendance_row.net_working_hours_seconds or 0) / 3600
        comp_off_days, hours_reason = _calculate_comp_off_days(worked_hours)
        
        if comp_off_days == 0:
            return {
                'credited': False,
                'reason': hours_reason,
                'worked_hours': worked_hours,
                'comp_off_days': 0,
            }
        
        # 3. Get COMP_OFF leave type
        try:
            comp_off_type = LeaveType.objects.get(code=COMP_OFF_LEAVE_CODE, is_active=True)
        except LeaveType.DoesNotExist:
            logger.warning("COMP_OFF leave type not configured")
            return {
                'credited': False,
                'reason': 'COMP_OFF leave type not configured',
                'comp_off_days': 0,
            }
        
        # 🎯 4. CRITICAL: Check duplicate BEFORE anything else (atomic)
        with transaction.atomic():
            # Try to get existing log for this employee+date
            existing_log = CompOffCreditLog.objects.filter(
                employee=employee,
                credit_date=day,
            ).first()
            
            if existing_log and not force:
                logger.info(
                    f"⏭️  Already credited on {day} for {employee.employee_id} "
                    f"(existing log: {existing_log.comp_off_days} days)"
                )
                return {
                    'credited': False,
                    'reason': f'Already credited on {day} ({existing_log.comp_off_days} days)',
                    'worked_hours': worked_hours,
                    'comp_off_days': 0,
                    'existing_credit': float(existing_log.comp_off_days),
                }
            
            # 5. Get or create balance
            year = day.year
            balance, created = LeaveBalance.objects.get_or_create(
                employee=employee,
                leave_type=comp_off_type,
                year=year,
                defaults={
                    'allocated': Decimal('0'),
                    'accrued_till_date': Decimal('0'),
                    'adjustment': Decimal('0'),
                }
            )
            
            # 6. If force=True and log exists, we need to REVERSE the old credit first
            if force and existing_log:
                # Subtract old credit before adding new
                old_amount = existing_log.comp_off_days
                balance.adjustment = max(Decimal('0'), balance.adjustment - old_amount)
                existing_log.delete()
                logger.info(f"🔄 Reversed old credit of {old_amount} for {day}")
            
            # 7. Try to create log entry — will fail if duplicate (safety net)
            try:
                CompOffCreditLog.objects.create(
                    employee=employee,
                    credit_date=day,
                    comp_off_days=comp_off_days,
                    worked_hours=Decimal(str(round(worked_hours, 2))),
                    reason=f"{day_reason} — {hours_reason}",
                )
            except IntegrityError:
                # Race condition: another process created it. Skip.
                logger.warning(f"⚠️  Race condition: log already exists for {day}")
                return {
                    'credited': False,
                    'reason': 'Already credited (race condition)',
                    'comp_off_days': 0,
                }
            
            # 8. NOW safely increment balance (log was successful)
            balance.adjustment = (balance.adjustment or Decimal('0')) + comp_off_days
            balance.save(update_fields=['adjustment'])
        
        # 9. Notify employee (outside transaction — safe if fails)
        try:
            _notify_comp_off_credited(employee, day, comp_off_days, day_reason, worked_hours)
        except Exception as exc:
            logger.exception(f"Notification failed: {exc}")
        
        logger.info(
            f"✅ Credited {comp_off_days} comp-off to {employee.employee_id} for {day}"
        )
        
        return {
            'credited': True,
            'reason': f'{day_reason} — {hours_reason}',
            'worked_hours': worked_hours,
            'comp_off_days': float(comp_off_days),
            'new_balance': float(balance.available),
        }

    @staticmethod
    def scan_and_credit_for_period(start_date: date, end_date: date, employee=None):
        """Scan all attendance in date range and credit comp-off."""
        from attendanceapp.models import DailyAttendance
        from HRMSapp.models import Employee
        
        if employee:
            employees = [employee]
        else:
            employees = Employee.objects.filter(
                is_deleted=False,
                status__in=['ACTIVE', 'PROBATION'],
            )
        
        results = {
            'scanned_employees': 0,
            'scanned_days': 0,
            'credited_count': 0,
            'skipped_count': 0,
            'total_days_credited': 0.0,
            'details': [],
            'errors': [],
        }
        
        for emp in employees:
            results['scanned_employees'] += 1
            
            attendances = DailyAttendance.objects.filter(
                attendance_date__gte=start_date,
                attendance_date__lte=end_date,
                employee=emp,
            )
            if not attendances.exists():
                attendances = DailyAttendance.objects.filter(
                    attendance_date__gte=start_date,
                    attendance_date__lte=end_date,
                    employee_code__iexact=emp.employee_id,
                )
            
            for att in attendances:
                results['scanned_days'] += 1
                
                try:
                    result = CompOffService.credit_comp_off_for_day(
                        emp, att, att.attendance_date, force=False
                    )
                    
                    if result['credited']:
                        results['credited_count'] += 1
                        results['total_days_credited'] += result['comp_off_days']
                        results['details'].append({
                            'employee_id': emp.employee_id,
                            'employee_name': emp.full_name,
                            'date': att.attendance_date.isoformat(),
                            'comp_off_days': result['comp_off_days'],
                            'reason': result['reason'],
                        })
                    else:
                        results['skipped_count'] += 1
                
                except Exception as exc:
                    logger.exception(f"Error for {emp.employee_id}: {exc}")
                    results['errors'].append({
                        'employee_id': emp.employee_id,
                        'date': att.attendance_date.isoformat(),
                        'error': str(exc),
                    })
        
        logger.info(
            f"Comp-Off Scan: {results['credited_count']} credited, "
            f"{results['skipped_count']} skipped, "
            f"{results['total_days_credited']} total days"
        )
        return results

    @staticmethod
    def scan_yesterday():
        yesterday = timezone.localdate() - timedelta(days=1)
        return CompOffService.scan_and_credit_for_period(yesterday, yesterday)


def _notify_comp_off_credited(employee, day, comp_off_days, day_reason, worked_hours):
    """Send notification to employee."""
    try:
        from HRMSapp.models import Notification
        Notification.objects.create(
            recipient=employee,
            notification_type='SYSTEM',
            title=f'🎉 Comp-Off Credited: {comp_off_days} day(s)',
            message=(
                f'You worked {worked_hours:.1f} hours on '
                f'{day.strftime("%d %b %Y")} ({day_reason.lower()}). '
                f'{comp_off_days} comp-off day(s) has been credited!'
            ),
            link='/leave',
        )
    except Exception as exc:
        logger.exception(f"Notification failed: {exc}")