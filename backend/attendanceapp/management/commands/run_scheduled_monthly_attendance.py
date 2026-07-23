"""
Management command to run scheduled MONTHLY attendance report.

This command:
1. Reads AutomationSettings from DB
2. Checks if today is the configured send day
3. Checks if time is past the configured send time
4. Checks if already sent for target month
5. If due → generates monthly Excel, sends email
6. If not due → prints message and exits

Called by:
- Windows Task Scheduler (every 1 hour)
- OR manually: python manage.py run_scheduled_monthly_attendance

Usage:
    python manage.py run_scheduled_monthly_attendance
    python manage.py run_scheduled_monthly_attendance --force  (skip checks, run now)
"""

from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from attendanceapp.models import AutomationSettings, MonthlyReportLog
from attendanceapp.services.monthly_report_service import send_monthly_report


def _previous_month(value):
    if value.month == 1:
        return value.year - 1, 12
    return value.year, value.month - 1


def _target_month(settings_obj, today):
    """Decide which month's report to send based on settings."""
    if settings_obj.monthly_report_mode == AutomationSettings.MONTHLY_MODE_CURRENT:
        return today.year, today.month
    return _previous_month(today)


def _is_send_day(settings_obj, today):
    """Check if today is the configured send day of month."""
    try:
        send_day = int(settings_obj.monthly_send_day or 1)
    except (TypeError, ValueError):
        send_day = 1
    return today.day == send_day


class Command(BaseCommand):
    help = "Run scheduled monthly attendance report when monthly settings are due."

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force run even if not scheduled (bypasses day/time/duplicate checks)',
        )
        parser.add_argument(
            '--year',
            type=int,
            help='Override target year (default: previous or current month based on settings)',
        )
        parser.add_argument(
            '--month',
            type=int,
            help='Override target month (default: previous or current month based on settings)',
        )

    def handle(self, *args, **options):
        settings_obj = AutomationSettings.get_solo()
        now = timezone.localtime(timezone.now())
        today = date(now.year, now.month, now.day)
        force = options.get('force', False)

        self.stdout.write(f"⏰ Current time: {now.strftime('%Y-%m-%d %H:%M:%S')}")

        # --- Check 1: Is monthly report enabled? ---
        if not settings_obj.enable_monthly_report and not force:
            self.stdout.write(
                self.style.WARNING("⏭  SKIPPED: Monthly Report is disabled in Settings.")
            )
            self.stdout.write(
                self.style.WARNING("   → Enable it: Attendance → Settings → 'Enable Monthly Report Email'")
            )
            return

        # --- Check 2: Is today the send day? ---
        if not _is_send_day(settings_obj, today) and not force:
            self.stdout.write(
                self.style.WARNING(
                    f"⏭  SKIPPED: Monthly report is not due today (send day: {settings_obj.monthly_send_day}, today: {today.day})."
                )
            )
            return

        # --- Check 3: Is time past the send time? ---
        if now.time() < settings_obj.monthly_send_time and not force:
            self.stdout.write(
                self.style.WARNING(
                    f"⏭  SKIPPED: Not due yet. Monthly Send Time is {settings_obj.monthly_send_time.strftime('%H:%M')}."
                )
            )
            return

        # --- Determine target year/month ---
        if options.get('year') and options.get('month'):
            year, month = options['year'], options['month']
            self.stdout.write(f"📆 Using override month: {year}-{month:02d}")
        else:
            year, month = _target_month(settings_obj, today)
            self.stdout.write(f"📆 Target month: {year}-{month:02d} (from settings)")

        # --- Check 4: Already sent for this month? ---
        already_sent = MonthlyReportLog.objects.filter(
            year=year,
            month=month,
            status=MonthlyReportLog.STATUS_SUCCESS,
        ).exists()
        if already_sent and not force:
            self.stdout.write(
                self.style.SUCCESS(f"✅ Monthly report for {year}-{month:02d} has already been sent.")
            )
            return

        # --- All checks passed → RUN ---
        self.stdout.write(f"🚀 Starting monthly attendance report for {year}-{month:02d}...")
        result = send_monthly_report(year, month, manual_send=force)

        if result.get("ok"):
            self.stdout.write(self.style.SUCCESS(f"✅ SUCCESS: {result['message']}"))
        else:
            self.stdout.write(self.style.ERROR(f"❌ FAILED: {result['message']}"))