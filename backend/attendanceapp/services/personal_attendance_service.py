# """
# Personal attendance service for individual employee views.
# Computes monthly stats, working days, shortage hours, calendar data.
# """

# import calendar
# from datetime import date, timedelta
# from decimal import Decimal
# import logging

# from django.utils import timezone

# from ..models import AutomationSettings, DailyAttendance, RawPunchLog

# logger = logging.getLogger(__name__)


# def _is_weekend(d: date) -> bool:
#     """Saturday=5, Sunday=6"""
#     return d.weekday() >= 5


# def _is_holiday(d: date, holiday_dates: set) -> bool:
#     return d in holiday_dates


# def _get_holidays_for_period(start_date, end_date, employee):
#     """Get holiday dates for employee's location."""
#     try:
#         from leaveapp.models import Holiday
#         from django.db.models import Q

#         qs = Holiday.objects.filter(
#             date__gte=start_date,
#             date__lte=end_date,
#             is_active=True,
#         )
#         if employee.structure_location:
#             qs = qs.filter(
#                 Q(applicable_to_all_locations=True) |
#                 Q(applicable_locations=employee.structure_location)
#             )
#         else:
#             qs = qs.filter(applicable_to_all_locations=True)

#         return set(qs.distinct().values_list('date', flat=True))
#     except Exception:
#         return set()


# def _seconds_to_hhmm(seconds: int) -> str:
#     seconds = max(int(seconds or 0), 0)
#     hours = seconds // 3600
#     minutes = (seconds % 3600) // 60
#     return f"{hours:02d}:{minutes:02d}"


# def _seconds_to_hours_decimal(seconds: int) -> float:
#     return round((seconds or 0) / 3600, 2)


# def _day_status(attendance_row, day, holiday_dates, is_future):
#     """
#     Determine status for a single day.
#     Returns: 'present', 'absent', 'missing_punch', 'weekend', 'holiday', 'future'
#     """
#     if is_future:
#         return 'future'
#     if _is_holiday(day, holiday_dates):
#         return 'holiday'
#     if _is_weekend(day):
#         # Weekend but employee worked?
#         if attendance_row:
#             return 'weekend_present'
#         return 'weekend'
#     if not attendance_row:
#         return 'absent'
#     if attendance_row.missing_punch:
#         return 'missing_punch'
#     return 'present'


# def get_monthly_attendance_for_employee(employee, year: int, month: int):
#     """
#     Get comprehensive monthly attendance data for one employee.
#     Returns full calendar + stats + shortage calculation.
#     """
#     settings_obj = AutomationSettings.get_solo()
#     today = timezone.localdate()

#     # Calculate date range
#     start_date = date(year, month, 1)
#     _, last_day = calendar.monthrange(year, month)
#     end_date = date(year, month, last_day)

#     # Get all attendance records for this employee (matched by employee_id/employee FK)
#     attendance_rows = DailyAttendance.objects.filter(
#         attendance_date__gte=start_date,
#         attendance_date__lte=end_date,
#     ).filter(
#         # Match by FK first, fallback to employee_code
#         # We use OR to catch both linked and unlinked records
#     )

#     # Match by FK (preferred) or by employee_id
#     attendance_rows = attendance_rows.filter(
#         employee=employee,
#     )

#     # Also try matching by employee_code (for records that weren't linked)
#     if not attendance_rows.exists():
#         attendance_rows = DailyAttendance.objects.filter(
#             attendance_date__gte=start_date,
#             attendance_date__lte=end_date,
#             employee_code__iexact=employee.employee_id,
#         )

#     rows_by_date = {row.attendance_date: row for row in attendance_rows}

#     # Get holidays
#     holiday_dates = _get_holidays_for_period(start_date, end_date, employee)

#     # Build daily breakdown
#     days = []
#     total_worked_seconds = 0
#     total_break_seconds = 0
#     present_days = 0
#     absent_days = 0
#     missing_punch_days = 0
#     weekend_worked_days = 0
#     working_days_in_month = 0
#     working_days_elapsed = 0

#     current = start_date
#     while current <= end_date:
#         is_future = current > today
#         row = rows_by_date.get(current)
#         status = _day_status(row, current, holiday_dates, is_future)

#         # Count working days (Mon-Fri, not holiday)
#         is_working_day = not _is_weekend(current) and not _is_holiday(current, holiday_dates)
#         if is_working_day:
#             working_days_in_month += 1
#             if not is_future:
#                 working_days_elapsed += 1

#         # Compute stats
#         worked_seconds = row.net_working_hours_seconds if row else 0
#         break_seconds = row.break_time_seconds if row else 0

#         if status == 'present':
#             present_days += 1
#             total_worked_seconds += worked_seconds
#             total_break_seconds += break_seconds
#         elif status == 'missing_punch':
#             missing_punch_days += 1
#             # Count partial hours
#             total_worked_seconds += worked_seconds
#             total_break_seconds += break_seconds
#         elif status == 'absent':
#             absent_days += 1
#         elif status == 'weekend_present':
#             weekend_worked_days += 1
#             total_worked_seconds += worked_seconds
#             total_break_seconds += break_seconds

#         days.append({
#             'date': current.isoformat(),
#             'day_name': current.strftime('%A'),
#             'day_number': current.day,
#             'status': status,
#             'is_weekend': _is_weekend(current),
#             'is_holiday': _is_holiday(current, holiday_dates),
#             'is_future': is_future,
#             'is_today': current == today,
#             'punch_in': timezone.localtime(row.punch_in).strftime('%H:%M') if row and row.punch_in else None,
#             'punch_out': timezone.localtime(row.punch_out).strftime('%H:%M') if row and row.punch_out else None,
#             'total_punches': row.total_punches if row else 0,
#             'worked_hours': _seconds_to_hhmm(worked_seconds),
#             'worked_hours_decimal': _seconds_to_hours_decimal(worked_seconds),
#             'break_time': _seconds_to_hhmm(break_seconds),
#             'is_late': row.is_late if row else False,
#             'is_early_exit': row.is_early_exit if row else False,
#         })

#         current += timedelta(days=1)

#     # Calculate shortage
#     full_day_hours = float(settings_obj.full_day_min_hours)
#     expected_seconds = working_days_elapsed * full_day_hours * 3600
#     total_worked_hours = _seconds_to_hours_decimal(total_worked_seconds)
#     expected_hours = round(expected_seconds / 3600, 2)
#     shortage_hours = max(0.0, round(expected_hours - total_worked_hours, 2))

#     # Attendance percentage
#     total_marking_days = present_days + absent_days + missing_punch_days
#     attendance_percent = 0.0
#     if working_days_elapsed > 0:
#         # Present + partial (missing punch) count as 1
#         attended = present_days + missing_punch_days
#         attendance_percent = round((attended / working_days_elapsed) * 100, 1)

#     return {
#         'year': year,
#         'month': month,
#         'month_label': date(year, month, 1).strftime('%B %Y'),
#         'start_date': start_date.isoformat(),
#         'end_date': end_date.isoformat(),
#         'employee': {
#             'id': str(employee.id),
#             'employee_id': employee.employee_id,
#             'full_name': employee.full_name,
#             'department': (
#                 employee.structure_location.name
#                 if employee.structure_location else None
#             ),
#             'position': (
#                 employee.position.title if employee.position else None
#             ),
#         },
#         'stats': {
#             'working_days_in_month': working_days_in_month,
#             'working_days_elapsed': working_days_elapsed,
#             'present_days': present_days,
#             'absent_days': absent_days,
#             'missing_punch_days': missing_punch_days,
#             'weekend_worked_days': weekend_worked_days,
#             'total_worked_hours': _seconds_to_hhmm(total_worked_seconds),
#             'total_worked_hours_decimal': total_worked_hours,
#             'total_break_time': _seconds_to_hhmm(total_break_seconds),
#             'expected_hours': expected_hours,
#             'shortage_hours': shortage_hours,
#             'attendance_percent': attendance_percent,
#             'full_day_hours': full_day_hours,
#         },
#         'days': days,
#     }


# def get_day_detail_for_employee(employee, day: date):
#     """
#     Get full punch details for one day for an employee.
#     Includes all raw punches.
#     """
#     attendance = DailyAttendance.objects.filter(
#         employee=employee,
#         attendance_date=day,
#     ).first()

#     if not attendance:
#         attendance = DailyAttendance.objects.filter(
#             attendance_date=day,
#             employee_code__iexact=employee.employee_id,
#         ).first()

#     # Get all raw punches for the day
#     raw_punches = RawPunchLog.objects.filter(
#         punch_date=day,
#     ).filter(
#         # Match by FK or code
#     )

#     # Try both FK and code matching
#     raw_punches = raw_punches.filter(
#         employee_code__iexact=employee.employee_id
#     ).order_by('punch_time')

#     punches = [
#         {
#             'time': timezone.localtime(p.punch_time).strftime('%H:%M:%S'),
#             'raw_line': p.raw_line,
#         }
#         for p in raw_punches
#     ]

#     settings_obj = AutomationSettings.get_solo()

#     return {
#         'date': day.isoformat(),
#         'day_name': day.strftime('%A'),
#         'employee': {
#             'id': str(employee.id),
#             'employee_id': employee.employee_id,
#             'full_name': employee.full_name,
#         },
#         'attendance': {
#             'punch_in': (
#                 timezone.localtime(attendance.punch_in).strftime('%H:%M:%S')
#                 if attendance and attendance.punch_in else None
#             ),
#             'punch_out': (
#                 timezone.localtime(attendance.punch_out).strftime('%H:%M:%S')
#                 if attendance and attendance.punch_out else None
#             ),
#             'total_punches': attendance.total_punches if attendance else 0,
#             'worked_hours': _seconds_to_hhmm(attendance.net_working_hours_seconds if attendance else 0),
#             'break_time': _seconds_to_hhmm(attendance.break_time_seconds if attendance else 0),
#             'gross_hours': _seconds_to_hhmm(attendance.working_hours_seconds if attendance else 0),
#             'is_late': attendance.is_late if attendance else False,
#             'is_early_exit': attendance.is_early_exit if attendance else False,
#             'missing_punch': attendance.missing_punch if attendance else False,
#             'status': attendance.get_status_display() if attendance else 'Absent',
#         },
#         'raw_punches': punches,
#         'expected_hours': float(settings_obj.full_day_min_hours),
#         'shift_in': settings_obj.shift_in_time.strftime('%H:%M'),
#         'shift_out': settings_obj.shift_out_time.strftime('%H:%M'),
#     }


# def get_team_monthly_summary(manager_employee, year: int, month: int):
#     """
#     Get monthly attendance summary for all team members of a manager.
#     Returns list of employees with their monthly stats.
#     """
#     from HRMSapp.models import Employee

#     # Get team
#     team_members = Employee.objects.filter(
#         reporting_manager=manager_employee,
#         is_deleted=False,
#         status__in=['ACTIVE', 'PROBATION'],
#     ).select_related('position', 'structure_location').order_by('employee_id')

#     team_data = []
#     for member in team_members:
#         try:
#             month_data = get_monthly_attendance_for_employee(member, year, month)
#             team_data.append({
#                 'employee': month_data['employee'],
#                 'stats': month_data['stats'],
#             })
#         except Exception as exc:
#             logger.exception(f"Failed to get stats for {member.employee_id}: {exc}")

#     # Team-level aggregate stats
#     total_shortage = sum(m['stats']['shortage_hours'] for m in team_data)
#     avg_attendance = 0.0
#     if team_data:
#         avg_attendance = round(
#             sum(m['stats']['attendance_percent'] for m in team_data) / len(team_data),
#             1
#         )

#     return {
#         'year': year,
#         'month': month,
#         'month_label': date(year, month, 1).strftime('%B %Y'),
#         'manager': {
#             'id': str(manager_employee.id),
#             'employee_id': manager_employee.employee_id,
#             'full_name': manager_employee.full_name,
#         },
#         'team_size': len(team_data),
#         'team_total_shortage': round(total_shortage, 2),
#         'team_avg_attendance': avg_attendance,
#         'members': team_data,
#     }

# def get_all_employees_monthly_summary(year: int, month: int, filters: dict = None):
#     """
#     Get monthly attendance summary for ALL employees (HR view).
#     Optional filters: department_id, search query.
#     """
#     from HRMSapp.models import Employee

#     filters = filters or {}

#     qs = Employee.objects.filter(
#         is_deleted=False,
#         status__in=['ACTIVE', 'PROBATION'],
#     ).select_related('position', 'structure_location', 'reporting_manager')

#     # Optional department filter
#     dept_id = filters.get('department_id')
#     if dept_id:
#         qs = qs.filter(structure_location_id=dept_id)

#     # Optional search filter
#     search = (filters.get('search') or '').strip()
#     if search:
#         from django.db.models import Q
#         qs = qs.filter(
#             Q(employee_id__icontains=search) |
#             Q(first_name__icontains=search) |
#             Q(last_name__icontains=search)
#         )

#     qs = qs.order_by('employee_id')

#     employees_data = []
#     for emp in qs:
#         try:
#             month_data = get_monthly_attendance_for_employee(emp, year, month)
#             employees_data.append({
#                 'employee': month_data['employee'],
#                 'manager_name': (
#                     emp.reporting_manager.full_name
#                     if emp.reporting_manager else None
#                 ),
#                 'stats': month_data['stats'],
#             })
#         except Exception as exc:
#             logger.exception(f"Failed for {emp.employee_id}: {exc}")

#     # Company-wide stats
#     total_shortage = sum(m['stats']['shortage_hours'] for m in employees_data)
#     avg_attendance = 0.0
#     if employees_data:
#         avg_attendance = round(
#             sum(m['stats']['attendance_percent'] for m in employees_data)
#             / len(employees_data),
#             1,
#         )

#     # Group by department for breakdown
#     from collections import defaultdict
#     dept_stats = defaultdict(lambda: {'count': 0, 'shortage': 0, 'attendance_sum': 0})
#     for m in employees_data:
#         dept_name = m['employee']['department'] or 'Unassigned'
#         dept_stats[dept_name]['count'] += 1
#         dept_stats[dept_name]['shortage'] += m['stats']['shortage_hours']
#         dept_stats[dept_name]['attendance_sum'] += m['stats']['attendance_percent']

#     departments = [
#         {
#             'name': name,
#             'employee_count': data['count'],
#             'total_shortage': round(data['shortage'], 2),
#             'avg_attendance': round(data['attendance_sum'] / data['count'], 1) if data['count'] else 0,
#         }
#         for name, data in dept_stats.items()
#     ]
#     departments.sort(key=lambda x: x['name'])

#     from datetime import date
#     return {
#         'year': year,
#         'month': month,
#         'month_label': date(year, month, 1).strftime('%B %Y'),
#         'total_employees': len(employees_data),
#         'total_shortage': round(total_shortage, 2),
#         'avg_attendance': avg_attendance,
#         'departments': departments,
#         'employees': employees_data,
#     }

# =======================================================================================================================
# """
# Personal attendance service — integrated with Leave Module.
# """

# import calendar
# from datetime import date, timedelta
# from decimal import Decimal
# import logging

# from django.utils import timezone

# from ..models import AutomationSettings, DailyAttendance, RawPunchLog

# logger = logging.getLogger(__name__)


# def _is_weekend(d: date) -> bool:
#     return d.weekday() >= 5


# def _is_holiday(d: date, holiday_dates: set) -> bool:
#     return d in holiday_dates


# def _get_holidays_for_period(start_date, end_date, employee):
#     """Get holiday dates — uses location field (falls back to structure_location)."""
#     try:
#         from leaveapp.models import Holiday
#         from django.db.models import Q

#         qs = Holiday.objects.filter(
#             date__gte=start_date,
#             date__lte=end_date,
#             is_active=True,
#         )
        
#         # Use location field first, fallback to structure_location
#         emp_location = employee.location or employee.structure_location
        
#         if emp_location and emp_location.type in ('LOCATION', 'HQ', 'COMPANY'):
#             qs = qs.filter(
#                 Q(applicable_to_all_locations=True) |
#                 Q(applicable_locations=emp_location)
#             )
#         else:
#             qs = qs.filter(applicable_to_all_locations=True)

#         return set(qs.distinct().values_list('date', flat=True))
#     except Exception:
#         return set()


# def _get_leaves_for_period(start_date, end_date, employee):
#     """
#     Get APPROVED leaves for employee in the period.
#     Returns dict: { date: {'leave_type_code': 'CL', 'leave_type_name': 'Casual Leave',
#                             'is_half_day': True/False, 'half_day_period': 'AM'/'PM'} }
#     """
#     leaves_by_date = {}
#     try:
#         from leaveapp.models import LeaveApplication

#         # Get approved leaves that overlap with the period
#         leaves = LeaveApplication.objects.filter(
#             employee=employee,
#             status='APPROVED',
#             start_date__lte=end_date,
#             end_date__gte=start_date,
#         ).select_related('leave_type')

#         for leave in leaves:
#             # Expand leave range into individual dates
#             leave_start = max(leave.start_date, start_date)
#             leave_end = min(leave.end_date, end_date)

#             current = leave_start
#             while current <= leave_end:
#                 leaves_by_date[current] = {
#                     'leave_type_code': leave.leave_type.code,
#                     'leave_type_name': leave.leave_type.name,
#                     'leave_type_color': leave.leave_type.color_code,
#                     'is_half_day': leave.is_half_day,
#                     'half_day_period': leave.half_day_period,
#                     'application_number': leave.application_number,
#                     'is_paid': leave.leave_type.is_paid,
#                     'is_lop': leave.is_lop,
#                 }
#                 current += timedelta(days=1)

#     except Exception as exc:
#         logger.exception(f"Failed to load leaves: {exc}")

#     return leaves_by_date


# def _seconds_to_hhmm(seconds: int) -> str:
#     seconds = max(int(seconds or 0), 0)
#     hours = seconds // 3600
#     minutes = (seconds % 3600) // 60
#     return f"{hours:02d}:{minutes:02d}"


# def _seconds_to_hours_decimal(seconds: int) -> float:
#     return round((seconds or 0) / 3600, 2)


# def _day_status(attendance_row, day, holiday_dates, leaves_by_date, is_future, today):
#     """
#     Determine status for a single day.
    
#     Priority logic (NEW):
#     1. Future date → 'future' (or 'will_be_on_leave' if leave approved)
#     2. Holiday → 'holiday'
#     3. Weekend → 'weekend' or 'weekend_present'
#     4. Leave approved:
#        ├─ If employee punched in → 'present' (they showed up!)
#        └─ If no punch → 'on_leave' (actually took leave)
#     5. No leave, no punch → 'absent'
#     6. Missing punch → 'missing_punch'
#     7. Punched in properly → 'present'
#     """
#     leave_info = leaves_by_date.get(day)
#     has_punch = attendance_row and (attendance_row.punch_in or attendance_row.punch_out)
#     has_full_attendance = attendance_row and attendance_row.punch_in and attendance_row.punch_out
    
#     # 1. FUTURE DATE
#     if is_future:
#         # If leave is approved for a future date, show "will be on leave"
#         if leave_info:
#             if leave_info['is_half_day']:
#                 return 'will_be_on_half_leave'
#             return 'will_be_on_leave'
#         return 'future'
    
#     # 2. HOLIDAY
#     if _is_holiday(day, holiday_dates):
#         return 'holiday'
    
#     # 3. WEEKEND
#     if _is_weekend(day):
#         if has_punch:
#             return 'weekend_present'
#         return 'weekend'
    
#     # 4. LEAVE APPROVED — Cross-check with actual attendance
#     if leave_info:
#         if leave_info['is_half_day']:
#             # Half-day leave: check if they came for the other half
#             if has_punch:
#                 return 'half_leave_present'  # Half leave + came for other half
#             return 'on_half_leave'  # Took half leave, no attendance
#         else:
#             # Full-day leave: check if they came at all
#             if has_full_attendance:
#                 # 🎯 Employee CAME even though on leave — mark as present
#                 return 'leave_but_present'
#             elif has_punch:
#                 # Partial punch on leave day
#                 return 'leave_but_partial'
#             else:
#                 # Actually took the leave
#                 return 'on_leave'
    
#     # 5-7. Regular attendance logic (no leave)
#     if not attendance_row:
#         return 'absent'
#     if attendance_row.missing_punch:
#         return 'missing_punch'
#     return 'present'


# def get_monthly_attendance_for_employee(employee, year: int, month: int):
#     """
#     Get comprehensive monthly attendance data — INTEGRATED WITH LEAVES.
#     """
#     settings_obj = AutomationSettings.get_solo()
#     today = timezone.localdate()

#     # Date range
#     start_date = date(year, month, 1)
#     _, last_day = calendar.monthrange(year, month)
#     end_date = date(year, month, last_day)

#     # Get attendance records
#     attendance_rows = DailyAttendance.objects.filter(
#         attendance_date__gte=start_date,
#         attendance_date__lte=end_date,
#         employee=employee,
#     )

#     # Also try by employee_code (for unlinked records)
#     if not attendance_rows.exists():
#         attendance_rows = DailyAttendance.objects.filter(
#             attendance_date__gte=start_date,
#             attendance_date__lte=end_date,
#             employee_code__iexact=employee.employee_id,
#         )

#     rows_by_date = {row.attendance_date: row for row in attendance_rows}

#     # Get holidays
#     holiday_dates = _get_holidays_for_period(start_date, end_date, employee)

#     # 🔥 NEW: Get approved leaves
#     leaves_by_date = _get_leaves_for_period(start_date, end_date, employee)

#     # Build daily breakdown
#     days = []
#     total_worked_seconds = 0
#     total_break_seconds = 0
#     present_days = 0
#     absent_days = 0
#     missing_punch_days = 0
#     weekend_worked_days = 0
#     on_leave_days = 0                # 🔥 NEW
#     on_half_leave_days = 0           # 🔥 NEW
#     lop_days = 0                     # 🔥 NEW (loss-of-pay leaves)
#     working_days_in_month = 0
#     working_days_elapsed = 0

#     current = start_date
#     while current <= end_date:
#         is_future = current > today
#         row = rows_by_date.get(current)
#         leave_info = leaves_by_date.get(current)
#         status = _day_status(row, current, holiday_dates, leaves_by_date, is_future, today)

#         # Count working days
#         is_working_day = not _is_weekend(current) and not _is_holiday(current, holiday_dates)
#         if is_working_day:
#             working_days_in_month += 1
#             if not is_future:
#                 working_days_elapsed += 1

#         # Compute stats
#         worked_seconds = row.net_working_hours_seconds if row else 0
#         break_seconds = row.break_time_seconds if row else 0

#         if status == 'present':
#             present_days += 1
#             total_worked_seconds += worked_seconds
#             total_break_seconds += break_seconds

#         elif status == 'missing_punch':
#             missing_punch_days += 1
#             total_worked_seconds += worked_seconds
#             total_break_seconds += break_seconds

#         elif status == 'absent':
#             absent_days += 1

#         elif status == 'weekend_present':
#             weekend_worked_days += 1
#             total_worked_seconds += worked_seconds
#             total_break_seconds += break_seconds

#         #  NEW STATUSES
#         elif status == 'on_leave':
#             on_leave_days += 1
#             if leave_info and leave_info.get('is_lop'):
#                 lop_days += 1

#         elif status == 'will_be_on_leave':
#             # Don't count in any stats — future planned leave
#             pass

#         elif status == 'on_half_leave':
#             on_half_leave_days += 1
#             if row and worked_seconds > 0:
#                 total_worked_seconds += worked_seconds
#                 total_break_seconds += break_seconds

#         elif status == 'will_be_on_half_leave':
#             pass

#         #  NEW: Employee came despite being on leave
#         elif status == 'leave_but_present':
#             # Count as PRESENT (they showed up!)
#             present_days += 1
#             total_worked_seconds += worked_seconds
#             total_break_seconds += break_seconds
#             # Note: They still used a leave day from balance,
#             # but attendance-wise they were present

#         elif status == 'leave_but_partial':
#             # Partial attendance on leave day
#             present_days += 1  # or missing_punch_days, your call
#             total_worked_seconds += worked_seconds
#             total_break_seconds += break_seconds

#         elif status == 'half_leave_present':
#             # Half leave + came for other half
#             present_days += 1  # Count as present for the working half
#             total_worked_seconds += worked_seconds
#             total_break_seconds += break_seconds

#         days.append({
#             'date': current.isoformat(),
#             'day_name': current.strftime('%A'),
#             'day_number': current.day,
#             'status': status,
#             'is_weekend': _is_weekend(current),
#             'is_holiday': _is_holiday(current, holiday_dates),
#             'is_future': is_future,
#             'is_today': current == today,
#             'punch_in': timezone.localtime(row.punch_in).strftime('%H:%M') if row and row.punch_in else None,
#             'punch_out': timezone.localtime(row.punch_out).strftime('%H:%M') if row and row.punch_out else None,
#             'total_punches': row.total_punches if row else 0,
#             'worked_hours': _seconds_to_hhmm(worked_seconds),
#             'worked_hours_decimal': _seconds_to_hours_decimal(worked_seconds),
#             'break_time': _seconds_to_hhmm(break_seconds),
#             'is_late': row.is_late if row else False,
#             'is_early_exit': row.is_early_exit if row else False,
#             #  NEW: Leave info
#             'leave_info': leave_info,
#         })

#         current += timedelta(days=1)

#     #  UPDATED: Shortage calculation — exclude leave days from expected
#     full_day_hours = float(settings_obj.full_day_min_hours)

#     # Working days minus leave days
#     effective_working_days = working_days_elapsed - on_leave_days - (on_half_leave_days * 0.5)
#     effective_working_days = max(0, effective_working_days)

#     expected_seconds = effective_working_days * full_day_hours * 3600
#     total_worked_hours = _seconds_to_hours_decimal(total_worked_seconds)
#     expected_hours = round(expected_seconds / 3600, 2)
#     shortage_hours = max(0.0, round(expected_hours - total_worked_hours, 2))

#     # Full month expected (for reference)
#     total_leave_in_month = sum(
#         1 for d in days
#         if d['status'] in ('on_leave', 'on_half_leave') and not d['is_future']
#     )
#     full_month_working_days = working_days_in_month
#     expected_hours_full_month = round(
#         max(0, full_month_working_days - on_leave_days - (on_half_leave_days * 0.5)) * full_day_hours,
#         2
#     )

#     # Attendance %
#     attendance_percent = 0.0
#     if effective_working_days > 0:
#         # Present + partial (missing punch) count as attended
#         attended = present_days + missing_punch_days + on_half_leave_days
#         attendance_percent = round((attended / effective_working_days) * 100, 1)
#     elif on_leave_days > 0 and effective_working_days == 0:
#         # All days on leave = 100%
#         attendance_percent = 100.0

#     return {
#         'year': year,
#         'month': month,
#         'month_label': date(year, month, 1).strftime('%B %Y'),
#         'start_date': start_date.isoformat(),
#         'end_date': end_date.isoformat(),
#         'employee': {
#             'id': str(employee.id),
#             'employee_id': employee.employee_id,
#             'full_name': employee.full_name,
#             'department': (
#                 employee.department.name if employee.department
#                 else employee.structure_location.name if employee.structure_location
#                 else None
#             ),
#             'location': (
#                 employee.location.name if employee.location
#                 else None
#             ),
#             'position': (
#                 employee.position.title if employee.position else None
#             ),
#         },
#         'stats': {
#             'working_days_in_month': working_days_in_month,
#             'working_days_elapsed': working_days_elapsed,
#             'effective_working_days': effective_working_days,  # 🔥 NEW
#             'present_days': present_days,
#             'absent_days': absent_days,
#             'missing_punch_days': missing_punch_days,
#             'weekend_worked_days': weekend_worked_days,
#             'on_leave_days': on_leave_days,                    # 🔥 NEW
#             'on_half_leave_days': on_half_leave_days,          # 🔥 NEW
#             'lop_days': lop_days,                              # 🔥 NEW
#             'total_worked_hours': _seconds_to_hhmm(total_worked_seconds),
#             'total_worked_hours_decimal': total_worked_hours,
#             'total_break_time': _seconds_to_hhmm(total_break_seconds),
#             'expected_hours': expected_hours,
#             'expected_hours_full_month': expected_hours_full_month,  # 🔥 NEW
#             'shortage_hours': shortage_hours,
#             'attendance_percent': attendance_percent,
#             'full_day_hours': full_day_hours,
#         },
#         'days': days,
#     }


# # ==========================================================================
# # The rest (get_day_detail_for_employee, get_team_monthly_summary,
# # get_all_employees_monthly_summary) — keep as they are.
# # They automatically benefit from the new logic since they call
# # get_monthly_attendance_for_employee().
# # ==========================================================================


# def get_day_detail_for_employee(employee, day: date):
#     """Get full punch details + leave info for one day."""
#     attendance = DailyAttendance.objects.filter(
#         employee=employee,
#         attendance_date=day,
#     ).first()

#     if not attendance:
#         attendance = DailyAttendance.objects.filter(
#             attendance_date=day,
#             employee_code__iexact=employee.employee_id,
#         ).first()

#     raw_punches = RawPunchLog.objects.filter(
#         punch_date=day,
#         employee_code__iexact=employee.employee_id,
#     ).order_by('punch_time')

#     punches = [
#         {
#             'time': timezone.localtime(p.punch_time).strftime('%H:%M:%S'),
#             'raw_line': p.raw_line,
#         }
#         for p in raw_punches
#     ]

#     settings_obj = AutomationSettings.get_solo()

#     # 🔥 NEW: Check for leave on this day
#     leaves_by_date = _get_leaves_for_period(day, day, employee)
#     leave_info = leaves_by_date.get(day)

#     return {
#         'date': day.isoformat(),
#         'day_name': day.strftime('%A'),
#         'employee': {
#             'id': str(employee.id),
#             'employee_id': employee.employee_id,
#             'full_name': employee.full_name,
#         },
#         'leave_info': leave_info,  # 🔥 NEW
#         'attendance': {
#             'punch_in': (
#                 timezone.localtime(attendance.punch_in).strftime('%H:%M:%S')
#                 if attendance and attendance.punch_in else None
#             ),
#             'punch_out': (
#                 timezone.localtime(attendance.punch_out).strftime('%H:%M:%S')
#                 if attendance and attendance.punch_out else None
#             ),
#             'total_punches': attendance.total_punches if attendance else 0,
#             'worked_hours': _seconds_to_hhmm(attendance.net_working_hours_seconds if attendance else 0),
#             'break_time': _seconds_to_hhmm(attendance.break_time_seconds if attendance else 0),
#             'gross_hours': _seconds_to_hhmm(attendance.working_hours_seconds if attendance else 0),
#             'is_late': attendance.is_late if attendance else False,
#             'is_early_exit': attendance.is_early_exit if attendance else False,
#             'missing_punch': attendance.missing_punch if attendance else False,
#             'status': attendance.get_status_display() if attendance else 'Absent',
#         },
#         'raw_punches': punches,
#         'expected_hours': float(settings_obj.full_day_min_hours),
#         'shift_in': settings_obj.shift_in_time.strftime('%H:%M'),
#         'shift_out': settings_obj.shift_out_time.strftime('%H:%M'),
#     }


# def get_team_monthly_summary(manager_employee, year: int, month: int):
#     """Monthly summary for team members."""
#     from HRMSapp.models import Employee

#     team_members = Employee.objects.filter(
#         reporting_manager=manager_employee,
#         is_deleted=False,
#         status__in=['ACTIVE', 'PROBATION'],
#     ).select_related('position', 'structure_location').order_by('employee_id')

#     team_data = []
#     for member in team_members:
#         try:
#             month_data = get_monthly_attendance_for_employee(member, year, month)
#             team_data.append({
#                 'employee': month_data['employee'],
#                 'stats': month_data['stats'],
#             })
#         except Exception as exc:
#             logger.exception(f"Failed for {member.employee_id}: {exc}")

#     total_shortage = sum(m['stats']['shortage_hours'] for m in team_data)
#     total_on_leave = sum(m['stats']['on_leave_days'] for m in team_data)  # 🔥 NEW
#     avg_attendance = 0.0
#     if team_data:
#         avg_attendance = round(
#             sum(m['stats']['attendance_percent'] for m in team_data) / len(team_data),
#             1
#         )

#     return {
#         'year': year,
#         'month': month,
#         'month_label': date(year, month, 1).strftime('%B %Y'),
#         'manager': {
#             'id': str(manager_employee.id),
#             'employee_id': manager_employee.employee_id,
#             'full_name': manager_employee.full_name,
#         },
#         'team_size': len(team_data),
#         'team_total_shortage': round(total_shortage, 2),
#         'team_total_on_leave': total_on_leave,  # 🔥 NEW
#         'team_avg_attendance': avg_attendance,
#         'members': team_data,
#     }


# def get_all_employees_monthly_summary(year: int, month: int, filters: dict = None):
#     """HR view: All employees' monthly attendance."""
#     from HRMSapp.models import Employee

#     filters = filters or {}
#     qs = Employee.objects.filter(
#         is_deleted=False,
#         status__in=['ACTIVE', 'PROBATION'],
#     ).select_related('position', 'structure_location', 'reporting_manager')

#     dept_id = filters.get('department_id')
#     if dept_id:
#         qs = qs.filter(structure_location_id=dept_id)

#     search = (filters.get('search') or '').strip()
#     if search:
#         from django.db.models import Q
#         qs = qs.filter(
#             Q(employee_id__icontains=search) |
#             Q(first_name__icontains=search) |
#             Q(last_name__icontains=search)
#         )

#     qs = qs.order_by('employee_id')

#     employees_data = []
#     for emp in qs:
#         try:
#             month_data = get_monthly_attendance_for_employee(emp, year, month)
#             employees_data.append({
#                 'employee': month_data['employee'],
#                 'manager_name': (
#                     emp.reporting_manager.full_name
#                     if emp.reporting_manager else None
#                 ),
#                 'stats': month_data['stats'],
#             })
#         except Exception as exc:
#             logger.exception(f"Failed for {emp.employee_id}: {exc}")

#     total_shortage = sum(m['stats']['shortage_hours'] for m in employees_data)
#     total_on_leave = sum(m['stats']['on_leave_days'] for m in employees_data)  # 🔥 NEW
#     avg_attendance = 0.0
#     if employees_data:
#         avg_attendance = round(
#             sum(m['stats']['attendance_percent'] for m in employees_data)
#             / len(employees_data),
#             1,
#         )

#     from collections import defaultdict
#     dept_stats = defaultdict(lambda: {'count': 0, 'shortage': 0, 'attendance_sum': 0, 'on_leave': 0})
#     for m in employees_data:
#         dept_name = m['employee']['department'] or 'Unassigned'
#         dept_stats[dept_name]['count'] += 1
#         dept_stats[dept_name]['shortage'] += m['stats']['shortage_hours']
#         dept_stats[dept_name]['attendance_sum'] += m['stats']['attendance_percent']
#         dept_stats[dept_name]['on_leave'] += m['stats']['on_leave_days']

#     departments = [
#         {
#             'name': name,
#             'employee_count': data['count'],
#             'total_shortage': round(data['shortage'], 2),
#             'total_on_leave': data['on_leave'],  # 🔥 NEW
#             'avg_attendance': round(data['attendance_sum'] / data['count'], 1) if data['count'] else 0,
#         }
#         for name, data in dept_stats.items()
#     ]
#     departments.sort(key=lambda x: x['name'])

#     return {
#         'year': year,
#         'month': month,
#         'month_label': date(year, month, 1).strftime('%B %Y'),
#         'total_employees': len(employees_data),
#         'total_shortage': round(total_shortage, 2),
#         'total_on_leave': total_on_leave,  # 🔥 NEW
#         'avg_attendance': avg_attendance,
#         'departments': departments,
#         'employees': employees_data,
#     }



"""
Personal attendance service — integrated with Leave Module & Live eSSL.
Ensures live eSSL / RawPunchLog data appears on My/Team/All attendance
without requiring daily automation.
"""

import calendar
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import logging

from django.utils import timezone

from ..models import AutomationSettings, DailyAttendance, RawPunchLog, normalize_employee_code

logger = logging.getLogger(__name__)


# ==============================================================================
# HELPER UTILITIES
# ==============================================================================

def _is_weekend(d: date) -> bool:
    return d.weekday() >= 5


def _is_holiday(d: date, holiday_dates: set) -> bool:
    return d in holiday_dates


def _get_holidays_for_period(start_date, end_date, employee):
    """Get holiday dates — uses location field (falls back to structure_location)."""
    try:
        from leaveapp.models import Holiday
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


def _get_leaves_for_period(start_date, end_date, employee):
    """
    Get APPROVED leaves for employee in the period.
    """
    leaves_by_date = {}
    try:
        from leaveapp.models import LeaveApplication

        leaves = LeaveApplication.objects.filter(
            employee=employee,
            status='APPROVED',
            start_date__lte=end_date,
            end_date__gte=start_date,
        ).select_related('leave_type')

        for leave in leaves:
            leave_start = max(leave.start_date, start_date)
            leave_end = min(leave.end_date, end_date)

            current = leave_start
            while current <= leave_end:
                leaves_by_date[current] = {
                    'leave_type_code': leave.leave_type.code,
                    'leave_type_name': leave.leave_type.name,
                    'leave_type_color': leave.leave_type.color_code,
                    'is_half_day': leave.is_half_day,
                    'half_day_period': leave.half_day_period,
                    'application_number': leave.application_number,
                    'is_paid': leave.leave_type.is_paid,
                    'is_lop': leave.is_lop,
                }
                current += timedelta(days=1)

    except Exception as exc:
        logger.exception(f"Failed to load leaves: {exc}")

    return leaves_by_date


def _seconds_to_hhmm(seconds: int) -> str:
    seconds = max(int(seconds or 0), 0)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    return f"{hours:02d}:{minutes:02d}"


def _seconds_to_hours_decimal(seconds: int) -> float:
    return round((seconds or 0) / 3600, 2)


def _day_status(attendance_row, day, holiday_dates, leaves_by_date, is_future, today):
    """
    Determine status for a single day.
    """
    leave_info = leaves_by_date.get(day)
    has_punch = attendance_row and (attendance_row.punch_in or attendance_row.punch_out)
    has_full_attendance = attendance_row and attendance_row.punch_in and attendance_row.punch_out
    
    # 1. FUTURE DATE
    if is_future:
        if leave_info:
            if leave_info['is_half_day']:
                return 'will_be_on_half_leave'
            return 'will_be_on_leave'
        return 'future'
    
    # 2. HOLIDAY
    if _is_holiday(day, holiday_dates):
        return 'holiday'
    
    # 3. WEEKEND
    if _is_weekend(day):
        if has_punch:
            return 'weekend_present'
        return 'weekend'
    
    # 4. LEAVE APPROVED
    if leave_info:
        if leave_info['is_half_day']:
            if has_punch:
                return 'half_leave_present'
            return 'on_half_leave'
        else:
            if has_full_attendance:
                return 'leave_but_present'
            elif has_punch:
                return 'leave_but_partial'
            else:
                return 'on_leave'
    
    # 5-7. Regular attendance logic
    if not attendance_row:
        return 'absent'
    if attendance_row.missing_punch:
        return 'missing_punch'
    return 'present'


# ==============================================================================
# ON-DEMAND ATTENDANCE SYNC & PROCESSING (NO DAILY AUTOMATION NEEDED)
# ==============================================================================

def _ensure_attendance_processed_for_period(start_date: date, end_date: date, employee=None):
    """
    Syncs live punches from eSSL device into RawPunchLog, then processes
    RawPunchLog -> DailyAttendance for [start_date, end_date].
    
    Ensures pages load live attendance even if daily automation is disabled.
    """
    today = timezone.localdate()
    effective_end = min(end_date, today)
    if start_date > effective_end:
        return

    settings_obj = AutomationSettings.get_solo()

    # 1) Sync from eSSL (best effort — if device is down, uses cached DB punches)
    try:
        from .essl_service import (
            call_essl_api_for_range,
            extract_str_data_list,
            parse_punch_logs,
        )
        from .attendance_processor import persist_raw_logs

        xml_text = call_essl_api_for_range(
            settings_obj,
            datetime.combine(start_date, time.min),
            datetime.combine(effective_end, time(23, 59, 59)),
        )
        _, str_data = extract_str_data_list(xml_text)
        logs = parse_punch_logs(str_data or "")

        if logs and employee is not None:
            target = normalize_employee_code(employee.employee_id)
            logs = [
                log for log in logs
                if normalize_employee_code(log.get("employee_code")) == target
            ]

        if logs:
            persist_raw_logs(logs)
    except Exception as exc:
        logger.warning(
            "eSSL sync skipped for personal attendance (%s to %s): %s",
            start_date, effective_end, exc,
        )

    # 2) Build DailyAttendance rows from RawPunchLog
    from .attendance_processor import process_attendance_period

    raw_qs = RawPunchLog.objects.filter(
        punch_date__gte=start_date,
        punch_date__lte=effective_end,
    )
    if employee is not None:
        raw_qs = raw_qs.filter(
            employee_code__iexact=employee.employee_id
        ) | raw_qs.filter(employee=employee)

    raw_rows = list(raw_qs.values("employee_code", "punch_time", "raw_line"))
    if not raw_rows:
        return

    logs = [
        {
            "employee_code": row["employee_code"],
            "punch_time": row["punch_time"],
            "raw_line": row.get("raw_line") or "",
        }
        for row in raw_rows
    ]

    process_attendance_period(logs, settings_obj, start_date, effective_end)


def _ensure_month_attendance_for_all(year: int, month: int):
    """
    Runs ONE bulk eSSL sync + attendance processing pass for the whole company
    for the requested month. Called by Team & All Employees views.
    """
    start_date = date(year, month, 1)
    _, last_day = calendar.monthrange(year, month)
    end_date = date(year, month, last_day)

    _ensure_attendance_processed_for_period(start_date, end_date, employee=None)


# ==============================================================================
# PERSONAL ATTENDANCE PUBLIC SERVICES
# ==============================================================================

def get_monthly_attendance_for_employee(employee, year: int, month: int, ensure_sync: bool = True):
    """
    Get comprehensive monthly attendance data — INTEGRATED WITH LEAVES.
    
    ensure_sync=True  -> syncs eSSL & updates DailyAttendance (for single employee view)
    ensure_sync=False -> skips sync because bulk sync was already done (for Team/All view)
    """
    settings_obj = AutomationSettings.get_solo()
    today = timezone.localdate()

    # Date range
    start_date = date(year, month, 1)
    _, last_day = calendar.monthrange(year, month)
    end_date = date(year, month, last_day)

    # Process live attendance on-demand if enabled
    if ensure_sync:
        _ensure_attendance_processed_for_period(start_date, end_date, employee=employee)

    # Get attendance records
    attendance_rows = DailyAttendance.objects.filter(
        attendance_date__gte=start_date,
        attendance_date__lte=end_date,
        employee=employee,
    )

    # Also try by employee_code (for unlinked records)
    if not attendance_rows.exists():
        attendance_rows = DailyAttendance.objects.filter(
            attendance_date__gte=start_date,
            attendance_date__lte=end_date,
            employee_code__iexact=employee.employee_id,
        )

    rows_by_date = {row.attendance_date: row for row in attendance_rows}

    # Get holidays & approved leaves
    holiday_dates = _get_holidays_for_period(start_date, end_date, employee)
    leaves_by_date = _get_leaves_for_period(start_date, end_date, employee)

    # Build daily breakdown
    days = []
    total_worked_seconds = 0
    total_break_seconds = 0
    present_days = 0
    absent_days = 0
    missing_punch_days = 0
    weekend_worked_days = 0
    on_leave_days = 0
    on_half_leave_days = 0
    lop_days = 0
    working_days_in_month = 0
    working_days_elapsed = 0

    current = start_date
    while current <= end_date:
        is_future = current > today
        row = rows_by_date.get(current)
        leave_info = leaves_by_date.get(current)
        status = _day_status(row, current, holiday_dates, leaves_by_date, is_future, today)

        is_working_day = not _is_weekend(current) and not _is_holiday(current, holiday_dates)
        if is_working_day:
            working_days_in_month += 1
            if not is_future:
                working_days_elapsed += 1

        worked_seconds = row.net_working_hours_seconds if row else 0
        break_seconds = row.break_time_seconds if row else 0

        if status == 'present':
            present_days += 1
            total_worked_seconds += worked_seconds
            total_break_seconds += break_seconds

        elif status == 'missing_punch':
            missing_punch_days += 1
            total_worked_seconds += worked_seconds
            total_break_seconds += break_seconds

        elif status == 'absent':
            absent_days += 1

        elif status == 'weekend_present':
            weekend_worked_days += 1
            total_worked_seconds += worked_seconds
            total_break_seconds += break_seconds

        elif status == 'on_leave':
            on_leave_days += 1
            if leave_info and leave_info.get('is_lop'):
                lop_days += 1

        elif status == 'will_be_on_leave':
            pass

        elif status == 'on_half_leave':
            on_half_leave_days += 1
            if row and worked_seconds > 0:
                total_worked_seconds += worked_seconds
                total_break_seconds += break_seconds

        elif status == 'will_be_on_half_leave':
            pass

        elif status == 'leave_but_present':
            present_days += 1
            total_worked_seconds += worked_seconds
            total_break_seconds += break_seconds

        elif status == 'leave_but_partial':
            present_days += 1
            total_worked_seconds += worked_seconds
            total_break_seconds += break_seconds

        elif status == 'half_leave_present':
            present_days += 1
            total_worked_seconds += worked_seconds
            total_break_seconds += break_seconds

        days.append({
            'date': current.isoformat(),
            'day_name': current.strftime('%A'),
            'day_number': current.day,
            'status': status,
            'is_weekend': _is_weekend(current),
            'is_holiday': _is_holiday(current, holiday_dates),
            'is_future': is_future,
            'is_today': current == today,
            'punch_in': timezone.localtime(row.punch_in).strftime('%H:%M') if row and row.punch_in else None,
            'punch_out': timezone.localtime(row.punch_out).strftime('%H:%M') if row and row.punch_out else None,
            'total_punches': row.total_punches if row else 0,
            'worked_hours': _seconds_to_hhmm(worked_seconds),
            'worked_hours_decimal': _seconds_to_hours_decimal(worked_seconds),
            'break_time': _seconds_to_hhmm(break_seconds),
            'is_late': row.is_late if row else False,
            'is_early_exit': row.is_early_exit if row else False,
            'leave_info': leave_info,
        })

        current += timedelta(days=1)

    full_day_hours = float(settings_obj.full_day_min_hours)

    effective_working_days = working_days_elapsed - on_leave_days - (on_half_leave_days * 0.5)
    effective_working_days = max(0, effective_working_days)

    expected_seconds = effective_working_days * full_day_hours * 3600
    total_worked_hours = _seconds_to_hours_decimal(total_worked_seconds)
    expected_hours = round(expected_seconds / 3600, 2)
    shortage_hours = max(0.0, round(expected_hours - total_worked_hours, 2))

    full_month_working_days = working_days_in_month
    expected_hours_full_month = round(
        max(0, full_month_working_days - on_leave_days - (on_half_leave_days * 0.5)) * full_day_hours,
        2
    )

    attendance_percent = 0.0
    if effective_working_days > 0:
        attended = present_days + missing_punch_days + on_half_leave_days
        attendance_percent = round((attended / effective_working_days) * 100, 1)
    elif on_leave_days > 0 and effective_working_days == 0:
        attendance_percent = 100.0

    return {
        'year': year,
        'month': month,
        'month_label': date(year, month, 1).strftime('%B %Y'),
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'employee': {
            'id': str(employee.id),
            'employee_id': employee.employee_id,
            'full_name': employee.full_name,
            'department': (
                employee.department.name if employee.department
                else employee.structure_location.name if employee.structure_location
                else None
            ),
            'location': (
                employee.location.name if employee.location
                else None
            ),
            'position': (
                employee.position.title if employee.position else None
            ),
        },
        'stats': {
            'working_days_in_month': working_days_in_month,
            'working_days_elapsed': working_days_elapsed,
            'effective_working_days': effective_working_days,
            'present_days': present_days,
            'absent_days': absent_days,
            'missing_punch_days': missing_punch_days,
            'weekend_worked_days': weekend_worked_days,
            'on_leave_days': on_leave_days,
            'on_half_leave_days': on_half_leave_days,
            'lop_days': lop_days,
            'total_worked_hours': _seconds_to_hhmm(total_worked_seconds),
            'total_worked_hours_decimal': total_worked_hours,
            'total_break_time': _seconds_to_hhmm(total_break_seconds),
            'expected_hours': expected_hours,
            'expected_hours_full_month': expected_hours_full_month,
            'shortage_hours': shortage_hours,
            'attendance_percent': attendance_percent,
            'full_day_hours': full_day_hours,
        },
        'days': days,
    }


def get_day_detail_for_employee(employee, day: date):
    """Get full punch details + leave info for one day."""
    _ensure_attendance_processed_for_period(day, day, employee=employee)

    attendance = DailyAttendance.objects.filter(
        employee=employee,
        attendance_date=day,
    ).first()

    if not attendance:
        attendance = DailyAttendance.objects.filter(
            attendance_date=day,
            employee_code__iexact=employee.employee_id,
        ).first()

    raw_punches = RawPunchLog.objects.filter(
        punch_date=day,
        employee_code__iexact=employee.employee_id,
    ).order_by('punch_time')

    punches = [
        {
            'time': timezone.localtime(p.punch_time).strftime('%H:%M:%S'),
            'raw_line': p.raw_line,
        }
        for p in raw_punches
    ]

    settings_obj = AutomationSettings.get_solo()

    leaves_by_date = _get_leaves_for_period(day, day, employee)
    leave_info = leaves_by_date.get(day)

    return {
        'date': day.isoformat(),
        'day_name': day.strftime('%A'),
        'employee': {
            'id': str(employee.id),
            'employee_id': employee.employee_id,
            'full_name': employee.full_name,
        },
        'leave_info': leave_info,
        'attendance': {
            'punch_in': (
                timezone.localtime(attendance.punch_in).strftime('%H:%M:%S')
                if attendance and attendance.punch_in else None
            ),
            'punch_out': (
                timezone.localtime(attendance.punch_out).strftime('%H:%M:%S')
                if attendance and attendance.punch_out else None
            ),
            'total_punches': attendance.total_punches if attendance else 0,
            'worked_hours': _seconds_to_hhmm(attendance.net_working_hours_seconds if attendance else 0),
            'break_time': _seconds_to_hhmm(attendance.break_time_seconds if attendance else 0),
            'gross_hours': _seconds_to_hhmm(attendance.working_hours_seconds if attendance else 0),
            'is_late': attendance.is_late if attendance else False,
            'is_early_exit': attendance.is_early_exit if attendance else False,
            'missing_punch': attendance.missing_punch if attendance else False,
            'status': attendance.get_status_display() if attendance else 'Absent',
        },
        'raw_punches': punches,
        'expected_hours': float(settings_obj.full_day_min_hours),
        'shift_in': settings_obj.shift_in_time.strftime('%H:%M'),
        'shift_out': settings_obj.shift_out_time.strftime('%H:%M'),
    }


def get_team_monthly_summary(manager_employee, year: int, month: int):
    """Monthly summary for team members."""
    from HRMSapp.models import Employee

    # Bulk sync for the entire month once
    _ensure_month_attendance_for_all(year, month)

    team_members = Employee.objects.filter(
        reporting_manager=manager_employee,
        is_deleted=False,
        status__in=['ACTIVE', 'PROBATION'],
    ).select_related('position', 'structure_location').order_by('employee_id')

    team_data = []
    for member in team_members:
        try:
            month_data = get_monthly_attendance_for_employee(
                member, year, month, ensure_sync=False
            )
            team_data.append({
                'employee': month_data['employee'],
                'stats': month_data['stats'],
            })
        except Exception as exc:
            logger.exception(f"Failed for {member.employee_id}: {exc}")

    total_shortage = sum(m['stats']['shortage_hours'] for m in team_data)
    total_on_leave = sum(m['stats']['on_leave_days'] for m in team_data)
    avg_attendance = 0.0
    if team_data:
        avg_attendance = round(
            sum(m['stats']['attendance_percent'] for m in team_data) / len(team_data),
            1
        )

    return {
        'year': year,
        'month': month,
        'month_label': date(year, month, 1).strftime('%B %Y'),
        'manager': {
            'id': str(manager_employee.id),
            'employee_id': manager_employee.employee_id,
            'full_name': manager_employee.full_name,
        },
        'team_size': len(team_data),
        'team_total_shortage': round(total_shortage, 2),
        'team_total_on_leave': total_on_leave,
        'team_avg_attendance': avg_attendance,
        'members': team_data,
    }


def get_all_employees_monthly_summary(year: int, month: int, filters: dict = None):
    """HR view: All employees' monthly attendance."""
    from HRMSapp.models import Employee

    # Bulk sync for the entire month once
    _ensure_month_attendance_for_all(year, month)

    filters = filters or {}
    qs = Employee.objects.filter(
        is_deleted=False,
        status__in=['ACTIVE', 'PROBATION'],
    ).select_related('position', 'structure_location', 'reporting_manager')

    dept_id = filters.get('department_id')
    if dept_id:
        qs = qs.filter(structure_location_id=dept_id)

    search = (filters.get('search') or '').strip()
    if search:
        from django.db.models import Q
        qs = qs.filter(
            Q(employee_id__icontains=search) |
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search)
        )

    qs = qs.order_by('employee_id')

    employees_data = []
    for emp in qs:
        try:
            month_data = get_monthly_attendance_for_employee(
                emp, year, month, ensure_sync=False
            )
            employees_data.append({
                'employee': month_data['employee'],
                'manager_name': (
                    emp.reporting_manager.full_name
                    if emp.reporting_manager else None
                ),
                'stats': month_data['stats'],
            })
        except Exception as exc:
            logger.exception(f"Failed for {emp.employee_id}: {exc}")

    total_shortage = sum(m['stats']['shortage_hours'] for m in employees_data)
    total_on_leave = sum(m['stats']['on_leave_days'] for m in employees_data)
    avg_attendance = 0.0
    if employees_data:
        avg_attendance = round(
            sum(m['stats']['attendance_percent'] for m in employees_data)
            / len(employees_data),
            1,
        )

    from collections import defaultdict
    dept_stats = defaultdict(lambda: {'count': 0, 'shortage': 0, 'attendance_sum': 0, 'on_leave': 0})
    for m in employees_data:
        dept_name = m['employee']['department'] or 'Unassigned'
        dept_stats[dept_name]['count'] += 1
        dept_stats[dept_name]['shortage'] += m['stats']['shortage_hours']
        dept_stats[dept_name]['attendance_sum'] += m['stats']['attendance_percent']
        dept_stats[dept_name]['on_leave'] += m['stats']['on_leave_days']

    departments = [
        {
            'name': name,
            'employee_count': data['count'],
            'total_shortage': round(data['shortage'], 2),
            'total_on_leave': data['on_leave'],
            'avg_attendance': round(data['attendance_sum'] / data['count'], 1) if data['count'] else 0,
        }
        for name, data in dept_stats.items()
    ]
    departments.sort(key=lambda x: x['name'])

    return {
        'year': year,
        'month': month,
        'month_label': date(year, month, 1).strftime('%B %Y'),
        'total_employees': len(employees_data),
        'total_shortage': round(total_shortage, 2),
        'total_on_leave': total_on_leave,
        'avg_attendance': avg_attendance,
        'departments': departments,
        'employees': employees_data,
    }