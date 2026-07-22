from django.conf import settings
from decimal import Decimal
from decimal import InvalidOperation

from django.core.exceptions import ObjectDoesNotExist
from django.db import connections
from django.db.models import Count, Prefetch, Sum
from rest_framework import filters, permissions, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from HRMSapp.models import Employee

from .models import (
    BillExtraction,
    EmployeeReimbursementProfile,
    EmailDispatchLog,
    ExpenseAttachment,
    ExpenseItem,
    ExpenseValidation,
    GeneratedReport,
    MonthlyReimbursementBatch,
    ReimbursementClaim,
    SmartReimbursementUpload,
    SmartUploadedBillFile,
    UploadedReimbursementForm,
    get_system_settings,
)
from .ocr_services import (
    TesseractUnavailableError,
    get_tesseract_version_safe,
    run_ocr_for_attachment,
)
from .email_services import (
    build_reimbursement_email_preview,
    send_reimbursement_email,
    send_smtp_test_email,
)
from .report_services import (
    generate_combined_excel_report,
    generate_combined_pdf_report,
    generate_employee_excel_report,
    generate_employee_pdf_report,
)
from .services import (
    approve_expense_item,
    approve_matched_claim_expenses,
    import_parsed_reimbursement_form,
    parse_company_reimbursement_form,
    parse_reimbursement_excel,
    reject_expense_item,
)
from .serializers import (
    BillExtractionSerializer,
    EmailDispatchLogSerializer,
    ExpenseAttachmentSerializer,
    ExpenseItemSerializer,
    ExpenseValidationSerializer,
    GeneratedReportSerializer,
    MonthlyReimbursementBatchSerializer,
    ReimbursementClaimSerializer,
    DraftExtractedExpenseSerializer,
    DraftExpenseUpdateSerializer,
    EmployeeReimbursementProfileSerializer,
    SmartReimbursementUploadSerializer,
    SmartUploadCreateSerializer,
    SystemSettingSerializer,
    UploadedReimbursementFormSerializer,
)
from .quick_claim_services import (
    create_smart_upload,
    get_complete_reimbursement_profile,
    mark_confirm_failure,
    prepare_uploaded_bills,
    refresh_upload_progress,
    validate_draft_expenses_ready,
    validate_recipients,
)

from .quick_claim_throttles import QuickClaimSendThrottle, QuickClaimUploadThrottle
from .access import user_can_access_full_app
from .permissions import IsFinanceOrAdmin
from .tasks import confirm_and_send_quick_claim, enqueue_smart_upload
from .validation_services import validate_claim_expenses, validate_expense_item
from .access import user_can_access_full_app

FINANCE_REVIEW_BUCKETS = {
    "all",
    "ready_to_approve",
    "missing_bill",
    "ocr_pending",
    "ocr_failed",
    "amount_mismatch",
    "date_mismatch",
    "needs_review",
    "approved",
    "rejected",
}


def _expense_item_detail_queryset():
    return (
        ExpenseItem.objects.select_related("claim", "claim__employee", "claim__batch", "validation")
        .prefetch_related(
            Prefetch(
                "attachments",
                queryset=ExpenseAttachment.objects.select_related("extraction").order_by("-uploaded_at"),
                to_attr="prefetched_attachments",
            )
        )
        .annotate(attachment_count=Count("attachments", distinct=True))
    )


def _parse_decimal_input(value, fallback: Decimal | None = None) -> Decimal | None:
    if value in (None, ""):
        return fallback
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _finance_review_bucket_for_item(expense_item: ExpenseItem) -> str | None:
    attachments = getattr(expense_item, "prefetched_attachments", None)
    if attachments is None:
        attachments = list(expense_item.attachments.select_related("extraction").order_by("-uploaded_at"))

    try:
        validation = expense_item.validation
    except ObjectDoesNotExist:
        validation = None
    has_attachment = bool(getattr(expense_item, "attachment_count", None) or attachments)
    has_extraction = False
    for attachment in attachments:
        try:
            if attachment.extraction:
                has_extraction = True
                break
        except ObjectDoesNotExist:
            continue
    validation_status = validation.status if validation else None

    if expense_item.status == ExpenseItem.Status.APPROVED:
        return "approved"
    if expense_item.status == ExpenseItem.Status.REJECTED:
        return "rejected"
    if validation_status == ExpenseValidation.Status.MATCHED and expense_item.status == ExpenseItem.Status.PENDING_REVIEW:
        return "ready_to_approve"
    if not has_attachment or validation_status == ExpenseValidation.Status.MISSING_BILL:
        return "missing_bill"
    if (has_attachment and not has_extraction) or validation_status == ExpenseValidation.Status.OCR_PENDING:
        return "ocr_pending"
    if validation_status == ExpenseValidation.Status.OCR_FAILED:
        return "ocr_failed"
    if validation_status == ExpenseValidation.Status.AMOUNT_MISMATCH:
        return "amount_mismatch"
    if validation_status == ExpenseValidation.Status.DATE_MISMATCH:
        return "date_mismatch"
    if validation_status == ExpenseValidation.Status.NEEDS_REVIEW:
        return "needs_review"
    return None


def _finance_review_items_queryset():
    return _expense_item_detail_queryset().order_by("-created_at")


def _filter_finance_review_items(bucket: str | None):
    normalized_bucket = bucket or "all"
    queryset = _finance_review_items_queryset()
    items = list(queryset)

    if normalized_bucket == "all":
        return items

    return [item for item in items if _finance_review_bucket_for_item(item) == normalized_bucket]


class MonthlyReimbursementBatchViewSet(viewsets.ModelViewSet):
    queryset = MonthlyReimbursementBatch.objects.all().order_by("-year", "-month")
    serializer_class = MonthlyReimbursementBatchSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "notes", "status"]
    ordering_fields = ["year", "month", "created_at", "updated_at"]
    ordering = ["-year", "-month"]


class ReimbursementClaimViewSet(viewsets.ModelViewSet):
    serializer_class = ReimbursementClaimSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "employee__employee_id",
        "employee__first_name",
        "employee__last_name",
        "remarks",
        "status",
    ]
    ordering_fields = ["created_at", "updated_at", "total_claimed_amount", "total_approved_amount"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = ReimbursementClaim.objects.select_related("employee", "batch").order_by("-created_at")
        user = self.request.user

        # Check if requesting "my claims only"
        my_only = self.request.query_params.get("my_only", "").lower() == "true"

        if my_only:
            # Always filter to own claims regardless of role
            queryset = self._filter_own_claims(queryset, user)
        elif user_can_access_full_app(user):
            # HR/Admin sees all claims (Claim Monitor page)
            pass
        else:
            # Regular employee without my_only — still show only own
            queryset = self._filter_own_claims(queryset, user)

        # Apply additional filters
        batch_id = self.request.query_params.get("batch")
        employee_id = self.request.query_params.get("employee")
        status_param = self.request.query_params.get("status")

        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset

    def _filter_own_claims(self, queryset, user):
        """Filter queryset to only show claims belonging to the current user."""
        from django.db.models import Q

        filters = Q()

        # Match by HRMS employee link (UserAccount → Employee)
        if hasattr(user, 'employee'):
            filters |= Q(employee=user.employee)

        # Match by smart upload creator
        filters |= Q(smart_reimbursement_uploads__created_by=user)

        if filters:
            return queryset.filter(filters).distinct()

        return queryset.none()


class ExpenseItemViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseItemSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["vendor_name", "description", "category", "status"]
    ordering_fields = ["created_at", "updated_at", "expense_date", "claimed_amount", "approved_amount"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = (
            ExpenseItem.objects.select_related("claim", "claim__employee", "claim__batch", "validation")
            .prefetch_related(
                Prefetch(
                    "attachments",
                    queryset=ExpenseAttachment.objects.select_related("extraction").order_by("-uploaded_at"),
                    to_attr="prefetched_attachments",
                )
            )
            .annotate(attachment_count=Count("attachments", distinct=True))
            .order_by("-created_at")
        )

        claim_id = self.request.query_params.get("claim")
        category = self.request.query_params.get("category")
        status = self.request.query_params.get("status")

        if claim_id:
            queryset = queryset.filter(claim_id=claim_id)
        if category:
            queryset = queryset.filter(category=category)
        if status:
            queryset = queryset.filter(status=status)

        return queryset


class ExpenseAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseAttachmentSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["original_filename", "file_type", "expense_item__vendor_name"]
    ordering_fields = ["uploaded_at"]
    ordering = ["-uploaded_at"]

    def get_queryset(self):
        queryset = ExpenseAttachment.objects.select_related("expense_item", "extraction").order_by("-uploaded_at")

        expense_item_id = self.request.query_params.get("expense_item")
        if expense_item_id:
            queryset = queryset.filter(expense_item_id=expense_item_id)

        return queryset


class BillExtractionViewSet(viewsets.ModelViewSet):
    serializer_class = BillExtractionSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "attachment__original_filename",
        "extracted_vendor",
        "extracted_invoice_number",
        "status",
    ]
    ordering_fields = ["processed_at", "created_at", "updated_at", "extracted_amount"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        queryset = BillExtraction.objects.select_related("attachment", "attachment__expense_item").order_by("-updated_at")

        attachment_id = self.request.query_params.get("attachment")
        status_value = self.request.query_params.get("status")
        if attachment_id:
            queryset = queryset.filter(attachment_id=attachment_id)
        if status_value:
            queryset = queryset.filter(status=status_value)

        return queryset


class ExpenseValidationViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseValidationSerializer
    permission_classes = [IsFinanceOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "expense_item__description",
        "expense_item__vendor_name",
        "status",
        "message",
    ]
    ordering_fields = ["checked_at", "created_at", "updated_at", "amount_difference"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        queryset = ExpenseValidation.objects.select_related("expense_item", "expense_item__claim").order_by("-updated_at")

        expense_item_id = self.request.query_params.get("expense_item")
        claim_id = self.request.query_params.get("claim")
        status_value = self.request.query_params.get("status")
        if expense_item_id:
            queryset = queryset.filter(expense_item_id=expense_item_id)
        if claim_id:
            queryset = queryset.filter(expense_item__claim_id=claim_id)
        if status_value:
            queryset = queryset.filter(status=status_value)

        return queryset


class ReimbursementDashboardSummaryView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        claim_totals = ReimbursementClaim.objects.aggregate(
            total_claimed_amount=Sum("total_claimed_amount"),
            total_approved_amount=Sum("total_approved_amount"),
        )

        response_data = {
            "total_batches": MonthlyReimbursementBatch.objects.count(),
            "total_claims": ReimbursementClaim.objects.count(),
            "total_expense_items": ExpenseItem.objects.count(),
            "total_employees": Employee.objects.count(),
            "total_claimed_amount": float(
                claim_totals["total_claimed_amount"] or Decimal("0.00")
            ),
            "total_approved_amount": float(
                claim_totals["total_approved_amount"] or Decimal("0.00")
            ),
            "pending_review_count": ExpenseItem.objects.filter(
                status=ExpenseItem.Status.PENDING_REVIEW
            ).count(),
            "approved_count": ExpenseItem.objects.filter(
                status=ExpenseItem.Status.APPROVED
            ).count(),
            "rejected_count": ExpenseItem.objects.filter(
                status=ExpenseItem.Status.REJECTED
            ).count(),
            "mismatch_count": ExpenseItem.objects.filter(
                status=ExpenseItem.Status.MISMATCH
            ).count(),
        }
        return Response(response_data)


class FinanceReviewSummaryAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        items = list(_finance_review_items_queryset())

        ready_to_approve_items = [item for item in items if _finance_review_bucket_for_item(item) == "ready_to_approve"]
        missing_bill_items = [item for item in items if _finance_review_bucket_for_item(item) == "missing_bill"]
        ocr_pending_items = [item for item in items if _finance_review_bucket_for_item(item) == "ocr_pending"]
        ocr_failed_items = [item for item in items if _finance_review_bucket_for_item(item) == "ocr_failed"]
        amount_mismatch_items = [item for item in items if _finance_review_bucket_for_item(item) == "amount_mismatch"]
        date_mismatch_items = [item for item in items if _finance_review_bucket_for_item(item) == "date_mismatch"]
        needs_review_items = [item for item in items if _finance_review_bucket_for_item(item) == "needs_review"]
        approved_items = [item for item in items if _finance_review_bucket_for_item(item) == "approved"]
        rejected_items = [item for item in items if _finance_review_bucket_for_item(item) == "rejected"]

        response_data = {
            "total_items": len(items),
            "total_claimed_amount": f"{sum((item.claimed_amount for item in items), Decimal('0.00')):.2f}",
            "total_approved_amount": f"{sum((item.approved_amount for item in items), Decimal('0.00')):.2f}",
            "ready_to_approve_count": len(ready_to_approve_items),
            "missing_bill_count": len(missing_bill_items),
            "ocr_pending_count": len(ocr_pending_items),
            "ocr_failed_count": len(ocr_failed_items),
            "amount_mismatch_count": len(amount_mismatch_items),
            "date_mismatch_count": len(date_mismatch_items),
            "needs_review_count": len(needs_review_items),
            "approved_count": len(approved_items),
            "rejected_count": len(rejected_items),
            "ready_to_approve_amount": f"{sum((item.claimed_amount for item in ready_to_approve_items), Decimal('0.00')):.2f}",
            "approved_amount": f"{sum((item.approved_amount for item in approved_items), Decimal('0.00')):.2f}",
            "rejected_amount": f"{sum((item.claimed_amount for item in rejected_items), Decimal('0.00')):.2f}",
        }
        return Response(response_data)


class FinanceReviewItemsAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        bucket = request.query_params.get("bucket", "all")
        if bucket not in FINANCE_REVIEW_BUCKETS:
            return Response({"detail": "Invalid finance review bucket."}, status=status.HTTP_400_BAD_REQUEST)

        items = _filter_finance_review_items(bucket)
        serializer = ExpenseItemSerializer(items, many=True, context={"request": request})
        return Response(serializer.data)


class GeneratedReportListAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        reports = GeneratedReport.objects.select_related("batch", "claim", "claim__employee").order_by("-generated_at")
        serializer = GeneratedReportSerializer(reports, many=True, context={"request": request})
        return Response(serializer.data)


class ReportCenterSummaryAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        reports = GeneratedReport.objects.all()
        latest_report = reports.order_by("-generated_at").first()
        return Response(
            {
                "total_reports": reports.count(),
                "combined_reports": reports.filter(
                    report_type__in=[
                        GeneratedReport.ReportType.COMBINED_EXCEL,
                        GeneratedReport.ReportType.COMBINED_PDF,
                    ]
                ).count(),
                "employee_reports": reports.filter(
                    report_type__in=[
                        GeneratedReport.ReportType.EMPLOYEE_EXCEL,
                        GeneratedReport.ReportType.EMPLOYEE_PDF,
                    ]
                ).count(),
                "latest_report_generated_at": latest_report.generated_at if latest_report else None,
            }
        )


class SystemSettingsAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        serializer = SystemSettingSerializer(get_system_settings(), context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        system_setting = get_system_settings()
        serializer = SystemSettingSerializer(
            system_setting,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class SystemConfigStatusAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        system_setting = get_system_settings()

        try:
            connections["default"].ensure_connection()
            database_connected = True
        except Exception:
            database_connected = False

        try:
            tesseract_version = get_tesseract_version_safe()
            tesseract_available = True
        except Exception:
            tesseract_version = ""
            tesseract_available = False

        response_data = {
            "database": {
                "connected": database_connected,
            },
            "email": {
                "email_host": settings.EMAIL_HOST,
                "email_port": settings.EMAIL_PORT,
                "email_use_tls": settings.EMAIL_USE_TLS,
                "email_host_user_configured": bool(settings.EMAIL_HOST_USER),
                "default_from_email_configured": bool(settings.DEFAULT_FROM_EMAIL),
                "email_password_configured": bool(settings.EMAIL_HOST_PASSWORD),
                "cto_email_configured": bool(system_setting.cto_email or settings.CTO_EMAIL),
                "finance_head_email_configured": bool(
                    system_setting.finance_head_email or settings.FINANCE_HEAD_EMAIL
                ),
            },
            "ocr": {
                "tesseract_cmd_configured": bool(getattr(settings, "TESSERACT_CMD", "")),
                "tesseract_available": tesseract_available,
                "tesseract_version": tesseract_version,
            },
        }
        return Response(response_data, status=status.HTTP_200_OK)


class EmailPreviewAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        batch_id = request.query_params.get("batch")
        template_type = request.query_params.get("template_type")
        if not batch_id:
            return Response({"detail": "Batch is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            preview = build_reimbursement_email_preview(int(batch_id), template_type=template_type)
        except ValueError as exc:
            detail = str(exc)
            response_status = (
                status.HTTP_404_NOT_FOUND
                if detail == "Reimbursement batch not found."
                else status.HTTP_400_BAD_REQUEST
            )
            return Response({"detail": detail}, status=response_status)

        return Response(preview, status=status.HTTP_200_OK)


class EmailDispatchLogListAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        logs = EmailDispatchLog.objects.prefetch_related("attached_reports").order_by("-created_at")
        serializer = EmailDispatchLogSerializer(logs, many=True, context={"request": request})
        return Response(serializer.data)


class EmailTestSMTPAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, *args, **kwargs):
        test_to_email = str(request.data.get("test_to_email", "") or "").strip()
        if not test_to_email:
            return Response({"success": False, "message": "Test email recipient is required."}, status=status.HTTP_400_BAD_REQUEST)

        result = send_smtp_test_email(test_to_email)
        http_status = status.HTTP_200_OK if result["success"] else status.HTTP_400_BAD_REQUEST
        return Response(result, status=http_status)


class UploadedReimbursementFormListAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        queryset = UploadedReimbursementForm.objects.select_related("employee", "batch").order_by("-uploaded_at")
        serializer = UploadedReimbursementFormSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)


class UploadedReimbursementFormUploadAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        uploaded_form = UploadedReimbursementForm.objects.create(
            original_file=uploaded_file,
            original_filename=uploaded_file.name,
            status=UploadedReimbursementForm.Status.UPLOADED,
        )

        try:
            parsed_result = parse_company_reimbursement_form(uploaded_form.original_file.path)
            uploaded_form.status = UploadedReimbursementForm.Status.PARSED
            uploaded_form.parsed_data = parsed_result
            uploaded_form.error_message = ""
        except Exception as company_exc:
            try:
                parsed_result = parse_reimbursement_excel(uploaded_form.original_file.path)
                uploaded_form.status = UploadedReimbursementForm.Status.NEEDS_REVIEW
                uploaded_form.parsed_data = parsed_result
                uploaded_form.error_message = (
                    f"Generic preview only. Company format mapping failed: {company_exc}"
                )
            except Exception as generic_exc:
                uploaded_form.status = UploadedReimbursementForm.Status.NEEDS_REVIEW
                uploaded_form.parsed_data = {}
                uploaded_form.error_message = (
                    f"Company format parsing failed: {company_exc}. "
                    f"Generic preview also failed: {generic_exc}"
                )

        uploaded_form.save()
        serializer = UploadedReimbursementFormSerializer(uploaded_form, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UploadedReimbursementFormImportAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        uploaded_form = UploadedReimbursementForm.objects.filter(pk=pk).first()
        if not uploaded_form:
            return Response({"detail": "Uploaded reimbursement form not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            claim = import_parsed_reimbursement_form(uploaded_form)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "success": True,
                "claim_id": claim.id,
                "employee_name": claim.employee.full_name,
                "batch": str(claim.batch),
                "expense_count": claim.expense_items.count(),
                "total_claimed_amount": f"{claim.total_claimed_amount:.2f}",
            }
        )


class ExpenseItemAttachmentUploadAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk, *args, **kwargs):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        expense_item = ExpenseItem.objects.filter(pk=pk).first()
        if not expense_item:
            return Response({"detail": "Expense item not found."}, status=status.HTTP_404_NOT_FOUND)

        attachment = ExpenseAttachment.objects.create(
            expense_item=expense_item,
            file=uploaded_file,
            original_filename=uploaded_file.name,
            file_type=getattr(uploaded_file, "content_type", "") or "",
        )
        serializer = ExpenseAttachmentSerializer(attachment, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AttachmentRunOCRAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        attachment = ExpenseAttachment.objects.select_related("expense_item").filter(pk=pk).first()
        if not attachment:
            return Response({"detail": "Expense attachment not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            extraction = run_ocr_for_attachment(attachment)
        except TesseractUnavailableError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = BillExtractionSerializer(extraction, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ExpenseItemValidateAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        expense_item = ExpenseItem.objects.prefetch_related("attachments__extraction").filter(pk=pk).first()
        if not expense_item:
            return Response({"detail": "Expense item not found."}, status=status.HTTP_404_NOT_FOUND)

        validation = validate_expense_item(expense_item)
        serializer = ExpenseValidationSerializer(validation, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ClaimValidateAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        claim = ReimbursementClaim.objects.select_related("employee", "batch").filter(pk=pk).first()
        if not claim:
            return Response({"detail": "Reimbursement claim not found."}, status=status.HTTP_404_NOT_FOUND)

        summary = validate_claim_expenses(claim)
        return Response(summary, status=status.HTTP_200_OK)


class ExpenseItemApproveAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        expense_item = ExpenseItem.objects.select_related("claim", "claim__batch").filter(pk=pk).first()
        if not expense_item:
            return Response({"detail": "Expense item not found."}, status=status.HTTP_404_NOT_FOUND)

        approved_amount = _parse_decimal_input(request.data.get("approved_amount"), fallback=expense_item.claimed_amount)
        if approved_amount is None:
            return Response({"detail": "Approved amount must be a valid number."}, status=status.HTTP_400_BAD_REQUEST)
        if approved_amount < Decimal("0.00"):
            return Response({"detail": "Approved amount cannot be negative."}, status=status.HTTP_400_BAD_REQUEST)

        review_notes = str(request.data.get("review_notes", "") or "")
        approve_expense_item(expense_item, approved_amount=approved_amount, review_notes=review_notes)

        updated_item = _expense_item_detail_queryset().filter(pk=expense_item.pk).first()
        serializer = ExpenseItemSerializer(updated_item, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ExpenseItemRejectAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        expense_item = ExpenseItem.objects.select_related("claim", "claim__batch").filter(pk=pk).first()
        if not expense_item:
            return Response({"detail": "Expense item not found."}, status=status.HTTP_404_NOT_FOUND)

        review_notes = str(request.data.get("review_notes", "") or "").strip()
        if not review_notes:
            return Response({"detail": "Review notes are required when rejecting an expense item."}, status=status.HTTP_400_BAD_REQUEST)

        reject_expense_item(expense_item, review_notes=review_notes)

        updated_item = _expense_item_detail_queryset().filter(pk=expense_item.pk).first()
        serializer = ExpenseItemSerializer(updated_item, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ClaimApproveMatchedAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        claim = ReimbursementClaim.objects.select_related("employee", "batch").filter(pk=pk).first()
        if not claim:
            return Response({"detail": "Reimbursement claim not found."}, status=status.HTTP_404_NOT_FOUND)

        summary = approve_matched_claim_expenses(claim)
        return Response(summary, status=status.HTTP_200_OK)


class BatchGenerateCombinedExcelAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        if not MonthlyReimbursementBatch.objects.filter(pk=pk).exists():
            return Response({"detail": "Reimbursement batch not found."}, status=status.HTTP_404_NOT_FOUND)

        report = generate_combined_excel_report(pk)
        serializer = GeneratedReportSerializer(report, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BatchGenerateCombinedPdfAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        if not MonthlyReimbursementBatch.objects.filter(pk=pk).exists():
            return Response({"detail": "Reimbursement batch not found."}, status=status.HTTP_404_NOT_FOUND)

        report = generate_combined_pdf_report(pk)
        serializer = GeneratedReportSerializer(report, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ClaimGenerateEmployeeExcelAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        if not ReimbursementClaim.objects.filter(pk=pk).exists():
            return Response({"detail": "Reimbursement claim not found."}, status=status.HTTP_404_NOT_FOUND)

        report = generate_employee_excel_report(pk)
        serializer = GeneratedReportSerializer(report, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ClaimGenerateEmployeePdfAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        if not ReimbursementClaim.objects.filter(pk=pk).exists():
            return Response({"detail": "Reimbursement claim not found."}, status=status.HTTP_404_NOT_FOUND)

        report = generate_employee_pdf_report(pk)
        serializer = GeneratedReportSerializer(report, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class EmailSendAPIView(APIView):
    permission_classes = [IsFinanceOrAdmin]

    def post(self, request, *args, **kwargs):
        batch_id = request.data.get("batch")
        report_ids = request.data.get("report_ids") or []
        to_email = str(request.data.get("to_email", "") or "").strip()
        cc_email = str(request.data.get("cc_email", "") or "").strip()
        subject = str(request.data.get("subject", "") or "").strip()
        body = str(request.data.get("body", "") or "")

        if not batch_id:
            return Response({"detail": "Batch is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not report_ids:
            return Response({"detail": "Please select at least one report to attach."}, status=status.HTTP_400_BAD_REQUEST)
        if not to_email:
            return Response({"detail": "To email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            log = send_reimbursement_email(
                batch_id=int(batch_id),
                report_ids=[int(report_id) for report_id in report_ids],
                to_email=to_email,
                cc_email=cc_email,
                subject=subject,
                body=body,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)

        serializer = EmailDispatchLogSerializer(log, context={"request": request})
        if log.status == EmailDispatchLog.Status.FAILED:
            return Response(serializer.data, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


def _owned_smart_upload(request, pk):
    return (
        SmartReimbursementUpload.objects.select_related(
            "claim", "created_by_employee", "excel_report", "pdf_report"
        )
        .prefetch_related("bill_files__expense_attachment__extraction")
        .filter(pk=pk, created_by=request.user)
        .first()
    )


def _accessible_smart_upload(request, pk):
    queryset = (
        SmartReimbursementUpload.objects.select_related(
            "claim", "created_by_employee", "excel_report", "pdf_report"
        )
        .prefetch_related("bill_files__expense_attachment__extraction")
        .filter(pk=pk)
    )
    if not user_can_access_full_app(request.user):
        queryset = queryset.filter(created_by=request.user)
    return queryset.first()


class MyReimbursementProfileAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        profile = EmployeeReimbursementProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response(
                {
                    "id": None,
                    "email": request.user.email,
                    "username": request.user.get_username(),
                    "employee_name": "",
                    "department": "",
                    "default_claim_month": None,
                    "default_claim_year": None,
                    "finance_head_email": "",
                    "cc_emails": [],
                    "is_complete": False,
                    "created_at": None,
                    "updated_at": None,
                },
                status=status.HTTP_200_OK,
            )
        serializer = EmployeeReimbursementProfileSerializer(profile, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, *args, **kwargs):
        profile = EmployeeReimbursementProfile.objects.filter(user=request.user).first()
        serializer = EmployeeReimbursementProfileSerializer(
            profile,
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class QuickClaimUploadAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [QuickClaimUploadThrottle]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        uploaded_files = request.FILES.getlist("files[]") or request.FILES.getlist("files")
        if not uploaded_files:
            return Response({"detail": "At least one bill file is required."}, status=status.HTTP_400_BAD_REQUEST)

        input_serializer = SmartUploadCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        prepared_bills = prepare_uploaded_bills(uploaded_files)
        upload = create_smart_upload(
            user=request.user,
            validated_data=input_serializer.validated_data,
            prepared_bills=prepared_bills,
        )
        enqueue_smart_upload(upload.id)
        upload.refresh_from_db()
        serializer = SmartReimbursementUploadSerializer(upload, context={"request": request})
        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)


class QuickClaimStatusAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, *args, **kwargs):
        upload = _accessible_smart_upload(request, pk)
        if not upload:
            return Response({"detail": "Quick Claim upload not found."}, status=status.HTTP_404_NOT_FOUND)
        upload = refresh_upload_progress(upload.id)
        upload = _accessible_smart_upload(request, pk)
        return Response(SmartReimbursementUploadSerializer(upload, context={"request": request}).data)


class QuickClaimDraftExpenseListAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, *args, **kwargs):
        upload = _accessible_smart_upload(request, pk)
        if not upload:
            return Response({"detail": "Quick Claim upload not found."}, status=status.HTTP_404_NOT_FOUND)
        drafts = upload.draft_expenses.select_related("bill_file").order_by("id")
        return Response(DraftExtractedExpenseSerializer(drafts, many=True).data)


class QuickClaimDraftExpenseUpdateAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk, item_id, *args, **kwargs):
        upload = _accessible_smart_upload(request, pk)
        if not upload:
            return Response({"detail": "Quick Claim upload not found."}, status=status.HTTP_404_NOT_FOUND)
        if upload.status in {SmartReimbursementUpload.Status.SENT, SmartReimbursementUpload.Status.CANCELLED}:
            return Response({"detail": "This Quick Claim can no longer be edited."}, status=status.HTTP_409_CONFLICT)
        draft = upload.draft_expenses.select_related("bill_file").filter(pk=item_id).first()
        if not draft:
            return Response({"detail": "Draft expense not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = DraftExpenseUpdateSerializer(
            draft,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        refresh_upload_progress(upload.id)
        if not upload.draft_expenses.filter(requires_manual_review=True).exists() and not upload.bill_files.filter(
            status=SmartUploadedBillFile.Status.FAILED
        ).exists():
            upload.status = SmartReimbursementUpload.Status.READY_TO_CONFIRM
            upload.save(update_fields=["status", "updated_at"])
        return Response(DraftExtractedExpenseSerializer(serializer.instance).data)


class QuickClaimConfirmAndSendAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [QuickClaimSendThrottle]

    def post(self, request, pk, *args, **kwargs):
        upload = _accessible_smart_upload(request, pk)
        if not upload:
            return Response({"detail": "Quick Claim upload not found."}, status=status.HTTP_404_NOT_FOUND)
        if upload.status == SmartReimbursementUpload.Status.CANCELLED:
            return Response({"detail": "Cancelled uploads cannot be sent."}, status=status.HTTP_409_CONFLICT)
        if upload.status == SmartReimbursementUpload.Status.SENT:
            return Response({"detail": "This Quick Claim has already been sent."}, status=status.HTTP_409_CONFLICT)
        if upload.status == SmartReimbursementUpload.Status.CONFIRMING:
            return Response(
                {"detail": "This Quick Claim is already being confirmed."},
                status=status.HTTP_409_CONFLICT,
            )

        profile = get_complete_reimbursement_profile(request.user)
        recipient = profile.finance_head_email
        cc_emails = profile.cc_emails
        validate_recipients(recipient, cc_emails)
        validate_draft_expenses_ready(upload)
        upload.recipient_email = recipient
        upload.cc_emails = cc_emails
        upload.reimbursement_profile = profile
        upload.employee_name = profile.employee_name
        upload.employee_department = profile.department
        upload.month = profile.default_claim_month
        upload.year = profile.default_claim_year
        upload.status = SmartReimbursementUpload.Status.CONFIRMING
        upload.error_message = ""
        upload.save(
            update_fields=[
                "recipient_email",
                "cc_emails",
                "reimbursement_profile",
                "employee_name",
                "employee_department",
                "month",
                "year",
                "status",
                "error_message",
                "updated_at",
            ]
        )
        try:
            result = confirm_and_send_quick_claim.delay(upload.id, request.user.id)
        except Exception as exc:
            message = f"Confirm and send failed: {exc}"
            upload = mark_confirm_failure(upload.id, message)
            return Response(
                {
                    "detail": message,
                    "stage": "confirm",
                    "upload": SmartReimbursementUploadSerializer(
                        upload,
                        context={"request": request},
                    ).data,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        upload.refresh_from_db()
        task_result = getattr(result, "result", None) if settings.CELERY_TASK_ALWAYS_EAGER else None
        if isinstance(task_result, dict) and task_result.get("success") is False:
            failure_stage = task_result.get("stage", "confirm")
            failure_status = (
                status.HTTP_400_BAD_REQUEST
                if failure_stage == "validation"
                else status.HTTP_502_BAD_GATEWAY
                if failure_stage == "email"
                else status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            return Response(
                {
                    "detail": task_result.get("error") or "Confirm and send failed.",
                    "stage": failure_stage,
                    "email_log_id": task_result.get("email_log_id"),
                    "upload": SmartReimbursementUploadSerializer(
                        upload,
                        context={"request": request},
                    ).data,
                },
                status=failure_status,
            )

        return Response(
            {
                "task_id": result.id,
                "upload": SmartReimbursementUploadSerializer(upload, context={"request": request}).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class QuickClaimCancelAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        upload = _owned_smart_upload(request, pk)
        if not upload:
            return Response({"detail": "Quick Claim upload not found."}, status=status.HTTP_404_NOT_FOUND)
        if upload.status == SmartReimbursementUpload.Status.SENT:
            return Response({"detail": "Sent uploads cannot be cancelled."}, status=status.HTTP_409_CONFLICT)
        upload.status = SmartReimbursementUpload.Status.CANCELLED
        upload.save(update_fields=["status", "updated_at"])
        upload.bill_files.filter(status=SmartUploadedBillFile.Status.QUEUED).update(
            status=SmartUploadedBillFile.Status.CANCELLED
        )
        return Response(SmartReimbursementUploadSerializer(upload, context={"request": request}).data)


