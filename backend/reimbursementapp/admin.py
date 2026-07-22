from django.contrib import admin

from .models import (
    BillExtraction,
    DraftExtractedExpense,
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
    SystemSetting,
    UploadedReimbursementForm,
    VendorCategoryRule,
)


@admin.register(MonthlyReimbursementBatch)
class MonthlyReimbursementBatchAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "month",
        "year",
        "status",
        "total_employees",
        "total_claimed_amount",
        "total_approved_amount",
        "updated_at",
    )
    search_fields = ("title", "notes")
    list_filter = ("status", "year", "month")


@admin.register(ReimbursementClaim)
class ReimbursementClaimAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "batch",
        "source",
        "status",
        "total_claimed_amount",
        "total_approved_amount",
        "updated_at",
    )
    search_fields = (
        "employee__employee_id",
        "employee__full_name",
        "batch__title",
    )
    list_filter = ("source", "status", "batch__year", "batch__month")


@admin.register(ExpenseItem)
class ExpenseItemAdmin(admin.ModelAdmin):
    list_display = (
        "vendor_name",
        "claim",
        "category",
        "classification_source",
        "category_confidence",
        "requires_manual_review",
        "claimed_amount",
        "approved_amount",
        "status",
        "expense_date",
    )
    search_fields = (
        "vendor_name",
        "description",
        "claim__employee__full_name",
        "claim__employee__employee_id",
    )
    list_filter = ("category", "classification_source", "requires_manual_review", "status", "expense_date")


@admin.register(ExpenseAttachment)
class ExpenseAttachmentAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "expense_item", "file_type", "uploaded_at")
    search_fields = (
        "original_filename",
        "file_type",
        "expense_item__vendor_name",
        "expense_item__claim__employee__full_name",
    )
    list_filter = ("file_type", "uploaded_at")


@admin.register(BillExtraction)
class BillExtractionAdmin(admin.ModelAdmin):
    list_display = (
        "attachment",
        "status",
        "extracted_vendor",
        "extracted_date",
        "extracted_amount",
        "processed_at",
    )
    search_fields = (
        "attachment__original_filename",
        "extracted_vendor",
        "extracted_invoice_number",
        "error_message",
    )
    list_filter = ("status", "processed_at", "created_at")


@admin.register(ExpenseValidation)
class ExpenseValidationAdmin(admin.ModelAdmin):
    list_display = (
        "expense_item",
        "status",
        "claimed_amount",
        "extracted_amount",
        "amount_difference",
        "claimed_date",
        "extracted_date",
        "checked_at",
    )
    search_fields = (
        "expense_item__description",
        "expense_item__vendor_name",
        "expense_item__claim__employee__full_name",
        "message",
    )
    list_filter = ("status", "checked_at", "created_at")


@admin.register(UploadedReimbursementForm)
class UploadedReimbursementFormAdmin(admin.ModelAdmin):
    list_display = (
        "original_filename",
        "status",
        "employee",
        "batch",
        "imported_claim",
        "uploaded_at",
    )
    list_filter = ("status", "uploaded_at")
    search_fields = (
        "original_filename",
        "employee__full_name",
        "employee__employee_id",
    )


@admin.register(GeneratedReport)
class GeneratedReportAdmin(admin.ModelAdmin):
    list_display = (
        "original_filename",
        "report_type",
        "batch",
        "claim",
        "generated_at",
    )
    list_filter = ("report_type", "generated_at")
    search_fields = (
        "original_filename",
        "batch__title",
        "claim__employee__full_name",
        "claim__employee__employee_id",
    )


@admin.register(EmailDispatchLog)
class EmailDispatchLogAdmin(admin.ModelAdmin):
    list_display = (
        "subject",
        "batch",
        "to_email",
        "cc_email",
        "status",
        "sent_at",
        "created_at",
    )
    list_filter = ("status", "sent_at", "created_at")
    search_fields = ("subject", "to_email", "cc_email", "error_message", "batch__title")


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ("company_name", "cto_email", "finance_head_email", "updated_at")


@admin.register(SmartReimbursementUpload)
class SmartReimbursementUploadAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "status",
        "claim",
        "created_by",
        "reimbursement_profile",
        "created_by_employee",
        "total_files",
        "processed_files",
        "failed_files",
        "draft_total_amount",
        "auto_send",
        "created_at",
    )
    list_filter = ("status", "auto_send", "created_at")
    search_fields = (
        "claim__employee__full_name",
        "created_by__username",
        "reimbursement_profile__employee_name",
        "recipient_email",
        "task_group_id",
    )


@admin.register(EmployeeReimbursementProfile)
class EmployeeReimbursementProfileAdmin(admin.ModelAdmin):
    list_display = (
        "employee_name",
        "user",
        "department",
        "default_claim_month",
        "default_claim_year",
        "finance_head_email",
        "is_complete",
        "updated_at",
    )
    list_filter = ("department", "default_claim_year", "is_complete")
    search_fields = ("employee_name", "department", "user__username", "user__email", "finance_head_email")


@admin.register(SmartUploadedBillFile)
class SmartUploadedBillFileAdmin(admin.ModelAdmin):
    list_display = (
        "original_filename",
        "upload",
        "detected_mime_type",
        "file_size",
        "status",
        "processed_at",
    )
    list_filter = ("status", "detected_mime_type", "created_at")
    search_fields = ("original_filename", "content_sha256")


@admin.register(DraftExtractedExpense)
class DraftExtractedExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "bill_file",
        "vendor_name",
        "category",
        "amount",
        "category_confidence",
        "requires_manual_review",
        "manually_reviewed",
    )
    list_filter = ("category", "classification_source", "requires_manual_review", "manually_reviewed")
    search_fields = ("bill_file__original_filename", "vendor_name", "purpose")


@admin.register(VendorCategoryRule)
class VendorCategoryRuleAdmin(admin.ModelAdmin):
    list_display = ("vendor_keyword", "category", "match_priority", "is_active", "updated_at")
    list_filter = ("category", "is_active")
    search_fields = ("vendor_keyword",)
    ordering = ("match_priority", "vendor_keyword")

