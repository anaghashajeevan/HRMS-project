import base64
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import EmployeeReimbursementProfile


PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


class SessionAuthBridgeTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="employee",
            email="employee@example.com",
            password="secret-pass",
            first_name="Jithin",
            last_name="Raj",
        )
        EmployeeReimbursementProfile.objects.create(
            user=self.user,
            employee_name="Jithin Raj",
            department="Technology",
            default_claim_month=6,
            default_claim_year=2026,
            finance_head_email="finance@vbsai.com",
            cc_emails=[],
            is_complete=True,
        )
        self.client = Client(enforce_csrf_checks=True)

    def _csrf_token(self):
        response = self.client.get(reverse("auth-csrf"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("csrftoken", self.client.cookies)
        self.assertEqual(response.json()["detail"], "CSRF cookie set")
        self.assertTrue(response.json()["csrfToken"])
        return response.json()["csrfToken"]

    def test_csrf_endpoint_sets_cookie(self):
        token = self._csrf_token()

        self.assertTrue(token)
        self.assertTrue(self.client.cookies["csrftoken"].value)

    def test_login_success_with_username_and_me_endpoint(self):
        token = self._csrf_token()

        login_response = self.client.post(
            reverse("auth-login"),
            {"username": "employee", "password": "secret-pass"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        me_response = self.client.get(reverse("auth-me"))

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(login_response.json()["user"]["username"], "employee")
        self.assertEqual(login_response.json()["user"]["email"], "employee@example.com")
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.json()["user"]["id"], self.user.id)

    def test_login_success_with_email(self):
        token = self._csrf_token()

        response = self.client.post(
            reverse("auth-login"),
            {"username": "employee@example.com", "password": "secret-pass"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["user"]["username"], "employee")

    def test_login_trusts_vite_5174_origin_with_csrf_header(self):
        origin = "http://127.0.0.1:5174"
        self.assertIn(origin, settings.CSRF_TRUSTED_ORIGINS)
        self.assertIn(origin, settings.CORS_ALLOWED_ORIGINS)

        csrf_response = self.client.get(reverse("auth-csrf"), HTTP_ORIGIN=origin)
        token = self.client.cookies["csrftoken"].value
        login_response = self.client.post(
            reverse("auth-login"),
            {"username": "employee", "password": "secret-pass"},
            content_type="application/json",
            HTTP_ORIGIN=origin,
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(csrf_response.status_code, status.HTTP_200_OK)
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(login_response.json()["user"]["username"], "employee")

    def test_login_failure(self):
        token = self._csrf_token()

        response = self.client.post(
            reverse("auth-login"),
            {"username": "employee", "password": "wrong"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid", response.json()["detail"])

    def test_me_unauthenticated_returns_401(self):
        response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_ends_session(self):
        token = self._csrf_token()
        self.client.post(
            reverse("auth-login"),
            {"username": "employee", "password": "secret-pass"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        token = self.client.cookies["csrftoken"].value

        logout_response = self.client.post(reverse("auth-logout"), HTTP_X_CSRFTOKEN=token)
        me_response = self.client.get(reverse("auth-me"))

        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(ALLOWED_RECIPIENT_DOMAINS=["vbsai.com"])
    def test_register_creates_user_profile_and_session(self):
        token = self._csrf_token()

        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "new.employee@example.com",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
                "employee_name": "New Employee",
                "department": "Operations",
                "claim_month": 6,
                "claim_year": 2026,
                "finance_head_email": "rahul.ab@vbsai.com",
                "cc_emails": ["jithin.raj@vbsai.com"],
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        me_response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["user"]["email"], "new.employee@example.com")
        self.assertTrue(response.json()["profile"]["is_complete"])
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            EmployeeReimbursementProfile.objects.filter(
                user__email="new.employee@example.com",
                finance_head_email="rahul.ab@vbsai.com",
            ).exists()
        )

    @override_settings(ALLOWED_RECIPIENT_DOMAINS=["vbsai.com"])
    def test_register_blocks_duplicate_email(self):
        token = self._csrf_token()

        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "employee@example.com",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
                "employee_name": "Employee",
                "department": "Technology",
                "claim_month": 6,
                "claim_year": 2026,
                "finance_head_email": "rahul.ab@vbsai.com",
                "cc_emails": [],
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", response.json()["email"][0])

    @patch("reimbursements.views.enqueue_smart_upload")
    def test_quick_claim_multipart_upload_requires_and_accepts_explicit_csrf_header(self, mocked_enqueue):
        mocked_enqueue.return_value = SimpleNamespace(id="task-123")
        token = self._csrf_token()
        login_response = self.client.post(
            reverse("auth-login"),
            {"username": "employee", "password": "secret-pass"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        rotated_token = self.client.cookies["csrftoken"].value

        missing_csrf_response = self.client.post(
            reverse("quick-claim-upload"),
            {
                "employee_name": "Jithin Raj",
                "month": 6,
                "year": 2026,
                "recipient_email": "finance@vbsai.com",
                "files[]": SimpleUploadedFile("bill.png", PNG_BYTES, content_type="image/png"),
            },
        )
        success_response = self.client.post(
            reverse("quick-claim-upload"),
            {
                "employee_name": "Jithin Raj",
                "month": 6,
                "year": 2026,
                "recipient_email": "finance@vbsai.com",
                "files[]": SimpleUploadedFile("bill.png", PNG_BYTES, content_type="image/png"),
            },
            HTTP_X_CSRFTOKEN=rotated_token,
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(missing_csrf_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(missing_csrf_response.json()["detail"], "CSRF Failed: CSRF token missing.")
        self.assertEqual(success_response.status_code, status.HTTP_202_ACCEPTED)


class QuickClaimSessionAuthTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="employee", password="secret-pass")
        self.other_user = get_user_model().objects.create_user(username="other", password="secret-pass")
        EmployeeReimbursementProfile.objects.create(
            user=self.user,
            employee_name="Jithin Raj",
            department="Technology",
            default_claim_month=6,
            default_claim_year=2026,
            finance_head_email="finance@vbsai.com",
            cc_emails=[],
            is_complete=True,
        )

    def test_quick_claim_upload_unauthenticated_is_rejected(self):
        response = self.client.post(
            reverse("quick-claim-upload"),
            {
                "employee_name": "Jithin Raj",
                "month": 6,
                "year": 2026,
                "files[]": SimpleUploadedFile("bill.png", PNG_BYTES, content_type="image/png"),
            },
            format="multipart",
        )

        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    @patch("reimbursements.views.enqueue_smart_upload")
    def test_quick_claim_upload_authenticated_session_succeeds_and_owner_scoping_remains(self, mocked_enqueue):
        mocked_enqueue.return_value = SimpleNamespace(id="task-123")
        self.client.login(username="employee", password="secret-pass")
        response = self.client.post(
            reverse("quick-claim-upload"),
            {
                "employee_name": "Jithin Raj",
                "month": 6,
                "year": 2026,
                "files[]": SimpleUploadedFile("bill.png", PNG_BYTES, content_type="image/png"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        upload_id = response.data["id"]
        self.client.logout()
        self.client.login(username="other", password="secret-pass")
        scoped_response = self.client.get(reverse("quick-claim-status", args=[upload_id]))

        self.assertEqual(scoped_response.status_code, status.HTTP_404_NOT_FOUND)
