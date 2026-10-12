"""
Sync eSSL punches into RawPunchLog + DailyAttendance.
Run every 5 minutes automatically via Celery Beat or Cron.
"""

from datetime import datetime, time, timedelta
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from attendanceapp.models import AutomationSettings
from attendanceapp.services.attendance_processor import process_attendance_period
from attendanceapp.services.essl_service import fetch_logs_for_range

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Sync recent eSSL punches into attendance tables (for live calendars)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=2,
            help="How many days back to sync (default: 2 days).",
        )

    def handle(self, *args, **options):
        days = max(1, int(options["days"]))
        today = timezone.localdate()
        start_date = today - timedelta(days=days - 1)
        end_date = today

        settings_obj = AutomationSettings.get_solo()

        try:
            mode, logs = fetch_logs_for_range(
                datetime.combine(start_date, time.min),
                datetime.combine(end_date, time(23, 59, 59)),
            )
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"eSSL fetch failed: {exc}"))
            return

        if not logs:
            self.stdout.write(self.style.WARNING("No logs returned from eSSL."))
            return

        rows = process_attendance_period(
            logs, settings_obj, start_date, end_date
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"OK: mode={mode} raw_logs={len(logs)} daily_rows={len(rows)}"
            )
        )