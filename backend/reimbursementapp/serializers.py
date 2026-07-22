from rest_framework import serializers
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal

from HRMSapp.models import Employee

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
    get_quick_claim_allowed_recipient_domains,
    normalize_quick_claim_allowed_recipient_domains,
)


def validate_quick_claim_recipient_allowlist(recipient_email: str, cc_emails: list[str]) -> None:
    allowed_domains = get_quick_claim_allowed_recipient_domains()
    if not allowed_domains:
        raise serializers.ValidationError(
            "No Quick Claim recipient domains are configured. Add ALLOWED_RECIPIENT_DOMAINS or System Settings."
        )

    rejected: list[str] = []
    email_validator = serializers.EmailField()
    for raw_email in [recipient_email, *cc_emails]:
        email = str(raw_email or "").strip().lower()
        if not email:
            continue
        email_validator.run_validation(email)
        domain = email.rsplit("@", 1)[-1]
        if not any(domain == allowed or domain.endswith(f".{allowed}") for allowed in allowed_domains):
            rejected.append(email)

    if rejected:
        raise serializers.ValidationError(
            f"Recipient domain is not allowlisted for: {', '.join(rejected)}."
        )


class EmployeeReimbursementProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    cc_emails = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = EmployeeReimbursementProfile
        fields = [
            "id",
            "email",
            "username",
            "employee_name",
            "department",
            "default_claim_month",
            "default_claim_year",
            "finance_head_email",
            "cc_emails",
            "is_complete",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "email", "username", "is_complete", "created_at", "updated_at"]

    def validate_employee_name(self, value):
        value = str(value or "").strip()
        if not value:
            raise serializers.ValidationError("Employee name is required.")
        return value

    def validate_department(self, value):
        value = str(value or "").strip()
        if not value:
            raise serializers.ValidationError("Department is required.")
        return value

    def validate_default_claim_month(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError("Claim month must be between 1 and 12.")
        return value

    def validate_default_claim_year(self, value):
        if value < 2024 or value > 2100:
            raise serializers.ValidationError("Claim year must be between 2024 and 2100.")
        return value

    def validate_cc_emails(self, value):
        return [str(email).strip().lower() for email in value or [] if str(email).strip()]

    def validate(self, attrs):
        finance_head_email = str(attrs.get("finance_head_email") or "").strip().lower()
        cc_emails = attrs.get("cc_emails", [])
        if not finance_head_email:
            raise serializers.ValidationError({"finance_head_email": "Finance Head email is required."})
        validate_quick_claim_recipient_allowlist(finance_head_email, cc_emails)
        attrs["finance_head_email"] = finance_head_email
        attrs["is_complete"] = True
        return attrs


class MonthlyReimbursementBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonthlyReimbursementBatch
        fields = [
            "id",
            "month",
            "year",
            "title",
            "status",
            "total_employees",
            "total_claimed_amount",
            "total_approved_amount",
            "notes",
            "created_at",
            "updated_at",
        ]


class ReimbursementClaimSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_id", read_only=True)

    def get_employee_name(self, obj):
        emp = obj.employee if obj else None
        if emp:
            return f"{emp.first_name} {emp.last_name}".strip()
        return ""
    class Meta:
        model = ReimbursementClaim
        fields = [
            "id",
            "batch",
            "employee",
            "employee_name",
            "status","employee_code",
            "total_claimed_amount",
            "total_approved_amount",
            "remarks",
            "created_at",
            "updated_at",
        ]


class ExpenseItemSerializer(serializers.ModelSerializer):
    attachments = serializers.SerializerMethodField()
    attachment_count = serializers.IntegerField(read_only=True)
    has_attachment = serializers.SerializerMethodField()
    validation = serializers.SerializerMethodField()
    claim_id = serializers.IntegerField(source="claim.id", read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.CharField(source="claim.employee.employee_id", read_only=True)
    batch_title = serializers.CharField(source="claim.batch.title", read_only=True)

    def get_employee_name(self, obj):
        emp = obj.claim.employee if obj.claim else None
        if emp:
            return f"{emp.first_name} {emp.last_name}".strip()
        return ""

    def get_attachments(self, obj):
        attachments = getattr(obj, "prefetched_attachments", None)
        if attachments is None:
            attachments = obj.attachments.all()
        return ExpenseAttachmentSerializer(attachments, many=True, context=self.context).data

    def get_has_attachment(self, obj):
        attachment_count = getattr(obj, "attachment_count", None)
        if attachment_count is None:
            attachment_count = obj.attachments.count()
        return attachment_count > 0

    def get_validation(self, obj):
        try:
            validation = obj.validation
        except ObjectDoesNotExist:
            return None
        return ExpenseValidationSerializer(validation, context=self.context).data

    class Meta:
        model = ExpenseItem
        fields = [
            "id",
            "claim",
            "claim_id",
            "employee_name",
            "employee_code",
            "batch_title",
            "expense_date",
            "category",
            "vendor_name",
            "description",
            "claimed_amount",
            "approved_amount",
            "status",
            "review_notes",
            "attachments",
            "attachment_count",
            "has_attachment",
            "validation",
            "created_at",
            "updated_at",
        ]


class BillExtractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillExtraction
        fields = [
            "id",
            "attachment",
            "status",
            "raw_text",
            "extracted_vendor",
            "extracted_date",
            "extracted_amount",
            "extracted_invoice_number",
            "confidence_score",
            "error_message",
            "processed_at",
            "created_at",
            "updated_at",
        ]


class ExpenseValidationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseValidation
        fields = [
            "id",
            "expense_item",
            "status",
            "claimed_amount",
            "extracted_amount",
            "amount_difference",
            "claimed_date",
            "extracted_date",
            "message",
            "checked_at",
            "created_at",
            "updated_at",
        ]


class ExpenseAttachmentSerializer(serializers.ModelSerializer):
    extraction = serializers.SerializerMethodField()

    def get_extraction(self, obj):
        try:
            extraction = obj.extraction
        except ObjectDoesNotExist:
            return None
        return BillExtractionSerializer(extraction, context=self.context).data

    class Meta:
        model = ExpenseAttachment
        fields = [
            "id",
            "expense_item",
            "file",
            "original_filename",
            "file_type",
            "extraction",
            "uploaded_at",
        ]


class UploadedReimbursementFormSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_id", read_only=True)

    def get_employee_name(self, obj):
        emp = obj.employee if obj else None
        if emp:
            return f"{emp.first_name} {emp.last_name}".strip()
        return ""
    class Meta:
        model = UploadedReimbursementForm
        fields = [
            "id",
            "batch",
            "employee",
            "employee_name",
            "employee_code",
            "original_file",
            "original_filename",
            "imported_claim",
            "status",
            "parsed_data",
            "error_message",
            "uploaded_at",
            "imported_at",
        ]


class GeneratedReportSerializer(serializers.ModelSerializer):
    batch_title = serializers.CharField(source="batch.title", read_only=True)
    claim_employee_name = serializers.CharField(source="claim.employee.full_name", read_only=True)

    class Meta:
        model = GeneratedReport
        fields = [
            "id",
            "batch",
            "claim",
            "batch_title",
            "claim_employee_name",
            "report_type",
            "file",
            "original_filename",
            "generated_at",
            "notes",
        ]


class EmailDispatchLogSerializer(serializers.ModelSerializer):
    attached_reports = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = EmailDispatchLog
        fields = [
            "id",
            "batch",
            "smart_reimbursement_upload",
            "triggered_by",
            "subject",
            "body",
            "to_email",
            "cc_emails",
            "cc_email",
            "status",
            "attached_reports",
            "error_message",
            "sent_at",
            "created_at",
            "updated_at",
        ]


class SystemSettingSerializer(serializers.ModelSerializer):
    def validate_quick_claim_allowed_recipient_domains(self, value):
        return normalize_quick_claim_allowed_recipient_domains(value)

    class Meta:
        model = SystemSetting
        fields = [
            "id",
            "company_name",
            "company_address",
            "cto_email",
            "finance_head_email",
            "default_email_subject_prefix",
            "default_email_body_note",
            "quick_claim_allowed_recipient_domains",
            "quick_claim_confidence_threshold",
            "quick_claim_llm_enabled",
            "created_at",
            "updated_at",
        ]


class SmartUploadCreateSerializer(serializers.Serializer):
    employee_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    employee_department = serializers.CharField(max_length=100, required=False, allow_blank=True)
    created_by_employee = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        required=False,
        allow_null=True,
    )
    month = serializers.IntegerField(min_value=1, max_value=12, required=False)
    year = serializers.IntegerField(min_value=2024, max_value=2100, required=False)
    recipient_email = serializers.EmailField(required=False, allow_blank=True)
    cc = serializers.CharField(required=False, allow_blank=True)
    auto_send = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if not attrs.get("employee_name", "").strip() and not attrs.get("created_by_employee"):
            attrs["employee_name"] = ""
        cc_value = attrs.pop("cc", "")
        attrs["cc_emails"] = [email.strip() for email in cc_value.split(",") if email.strip()]
        for email in attrs["cc_emails"]:
            serializers.EmailField().run_validation(email)
        if attrs.get("auto_send") and not attrs.get("recipient_email"):
            raise serializers.ValidationError({"recipient_email": "Recipient email is required for auto-send."})
        return attrs


class SmartUploadedBillFileSerializer(serializers.ModelSerializer):
    extraction_status = serializers.SerializerMethodField()

    def get_extraction_status(self, obj):
        attachment = obj.expense_attachment
        if not attachment:
            return None
        try:
            return attachment.extraction.status
        except ObjectDoesNotExist:
            return None

    class Meta:
        model = SmartUploadedBillFile
        fields = [
            "id",
            "original_filename",
            "detected_mime_type",
            "file_size",
            "status",
            "extraction_status",
            "error_message",
            "processed_at",
        ]


class DraftExtractedExpenseSerializer(serializers.ModelSerializer):
    bill_filename = serializers.CharField(source="bill_file.original_filename", read_only=True)

    class Meta:
        model = DraftExtractedExpense
        fields = [
            "id",
            "bill_file",
            "bill_filename",
            "expense_date",
            "vendor_name",
            "purpose",
            "remarks",
            "category",
            "amount",
            "classification_source",
            "category_confidence",
            "requires_manual_review",
            "manually_reviewed",
            "expense_item",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "bill_file",
            "classification_source",
            "category_confidence",
            "requires_manual_review",
            "manually_reviewed",
            "expense_item",
        ]


class DraftExpenseUpdateSerializer(serializers.ModelSerializer):
    category = serializers.ChoiceField(
        choices=[
            "TRAVEL",
            "MEAL",
            "TELEPHONE",
            "HOTEL",
            "OFFICE",
            "OTHERS",
        ],
        required=False,
    )
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
    )

    class Meta:
        model = DraftExtractedExpense
        fields = ["expense_date", "vendor_name", "purpose", "category", "amount", "remarks"]

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        is_complete = bool(
            instance.expense_date
            and instance.amount is not None
            and instance.amount > 0
            and instance.vendor_name.strip()
            and instance.purpose.strip()
            and instance.category
        )
        instance.classification_source = ExpenseItem.ClassificationSource.MANUAL
        instance.category_confidence = 1.0
        instance.requires_manual_review = not is_complete
        instance.manually_reviewed = True
        instance.reviewed_by = self.context["request"].user
        instance.save(
            update_fields=[
                "classification_source",
                "category_confidence",
                "requires_manual_review",
                "manually_reviewed",
                "reviewed_by",
                "updated_at",
            ]
        )
        return instance


class SmartReimbursementUploadSerializer(serializers.ModelSerializer):
    files = SmartUploadedBillFileSerializer(source="bill_files", many=True, read_only=True)
    excel_report_url = serializers.SerializerMethodField()
    pdf_report_url = serializers.SerializerMethodField()
    latest_email_status = serializers.SerializerMethodField()

    def _file_url(self, report):
        if not report or not report.file:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(report.file.url) if request else report.file.url

    def get_excel_report_url(self, obj):
        return self._file_url(obj.excel_report)

    def get_pdf_report_url(self, obj):
        return self._file_url(obj.pdf_report)

    def get_latest_email_status(self, obj):
        log = obj.email_dispatch_logs.order_by("-created_at").first()
        if not log:
            return None
        return {
            "status": log.status,
            "sent_at": log.sent_at,
            "error_message": log.error_message,
        }

    class Meta:
        model = SmartReimbursementUpload
        fields = [
            "id",
            "status",
            "claim",
            "employee_name",
            "employee_department",
            "reimbursement_profile",
            "created_by_employee",
            "month",
            "year",
            "total_files",
            "processed_files",
            "failed_files",
            "draft_total_amount",
            "recipient_email",
            "cc_emails",
            "auto_send",
            "excel_report",
            "pdf_report",
            "excel_report_url",
            "pdf_report_url",
            "latest_email_status",
            "error_message",
            "sent_at",
            "files",
            "created_at",
            "updated_at",
        ]


class SmartConfirmSendSerializer(serializers.Serializer):
    recipient_email = serializers.EmailField(required=False)
    cc_emails = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        allow_empty=True,
    )

