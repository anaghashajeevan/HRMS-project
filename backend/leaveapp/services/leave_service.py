"""
Leave application processing service.
Handles: validation, day calculation, balance updates, workflow.
"""

from datetime import date, timedelta
from decimal import Decimal
import logging

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


class LeaveApplicationError(Exception):
    pass


class LeaveApplicationService:
    """Handles the complete leave application lifecycle."""

    # ==========================================================================
    # DAY CALCULATION (excludes weekends + holidays)
    # ==========================================================================
    
    @staticmethod
    def calculate_working_days(start_date, end_date, employee, exclude_holidays=True):
        """
        Calculate working days between two dates.
        Excludes: Saturdays, Sundays, and holidays (based on employee location).
        Returns: Decimal number of days.
        """
        from ..models import Holiday
        
        if start_date > end_date:
            return Decimal('0')
        
        # Get holidays in range
        holiday_dates = set()
        if exclude_holidays:
            holiday_query = Holiday.objects.filter(
                date__gte=start_date,
                date__lte=end_date,
                is_active=True,
            )
            
            # Filter by employee's location
            if employee.structure_location:
                from django.db.models import Q
                holiday_query = holiday_query.filter(
                    Q(applicable_to_all_locations=True) |
                    Q(applicable_locations=employee.structure_location)
                )
            else:
                holiday_query = holiday_query.filter(applicable_to_all_locations=True)
            
            holiday_dates = set(h.date for h in holiday_query.distinct())
        
        # Count working days
        working_days = 0
        current = start_date
        while current <= end_date:
            # Skip weekends (5=Sat, 6=Sun)
            if current.weekday() < 5 and current not in holiday_dates:
                working_days += 1
            current += timedelta(days=1)
        
        return Decimal(str(working_days))

    # ==========================================================================
    # VALIDATION
    # ==========================================================================
    
    @staticmethod
    def validate_application(employee, leave_type, start_date, end_date,
                              is_half_day=False, half_day_period=None,
                              supporting_document=None):
        """
        Validate a leave application before creating.
        Returns: dict with 'valid', 'errors', 'warnings', 'total_days', 'is_lop', 'lop_days'
        """
        from ..models import LeaveApplication
        from .balance_service import LeaveBalanceService
        
        errors = []
        warnings = []
        
        # ---------- Basic validations ----------
        today = timezone.localdate()
        
        if start_date > end_date:
            errors.append("End date must be after or equal to start date")
        
        if start_date < today - timedelta(days=30):
            errors.append("Cannot apply leave more than 30 days in the past")
        
        if start_date > today + timedelta(days=365):
            errors.append("Cannot apply leave more than 1 year in advance")
        
        # ---------- Leave type rules ----------
        if not leave_type.is_active:
            errors.append(f"{leave_type.name} is not currently active")
        
        # Notice period
        if leave_type.min_days_before_apply > 0:
            days_before = (start_date - today).days
            if days_before < leave_type.min_days_before_apply:
                errors.append(
                    f"{leave_type.name} requires {leave_type.min_days_before_apply} days notice. "
                    f"You have {days_before} days."
                )
        
        # Half-day rules
        if is_half_day:
            if not leave_type.can_apply_half_day:
                errors.append(f"{leave_type.name} does not allow half-day leave")
            if start_date != end_date:
                errors.append("Half-day leave must be for a single day")
            if not half_day_period:
                errors.append("Half-day period (AM/PM) is required")
        
        # Document requirement
        if leave_type.requires_document and not supporting_document:
            errors.append(f"{leave_type.name} requires a supporting document")
        
        # Probation restriction
        if not leave_type.allowed_during_probation and employee.status == 'PROBATION':
            errors.append(f"{leave_type.name} not allowed during probation")
        
        # Service duration
        if leave_type.min_service_months > 0:
            service_days = (today - employee.date_of_joining).days
            service_months = service_days / 30.44
            if service_months < leave_type.min_service_months:
                errors.append(
                    f"{leave_type.name} requires {leave_type.min_service_months} months service. "
                    f"You have {int(service_months)} months."
                )
        
        # Gender restriction
        if leave_type.applicable_gender != 'ALL':
            if not employee.gender:
                errors.append(f"{leave_type.name} has gender restrictions but employee gender is not set")
            elif employee.gender != leave_type.applicable_gender:
                errors.append(f"{leave_type.name} is only for {leave_type.applicable_gender} employees")
        
        # ---------- Calculate days ----------
        total_days = LeaveApplicationService.calculate_working_days(
            start_date, end_date, employee
        )
        
        if is_half_day:
            total_days = Decimal('0.5')
        
        if total_days == 0:
            errors.append("Leave period only contains weekends/holidays. No leave days needed.")
        
        # Max consecutive
        if (leave_type.max_consecutive_days > 0 
                and total_days > leave_type.max_consecutive_days):
            errors.append(
                f"{leave_type.name} allows max {leave_type.max_consecutive_days} consecutive days. "
                f"You applied for {total_days}."
            )
        
        # ---------- Overlap check ----------
        overlaps = LeaveApplication.objects.filter(
            employee=employee,
            status__in=['PENDING', 'APPROVED'],
            start_date__lte=end_date,
            end_date__gte=start_date,
        )
        if overlaps.exists():
            first_overlap = overlaps.first()
            errors.append(
                f"You already have a {first_overlap.get_status_display().lower()} leave "
                f"from {first_overlap.start_date} to {first_overlap.end_date}"
            )
        
        # ---------- Balance check ----------
        is_lop = False
        lop_days = Decimal('0')
        
        if leave_type.is_paid and leave_type.accrual_type != 'ON_DEMAND':
            year = start_date.year
            balance = LeaveBalanceService.get_balance(employee, leave_type.code, year)
            
            if not balance:
                warnings.append(
                    f"No leave balance for {leave_type.name} in {year}. "
                    f"Will be treated as LOP."
                )
                is_lop = True
                lop_days = total_days
            elif balance.available < total_days:
                available = balance.available
                is_lop = True
                lop_days = total_days - available
                warnings.append(
                    f"Insufficient balance. Available: {available}, Requested: {total_days}. "
                    f"{lop_days} days will be LOP."
                )
        
                # 🆕 CLASH DETECTION — Check if this leave creates a team clash
        clash_warnings = LeaveApplicationService._check_team_clash(
            employee, start_date, end_date
        )
        for warn in clash_warnings:
            warnings.append(warn)
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'total_days': total_days,
            'is_lop': is_lop,
            'lop_days': lop_days,
        }
    
    @staticmethod
    def _check_team_clash(employee, start_date, end_date):
        """Check if this leave would create a team clash. Returns list of warning strings."""
        from ..models import LeaveApplication
        from HRMSapp.models import Employee
        
        warnings = []
        
        # Only check if employee has a manager (has team context)
        if not employee.reporting_manager:
            return warnings
        
        # Get team size (excluding this employee)
        team_size = Employee.objects.filter(
            reporting_manager=employee.reporting_manager,
            is_deleted=False,
        ).count()
        
        if team_size == 0:
            return warnings
        
        # Check each date in the range
        current = start_date
        while current <= end_date:
            if current.weekday() < 5:  # Skip weekends
                # Count team members already on leave that day
                other_leaves = LeaveApplication.objects.filter(
                    employee__reporting_manager=employee.reporting_manager,
                    status__in=['PENDING', 'APPROVED'],
                    start_date__lte=current,
                    end_date__gte=current,
                ).exclude(employee=employee).count()
                
                # Total including this new leave = other_leaves + 1
                total_on_leave = other_leaves + 1
                percentage = (total_on_leave / team_size) * 100
                
                if percentage >= 100:
                    warnings.append(
                        f"⛔ CRITICAL on {current.strftime('%d %b')}: "
                        f"Entire team will be on leave ({total_on_leave}/{team_size} people)! "
                        f"Manager may not approve."
                    )
                elif percentage >= 75:
                    warnings.append(
                        f"🔴 On {current.strftime('%d %b')}: "
                        f"{total_on_leave}/{team_size} team members will be on leave ({percentage:.0f}%). "
                        f"Manager may ask you to reschedule."
                    )
                elif percentage >= 50:
                    warnings.append(
                        f"🟠 On {current.strftime('%d %b')}: "
                        f"{total_on_leave}/{team_size} team members will be on leave."
                    )
            
            current += timedelta(days=1)
        
        return warnings

    # ==========================================================================
    # CREATE APPLICATION
    # ==========================================================================
    
    @staticmethod
    @transaction.atomic
    def create_application(employee, leave_type, start_date, end_date, reason,
                            is_half_day=False, half_day_period='',
                            contact_during_leave='', supporting_document=None,
                            handover_to=None, handover_notes=''):
        """Create leave application using HRMSapp.ApprovalWorkflow."""
        from ..models import LeaveApplication, LeaveApplicationApproval
        from HRMSapp.models import ApprovalWorkflow
        from HRMSapp.services.workflow_service import WorkflowService
        from .balance_service import LeaveBalanceService
        
        # Validate
        validation = LeaveApplicationService.validate_application(
            employee, leave_type, start_date, end_date,
            is_half_day, half_day_period, supporting_document,
        )
        
        if not validation['valid']:
            raise LeaveApplicationError('; '.join(validation['errors']))
        
        # Generate application number
        year = timezone.now().year
        count = LeaveApplication.objects.filter(
            applied_at__year=year
        ).count() + 1
        application_number = f"LEAVE-{year}-{count:04d}"
        
        # 🆕 NEW: Get active LEAVE workflow
        workflow = ApprovalWorkflow.objects.filter(
            module='LEAVE', is_active=True
        ).prefetch_related('steps').first()
        
        if not workflow:
            raise LeaveApplicationError(
                'No active LEAVE approval workflow configured. '
                'Please configure it in Settings → Approval Workflows.'
            )
        
        # Get first step
        first_step = workflow.steps.order_by('step_number').first()
        if not first_step:
            raise LeaveApplicationError('Leave workflow has no steps configured.')
        
        # Resolve first approver using HRMS WorkflowService logic
        approvers = WorkflowService.resolve_approvers(first_step, employee)
        if not approvers:
            raise LeaveApplicationError(
                f'Could not resolve approver for step "{first_step.step_name}". '
                f'Check workflow configuration.'
            )
        
        first_approver = approvers[0]  # Take first if multiple
        
        # Create application
        application = LeaveApplication.objects.create(
            application_number=application_number,
            employee=employee,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            total_days=validation['total_days'],
            is_half_day=is_half_day,
            half_day_period=half_day_period,
            reason=reason,
            contact_during_leave=contact_during_leave,
            supporting_document=supporting_document,
            handover_to=handover_to,
            handover_notes=handover_notes,
            status='PENDING',
            is_lop=validation['is_lop'],
            lop_days=validation['lop_days'],
            current_approver=first_approver,
        )
        
        # Reserve balance
        if leave_type.is_paid and leave_type.accrual_type != 'ON_DEMAND':
            balance = LeaveBalanceService.get_balance(employee, leave_type.code, year)
            if balance:
                to_reserve = validation['total_days'] - validation['lop_days']
                if to_reserve > 0:
                    balance.pending += to_reserve
                    balance.save()
        
        # Create approval record for step 1
        LeaveApplicationApproval.objects.create(
            application=application,
            step_number=first_step.step_number,
            step_name=first_step.step_name,
            approver=first_approver,
            status='PENDING',
        )
        
        # Notify approver
        LeaveApplicationService._notify_approver(application)
        
        return application

    # ==========================================================================
    # APPROVE / REJECT
    # ==========================================================================
    
    @staticmethod
    @transaction.atomic
    def approve_application(application, approver, comments='', override_clash=False):
        """Approve current step. Route to next step or finalize."""
        from ..models import LeaveApplicationApproval
        from HRMSapp.models import ApprovalWorkflow
        from HRMSapp.services.workflow_service import WorkflowService
        
        if application.status != 'PENDING':
            raise LeaveApplicationError(f"Cannot approve {application.get_status_display()}")
        
        if application.current_approver != approver:
            raise LeaveApplicationError("You are not the current approver")
        
        if not override_clash:
            critical_clashes = LeaveApplicationService._get_critical_clashes(application)
            if critical_clashes:
                clash_msg = '; '.join(critical_clashes)
                raise LeaveApplicationError(
                    f"CRITICAL CLASH: {clash_msg} "
                    f"Use override_clash=true to approve anyway."
                )
        # Get current pending approval
        pending_approval = application.approvals.filter(
            approver=approver, status='PENDING'
        ).first()
        
        if not pending_approval:
            raise LeaveApplicationError("No pending approval action found")
        
        # Mark this step approved
        pending_approval.status = 'APPROVED'
        pending_approval.acted_at = timezone.now()
        pending_approval.comments = comments
        pending_approval.save()
        
        # 🆕 Check if next step exists in the workflow
        workflow = ApprovalWorkflow.objects.filter(
            module='LEAVE', is_active=True
        ).prefetch_related('steps').first()
        
        if not workflow:
            LeaveApplicationService._finalize_approval(application, approver)
            return application
        
        current_step_num = pending_approval.step_number
        next_step = workflow.steps.filter(
            step_number__gt=current_step_num
        ).order_by('step_number').first()
        
        if next_step:
            # Route to next step
            next_approvers = WorkflowService.resolve_approvers(next_step, application.employee)
            if next_approvers:
                next_approver = next_approvers[0]
                application.current_approver = next_approver
                application.save()
                
                LeaveApplicationApproval.objects.create(
                    application=application,
                    step_number=next_step.step_number,
                    step_name=next_step.step_name,
                    approver=next_approver,
                    status='PENDING',
                )
                LeaveApplicationService._notify_approver(application, is_escalation=True)
            else:
                # No approver resolved for next step — finalize
                LeaveApplicationService._finalize_approval(application, approver)
        else:
            # No more steps — finalize
            LeaveApplicationService._finalize_approval(application, approver)
        
        return application
    @staticmethod
    def _get_critical_clashes(application):
        """Return list of critical clash messages (100% team on leave)."""
        from ..models import LeaveApplication
        from HRMSapp.models import Employee
        from datetime import timedelta
        
        employee = application.employee
        if not employee.reporting_manager:
            return []
        
        team_size = Employee.objects.filter(
            reporting_manager=employee.reporting_manager,
            is_deleted=False,
        ).count()
        
        if team_size <= 1:
            return []  # Only 1 person = no team clash possible
        
        critical = []
        current = application.start_date
        while current <= application.end_date:
            if current.weekday() < 5:
                other_leaves = LeaveApplication.objects.filter(
                    employee__reporting_manager=employee.reporting_manager,
                    status__in=['PENDING', 'APPROVED'],
                    start_date__lte=current,
                    end_date__gte=current,
                ).exclude(id=application.id).count()
                
                total_on_leave = other_leaves + 1
                if total_on_leave >= team_size:
                    critical.append(
                        f"{current.strftime('%d %b %Y')}: Entire team ({team_size} people) on leave"
                    )
            current += timedelta(days=1)
        
        return critical

    @staticmethod
    @transaction.atomic
    def reject_application(application, approver, reason):
        """Reject a leave application."""
        from .balance_service import LeaveBalanceService
        
        if application.status != 'PENDING':
            raise LeaveApplicationError(f"Cannot reject {application.get_status_display()} application")
        
        if application.current_approver != approver:
            raise LeaveApplicationError("You are not the current approver")
        
        # Mark approval step as rejected
        pending_approval = application.approvals.filter(
            approver=approver, status='PENDING'
        ).first()
        
        if pending_approval:
            pending_approval.status = 'REJECTED'
            pending_approval.acted_at = timezone.now()
            pending_approval.comments = reason
            pending_approval.save()
        
        # Update application
        application.status = 'REJECTED'
        application.rejection_reason = reason
        application.current_approver = None
        application.save()
        
        # Release reserved balance
        LeaveApplicationService._release_pending_balance(application)
        
        # Notify employee
        LeaveApplicationService._notify_rejection(application, approver, reason)
        
        return application

    # ==========================================================================
    # CANCEL / WITHDRAW
    # ==========================================================================
    
    @staticmethod
    @transaction.atomic
    def cancel_application(application, reason=''):
        """Cancel a pending or future approved leave."""
        if application.status not in ['PENDING', 'APPROVED']:
            raise LeaveApplicationError(f"Cannot cancel {application.get_status_display()} application")
        
        # Check if already started (can't cancel past leaves)
        today = timezone.localdate()
        if application.status == 'APPROVED' and application.start_date <= today:
            raise LeaveApplicationError("Cannot cancel leave that has already started")
        
        was_approved = application.status == 'APPROVED'
        application.status = 'CANCELLED'
        application.cancellation_reason = reason
        application.cancelled_at = timezone.now()
        application.save()
        
        # Release balance
        if was_approved:
            LeaveApplicationService._release_used_balance(application)
        else:
            LeaveApplicationService._release_pending_balance(application)
        
        return application

    # ==========================================================================
    # HELPERS (Private)
    # ==========================================================================
    
    # @staticmethod
    # def _escalate_to_hr(application):
    #     """Route to HR admin for next-level approval."""
    #     from ..models import LeaveApplicationApproval
    #     from HRMSapp.models import UserAccount
        
    #     # Find first HR admin employee
    #     hr_user = UserAccount.objects.filter(
    #         is_active=True,
    #         roles__role_name='HR_ADMIN',
    #     ).select_related('employee').first()
        
    #     if not hr_user or not hr_user.employee:
    #         # No HR? Auto-finalize with current approver
    #         LeaveApplicationService._finalize_approval(application, application.current_approver)
    #         return
        
    #     hr_employee = hr_user.employee
        
    #     # Get next step number
    #     next_step = application.approvals.count() + 1
        
    #     LeaveApplicationApproval.objects.create(
    #         application=application,
    #         step_number=next_step,
    #         step_name='HR Approval',
    #         approver=hr_employee,
    #         status='PENDING',
    #     )
        
    #     application.current_approver = hr_employee
    #     application.save()
        
    #     LeaveApplicationService._notify_approver(application)

    @staticmethod
    def _finalize_approval(application, approver):
        """Mark application as fully approved and move balance."""
        from .balance_service import LeaveBalanceService
        
        application.status = 'APPROVED'
        application.approved_by = approver
        application.approved_at = timezone.now()
        application.current_approver = None
        application.save()
        
        # Move balance from pending to used
        leave_type = application.leave_type
        if leave_type.is_paid and leave_type.accrual_type != 'ON_DEMAND':
            year = application.start_date.year
            balance = LeaveBalanceService.get_balance(
                application.employee, leave_type.code, year
            )
            if balance:
                to_move = application.total_days - application.lop_days
                if to_move > 0:
                    balance.pending -= to_move
                    balance.used += to_move
                    if balance.pending < 0:
                        balance.pending = Decimal('0')
                    balance.save()
        
        # Notify employee
        LeaveApplicationService._notify_approval(application, approver)
        
        # 🔗 Update attendance records (if attendance app integrated)
        LeaveApplicationService._update_attendance_records(application)

    @staticmethod
    def _release_pending_balance(application):
        """Return pending balance to available (on rejection/cancel)."""
        from .balance_service import LeaveBalanceService
        
        leave_type = application.leave_type
        if leave_type.is_paid and leave_type.accrual_type != 'ON_DEMAND':
            year = application.start_date.year
            balance = LeaveBalanceService.get_balance(
                application.employee, leave_type.code, year
            )
            if balance:
                to_release = application.total_days - application.lop_days
                if to_release > 0:
                    balance.pending -= to_release
                    if balance.pending < 0:
                        balance.pending = Decimal('0')
                    balance.save()

    @staticmethod
    def _release_used_balance(application):
        """Return used balance to available (on cancellation of approved leave)."""
        from .balance_service import LeaveBalanceService
        
        leave_type = application.leave_type
        if leave_type.is_paid and leave_type.accrual_type != 'ON_DEMAND':
            year = application.start_date.year
            balance = LeaveBalanceService.get_balance(
                application.employee, leave_type.code, year
            )
            if balance:
                to_return = application.total_days - application.lop_days
                if to_return > 0:
                    balance.used -= to_return
                    if balance.used < 0:
                        balance.used = Decimal('0')
                    balance.save()

    @staticmethod
    def _notify_approver(application, is_escalation=False):
        """Send in-app + email + WhatsApp to approver."""
        try:
            from HRMSapp.models import Notification
            from .email_service import LeaveEmailService
            from .whatsapp_service import (
                send_leave_approval_request_whatsapp,
                is_whatsapp_enabled,
            )
            from ..models import WhatsAppNotificationLog
            
            approver = application.current_approver
            if not approver:
                return
            
            # 1. In-app notification
            Notification.objects.create(
                recipient=approver,
                notification_type='APPROVAL_REQUEST',
                title=f'Leave Request: {application.employee.full_name}',
                message=(
                    f'{"[ESCALATED] " if is_escalation else ""}'
                    f'{application.employee.full_name} has applied for '
                    f'{application.leave_type.name} from {application.start_date} to '
                    f'{application.end_date} ({application.total_days} days).'
                ),
                link=f'/leave/approvals',
            )
            
            # 2. Email
            LeaveEmailService.send_approval_request(
                application, approver, is_escalation=is_escalation
            )
            
            # 3. WhatsApp
            if is_whatsapp_enabled():
                if approver.phone_number:
                    result = send_leave_approval_request_whatsapp(application, approver)
                    WhatsAppNotificationLog.objects.create(
                        notification_type='LEAVE_APPROVAL_REQUEST',
                        recipient_employee=approver,
                        recipient_phone=approver.phone_number,
                        leave_application=application,
                        status='SUCCESS' if result.get('success') else 'FAILED',
                        message_id=result.get('message_id', ''),
                        error_message=result.get('error', ''),
                    )
                else:
                    WhatsAppNotificationLog.objects.create(
                        notification_type='LEAVE_APPROVAL_REQUEST',
                        recipient_employee=approver,
                        recipient_phone='',
                        leave_application=application,
                        status='SKIPPED',
                        error_message='No phone number',
                    )
            
        except Exception as exc:
            logger.exception(f"Failed to send approver notification: {exc}")

    @staticmethod
    def _notify_approval(application, approver):
        """Notify employee — in-app + email + WhatsApp."""
        try:
            from HRMSapp.models import Notification
            from .email_service import LeaveEmailService
            from .whatsapp_service import (
                send_leave_approved_whatsapp,
                is_whatsapp_enabled,
            )
            from ..models import WhatsAppNotificationLog
            
            # In-app
            Notification.objects.create(
                recipient=application.employee,
                notification_type='APPROVAL_APPROVED',
                title=f'Leave Approved: {application.application_number}',
                message=(
                    f'Your {application.leave_type.name} from {application.start_date} to '
                    f'{application.end_date} has been approved by {approver.full_name}.'
                ),
                link=f'/leave/my-applications',
            )
            
            # Email
            LeaveEmailService.send_approval_notification(application, approver)
            
            # WhatsApp
            if is_whatsapp_enabled() and application.employee.phone_number:
                result = send_leave_approved_whatsapp(application, approver)
                WhatsAppNotificationLog.objects.create(
                    notification_type='LEAVE_APPROVED',
                    recipient_employee=application.employee,
                    recipient_phone=application.employee.phone_number,
                    leave_application=application,
                    status='SUCCESS' if result.get('success') else 'FAILED',
                    message_id=result.get('message_id', ''),
                    error_message=result.get('error', ''),
                )
        except Exception as exc:
            logger.exception(f"Failed to send approval notification: {exc}")

    @staticmethod
    def _notify_rejection(application, approver, reason):
        """Notify employee — in-app + email + WhatsApp."""
        try:
            from HRMSapp.models import Notification
            from .email_service import LeaveEmailService
            from .whatsapp_service import (
                send_leave_rejected_whatsapp,
                is_whatsapp_enabled,
            )
            from ..models import WhatsAppNotificationLog
            
            # In-app
            Notification.objects.create(
                recipient=application.employee,
                notification_type='APPROVAL_REJECTED',
                title=f'Leave Rejected: {application.application_number}',
                message=(
                    f'Your {application.leave_type.name} was rejected by {approver.full_name}. '
                    f'Reason: {reason}'
                ),
                link=f'/leave/my-applications',
            )
            
            # Email
            LeaveEmailService.send_rejection_notification(application, approver, reason)
            
            # WhatsApp
            if is_whatsapp_enabled() and application.employee.phone_number:
                result = send_leave_rejected_whatsapp(application, approver, reason)
                WhatsAppNotificationLog.objects.create(
                    notification_type='LEAVE_REJECTED',
                    recipient_employee=application.employee,
                    recipient_phone=application.employee.phone_number,
                    leave_application=application,
                    status='SUCCESS' if result.get('success') else 'FAILED',
                    message_id=result.get('message_id', ''),
                    error_message=result.get('error', ''),
                )
        except Exception as exc:
            logger.exception(f"Failed to send rejection notification: {exc}")

    @staticmethod
    def _update_attendance_records(application):
        """
        Update attendanceapp.DailyAttendance to link approved leave.
        Only if attendance app is installed.
        """
        try:
            from attendanceapp.models import DailyAttendance
            
            current = application.start_date
            while current <= application.end_date:
                # Skip weekends
                if current.weekday() < 5:
                    DailyAttendance.objects.update_or_create(
                        employee=application.employee,
                        attendance_date=current,
                        defaults={
                            'employee_code': application.employee.employee_id,
                            'employee_name': application.employee.full_name,
                            'status': 'missing_punch',  # Will be overridden by actual punch
                        }
                    )
                current += timedelta(days=1)
        except Exception as exc:
            # Silent fail — attendance app may not be integrated
            logger.debug(f"Could not update attendance records: {exc}")


# ==============================================================================
# TEAM CALENDAR SERVICE
# ==============================================================================

class TeamCalendarService:
    """Team calendar for clash prevention (SRS 4.6.2)."""
    
    @staticmethod
    def get_team_calendar(manager, start_date, end_date):
        """
        Get team leave calendar for a date range.
        Returns leaves + holidays + clash warnings.
        """
        from ..models import LeaveApplication, Holiday
        from HRMSapp.models import Employee
        
        # Get manager's team
        team = Employee.objects.filter(
            reporting_manager=manager,
            is_deleted=False,
        )
        team_size = team.count()
        
        # Get all leaves in range
        leaves = LeaveApplication.objects.filter(
            employee__in=team,
            status__in=['PENDING', 'APPROVED'],
            start_date__lte=end_date,
            end_date__gte=start_date,
        ).select_related('employee', 'leave_type')
        
        # Get holidays in range
        holidays = Holiday.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
            is_active=True,
        )
        
        # Build calendar events
        events = []
        for leave in leaves:
            events.append({
                'type': 'leave',
                'id': str(leave.id),
                'employee_id': str(leave.employee.id),
                'employee_code': leave.employee.employee_id,
                'employee_name': leave.employee.full_name,
                'start_date': leave.start_date.isoformat(),
                'end_date': leave.end_date.isoformat(),
                'leave_type_code': leave.leave_type.code,
                'leave_type_name': leave.leave_type.name,
                'status': leave.status,
                'color': leave.leave_type.color_code,
                'total_days': str(leave.total_days),
                'is_half_day': leave.is_half_day,
            })
        
        for holiday in holidays:
            events.append({
                'type': 'holiday',
                'id': str(holiday.id),
                'title': holiday.name,
                'date': holiday.date.isoformat(),
                'holiday_type': holiday.holiday_type,
                'color': '#94A3B8',
            })
        
        # Detect clashes (days with >30% team on leave)
        clashes = TeamCalendarService._detect_clashes(leaves, team_size)
        
        return {
            'events': events,
            'clashes': clashes,
            'team_size': team_size,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
        }
    
    @staticmethod
    def _detect_clashes(leaves, team_size):
        """
        Detect days where too many employees are on leave.
        Returns 4-level severity: LOW, MEDIUM, HIGH, CRITICAL
        """
        from collections import defaultdict
        
        if team_size == 0:
            return []
        
        # Count leaves per day
        day_counts = defaultdict(list)
        for leave in leaves:
            current = leave.start_date
            while current <= leave.end_date:
                if current.weekday() < 5:  # Skip weekends
                    day_counts[current].append({
                        'employee_name': leave.employee.full_name,
                        'employee_code': leave.employee.employee_id,
                        'leave_type': leave.leave_type.code,
                        'status': leave.status,
                    })
                current += timedelta(days=1)
        
        warnings = []
        for day, people in day_counts.items():
            count = len(people)
            percentage = round((count / team_size) * 100, 1)
            
            # Determine severity based on percentage
            if percentage >= 100:
                severity = 'critical'
                severity_label = '⛔ CRITICAL - Entire team on leave!'
                recommendation = (
                    'ALL team members will be absent. Consider: '
                    '(1) Requiring at least one person to reschedule, or '
                    '(2) Arranging cross-team coverage, or '
                    '(3) HR must review and override this scenario.'
                )
            elif percentage >= 75:
                severity = 'high'
                severity_label = '🔴 HIGH - Most team on leave'
                recommendation = (
                    'Only a few team members will be available. '
                    'Verify critical work is covered before approving.'
                )
            elif percentage >= 50:
                severity = 'medium'
                severity_label = '🟠 MEDIUM - Half team on leave'
                recommendation = (
                    'Half the team will be absent. Ensure important tasks are handed over.'
                )
            elif percentage >= 30 or count >= 3:
                severity = 'low'
                severity_label = '🟡 LOW - Multiple people out'
                recommendation = 'Multiple team members will be on leave. Monitor workload.'
            else:
                continue  # No warning needed
            
            warnings.append({
                'date': day.isoformat(),
                'count': count,
                'employees': people,
                'severity': severity,
                'severity_label': severity_label,
                'recommendation': recommendation,
                'percentage': percentage,
                'is_all_team': percentage >= 100,
            })
        
        return sorted(warnings, key=lambda x: x['date'])