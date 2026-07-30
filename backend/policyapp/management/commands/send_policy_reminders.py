"""
Send policy acknowledgment reminders.
Run daily via cron/task scheduler.

Usage:
    python manage.py send_policy_reminders
"""

from django.core.management.base import BaseCommand
from policyapp.services.policy_service import PolicyService


class Command(BaseCommand):
    help = "Send policy acknowledgment reminders to employees with pending acknowledgments."

    def handle(self, *args, **options):
        self.stdout.write("🔔 Checking for policy acknowledgment reminders...")
        count = PolicyService.send_reminders()
        if count > 0:
            self.stdout.write(self.style.SUCCESS(f"✅ Sent {count} reminders"))
        else:
            self.stdout.write(self.style.WARNING("No reminders needed"))