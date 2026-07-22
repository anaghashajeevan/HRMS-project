from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AttachmentRunOCRAPIView,
    BatchGenerateCombinedExcelAPIView,
    BatchGenerateCombinedPdfAPIView,
    ClaimApproveMatchedAPIView,
    ClaimGenerateEmployeeExcelAPIView,
    ClaimGenerateEmployeePdfAPIView,
    BillExtractionViewSet,
    ClaimValidateAPIView,
    EmailDispatchLogListAPIView,
    EmailPreviewAPIView,
    EmailSendAPIView,
    EmailTestSMTPAPIView,
    ExpenseItemAttachmentUploadAPIView,
    ExpenseItemApproveAPIView,
    ExpenseAttachmentViewSet,
    ExpenseItemRejectAPIView,
    ExpenseItemViewSet,
    ExpenseItemValidateAPIView,
    ExpenseValidationViewSet,
    FinanceReviewItemsAPIView,
    FinanceReviewSummaryAPIView,
    GeneratedReportListAPIView,
    MonthlyReimbursementBatchViewSet,
    MyReimbursementProfileAPIView,
    ReimbursementClaimViewSet,
    ReimbursementDashboardSummaryView,
    ReportCenterSummaryAPIView,
    SystemConfigStatusAPIView,
    SystemSettingsAPIView,
    UploadedReimbursementFormImportAPIView,
    UploadedReimbursementFormListAPIView,
    UploadedReimbursementFormUploadAPIView,
    QuickClaimCancelAPIView,
    QuickClaimConfirmAndSendAPIView,
    QuickClaimDraftExpenseListAPIView,
    QuickClaimDraftExpenseUpdateAPIView,
    QuickClaimStatusAPIView,
    QuickClaimUploadAPIView,
)

router = DefaultRouter()
router.register("batches", MonthlyReimbursementBatchViewSet, basename="reimbursement-batch")
router.register("claims", ReimbursementClaimViewSet, basename="reimbursement-claim")
router.register("expense-items", ExpenseItemViewSet, basename="expense-item")
router.register("attachments", ExpenseAttachmentViewSet, basename="expense-attachment")
router.register("extractions", BillExtractionViewSet, basename="bill-extraction")
router.register("validations", ExpenseValidationViewSet, basename="expense-validation")

urlpatterns = [
    path("quick-claims/", QuickClaimUploadAPIView.as_view(), name="quick-claim-upload"),
    path(
        "my-reimbursement-profile/",
        MyReimbursementProfileAPIView.as_view(),
        name="my-reimbursement-profile",
    ),
    path("quick-claims/<int:pk>/status/", QuickClaimStatusAPIView.as_view(), name="quick-claim-status"),
    path(
        "quick-claims/<int:pk>/draft-expenses/",
        QuickClaimDraftExpenseListAPIView.as_view(),
        name="quick-claim-draft-expenses",
    ),
    path(
        "quick-claims/<int:pk>/items/<int:item_id>/",
        QuickClaimDraftExpenseUpdateAPIView.as_view(),
        name="quick-claim-update-item",
    ),
    path(
        "quick-claims/<int:pk>/confirm-and-send/",
        QuickClaimConfirmAndSendAPIView.as_view(),
        name="quick-claim-confirm-and-send",
    ),
    path("quick-claims/<int:pk>/cancel/", QuickClaimCancelAPIView.as_view(), name="quick-claim-cancel"),
    path("dashboard-summary/", ReimbursementDashboardSummaryView.as_view(), name="dashboard-summary"),
    path("system-settings/", SystemSettingsAPIView.as_view(), name="system-settings"),
    path(
        "system-settings/config-status/",
        SystemConfigStatusAPIView.as_view(),
        name="system-config-status",
    ),
    path("finance-review-summary/", FinanceReviewSummaryAPIView.as_view(), name="finance-review-summary"),
    path("finance-review-items/", FinanceReviewItemsAPIView.as_view(), name="finance-review-items"),
    path("reports/", GeneratedReportListAPIView.as_view(), name="generated-report-list"),
    path("report-center-summary/", ReportCenterSummaryAPIView.as_view(), name="report-center-summary"),
    path("email-control/preview/", EmailPreviewAPIView.as_view(), name="email-preview"),
    path("email-control/send/", EmailSendAPIView.as_view(), name="email-send"),
    path("email-control/test-smtp/", EmailTestSMTPAPIView.as_view(), name="email-test-smtp"),
    path("email-logs/", EmailDispatchLogListAPIView.as_view(), name="email-log-list"),
    path("forms/", UploadedReimbursementFormListAPIView.as_view(), name="uploaded-reimbursement-forms"),
    path("forms/upload/", UploadedReimbursementFormUploadAPIView.as_view(), name="upload-reimbursement-form"),
    path("forms/<int:pk>/import/", UploadedReimbursementFormImportAPIView.as_view(), name="import-reimbursement-form"),
    path(
        "expense-items/<int:pk>/upload-attachment/",
        ExpenseItemAttachmentUploadAPIView.as_view(),
        name="upload-expense-attachment",
    ),
    path(
        "attachments/<int:pk>/run-ocr/",
        AttachmentRunOCRAPIView.as_view(),
        name="run-attachment-ocr",
    ),
    path(
        "expense-items/<int:pk>/validate/",
        ExpenseItemValidateAPIView.as_view(),
        name="validate-expense-item",
    ),
    path(
        "claims/<int:pk>/validate/",
        ClaimValidateAPIView.as_view(),
        name="validate-claim",
    ),
    path(
        "expense-items/<int:pk>/approve/",
        ExpenseItemApproveAPIView.as_view(),
        name="approve-expense-item",
    ),
    path(
        "expense-items/<int:pk>/reject/",
        ExpenseItemRejectAPIView.as_view(),
        name="reject-expense-item",
    ),
    path(
        "claims/<int:pk>/approve-matched/",
        ClaimApproveMatchedAPIView.as_view(),
        name="approve-matched-claim",
    ),
    path(
        "batches/<int:pk>/generate-combined-excel/",
        BatchGenerateCombinedExcelAPIView.as_view(),
        name="generate-combined-excel",
    ),
    path(
        "batches/<int:pk>/generate-combined-pdf/",
        BatchGenerateCombinedPdfAPIView.as_view(),
        name="generate-combined-pdf",
    ),
    path(
        "claims/<int:pk>/generate-employee-excel/",
        ClaimGenerateEmployeeExcelAPIView.as_view(),
        name="generate-employee-excel",
    ),
    path(
        "claims/<int:pk>/generate-employee-pdf/",
        ClaimGenerateEmployeePdfAPIView.as_view(),
        name="generate-employee-pdf",
    ),
]

urlpatterns += router.urls
