import os
import shutil
import smtplib
import tempfile
from unittest.mock import patch
from decimal import Decimal
from datetime import date

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from HRMSapp.models import Employee

from .classification_services import classify_expense
from .models import (
    BillExtraction,
    EmailDispatchLog,
    ExpenseAttachment,
    ExpenseItem,
    ExpenseValidation,
    GeneratedReport,
    MonthlyReimbursementBatch,
    ReimbursementClaim,
    SystemSetting,
    VendorCategoryRule,
)
from .ocr_services import (
    extract_amount_candidates_from_text,
    TESSERACT_UNAVAILABLE_MESSAGE,
    TesseractUnavailableError,
    extract_amount_from_text,
    extract_date_from_text,
    extract_invoice_number_from_text,
    find_claimed_amount_by_sum,
    find_claimed_amount_in_ocr,
    _extract_vendor_from_text,
)


TEST_MEDIA_ROOT = tempfile.mkdtemp()


class ExpenseClassificationTests(TestCase):
    def setUp(self):
        self.system_setting = SystemSetting.objects.create(
            quick_claim_confidence_threshold=0.6,
            quick_claim_llm_enabled=False,
        )

    def test_vendor_rule_is_primary_and_uses_canonical_expense_category(self):
        VendorCategoryRule.objects.update_or_create(
            vendor_keyword="Rapido",
            defaults={"category": ExpenseItem.Category.TRAVEL, "match_priority": 10},
        )

        result = classify_expense("RAPIDO ride invoice total 245", "Rapido")

        self.assertEqual(result.category, ExpenseItem.Category.TRAVEL)
        self.assertEqual(result.classification_source, ExpenseItem.ClassificationSource.VENDOR_RULE)
        self.assertFalse(result.requires_manual_review)

    def test_vendor_rule_tolerates_minor_ocr_typo(self):
        VendorCategoryRule.objects.update_or_create(
            vendor_keyword="Rapido",
            defaults={"category": ExpenseItem.Category.TRAVEL, "match_priority": 10},
        )

        result = classify_expense("RAPIDQ TAX INVOICE", "")

        self.assertEqual(result.category, ExpenseItem.Category.TRAVEL)
        self.assertEqual(result.classification_source, ExpenseItem.ClassificationSource.VENDOR_RULE)

    def test_text_heuristic_is_used_when_vendor_rule_does_not_match(self):
        result = classify_expense("Monthly broadband connection receipt", "Regional ISP")

        self.assertEqual(result.category, ExpenseItem.Category.TELEPHONE)
        self.assertEqual(result.classification_source, ExpenseItem.ClassificationSource.TEXT_HEURISTIC)

    def test_low_confidence_fallback_requires_manual_review(self):
        result = classify_expense("Invoice 49201 total 880", "Unknown Merchant")

        self.assertEqual(result.category, ExpenseItem.Category.OTHERS)
        self.assertEqual(result.confidence, 0.35)
        self.assertTrue(result.requires_manual_review)

    @patch("reimbursements.classification_services._llm_match")
    def test_llm_fallback_is_not_called_while_feature_flag_is_off(self, mocked_llm):
        classify_expense("Unclassifiable receipt", "Unknown")

        mocked_llm.assert_not_called()


class AmountExtractionTests(TestCase):
    def test_blinkit_wifi_invoice_returns_649(self):
        raw_text = """
        Blinkit
        Invoice No: BLR-1001
        Item Total 550.00
        CGST 49.50
        SGST 49.50
        Grand Total INR 649.00
        """

        self.assertEqual(extract_amount_from_text(raw_text), Decimal("649.00"))

    def test_blinkit_hdmi_invoice_returns_640(self):
        raw_text = """
        Blinkit Tax Invoice
        HDMI Cable 629.00
        Delivery Fee 11.00
        Total 629.00 11.00 640.00
        """

        self.assertEqual(extract_amount_from_text(raw_text), Decimal("640.00"))

    def test_receipt_ocr_returns_3897_from_grand_total(self):
        raw_text = """
        DECATHLON SPORTS INDIA
        Sub Total 3711.43
        Tax 185.57
        Grand To
        INR 3897
        Mode of payment CARD 3897
        """

        self.assertEqual(extract_amount_from_text(raw_text), Decimal("3897.00"))

    def test_tax_values_are_ignored_when_final_total_exists(self):
        raw_text = """
        Taxable Value 533.05
        CGST 48.81
        SGST 48.81
        Invoice Total Rs 640.00
        """

        self.assertEqual(extract_amount_from_text(raw_text), Decimal("640.00"))

    def test_phone_and_order_ids_are_ignored(self):
        raw_text = """
        Contact 9876543210
        Order ID 2026051234567
        Bill Amount INR 649.00
        """

        self.assertEqual(extract_amount_from_text(raw_text), Decimal("649.00"))

    def test_extract_amount_candidates_keeps_reasonable_bill_values(self):
        raw_text = """
        Blinkit
        Order ID 2026051234567
        HDMI Cable 629.00
        Delivery 11.00
        Total 1 48.81 48.81 640.00
        """

        self.assertEqual(
            extract_amount_candidates_from_text(raw_text),
            [Decimal("629.00"), Decimal("11.00"), Decimal("640.00")],
        )

    def test_find_claimed_amount_in_ocr_matches_blinkit_wifi_total(self):
        raw_text = """
        Blinkit
        Taxable Value 550.00
        CGST 49.50
        SGST 49.50
        Total 1 49.50 49.50 649.00
        """

        self.assertEqual(find_claimed_amount_in_ocr(raw_text, Decimal("649.00")), Decimal("649.00"))

    def test_find_claimed_amount_in_ocr_matches_blinkit_hdmi_total(self):
        raw_text = """
        Blinkit
        Item Total 629.00
        Delivery Fee 11.00
        Total 1 48.81 48.81 640.00
        """

        self.assertEqual(find_claimed_amount_in_ocr(raw_text, Decimal("640.00")), Decimal("640.00"))

    def test_find_claimed_amount_by_sum_matches_receipt_items(self):
        raw_text = """
        DECATHLON
        SENSATION 500
        1499
        1499
        899
        """

        self.assertEqual(find_claimed_amount_by_sum(raw_text, Decimal("3897.00")), Decimal("3897.00"))

    def test_real_blinkit_invoice_layout_extracts_final_total_and_metadata(self):
        raw_text = """
        Tax Invoice
        Sold By / Seller
        BLINK COMMERCE PRIVATE LIMITED
        Invoice Number : C483523T26127310
        Invoice Date : 27-May-2026
        Sr. no
        UPC
        Item Description
        Total
        1
        8904
        3368
        0041
        Portronics C-Konnect 3-in-1 USB Hub Type C + USB + HDMI
        629.00
        Delivery and other charges
        11.00
        Total
        1
        48.81
        48.81
        640.00
        Amount in
        Words:
        Six Hundred And Forty Rupees And Zero Paisa Only
        """

        self.assertEqual(extract_amount_from_text(raw_text), Decimal("640.00"))
        self.assertEqual(extract_date_from_text(raw_text), date(2026, 5, 27))
        self.assertEqual(_extract_vendor_from_text(raw_text), "BLINK COMMERCE PRIVATE LIMITED")
        self.assertEqual(extract_invoice_number_from_text(raw_text), "C483523T26127310")

    def test_real_blinkit_office_invoice_is_not_misclassified_as_travel(self):
        raw_text = """
        Tax Invoice
        Sold By / Seller
        BLINK COMMERCE PRIVATE LIMITED
        Ant Esports AE600B Wi-Fi USB Adapter
        Terms are applicable to this invoice.
        """

        result = classify_expense(raw_text, "BLINK COMMERCE PRIVATE LIMITED")

        self.assertEqual(result.category, ExpenseItem.Category.OFFICE)
        self.assertEqual(result.classification_source, ExpenseItem.ClassificationSource.TEXT_HEURISTIC)


@override_settings(
    MEDIA_ROOT=TEST_MEDIA_ROOT,
    CTO_EMAIL="cto@example.com",
    FINANCE_HEAD_EMAIL="finance@example.com",
    DEFAULT_FROM_EMAIL="noreply@example.com",
)
class ExpenseAttachmentApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="settings-admin",
            password="secret",
            is_staff=True,
        )
        cls.employee = Employee.objects.create(
            employee_id="EMP001",
            full_name="Jithin Raj C",
            department="Operations",
        )
        cls.batch = MonthlyReimbursementBatch.objects.create(
            month=5,
            year=2026,
            title="May 2026 Reimbursement Batch",
        )
        cls.claim = ReimbursementClaim.objects.create(
            batch=cls.batch,
            employee=cls.employee,
            total_claimed_amount=Decimal("649.00"),
        )
        cls.expense_item = ExpenseItem.objects.create(
            claim=cls.claim,
            description="Purchase of WiFi Dougle",
            category=ExpenseItem.Category.OFFICE_SUPPLIES,
            claimed_amount=Decimal("649.00"),
            approved_amount=Decimal("0.00"),
        )

    def setUp(self):
        self.client.force_authenticate(self.user)

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def test_expense_item_list_includes_attachment_metadata(self):
        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("wifi-dongle-bill.pdf", b"pdf-content", content_type="application/pdf"),
            original_filename="wifi-dongle-bill.pdf",
            file_type="application/pdf",
        )

        response = self.client.get(reverse("expense-item-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        item = response.data[0]
        self.assertEqual(item["id"], self.expense_item.id)
        self.assertEqual(item["attachment_count"], 1)
        self.assertTrue(item["has_attachment"])
        self.assertEqual(len(item["attachments"]), 1)
        self.assertEqual(item["attachments"][0]["id"], attachment.id)
        self.assertEqual(item["attachments"][0]["expense_item"], self.expense_item.id)
        self.assertEqual(item["attachments"][0]["original_filename"], "wifi-dongle-bill.pdf")
        self.assertEqual(item["attachments"][0]["file_type"], "application/pdf")
        self.assertTrue(item["attachments"][0]["file"])
        self.assertEqual(item["claim_id"], self.claim.id)
        self.assertEqual(item["employee_name"], self.employee.full_name)
        self.assertEqual(item["employee_id"], self.employee.employee_id)
        self.assertEqual(item["batch_title"], self.batch.title)

    def test_upload_attachment_returns_attachment_payload(self):
        upload = SimpleUploadedFile("receipt.jpg", b"fake-image", content_type="image/jpeg")

        response = self.client.post(
            reverse("upload-expense-attachment", kwargs={"pk": self.expense_item.id}),
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["expense_item"], self.expense_item.id)
        self.assertEqual(response.data["original_filename"], "receipt.jpg")
        self.assertEqual(response.data["file_type"], "image/jpeg")
        self.assertIn("uploaded_at", response.data)
        self.assertTrue(response.data["file"])

    def test_attachment_delete_endpoint_is_available(self):
        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("delete-me.pdf", b"delete-content", content_type="application/pdf"),
            original_filename="delete-me.pdf",
            file_type="application/pdf",
        )

        response = self.client.delete(reverse("expense-attachment-detail", kwargs={"pk": attachment.id}))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ExpenseAttachment.objects.filter(pk=attachment.id).exists())

    def test_run_ocr_marks_unsupported_files(self):
        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("hotel-bill.xlsx", b"sheet-content", content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            original_filename="hotel-bill.xlsx",
            file_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        response = self.client.post(reverse("run-attachment-ocr", kwargs={"pk": attachment.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], BillExtraction.Status.UNSUPPORTED)
        self.assertIn("image and PDF files only", response.data["error_message"])
        self.assertEqual(response.data["attachment"], attachment.id)

    @patch("reimbursements.ocr_services.extract_text_from_pdf", return_value="ACME STORES\nInvoice No: INV-2026\nDate: 12/05/2026\nTotal 649.00")
    def test_run_ocr_supports_pdf_files(self, mocked_extract_pdf):
        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("hotel-bill.pdf", b"pdf-content", content_type="application/pdf"),
            original_filename="hotel-bill.pdf",
            file_type="application/pdf",
        )

        response = self.client.post(reverse("run-attachment-ocr", kwargs={"pk": attachment.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], BillExtraction.Status.COMPLETED)
        self.assertEqual(response.data["attachment"], attachment.id)
        self.assertEqual(response.data["extracted_vendor"], "ACME STORES")
        self.assertEqual(response.data["extracted_invoice_number"], "INV-2026")
        self.assertEqual(response.data["extracted_amount"], "649.00")
        mocked_extract_pdf.assert_called_once()

    @patch("reimbursements.ocr_services.configure_tesseract", return_value=r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    @patch(
        "reimbursements.ocr_services.get_tesseract_version_safe",
        side_effect=TesseractUnavailableError(
            f"{TESSERACT_UNAVAILABLE_MESSAGE} Checked path: C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
        ),
    )
    def test_run_ocr_returns_readable_error_when_tesseract_is_unavailable(self, mocked_version, mocked_configure):
        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("taxi-receipt.jpg", b"image-content", content_type="image/jpeg"),
            original_filename="taxi-receipt.jpg",
            file_type="image/jpeg",
        )

        response = self.client.post(reverse("run-attachment-ocr", kwargs={"pk": attachment.id}))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"],
            f"{TESSERACT_UNAVAILABLE_MESSAGE} Checked path: C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
        )
        extraction = BillExtraction.objects.get(attachment=attachment)
        self.assertEqual(extraction.status, BillExtraction.Status.FAILED)
        self.assertEqual(
            extraction.error_message,
            f"{TESSERACT_UNAVAILABLE_MESSAGE} Checked path: C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
        )
        mocked_version.assert_called_once()

    def test_validate_expense_item_marks_missing_bill(self):
        response = self.client.post(reverse("validate-expense-item", kwargs={"pk": self.expense_item.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ExpenseValidation.Status.MISSING_BILL)
        self.assertIn("No bill", response.data["message"])

    def test_validate_expense_item_marks_needs_review_when_no_reliable_amount_exists(self):
        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("bill.jpg", b"image-content", content_type="image/jpeg"),
            original_filename="bill.jpg",
            file_type="image/jpeg",
        )
        BillExtraction.objects.create(
            attachment=attachment,
            status=BillExtraction.Status.COMPLETED,
            extracted_amount=Decimal("700.00"),
            extracted_date=self.expense_item.expense_date,
            extracted_vendor="ACME STORES",
        )

        response = self.client.post(reverse("validate-expense-item", kwargs={"pk": self.expense_item.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ExpenseValidation.Status.NEEDS_REVIEW)
        self.assertEqual(response.data["extracted_amount"], "700.00")
        self.assertEqual(response.data["amount_difference"], "51.00")
        self.assertEqual(response.data["message"], "OCR completed, but no reliable matching amount was found.")

    def test_validate_expense_item_keeps_matched_when_bill_date_missing(self):
        self.expense_item.expense_date = date(2026, 5, 12)
        self.expense_item.save(update_fields=["expense_date"])

        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("bill.jpg", b"image-content", content_type="image/jpeg"),
            original_filename="bill.jpg",
            file_type="image/jpeg",
        )
        BillExtraction.objects.create(
            attachment=attachment,
            status=BillExtraction.Status.COMPLETED,
            extracted_amount=Decimal("649.00"),
            extracted_vendor="ACME STORES",
        )

        response = self.client.post(reverse("validate-expense-item", kwargs={"pk": self.expense_item.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ExpenseValidation.Status.MATCHED)
        self.assertEqual(response.data["amount_difference"], "0.00")
        self.assertEqual(
            response.data["message"],
            "Claimed amount matches the attached bill. Bill date was not extracted.",
        )

    def test_validate_expense_item_marks_matched_when_amount_and_date_match(self):
        self.expense_item.expense_date = date(2026, 5, 12)
        self.expense_item.save(update_fields=["expense_date"])

        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("bill.jpg", b"image-content", content_type="image/jpeg"),
            original_filename="bill.jpg",
            file_type="image/jpeg",
        )
        BillExtraction.objects.create(
            attachment=attachment,
            status=BillExtraction.Status.COMPLETED,
            extracted_amount=Decimal("649.00"),
            extracted_date=date(2026, 5, 12),
            extracted_vendor="ACME STORES",
        )

        response = self.client.post(reverse("validate-expense-item", kwargs={"pk": self.expense_item.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ExpenseValidation.Status.MATCHED)
        self.assertEqual(response.data["amount_difference"], "0.00")
        self.assertEqual(response.data["message"], "Claimed amount and bill date match the attached bill.")

    def test_validate_expense_item_marks_date_mismatch_when_amount_matches(self):
        self.expense_item.expense_date = date(2026, 5, 12)
        self.expense_item.save(update_fields=["expense_date"])

        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("bill.jpg", b"image-content", content_type="image/jpeg"),
            original_filename="bill.jpg",
            file_type="image/jpeg",
        )
        BillExtraction.objects.create(
            attachment=attachment,
            status=BillExtraction.Status.COMPLETED,
            extracted_amount=Decimal("649.00"),
            extracted_date=date(2026, 5, 13),
            extracted_vendor="ACME STORES",
        )

        response = self.client.post(reverse("validate-expense-item", kwargs={"pk": self.expense_item.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ExpenseValidation.Status.DATE_MISMATCH)
        self.assertEqual(response.data["amount_difference"], "0.00")
        self.assertEqual(
            response.data["message"],
            "Amount matched, but bill date differs from the claimed date.",
        )

    def test_validate_expense_item_matches_against_raw_text_when_extracted_amount_is_wrong(self):
        self.expense_item.expense_date = date(2026, 5, 12)
        self.expense_item.save(update_fields=["expense_date"])

        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("bill.pdf", b"pdf-content", content_type="application/pdf"),
            original_filename="bill.pdf",
            file_type="application/pdf",
        )
        BillExtraction.objects.create(
            attachment=attachment,
            status=BillExtraction.Status.COMPLETED,
            extracted_amount=Decimal("4.00"),
            raw_text="""
            Blinkit
            Taxable Value 550.00
            CGST 49.50
            SGST 49.50
            Total 1 49.50 49.50 649.00
            """,
            extracted_vendor="Blinkit",
        )

        response = self.client.post(reverse("validate-expense-item", kwargs={"pk": self.expense_item.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ExpenseValidation.Status.MATCHED)
        self.assertEqual(response.data["extracted_amount"], "649.00")
        self.assertEqual(response.data["amount_difference"], "0.00")
        self.assertEqual(
            response.data["message"],
            "Claimed amount matched against OCR raw text/candidate amounts. Bill date was not extracted.",
        )

    def test_validate_expense_item_matches_against_sum_candidates(self):
        badminton_expense = ExpenseItem.objects.create(
            claim=self.claim,
            description="Badminton",
            category=ExpenseItem.Category.OTHER,
            claimed_amount=Decimal("3897.00"),
            approved_amount=Decimal("0.00"),
        )
        attachment = ExpenseAttachment.objects.create(
            expense_item=badminton_expense,
            file=SimpleUploadedFile("receipt.jpg", b"image-content", content_type="image/jpeg"),
            original_filename="receipt.jpg",
            file_type="image/jpeg",
        )
        BillExtraction.objects.create(
            attachment=attachment,
            status=BillExtraction.Status.COMPLETED,
            extracted_amount=Decimal("500.00"),
            raw_text="""
            DECATHLON
            SENSATION 500
            1499
            1499
            899
            """,
            extracted_vendor="Decathlon",
        )

        response = self.client.post(reverse("validate-expense-item", kwargs={"pk": badminton_expense.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ExpenseValidation.Status.MATCHED)
        self.assertEqual(response.data["extracted_amount"], "3897.00")
        self.assertEqual(response.data["amount_difference"], "0.00")

    def test_validate_claim_returns_summary_counts(self):
        second_expense_item = ExpenseItem.objects.create(
            claim=self.claim,
            description="Taxi",
            category=ExpenseItem.Category.TRAVEL,
            claimed_amount=Decimal("120.00"),
            approved_amount=Decimal("0.00"),
        )

        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("bill.jpg", b"image-content", content_type="image/jpeg"),
            original_filename="bill.jpg",
            file_type="image/jpeg",
        )
        BillExtraction.objects.create(
            attachment=attachment,
            status=BillExtraction.Status.COMPLETED,
            extracted_amount=Decimal("649.00"),
            extracted_vendor="ACME STORES",
        )

        response = self.client.post(reverse("validate-claim", kwargs={"pk": self.claim.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["claim_id"], self.claim.id)
        self.assertEqual(response.data["total_items"], 2)
        self.assertEqual(response.data["matched"], 1)
        self.assertEqual(response.data["missing_bill"], 1)
        self.assertEqual(response.data["mismatched"], 0)
        self.assertEqual(response.data["needs_review"], 0)

    def test_approve_expense_item_sets_approved_amount_and_updates_totals(self):
        response = self.client.post(
            reverse("approve-expense-item", kwargs={"pk": self.expense_item.id}),
            {
                "approved_amount": "649.00",
                "review_notes": "Approved after bill validation",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.expense_item.refresh_from_db()
        self.claim.refresh_from_db()
        self.batch.refresh_from_db()

        self.assertEqual(self.expense_item.status, ExpenseItem.Status.APPROVED)
        self.assertEqual(self.expense_item.approved_amount, Decimal("649.00"))
        self.assertEqual(self.expense_item.review_notes, "Approved after bill validation")
        self.assertEqual(self.claim.total_approved_amount, Decimal("649.00"))
        self.assertEqual(self.batch.total_approved_amount, Decimal("649.00"))
        self.assertEqual(response.data["status"], ExpenseItem.Status.APPROVED)
        self.assertEqual(response.data["approved_amount"], "649.00")

    def test_reject_expense_item_sets_zero_amount_and_recalculates_totals(self):
        self.expense_item.status = ExpenseItem.Status.APPROVED
        self.expense_item.approved_amount = Decimal("649.00")
        self.expense_item.save(update_fields=["status", "approved_amount", "updated_at"])
        self.claim.total_approved_amount = Decimal("649.00")
        self.claim.save(update_fields=["total_approved_amount", "updated_at"])
        self.batch.total_approved_amount = Decimal("649.00")
        self.batch.save(update_fields=["total_approved_amount", "updated_at"])

        response = self.client.post(
            reverse("reject-expense-item", kwargs={"pk": self.expense_item.id}),
            {"review_notes": "Rejected due to policy mismatch"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.expense_item.refresh_from_db()
        self.claim.refresh_from_db()
        self.batch.refresh_from_db()

        self.assertEqual(self.expense_item.status, ExpenseItem.Status.REJECTED)
        self.assertEqual(self.expense_item.approved_amount, Decimal("0.00"))
        self.assertEqual(self.expense_item.review_notes, "Rejected due to policy mismatch")
        self.assertEqual(self.claim.total_approved_amount, Decimal("0.00"))
        self.assertEqual(self.batch.total_approved_amount, Decimal("0.00"))
        self.assertEqual(response.data["status"], ExpenseItem.Status.REJECTED)
        self.assertEqual(response.data["approved_amount"], "0.00")

    def test_approve_matched_claim_approves_only_matched_items(self):
        matched_attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("bill.pdf", b"pdf-content", content_type="application/pdf"),
            original_filename="bill.pdf",
            file_type="application/pdf",
        )
        BillExtraction.objects.create(
            attachment=matched_attachment,
            status=BillExtraction.Status.COMPLETED,
            extracted_amount=Decimal("649.00"),
            extracted_vendor="Blinkit",
        )
        self.client.post(reverse("validate-expense-item", kwargs={"pk": self.expense_item.id}))

        second_expense_item = ExpenseItem.objects.create(
            claim=self.claim,
            description="Taxi",
            category=ExpenseItem.Category.TRAVEL,
            claimed_amount=Decimal("120.00"),
            approved_amount=Decimal("0.00"),
        )
        ExpenseValidation.objects.create(
            expense_item=second_expense_item,
            status=ExpenseValidation.Status.NEEDS_REVIEW,
            claimed_amount=Decimal("120.00"),
            message="OCR completed, but no reliable matching amount was found.",
        )

        response = self.client.post(reverse("approve-matched-claim", kwargs={"pk": self.claim.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.expense_item.refresh_from_db()
        second_expense_item.refresh_from_db()
        self.claim.refresh_from_db()
        self.batch.refresh_from_db()

        self.assertEqual(self.expense_item.status, ExpenseItem.Status.APPROVED)
        self.assertEqual(self.expense_item.approved_amount, Decimal("649.00"))
        self.assertEqual(self.expense_item.review_notes, "Auto-approved matched bill.")
        self.assertEqual(second_expense_item.status, ExpenseItem.Status.PENDING_REVIEW)
        self.assertEqual(second_expense_item.approved_amount, Decimal("0.00"))
        self.assertEqual(self.claim.total_approved_amount, Decimal("649.00"))
        self.assertEqual(self.batch.total_approved_amount, Decimal("649.00"))
        self.assertEqual(response.data["approved_count"], 1)
        self.assertEqual(response.data["skipped_count"], 1)
        self.assertEqual(response.data["total_approved_amount"], "649.00")

    def test_finance_review_summary_counts_ready_to_approve_correctly(self):
        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("bill.pdf", b"pdf-content", content_type="application/pdf"),
            original_filename="bill.pdf",
            file_type="application/pdf",
        )
        BillExtraction.objects.create(
            attachment=attachment,
            status=BillExtraction.Status.COMPLETED,
            extracted_amount=Decimal("649.00"),
            extracted_vendor="Blinkit",
        )
        self.client.post(reverse("validate-expense-item", kwargs={"pk": self.expense_item.id}))

        response = self.client.get(reverse("finance-review-summary"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_items"], 1)
        self.assertEqual(response.data["ready_to_approve_count"], 1)
        self.assertEqual(response.data["ready_to_approve_amount"], "649.00")
        self.assertEqual(response.data["missing_bill_count"], 0)

    def test_finance_review_summary_counts_approved_and_rejected(self):
        approved_item = self.expense_item
        approved_item.status = ExpenseItem.Status.APPROVED
        approved_item.approved_amount = Decimal("649.00")
        approved_item.save(update_fields=["status", "approved_amount", "updated_at"])

        rejected_item = ExpenseItem.objects.create(
            claim=self.claim,
            description="Taxi",
            category=ExpenseItem.Category.TRAVEL,
            claimed_amount=Decimal("120.00"),
            approved_amount=Decimal("0.00"),
            status=ExpenseItem.Status.REJECTED,
            review_notes="Rejected",
        )

        response = self.client.get(reverse("finance-review-summary"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["approved_count"], 1)
        self.assertEqual(response.data["rejected_count"], 1)
        self.assertEqual(response.data["approved_amount"], "649.00")
        self.assertEqual(response.data["rejected_amount"], "120.00")
        self.assertEqual(response.data["total_items"], 2)

    def test_finance_review_summary_counts_missing_bill(self):
        ExpenseItem.objects.create(
            claim=self.claim,
            description="Taxi",
            category=ExpenseItem.Category.TRAVEL,
            claimed_amount=Decimal("120.00"),
            approved_amount=Decimal("0.00"),
        )

        response = self.client.get(reverse("finance-review-summary"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["missing_bill_count"], 2)

    def test_finance_review_items_bucket_ready_to_approve_works(self):
        attachment = ExpenseAttachment.objects.create(
            expense_item=self.expense_item,
            file=SimpleUploadedFile("bill.pdf", b"pdf-content", content_type="application/pdf"),
            original_filename="bill.pdf",
            file_type="application/pdf",
        )
        BillExtraction.objects.create(
            attachment=attachment,
            status=BillExtraction.Status.COMPLETED,
            extracted_amount=Decimal("649.00"),
            extracted_vendor="Blinkit",
        )
        self.client.post(reverse("validate-expense-item", kwargs={"pk": self.expense_item.id}))

        other_item = ExpenseItem.objects.create(
            claim=self.claim,
            description="Taxi",
            category=ExpenseItem.Category.TRAVEL,
            claimed_amount=Decimal("120.00"),
            approved_amount=Decimal("0.00"),
        )
        ExpenseValidation.objects.create(
            expense_item=other_item,
            status=ExpenseValidation.Status.MISSING_BILL,
            claimed_amount=Decimal("120.00"),
            message="No bill or invoice is attached to this expense item.",
        )

        response = self.client.get(reverse("finance-review-items"), {"bucket": "ready_to_approve"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.expense_item.id)

    def test_finance_review_items_bucket_approved_works(self):
        self.expense_item.status = ExpenseItem.Status.APPROVED
        self.expense_item.approved_amount = Decimal("649.00")
        self.expense_item.save(update_fields=["status", "approved_amount", "updated_at"])

        response = self.client.get(reverse("finance-review-items"), {"bucket": "approved"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["status"], ExpenseItem.Status.APPROVED)

    def test_finance_review_items_bucket_all_works(self):
        ExpenseItem.objects.create(
            claim=self.claim,
            description="Taxi",
            category=ExpenseItem.Category.TRAVEL,
            claimed_amount=Decimal("120.00"),
            approved_amount=Decimal("0.00"),
        )

        response = self.client.get(reverse("finance-review-items"), {"bucket": "all"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_generate_combined_excel_report_creates_generated_report(self):
        response = self.client.post(reverse("generate-combined-excel", kwargs={"pk": self.batch.id}))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = GeneratedReport.objects.get(pk=response.data["id"])
        self.assertEqual(report.batch_id, self.batch.id)
        self.assertEqual(report.report_type, GeneratedReport.ReportType.COMBINED_EXCEL)
        self.assertTrue(report.file.name.endswith(".xlsx"))

    def test_generate_employee_excel_report_creates_generated_report(self):
        response = self.client.post(reverse("generate-employee-excel", kwargs={"pk": self.claim.id}))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = GeneratedReport.objects.get(pk=response.data["id"])
        self.assertEqual(report.claim_id, self.claim.id)
        self.assertEqual(report.report_type, GeneratedReport.ReportType.EMPLOYEE_EXCEL)
        self.assertTrue(report.file.name.endswith(".xlsx"))

    def test_generated_report_file_exists(self):
        response = self.client.post(reverse("generate-combined-excel", kwargs={"pk": self.batch.id}))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = GeneratedReport.objects.get(pk=response.data["id"])
        self.assertTrue(os.path.exists(report.file.path))

    def test_generated_report_list_endpoint_works(self):
        self.client.post(reverse("generate-combined-excel", kwargs={"pk": self.batch.id}))
        self.client.post(reverse("generate-employee-excel", kwargs={"pk": self.claim.id}))

        response = self.client.get(reverse("generated-report-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["original_filename"][-5:], ".xlsx")

    def test_email_preview_endpoint_defaults_to_cto_executive_template(self):
        report = GeneratedReport.objects.create(
            batch=self.batch,
            report_type=GeneratedReport.ReportType.COMBINED_EXCEL,
            original_filename="combined.xlsx",
            file=SimpleUploadedFile("combined.xlsx", b"excel-content"),
        )

        response = self.client.get(reverse("email-preview"), {"batch": self.batch.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["batch_id"], self.batch.id)
        self.assertEqual(response.data["to_email"], "cto@example.com")
        self.assertEqual(response.data["cc_email"], "finance@example.com")
        self.assertEqual(
            response.data["subject"],
            f"Monthly Reimbursement Approval Summary - {self.batch.title}",
        )
        self.assertIn("executive reimbursement summary", response.data["body"])
        self.assertIn("review and final processing", response.data["body"])
        self.assertEqual(response.data["report_ids"], [report.id])

    def test_email_preview_with_formal_summary_template_works(self):
        response = self.client.get(
            reverse("email-preview"),
            {"batch": self.batch.id, "template_type": "FORMAL_SUMMARY"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["subject"],
            f"Expense Reimbursement Summary - {self.batch.title}",
        )
        self.assertIn("Please find below the reimbursement summary", response.data["body"])
        self.assertIn("shared for your review and record", response.data["body"])

    def test_email_preview_with_finance_approval_template_works(self):
        response = self.client.get(
            reverse("email-preview"),
            {"batch": self.batch.id, "template_type": "FINANCE_APPROVAL"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["subject"],
            f"Approved Expense Reimbursement Package - {self.batch.title}",
        )
        self.assertIn("Finance review has been completed", response.data["body"])
        self.assertIn("ready for processing", response.data["body"])

    def test_email_preview_with_cto_executive_template_works(self):
        response = self.client.get(
            reverse("email-preview"),
            {"batch": self.batch.id, "template_type": "CTO_EXECUTIVE"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["subject"],
            f"Monthly Reimbursement Approval Summary - {self.batch.title}",
        )
        self.assertIn("executive reimbursement summary", response.data["body"])
        self.assertIn("Reports Attached", response.data["body"])

    def test_get_system_settings_creates_singleton(self):
        SystemSetting.objects.all().delete()
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse("system-settings"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(SystemSetting.objects.count(), 1)
        self.assertEqual(response.data["company_name"], "NL Technologies Pvt. Ltd.")

    def test_patch_system_settings_updates_company_and_recipients(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse("system-settings"),
            {
                "company_name": "VBS AI Solutions",
                "cto_email": "cto@vbsai.com",
                "finance_head_email": "finance@vbsai.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        system_setting = SystemSetting.objects.get()
        self.assertEqual(system_setting.company_name, "VBS AI Solutions")
        self.assertEqual(system_setting.cto_email, "cto@vbsai.com")
        self.assertEqual(system_setting.finance_head_email, "finance@vbsai.com")

    def test_system_settings_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.patch(
            reverse("system-settings"),
            {"quick_claim_allowed_recipient_domains": ["example.com"]},
            format="json",
        )

        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    @override_settings(
        EMAIL_HOST="mail.vbsai.com",
        EMAIL_PORT=2525,
        EMAIL_USE_TLS=True,
        EMAIL_HOST_USER="mailer@vbsai.com",
        EMAIL_HOST_PASSWORD="super-secret-password",
        DEFAULT_FROM_EMAIL="finance@vbsai.com",
    )
    @patch("reimbursements.views.get_tesseract_version_safe", return_value="5.4.0")
    def test_config_status_returns_safe_live_values(self, mocked_tesseract_version):
        SystemSetting.objects.update_or_create(
            id=1,
            defaults={
                "cto_email": "cto@vbsai.com",
                "finance_head_email": "finance@vbsai.com",
            },
        )

        response = self.client.get(reverse("system-config-status"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["database"]["connected"])
        self.assertEqual(response.data["email"]["email_host"], "mail.vbsai.com")
        self.assertEqual(response.data["email"]["email_port"], 2525)
        self.assertTrue(response.data["email"]["email_use_tls"])
        self.assertTrue(response.data["email"]["email_host_user_configured"])
        self.assertTrue(response.data["email"]["default_from_email_configured"])
        self.assertTrue(response.data["email"]["email_password_configured"])
        self.assertTrue(response.data["email"]["cto_email_configured"])
        self.assertTrue(response.data["email"]["finance_head_email_configured"])
        self.assertTrue(response.data["ocr"]["tesseract_cmd_configured"])
        self.assertTrue(response.data["ocr"]["tesseract_available"])
        self.assertEqual(response.data["ocr"]["tesseract_version"], "5.4.0")
        rendered = response.content.decode()
        self.assertNotIn("smtp.office365.com", rendered)
        self.assertNotIn("super-secret-password", rendered)
        self.assertNotIn("SECRET_KEY", rendered)
        self.assertNotIn("DB_PASSWORD", rendered)
        mocked_tesseract_version.assert_called_once()

    @patch("reimbursements.views.get_tesseract_version_safe", side_effect=Exception("missing"))
    def test_config_status_returns_safe_ocr_data_when_unavailable(self, mocked_tesseract_version):
        response = self.client.get(reverse("system-config-status"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("ocr", response.data)
        self.assertTrue(response.data["ocr"]["tesseract_cmd_configured"])
        self.assertFalse(response.data["ocr"]["tesseract_available"])
        self.assertEqual(response.data["ocr"]["tesseract_version"], "")
        mocked_tesseract_version.assert_called_once()

    def test_email_preview_uses_system_setting_recipients_when_configured(self):
        SystemSetting.objects.update_or_create(
            id=1,
            defaults={
                "company_name": "VBS AI Solutions",
                "cto_email": "cto@vbsai.com",
                "finance_head_email": "finance@vbsai.com",
                "default_email_body_note": "This package is shared for final internal clearance.",
            },
        )

        response = self.client.get(reverse("email-preview"), {"batch": self.batch.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["to_email"], "cto@vbsai.com")
        self.assertEqual(response.data["cc_email"], "finance@vbsai.com")
        self.assertIn("This package is shared for final internal clearance.", response.data["body"])
        self.assertIn("VBS AI Solutions", response.data["body"])

    def test_send_email_endpoint_rejects_no_reports(self):
        response = self.client.post(
            reverse("email-send"),
            {
                "batch": self.batch.id,
                "report_ids": [],
                "to_email": "cto@example.com",
                "cc_email": "finance@example.com",
                "subject": "Monthly Expense Reimbursement Summary",
                "body": "Please review the attached reports.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Please select at least one report to attach.")

    @patch("reimbursements.email_services.EmailMessage")
    def test_send_email_endpoint_creates_sent_log(self, mocked_email_message):
        report = GeneratedReport.objects.create(
            batch=self.batch,
            report_type=GeneratedReport.ReportType.COMBINED_EXCEL,
            original_filename="combined.xlsx",
            file=SimpleUploadedFile("combined.xlsx", b"excel-content"),
        )
        mocked_email_message.return_value.send.return_value = 1

        response = self.client.post(
            reverse("email-send"),
            {
                "batch": self.batch.id,
                "report_ids": [report.id],
                "to_email": "cto@example.com",
                "cc_email": "finance@example.com",
                "subject": "Monthly Expense Reimbursement Summary",
                "body": "Please review the attached reports.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        log = EmailDispatchLog.objects.get(pk=response.data["id"])
        self.assertEqual(log.status, EmailDispatchLog.Status.SENT)
        self.assertEqual(log.to_email, "cto@example.com")
        self.assertEqual(log.attached_reports.count(), 1)
        mocked_email_message.return_value.attach_file.assert_called_once()
        mocked_email_message.return_value.send.assert_called_once_with(fail_silently=False)

    @patch("reimbursements.email_services.EmailMessage")
    def test_send_email_endpoint_creates_failed_log_on_error(self, mocked_email_message):
        report = GeneratedReport.objects.create(
            batch=self.batch,
            report_type=GeneratedReport.ReportType.COMBINED_EXCEL,
            original_filename="combined.xlsx",
            file=SimpleUploadedFile("combined.xlsx", b"excel-content"),
        )
        mocked_email_message.return_value.send.side_effect = Exception("SMTP authentication failed")

        response = self.client.post(
            reverse("email-send"),
            {
                "batch": self.batch.id,
                "report_ids": [report.id],
                "to_email": "cto@example.com",
                "cc_email": "finance@example.com",
                "subject": "Monthly Expense Reimbursement Summary",
                "body": "Please review the attached reports.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        log = EmailDispatchLog.objects.get(pk=response.data["id"])
        self.assertEqual(log.status, EmailDispatchLog.Status.FAILED)
        self.assertEqual(
            log.error_message,
            "SMTP authentication failed. Check EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, MFA/app password, and whether SMTP AUTH is enabled.",
        )

    @patch("reimbursements.email_services.EmailMessage")
    def test_test_smtp_endpoint_returns_success(self, mocked_email_message):
        mocked_email_message.return_value.send.return_value = 1

        response = self.client.post(
            reverse("email-test-smtp"),
            {"test_to_email": "someone@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn("sent successfully", response.data["message"])

    @patch("reimbursements.email_services.EmailMessage")
    def test_test_smtp_endpoint_returns_readable_auth_error(self, mocked_email_message):
        mocked_email_message.return_value.send.side_effect = smtplib.SMTPAuthenticationError(535, b"5.7.3 Authentication unsuccessful")

        response = self.client.post(
            reverse("email-test-smtp"),
            {"test_to_email": "someone@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertEqual(
            response.data["message"],
            "SMTP authentication failed. Check EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, MFA/app password, and whether SMTP AUTH is enabled.",
        )

    def test_email_logs_endpoint_works(self):
        log = EmailDispatchLog.objects.create(
            batch=self.batch,
            subject="Monthly Expense Reimbursement Summary",
            body="Please review the attached reports.",
            to_email="cto@example.com",
            cc_email="finance@example.com",
            status=EmailDispatchLog.Status.DRAFT,
        )

        response = self.client.get(reverse("email-log-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], log.id)
        self.assertEqual(response.data[0]["to_email"], "cto@example.com")

