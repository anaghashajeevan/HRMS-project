"""
Management command to run scheduled DAILY attendance automation.

This command:
1. Reads AutomationSettings from DB
2. Checks if it's time to run (auto_send_time reached)
3. Checks if already sent successfully today (avoids duplicates)
4. If due → fetches eSSL punches, generates report, sends email
5. If not due → prints message and exits

Called by:
- Windows Task Scheduler (every 10 minutes)
- OR manually: python manage.py run_scheduled_attendance

Usage:
    python manage.py run_scheduled_attendance
    python manage.py run_scheduled_attendance --force  (skip time checks, run now)
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from attendanceapp.models import AutomationSettings, EmailReportLog
from attendanceapp.services.automation_service import run_attendance_automation


class Command(BaseCommand):
    help = "Run scheduled daily attendance automation when the configured send time is due."

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force run even if not due time (bypasses time and duplicate checks)',
        )

    def handle(self, *args, **options):
        settings_obj = AutomationSettings.get_solo()
        now = timezone.localtime(timezone.now())
        today = now.date()
        force = options.get('force', False)

        self.stdout.write(f"⏰ Current time: {now.strftime('%Y-%m-%d %H:%M:%S')}")
        self.stdout.write(f"⏰ Auto send time: {settings_obj.auto_send_time.strftime('%H:%M')}")

        # --- Check 1: Is daily report email enabled? ---
        if not settings_obj.enable_daily_report_email and not force:
            self.stdout.write(
                self.style.WARNING("⏭  SKIPPED: Daily Report Email is disabled in Settings.")
            )
            self.stdout.write(
                self.style.WARNING("   → Enable it: Attendance → Settings → 'Enable Daily Report Email'")
            )
            return

        # --- Check 2: Is it time yet? ---
        if now.time() < settings_obj.auto_send_time and not force:
            self.stdout.write(
                self.style.WARNING(
                    f"⏭  SKIPPED: Not due yet. Auto Send Time is {settings_obj.auto_send_time.strftime('%H:%M')}."
                )
            )
            self.stdout.write(
                self.style.WARNING(f"   → Will run after {settings_obj.auto_send_time.strftime('%H:%M')}")
            )
            return

        # --- Check 3: Already sent successfully today? ---
        already_sent = EmailReportLog.objects.filter(
            report_date=today,
            status=EmailReportLog.STATUS_SUCCESS,
        ).exists()
        if already_sent and not force:
            self.stdout.write(
                self.style.SUCCESS("✅ Today's report has already been sent successfully. Nothing to do.")
            )
            return

        # --- All checks passed → RUN ---
        self.stdout.write("🚀 Starting daily attendance automation...")
        result = run_attendance_automation(report_date=today, force_send=False)

        if result.get("ok"):
            self.stdout.write(self.style.SUCCESS(f"✅ SUCCESS: {result['message']}"))
            if result.get("skipped"):
                self.stdout.write(self.style.WARNING(f"⏭  (Skipped: {result['message']})"))
        else:
            self.stdout.write(self.style.ERROR(f"❌ FAILED: {result['message']}"))