"""
Annual Calendar management service.
Handles: creation, holiday assignment, approval workflow, publishing.
"""

import logging
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


class CalendarServiceError(Exception):
    pass


class AnnualCalendarService:
    """Full lifecycle for annual calendars."""

    @staticmethod
    @transaction.atomic
    def create_calendar(year, title, description, created_by):
        """Create a new draft annual calendar."""
        from ..models import AnnualCalendar

        if AnnualCalendar.objects.filter(year=year).exists():
            raise CalendarServiceError(f"Calendar for {year} already exists")

        calendar = AnnualCalendar.objects.create(
            year=year,
            title=title,
            description=description,
            created_by=created_by,
            status='DRAFT',
        )
        logger.info(f"✅ Created annual calendar for {year}")
        return calendar

    @staticmethod
    @transaction.atomic
    def add_holiday_to_calendar(calendar, holiday_data, created_by):
        """Add a holiday to a calendar (only when DRAFT)."""
        from ..models import Holiday

        if calendar.status not in ['DRAFT']:
            raise CalendarServiceError(
                f"Cannot add holidays to {calendar.get_status_display()} calendar"
            )

        holiday_date = holiday_data.get('date')
        if holiday_date.year != calendar.year:
            raise CalendarServiceError(
                f"Holiday date must be in {calendar.year}"
            )

        location_ids = holiday_data.pop('applicable_locations', [])
        holiday = Holiday.objects.create(
            calendar=calendar,
            **holiday_data
        )
        if location_ids:
            holiday.applicable_locations.set(location_ids)
        return holiday

    @staticmethod
    @transaction.atomic
    def submit_for_approval(calendar, submitted_by):
        """Submit calendar for approval — routes to first approver."""
        from ..models import AnnualCalendarApproval
        from HRMSapp.models import ApprovalWorkflow
        from HRMSapp.services.workflow_service import WorkflowService

        if calendar.status != 'DRAFT':
            raise CalendarServiceError(
                f"Cannot submit {calendar.get_status_display()} calendar"
            )

        if calendar.holiday_count == 0:
            raise CalendarServiceError(
                "Cannot submit empty calendar. Add at least one holiday."
            )

        workflow = ApprovalWorkflow.objects.filter(
            module='CALENDAR', is_active=True
        ).prefetch_related('steps').first()

        if not workflow:
            raise CalendarServiceError(
                "No active CALENDAR approval workflow configured. "
                "Please set it up in Settings → Approval Workflows."
            )

        first_step = workflow.steps.order_by('step_number').first()
        if not first_step:
            raise CalendarServiceError("Workflow has no steps configured.")

        approvers = WorkflowService.resolve_approvers(first_step, submitted_by)
        if not approvers:
            raise CalendarServiceError(
                f"Could not resolve approver for '{first_step.step_name}'"
            )

        first_approver = approvers[0]

        # Update status + clear old return/reject info
        calendar.status = 'IN_REVIEW'
        calendar.return_comments = ''
        calendar.returned_at = None
        calendar.returned_by = None
        calendar.rejection_reason = ''
        calendar.rejected_at = None
        calendar.save()

        # Create approval record
        AnnualCalendarApproval.objects.create(
            calendar=calendar,
            step_number=first_step.step_number,
            step_name=first_step.step_name,
            approver=first_approver,
            status='PENDING',
        )

        AnnualCalendarService._notify_approver(calendar, first_approver)
        logger.info(f"📤 Calendar {calendar.year} submitted for approval")
        return calendar

    @staticmethod
    @transaction.atomic
    def approve_calendar(calendar, approver, comments=''):
        """Approve current step — route to next or finalize."""
        from ..models import AnnualCalendarApproval
        from HRMSapp.models import ApprovalWorkflow
        from HRMSapp.services.workflow_service import WorkflowService

        if calendar.status != 'IN_REVIEW':
            raise CalendarServiceError("Calendar is not in review")

        pending = AnnualCalendarApproval.objects.filter(
            calendar=calendar, approver=approver, status='PENDING'
        ).first()

        if not pending:
            raise CalendarServiceError("No pending approval for you")

        pending.status = 'APPROVED'
        pending.acted_at = timezone.now()
        pending.comments = comments
        pending.save()

        # Check for next step
        workflow = ApprovalWorkflow.objects.filter(
            module='CALENDAR', is_active=True
        ).prefetch_related('steps').first()

        if workflow:
            next_step = workflow.steps.filter(
                step_number__gt=pending.step_number
            ).order_by('step_number').first()

            if next_step:
                next_approvers = WorkflowService.resolve_approvers(
                    next_step, calendar.created_by
                )
                if next_approvers:
                    AnnualCalendarApproval.objects.create(
                        calendar=calendar,
                        step_number=next_step.step_number,
                        step_name=next_step.step_name,
                        approver=next_approvers[0],
                        status='PENDING',
                    )
                    AnnualCalendarService._notify_approver(
                        calendar, next_approvers[0], is_escalation=True
                    )
                    return calendar

        # All approved
        calendar.status = 'APPROVED'
        calendar.save(update_fields=['status'])
        AnnualCalendarService._notify_calendar_approved(calendar, approver)
        logger.info(f"✅ Calendar {calendar.year} fully approved")
        return calendar

    @staticmethod
    @transaction.atomic
    def reject_calendar(calendar, approver, reason):
        """Reject calendar — back to draft with rejection info."""
        from ..models import AnnualCalendarApproval

        if calendar.status != 'IN_REVIEW':
            raise CalendarServiceError("Calendar is not in review")

        pending = AnnualCalendarApproval.objects.filter(
            calendar=calendar, approver=approver, status='PENDING'
        ).first()

        if not pending:
            raise CalendarServiceError("No pending approval for you")

        pending.status = 'REJECTED'
        pending.acted_at = timezone.now()
        pending.comments = reason
        pending.save()

        calendar.status = 'DRAFT'
        calendar.rejection_reason = reason
        calendar.rejected_at = timezone.now()
        calendar.save()

        AnnualCalendarService._notify_calendar_rejected(calendar, approver, reason)
        return calendar

    @staticmethod
    @transaction.atomic
    def return_calendar_for_changes(calendar, approver, comments):
        """Return calendar for changes."""
        from ..models import AnnualCalendarApproval

        if calendar.status != 'IN_REVIEW':
            raise CalendarServiceError("Calendar is not in review")

        if not comments or len(comments.strip()) < 5:
            raise CalendarServiceError("Detailed comments required (min 5 chars)")

        pending = AnnualCalendarApproval.objects.filter(
            calendar=calendar, approver=approver, status='PENDING'
        ).first()

        if not pending:
            raise CalendarServiceError("No pending approval for you")

        pending.status = 'RETURNED'
        pending.acted_at = timezone.now()
        pending.comments = comments
        pending.save()

        calendar.status = 'DRAFT'
        calendar.return_comments = comments
        calendar.returned_at = timezone.now()
        calendar.returned_by = approver
        calendar.save()

        AnnualCalendarService._notify_calendar_returned(calendar, approver, comments)
        return calendar

    @staticmethod
    @transaction.atomic
    def publish_calendar(calendar, published_by):
        """Publish calendar — fast DB operations only. Emails go to background."""
        from ..models import AnnualCalendar

        if calendar.status != 'APPROVED':
            raise CalendarServiceError(
                f"Only approved calendars can be published. "
                f"Current: {calendar.get_status_display()}"
            )

        # Archive previous published calendars
        AnnualCalendar.objects.filter(
            status='PUBLISHED'
        ).exclude(id=calendar.id).update(status='ARCHIVED')

        # Activate holidays
        calendar.holidays.all().update(is_active=True)

        # Update status
        calendar.status = 'PUBLISHED'
        calendar.published_at = timezone.now()
        calendar.published_by = published_by
        calendar.save()

        logger.info(f"✅ Calendar {calendar.year} published — queuing notifications")
        
        # 🔥 Queue email sending in background (no more DB lock!)
        from ..tasks import notify_employees_calendar_published
        notify_employees_calendar_published.delay(str(calendar.id))
        
        return calendar

    # ==========================================================================
    # NOTIFICATIONS
    # ==========================================================================

    @staticmethod
    def _notify_approver(calendar, approver, is_escalation=False):
        """Notify approver via in-app + email."""
        try:
            from HRMSapp.models import Notification
            from django.conf import settings
            from django.core.mail import EmailMultiAlternatives

            prefix = "[ESCALATED] " if is_escalation else ""

            Notification.objects.create(
                recipient=approver,
                notification_type='APPROVAL_REQUEST',
                title=f'{prefix}Calendar Review: {calendar.title}',
                message=(
                    f'Annual calendar for {calendar.year} needs your approval. '
                    f'{calendar.holiday_count} holidays added.'
                ),
                link=f'/calendar/pending-approvals',
            )

            portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
            company_name = getattr(settings, 'COMPANY_NAME', 'Company')

            subject = f"📅 Annual Calendar Review Required: {calendar.year}"

            html_body = f'''<!DOCTYPE html>
<html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fa;padding:20px;">
<div style="max-width:640px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);padding:32px;text-align:center;color:white;">
        <h1>📅 Annual Calendar Review</h1>
        <p style="opacity:0.9;">Calendar for FY {calendar.year}</p>
    </div>
    <div style="padding:32px;">
        <p>Hello <strong>{approver.full_name}</strong>,</p>
        <p>{prefix}The annual holiday calendar for <strong>{calendar.year}</strong> requires your review.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr><td style="padding:12px;background:#f9fafb;font-weight:600;">Total Holidays</td><td style="padding:12px;">{calendar.holiday_count}</td></tr>
            <tr><td style="padding:12px;background:#f9fafb;font-weight:600;">Submitted By</td><td style="padding:12px;">{calendar.created_by.full_name if calendar.created_by else '—'}</td></tr>
        </table>
        <div style="text-align:center;margin:32px 0;">
            <a href="{portal_url}/calendar/pending-approvals" style="display:inline-block;background:#2563eb;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Review Calendar →</a>
        </div>
    </div>
    <div style="background:#f9fafb;padding:24px;text-align:center;color:#6b7280;font-size:12px;">
        <p><strong>{company_name}</strong></p>
    </div>
</div>
</body></html>'''

            email = EmailMultiAlternatives(
                subject=subject,
                body=f"Annual calendar for {calendar.year} needs your approval. View: {portal_url}/calendar/pending-approvals",
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[approver.official_email],
            )
            email.attach_alternative(html_body, "text/html")
            email.send(fail_silently=True)

        except Exception as exc:
            logger.exception(f"Failed to notify approver: {exc}")

    @staticmethod
    def _notify_calendar_approved(calendar, approver):
        """Notify creator that calendar was approved."""
        try:
            from HRMSapp.models import Notification
            if calendar.created_by:
                Notification.objects.create(
                    recipient=calendar.created_by,
                    notification_type='APPROVAL_APPROVED',
                    title=f'Calendar Approved: {calendar.year}',
                    message=f'Annual calendar {calendar.year} is approved. Ready to publish.',
                    link=f'/calendar/manage/{calendar.id}',
                )
        except Exception as exc:
            logger.exception(f"Notification failed: {exc}")

    @staticmethod
    def _notify_calendar_rejected(calendar, approver, reason):
        try:
            from HRMSapp.models import Notification
            if calendar.created_by:
                Notification.objects.create(
                    recipient=calendar.created_by,
                    notification_type='APPROVAL_REJECTED',
                    title=f'Calendar Rejected: {calendar.year}',
                    message=f'Rejected by {approver.full_name}. Reason: {reason}',
                    link=f'/calendar/manage/{calendar.id}',
                )
        except Exception as exc:
            logger.exception(f"Notification failed: {exc}")

    @staticmethod
    def _notify_calendar_returned(calendar, approver, comments):
        try:
            from HRMSapp.models import Notification
            from django.conf import settings
            from django.core.mail import EmailMultiAlternatives

            if not calendar.created_by:
                return

            Notification.objects.create(
                recipient=calendar.created_by,
                notification_type='APPROVAL_REJECTED',
                title=f'🔄 Changes Requested: Calendar {calendar.year}',
                message=f'{approver.full_name} requested changes. Comments: {comments[:100]}',
                link=f'/calendar/manage/{calendar.id}',
            )

            # Send email
            portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
            html_body = f'''<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
<h2>🔄 Changes Requested — Annual Calendar {calendar.year}</h2>
<p>Hello {calendar.created_by.full_name},</p>
<p><strong>{approver.full_name}</strong> has requested changes:</p>
<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;margin:16px 0;">
    <p style="margin:0;white-space:pre-wrap;">{comments}</p>
</div>
<p><a href="{portal_url}/calendar/manage/{calendar.id}" style="background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Edit Calendar</a></p>
</div>'''

            email = EmailMultiAlternatives(
                subject=f"🔄 Changes Requested: Calendar {calendar.year}",
                body=f"Changes requested by {approver.full_name}: {comments}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[calendar.created_by.official_email],
            )
            email.attach_alternative(html_body, "text/html")
            email.send(fail_silently=True)

        except Exception as exc:
            logger.exception(f"Notification failed: {exc}")



    @staticmethod
    def notify_hr_to_create_next_calendar():
        """
        Runs in late December. Notifies HR to create next year's calendar.
        Should be scheduled via Celery Beat.
        """
        from HRMSapp.models import UserAccount, Notification
        from django.conf import settings
        from django.core.mail import EmailMultiAlternatives

        today = timezone.localdate()
        next_year = today.year + 1

        # Check if next year's calendar already exists
        from ..models import AnnualCalendar
        if AnnualCalendar.objects.filter(year=next_year).exists():
            logger.info(f"Calendar for {next_year} already exists. Skipping notification.")
            return

        # Get all HR admins
        hr_users = UserAccount.objects.filter(
            is_active=True, roles__role_name='HR_ADMIN',
        ).select_related('employee').distinct()

        portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
        company_name = getattr(settings, 'COMPANY_NAME', 'Company')

        for user in hr_users:
            if not user.employee:
                continue
            try:
                # In-app notification
                Notification.objects.create(
                    recipient=user.employee,
                    notification_type='SYSTEM',
                    title=f'📅 Action Required: Create {next_year} Annual Calendar',
                    message=(
                        f'The year is ending soon. Please create the annual holiday calendar '
                        f'for {next_year} to ensure employees have their leave planning ready.'
                    ),
                    link='/calendar/manage',
                )

                # Email
                html_body = f'''<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:32px;color:white;text-align:center;border-radius:12px 12px 0 0;">
    <h1>📅 Time to Prepare {next_year} Calendar</h1>
    </div>
    <div style="background:white;padding:32px;border-radius:0 0 12px 12px;">
    <p>Hello <strong>{user.employee.full_name}</strong>,</p>
    <p>The end of the year is approaching. It's time to prepare the annual holiday calendar for <strong>{next_year}</strong>.</p>
    <h3>What to include:</h3>
    <ul>
    <li>National holidays</li>
    <li>Regional holidays (per location)</li>
    <li>Company-specific holidays</li>
    <li>Optional/Restricted holidays</li>
    </ul>
    <p>After creation, submit for approval. Once approved, all employees will be notified.</p>
    <div style="text-align:center;margin:24px 0;">
        <a href="{portal_url}/calendar/manage" style="background:#2563eb;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600;">Create Calendar →</a>
    </div>
    </div>
    </div>'''

                email = EmailMultiAlternatives(
                    subject=f"📅 Action Required: Create {next_year} Annual Calendar",
                    body=f"Please create the {next_year} annual calendar at {portal_url}/calendar/manage",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[user.employee.official_email],
                )
                email.attach_alternative(html_body, "text/html")
                email.send(fail_silently=True)
            except Exception as exc:
                logger.exception(f"Failed to notify HR: {exc}")

        logger.info(f"📧 Notified {hr_users.count()} HR admins about {next_year} calendar")        



    @staticmethod
    @transaction.atomic
    def amend_add_holiday(calendar, holiday_data, reason, made_by):
        """Add a holiday to a PUBLISHED calendar with audit trail."""
        from ..models import Holiday, CalendarAmendment

        if calendar.status != 'PUBLISHED':
            raise CalendarServiceError(
                f"Can only amend PUBLISHED calendars. Current: {calendar.get_status_display()}"
            )

        if not reason or len(reason.strip()) < 5:
            raise CalendarServiceError("Please provide a reason for this amendment (min 5 chars)")

        if holiday_data['date'].year != calendar.year:
            raise CalendarServiceError(f"Date must be in {calendar.year}")

        location_ids = holiday_data.pop('applicable_locations', [])
        holiday = Holiday.objects.create(
            calendar=calendar,
            is_active=True,  # Immediately active since calendar is published
            **holiday_data
        )
        if location_ids:
            holiday.applicable_locations.set(location_ids)

        # Record amendment
        CalendarAmendment.objects.create(
            calendar=calendar,
            action='ADD',
            holiday_name=holiday.name,
            holiday_date=holiday.date,
            reason=reason,
            made_by=made_by,
            holiday_snapshot={
                'name': holiday.name,
                'date': str(holiday.date),
                'type': holiday.holiday_type,
            },
        )

        # Notify employees about the addition
        AnnualCalendarService._notify_calendar_amendment(
            calendar, 'ADD', holiday, reason, made_by
        )

        logger.info(f"✅ Added holiday {holiday.name} to published calendar {calendar.year}")
        return holiday


    @staticmethod
    @transaction.atomic
    def amend_remove_holiday(calendar, holiday_id, reason, made_by):
        """Remove a holiday from a PUBLISHED calendar with audit trail."""
        from ..models import Holiday, CalendarAmendment

        if calendar.status != 'PUBLISHED':
            raise CalendarServiceError(
                f"Can only amend PUBLISHED calendars. Current: {calendar.get_status_display()}"
            )

        if not reason or len(reason.strip()) < 5:
            raise CalendarServiceError("Please provide a reason for removal (min 5 chars)")

        try:
            holiday = Holiday.objects.get(id=holiday_id, calendar=calendar)
        except Holiday.DoesNotExist:
            raise CalendarServiceError("Holiday not found in this calendar")

        # Snapshot before deletion
        snapshot = {
            'name': holiday.name,
            'date': str(holiday.date),
            'type': holiday.holiday_type,
        }
        holiday_name = holiday.name
        holiday_date = holiday.date

        # Record amendment BEFORE deleting
        CalendarAmendment.objects.create(
            calendar=calendar,
            action='REMOVE',
            holiday_name=holiday_name,
            holiday_date=holiday_date,
            reason=reason,
            made_by=made_by,
            holiday_snapshot=snapshot,
        )

        # Notify BEFORE deleting (need holiday object for email)
        AnnualCalendarService._notify_calendar_amendment(
            calendar, 'REMOVE', holiday, reason, made_by
        )

        # Delete the holiday
        holiday.delete()

        logger.info(f"✅ Removed holiday {holiday_name} from calendar {calendar.year}")
        return {'removed': holiday_name, 'date': str(holiday_date)}


    @staticmethod
    def _notify_calendar_amendment(calendar, action, holiday, reason, made_by):
        """Notify all employees about a calendar amendment."""
        try:
            from ..tasks import notify_employees_calendar_amendment
            notify_employees_calendar_amendment.delay(
                str(calendar.id),
                action,
                holiday.name,
                str(holiday.date),
                reason,
                made_by.full_name if made_by else 'HR Team',
            )
        except Exception as exc:
            logger.warning(f"Failed to queue amendment notification: {exc}")    