"""
Diagnostic command to test eSSL device + SMTP connectivity.

Safe to run anytime - doesn't modify data, just checks connections.
Very useful when troubleshooting failed automation runs.

Usage:
    python manage.py diagnose_essl
"""

import os
import socket
import smtplib
from urllib.parse import urlparse

from django.core.management.base import BaseCommand
from django.utils import timezone

from attendanceapp.models import AutomationSettings
from attendanceapp.services.email_service import EmailConfigurationError, get_report_receiver_email
from attendanceapp.services.essl_service import test_connection


class Command(BaseCommand):
    help = "Diagnose eSSL device and SMTP connectivity (safe to run anytime)."

    def _ok(self, label, message="OK"):
        self.stdout.write(self.style.SUCCESS(f"  [OK]   {label}: {message}"))

    def _warn(self, label, message):
        self.stdout.write(self.style.WARNING(f"  [WARN] {label}: {message}"))

    def _fail(self, label, exc):
        self.stdout.write(
            self.style.ERROR(f"  [FAIL] {label}: {exc.__class__.__name__}: {exc}")
        )

    def _configured(self, value):
        return "✅ Configured" if value else "❌ Not Configured"

    def handle(self, *args, **options):
        settings_obj = AutomationSettings.get_solo()

        try:
            cto_email = get_report_receiver_email()
        except EmailConfigurationError:
            cto_email = ""

        self.stdout.write("")
        self.stdout.write("=" * 70)
        self.stdout.write(self.style.MIGRATE_HEADING(" ATTENDANCE DIAGNOSTICS "))
        self.stdout.write("=" * 70)

        # ===== Configuration Overview =====
        self.stdout.write(self.style.MIGRATE_HEADING("\n📋 CONFIGURATION:"))
        self.stdout.write(f"  Django timezone       : {timezone.get_current_timezone_name()}")
        self.stdout.write(f"  Current time          : {timezone.localtime(timezone.now()).strftime('%Y-%m-%d %H:%M:%S')}")
        self.stdout.write("")
        self.stdout.write(f"  eSSL API URL          : {settings_obj.essl_api_url or '❌ Missing'}")
        self.stdout.write(f"  Device Serial Number  : {self._configured(settings_obj.device_serial_number)}")
        self.stdout.write(f"  API Username          : {self._configured(settings_obj.api_username)}")
        self.stdout.write(f"  API Password          : {self._configured(settings_obj.get_api_password())}")
        self.stdout.write("")
        self.stdout.write(f"  SMTP Host             : {settings_obj.smtp_host or '❌ Missing'}")
        self.stdout.write(f"  SMTP Port             : {settings_obj.smtp_port}")
        self.stdout.write(f"  Sender Email          : {self._configured(settings_obj.sender_email)}")
        self.stdout.write(f"  SMTP Password         : {self._configured(settings_obj.get_smtp_password())}")
        self.stdout.write(f"  Report Receiver Email : {self._configured(cto_email)}")
        if cto_email:
            self.stdout.write(f"                          → {cto_email}")
        self.stdout.write("")
        self.stdout.write(f"  Daily Email Enabled   : {'✅ Yes' if settings_obj.enable_daily_report_email else '❌ No'}")
        self.stdout.write(f"  Monthly Email Enabled : {'✅ Yes' if settings_obj.enable_monthly_report else '❌ No'}")
        self.stdout.write(f"  Auto Send Time        : {settings_obj.auto_send_time.strftime('%H:%M')}")
        self.stdout.write(f"  Monthly Send Day      : {settings_obj.monthly_send_day}")
        self.stdout.write(f"  Monthly Send Time     : {settings_obj.monthly_send_time.strftime('%H:%M')}")

        # ===== eSSL Connectivity =====
        self.stdout.write(self.style.MIGRATE_HEADING("\n🔌 eSSL CONNECTIVITY:"))

        parsed = urlparse(settings_obj.essl_api_url or "")
        essl_host = parsed.hostname
        essl_port = parsed.port or (443 if parsed.scheme == "https" else 80)

        # Test socket connection
        if essl_host:
            try:
                with socket.create_connection((essl_host, essl_port), timeout=10):
                    self._ok("Socket Connection", f"{essl_host}:{essl_port} reachable")
            except OSError as exc:
                self._fail("Socket Connection", exc)
                self.stdout.write(self.style.WARNING(
                    f"     → Check: Is the eSSL device on and connected to network?"
                ))
                self.stdout.write(self.style.WARNING(
                    f"     → Try: ping {essl_host}"
                ))
        else:
            self._warn("Socket Connection", "Skipped (no host configured)")

        # Test SOAP API
        try:
            result = test_connection(settings_obj)
            self._ok("SOAP API", f"Response received. Logs available: {result['log_count']}")
        except Exception as exc:
            self._fail("SOAP API", exc)

        # ===== SMTP Connectivity =====
        self.stdout.write(self.style.MIGRATE_HEADING("\n📧 SMTP CONNECTIVITY:"))

        smtp_host = settings_obj.smtp_host
        smtp_port = settings_obj.smtp_port

        if smtp_host:
            # DNS lookup
            try:
                socket.getaddrinfo(smtp_host, smtp_port, type=socket.SOCK_STREAM)
                self._ok("DNS Resolution", f"{smtp_host} resolved")
            except OSError as exc:
                self._fail("DNS Resolution", exc)

            # Socket connect
            try:
                with socket.create_connection((smtp_host, smtp_port), timeout=10):
                    self._ok("Socket Connection", f"{smtp_host}:{smtp_port} reachable")
            except OSError as exc:
                self._fail("Socket Connection", exc)

            # STARTTLS handshake
            try:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    self._ok("STARTTLS", "TLS handshake successful")
            except Exception as exc:
                self._fail("STARTTLS", exc)

            # Try login (if password is set)
            if settings_obj.get_smtp_password():
                try:
                    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
                        server.ehlo()
                        server.starttls()
                        server.ehlo()
                        server.login(settings_obj.sender_email, settings_obj.get_smtp_password())
                        self._ok("Authentication", "Login successful")
                except Exception as exc:
                    self._fail("Authentication", exc)
                    self.stdout.write(self.style.WARNING(
                        "     → Check: Sender email and SMTP password"
                    ))
                    self.stdout.write(self.style.WARNING(
                        "     → Gmail? Use App Password (not regular password)"
                    ))
        else:
            self._warn("SMTP Tests", "Skipped (no SMTP host configured)")

        # ===== Proxy Environment (helps debug corporate networks) =====
        self.stdout.write(self.style.MIGRATE_HEADING("\n🌐 PROXY ENVIRONMENT:"))
        proxy_found = False
        for name in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"):
            value = os.environ.get(name)
            if value:
                self.stdout.write(f"  {name}: {value}")
                proxy_found = True
        if not proxy_found:
            self.stdout.write("  No proxy environment variables detected")

        # ===== Summary =====
        self.stdout.write("")
        self.stdout.write("=" * 70)
        self.stdout.write(self.style.MIGRATE_HEADING(" DIAGNOSTICS COMPLETE "))
        self.stdout.write("=" * 70)
        self.stdout.write("")
        self.stdout.write("💡 If all checks passed, run:")
        self.stdout.write(self.style.SUCCESS("     python manage.py run_scheduled_attendance --force"))
        self.stdout.write("")