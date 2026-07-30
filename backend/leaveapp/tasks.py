from celery import shared_task
import logging
from django.utils import timezone
logger = logging.getLogger(__name__)


@shared_task
def notify_hr_next_calendar():
    """Celery Beat runs this daily — only fires in last week of December."""
    today = timezone.localdate()
    if today.month == 12 and today.day >= 25:
        from .services.calendar_service import AnnualCalendarService
        AnnualCalendarService.notify_hr_next_calendar()
        return f"Reminded HR about {today.year + 1} calendar"
    return "Not December last week — skipped"


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def notify_employees_calendar_published(self, calendar_id):
    """
    Runs in background AFTER publish transaction completes.
    Sends notifications + emails to all employees.
    """
    from .models import AnnualCalendar
    from HRMSapp.models import Notification, Employee
    from django.conf import settings
    from django.core.mail import EmailMultiAlternatives

    try:
        calendar = AnnualCalendar.objects.get(id=calendar_id)
    except AnnualCalendar.DoesNotExist:
        logger.error(f"Calendar {calendar_id} not found")
        return

    employees = Employee.objects.filter(
        is_deleted=False,
        status__in=['ACTIVE', 'PROBATION'],
    )

    portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
    company_name = getattr(settings, 'COMPANY_NAME', 'Company')

    sent_count = 0
    error_count = 0

    for emp in employees:
        # 1) In-app notification (fast — batched writes)
        try:
            Notification.objects.create(
                recipient=emp,
                notification_type='SYSTEM',
                title=f'📅 {calendar.year} Holiday Calendar Published',
                message=(
                    f'The holiday calendar for {calendar.year} is now live. '
                    f'{calendar.holiday_count} holidays announced.'
                ),
                link='/calendar',
            )
        except Exception as exc:
            logger.warning(f"Notification failed for {emp.employee_id}: {exc}")

        # 2) Email (rate-limited to avoid SMTP overload)
        try:
            html = f'''<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
<div style="background:linear-gradient(135deg,#10b981,#059669);padding:32px;color:white;text-align:center;border-radius:12px 12px 0 0;">
<h1 style="margin:0;">📅 {calendar.year} Holiday Calendar</h1>
</div>
<div style="background:white;padding:32px;border-radius:0 0 12px 12px;">
<p>Hello <strong>{emp.full_name}</strong>,</p>
<p>The official holiday calendar for <strong>{calendar.year}</strong> has been published.</p>
<p><strong>Total Holidays:</strong> {calendar.holiday_count}</p>
<div style="text-align:center;margin:24px 0;">
<a href="{portal_url}/calendar" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">View Calendar →</a>
</div>
</div>
</div>'''

            email = EmailMultiAlternatives(
                subject=f"📅 {calendar.year} Holiday Calendar Published",
                body=f"View calendar at {portal_url}/calendar",
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[emp.official_email],
            )
            email.attach_alternative(html, "text/html")
            email.send(fail_silently=True)
            sent_count += 1
        except Exception as exc:
            logger.warning(f"Email failed for {emp.employee_id}: {exc}")
            error_count += 1

    logger.info(
        f"📧 Calendar {calendar.year} published notification: "
        f"{sent_count} emails sent, {error_count} errors"
    )
    return f"Sent to {sent_count} employees"



@shared_task
def notify_employees_calendar_amendment(
    calendar_id, action, holiday_name, holiday_date, reason, made_by_name
):
    """Notify all employees about calendar amendment."""
    from .models import AnnualCalendar
    from HRMSapp.models import Notification, Employee
    from django.conf import settings
    from django.core.mail import EmailMultiAlternatives

    try:
        calendar = AnnualCalendar.objects.get(id=calendar_id)
    except AnnualCalendar.DoesNotExist:
        return

    employees = Employee.objects.filter(
        is_deleted=False,
        status__in=['ACTIVE', 'PROBATION'],
    )

    portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
    company_name = getattr(settings, 'COMPANY_NAME', 'Company')

    # Action-specific messaging
    if action == 'ADD':
        emoji = '➕'
        title = f'{emoji} Holiday Added: {holiday_name}'
        header_title = 'New Holiday Added'
        gradient = '#10b981,#059669'
        action_text = 'has been added to the calendar'
    else:  # REMOVE
        emoji = '➖'
        title = f'{emoji} Holiday Removed: {holiday_name}'
        header_title = 'Holiday Removed'
        gradient = '#ef4444,#dc2626'
        action_text = 'has been removed from the calendar'

    for emp in employees:
        try:
            Notification.objects.create(
                recipient=emp,
                notification_type='SYSTEM',
                title=title,
                message=(
                    f'The holiday "{holiday_name}" on {holiday_date} {action_text}. '
                    f'Reason: {reason}'
                ),
                link='/calendar',
            )

            html = f'''<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
<div style="background:linear-gradient(135deg,{gradient});padding:32px;color:white;text-align:center;border-radius:12px 12px 0 0;">
<h1 style="margin:0;">{emoji} {header_title}</h1>
<p style="opacity:0.9;">Calendar {calendar.year}</p>
</div>
<div style="background:white;padding:32px;border-radius:0 0 12px 12px;">
<p>Hello <strong>{emp.full_name}</strong>,</p>
<p>An update has been made to the {calendar.year} holiday calendar.</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:10px;background:#f9fafb;font-weight:600;">Holiday</td><td style="padding:10px;">{holiday_name}</td></tr>
<tr><td style="padding:10px;background:#f9fafb;font-weight:600;">Date</td><td style="padding:10px;">{holiday_date}</td></tr>
<tr><td style="padding:10px;background:#f9fafb;font-weight:600;">Action</td><td style="padding:10px;">{action_text.title()}</td></tr>
<tr><td style="padding:10px;background:#f9fafb;font-weight:600;">Amended By</td><td style="padding:10px;">{made_by_name}</td></tr>
</table>

<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;margin:16px 0;border-radius:4px;">
<p style="margin:0;font-weight:600;">Reason:</p>
<p style="margin:4px 0 0 0;">{reason}</p>
</div>

<div style="text-align:center;margin:24px 0;">
<a href="{portal_url}/calendar" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">View Calendar →</a>
</div>
</div>
</div>'''

            email = EmailMultiAlternatives(
                subject=title,
                body=f"{holiday_name} on {holiday_date} {action_text}. Reason: {reason}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[emp.official_email],
            )
            email.attach_alternative(html, "text/html")
            email.send(fail_silently=True)
        except Exception as exc:
            logger.warning(f"Amendment notification failed for {emp.employee_id}: {exc}")

    logger.info(f"📧 Notified employees about calendar amendment: {action} {holiday_name}")



@shared_task
def scan_and_credit_compoff():
    """
    Daily task: scan yesterday's attendance and credit comp-off for weekend/holiday work.
    Runs every day at 11 PM via Celery Beat.
    """
    from .services.compoff_service import CompOffService
    
    logger.info("🔍 Starting daily Comp-Off scan...")
    
    try:
        result = CompOffService.scan_yesterday()
        
        logger.info(
            f"✅ Comp-Off scan done: "
            f"{result['credited_count']} credits, "
            f"{result['total_days_credited']} total days"
        )
        return result
    except Exception as exc:
        logger.exception(f"❌ Comp-Off scan failed: {exc}")
        raise