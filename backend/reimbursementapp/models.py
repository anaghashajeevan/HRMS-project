from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from HRMSapp.models import Employee


def normalize_quick_claim_allowed_recipient_domains(values) -> list[str]:
    if isinstance(values, str):
        values = values.split(",")
    normalized_domains: list[str] = []
    seen: set[str] = set()
    for raw_value in values or []:
        value = str(raw_value or "").strip().lower()
        if not value:
            continue
        if value.startswith("mailto:"):
            value = value.removeprefix("mailto:").strip()
        if "@" in value:
            value = value.rsplit("@", 1)[-1].strip()
        value = value.strip().lstrip("@").rstrip("/").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized_domains.append(value)
    return normalized_domains


def get_quick_claim_allowed_recipient_domains() -> list[str]:
    db_domains = normalize_quick_claim_allowed_recipient_domains(
        get_system_settings().quick_claim_allowed_recipient_domains
    )
    if db_domains:
        return db_domains
    return normalize_quick_claim_allowed_recipient_domains(
        getattr(settings, "ALLOWED_RECIPIENT_DOMAINS", [])
    )


class MonthlyReimbursementBatch(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        REVIEWING = "REVIEWING", "Reviewing"
        READY_TO_SEND = "READY_TO_SEND", "Ready to Send"
        SENT = "SENT", "Sent"
        CLOSED = "CLOSED", "Closed"

    month = models.PositiveSmallIntegerField()
    year = models.PositiveIntegerField()
    title = models.CharField(max_length=150, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    total_employees = models.PositiveIntegerField(default=0)
    total_claimed_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    total_approved_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("month", "year")
        ordering = ["-year", "-month"]

    def __str__(self):
        return self.title or f"Reimbursement Batch {self.month}/{self.year}"


class ReimbursementClaim(models.Model):
    class Source(models.TextChoices):
        FORM_IMPORT = "FORM_IMPORT", "Form Import"
        QUICK_BULK_UPLOAD = "QUICK_BULK_UPLOAD", "Quick Bulk Upload"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        REVIEWING = "REVIEWING", "Reviewing"
        APPROVED = "APPROVED", "Approved"
        PARTIALLY_APPROVED = "PARTIALLY_APPROVED", "Partially Approved"
        REJECTED = "REJECTED", "Rejected"

    batch = models.ForeignKey(
        MonthlyReimbursementBatch,
        on_delete=models.CASCADE,
        related_name="claims",
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="reimbursement_claims",
    )
    source = models.CharField(
        max_length=24,
        choices=Source.choices,
        default=Source.FORM_IMPORT,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    total_claimed_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    total_approved_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("batch", "employee")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.employee.full_name} - {self.batch}"


class ExpenseItem(models.Model):
    class Category(models.TextChoices):
        TRAVEL = "TRAVEL", "Travel"
        FOOD = "FOOD", "Food"
        OFFICE_UTILITY = "OFFICE_UTILITY", "Office Utility"
        OFFICE_SUPPLIES = "OFFICE_SUPPLIES", "Office Supplies"
        FUEL = "FUEL", "Fuel"
        OTHER = "OTHER", "Other"
        MEAL = "MEAL", "Meal"
        TELEPHONE = "TELEPHONE", "Telephone"
        HOTEL = "HOTEL", "Hotel"
        OFFICE = "OFFICE", "Office"
        OTHERS = "OTHERS", "Others"

    class ClassificationSource(models.TextChoices):
        VENDOR_RULE = "VENDOR_RULE", "Vendor Rule"
        TEXT_HEURISTIC = "TEXT_HEURISTIC", "Text Heuristic"
        LLM_FALLBACK = "LLM_FALLBACK", "LLM Fallback"
        MANUAL = "MANUAL", "Manual"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING_REVIEW = "PENDING_REVIEW", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        MISMATCH = "MISMATCH", "Mismatch"

    claim = models.ForeignKey(
        ReimbursementClaim,
        on_delete=models.CASCADE,
        related_name="expense_items",
    )
    expense_date = models.DateField(null=True, blank=True)
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    vendor_name = models.CharField(max_length=150, blank=True)
    description = models.TextField(blank=True)
    classification_source = models.CharField(
        max_length=20,
        choices=ClassificationSource.choices,
        default=ClassificationSource.MANUAL,
    )
    category_confidence = models.FloatField(
        default=1.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )
    requires_manual_review = models.BooleanField(default=False)
    claimed_amount = models.DecimalField(max_digits=12, decimal_places=2)
    approved_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING_REVIEW,
    )
    review_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        label = self.vendor_name or self.get_category_display()
        return f"{label} - {self.claimed_amount}"


class ExpenseAttachment(models.Model):
    expense_item = models.ForeignKey(
        ExpenseItem,
        on_delete=models.CASCADE,
        related_name="attachments",
        null=True,
        blank=True,
    )
    file = models.FileField(upload_to="reimbursement_bills/")
    original_filename = models.CharField(max_length=255, blank=True)
    file_type = models.CharField(max_length=100, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_filename or self.file.name


class BillExtraction(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"
        UNSUPPORTED = "UNSUPPORTED", "Unsupported"

    attachment = models.OneToOneField(
        ExpenseAttachment,
        on_delete=models.CASCADE,
        related_name="extraction",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    raw_text = models.TextField(blank=True)
    extracted_vendor = models.CharField(max_length=255, blank=True)
    extracted_date = models.DateField(null=True, blank=True)
    extracted_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    extracted_invoice_number = models.CharField(max_length=100, blank=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    error_message = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"OCR {self.get_status_display()} - {self.attachment}"


class ExpenseValidation(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        MATCHED = "MATCHED", "Matched"
        AMOUNT_MISMATCH = "AMOUNT_MISMATCH", "Amount Mismatch"
        DATE_MISMATCH = "DATE_MISMATCH", "Date Mismatch"
        MISSING_BILL = "MISSING_BILL", "Missing Bill"
        OCR_PENDING = "OCR_PENDING", "OCR Pending"
        OCR_FAILED = "OCR_FAILED", "OCR Failed"
        NEEDS_REVIEW = "NEEDS_REVIEW", "Needs Review"

    expense_item = models.OneToOneField(
        ExpenseItem,
        on_delete=models.CASCADE,
        related_name="validation",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    claimed_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    extracted_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    amount_difference = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    claimed_date = models.DateField(null=True, blank=True)
    extracted_date = models.DateField(null=True, blank=True)
    message = models.TextField(blank=True)
    checked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Validation {self.get_status_display()} - Expense #{self.expense_item_id}"


class UploadedReimbursementForm(models.Model):
    class Status(models.TextChoices):
        UPLOADED = "UPLOADED", "Uploaded"
        PARSED = "PARSED", "Parsed"
        IMPORTED = "IMPORTED", "Imported"
        FAILED = "FAILED", "Failed"
        NEEDS_REVIEW = "NEEDS_REVIEW", "Needs Review"

    batch = models.ForeignKey(
        MonthlyReimbursementBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_forms",
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_reimbursement_forms",
    )
    original_file = models.FileField(upload_to="reimbursement_forms/")
    original_filename = models.CharField(max_length=255)
    imported_claim = models.ForeignKey(
        ReimbursementClaim,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_uploaded_forms",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UPLOADED,
    )
    parsed_data = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    imported_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return self.original_filename


class GeneratedReport(models.Model):
    class ReportType(models.TextChoices):
        COMBINED_EXCEL = "COMBINED_EXCEL", "Combined Excel"
        COMBINED_PDF = "COMBINED_PDF", "Combined PDF"
        EMPLOYEE_EXCEL = "EMPLOYEE_EXCEL", "Employee Excel"
        EMPLOYEE_PDF = "EMPLOYEE_PDF", "Employee PDF"
        QUICK_CLAIM_EXCEL = "QUICK_CLAIM_EXCEL", "Quick Claim Excel"
        QUICK_CLAIM_PDF = "QUICK_CLAIM_PDF", "Quick Claim PDF"

    batch = models.ForeignKey(
        MonthlyReimbursementBatch,
        on_delete=models.CASCADE,
        related_name="generated_reports",
        null=True,
        blank=True,
    )
    claim = models.ForeignKey(
        ReimbursementClaim,
        on_delete=models.CASCADE,
        related_name="generated_reports",
        null=True,
        blank=True,
    )
    report_type = models.CharField(max_length=20, choices=ReportType.choices)
    file = models.FileField(upload_to="reimbursement_reports/")
    original_filename = models.CharField(max_length=255)
    generated_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-generated_at"]

    def __str__(self):
        return self.original_filename or f"Report #{self.pk}"


class SmartReimbursementUpload(models.Model):
    class Status(models.TextChoices):
        UPLOADING = "UPLOADING", "Uploading"
        QUEUED = "QUEUED", "Queued"
        PROCESSING = "PROCESSING", "Processing"
        NEEDS_REVIEW = "NEEDS_REVIEW", "Needs Review"
        READY_TO_CONFIRM = "READY_TO_CONFIRM", "Ready to Confirm"
        CONFIRMING = "CONFIRMING", "Confirming"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    claim = models.ForeignKey(
        ReimbursementClaim,
        on_delete=models.SET_NULL,
        related_name="smart_reimbursement_uploads",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPLOADING)
    total_files = models.PositiveIntegerField(default=0)
    processed_files = models.PositiveIntegerField(default=0)
    failed_files = models.PositiveIntegerField(default=0)
    draft_total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    employee_name = models.CharField(max_length=150, blank=True)
    employee_department = models.CharField(max_length=100, blank=True)
    month = models.PositiveSmallIntegerField()
    year = models.PositiveIntegerField()
    recipient_email = models.EmailField(null=True, blank=True)
    cc_emails = models.JSONField(default=list, blank=True)
    auto_send = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="smart_reimbursement_uploads",
        null=True,
        blank=True,
    )
    created_by_employee = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        related_name="smart_reimbursement_uploads",
        null=True,
        blank=True,
    )
    reimbursement_profile = models.ForeignKey(
        "EmployeeReimbursementProfile",
        on_delete=models.SET_NULL,
        related_name="smart_reimbursement_uploads",
        null=True,
        blank=True,
    )
    excel_report = models.ForeignKey(
        GeneratedReport,
        on_delete=models.SET_NULL,
        related_name="smart_excel_uploads",
        null=True,
        blank=True,
    )
    pdf_report = models.ForeignKey(
        GeneratedReport,
        on_delete=models.SET_NULL,
        related_name="smart_pdf_uploads",
        null=True,
        blank=True,
    )
    task_group_id = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Smart Upload #{self.pk} - {self.get_status_display()}"


class EmployeeReimbursementProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reimbursement_profile",
    )
    employee_name = models.CharField(max_length=150)
    department = models.CharField(max_length=100)
    default_claim_month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )
    default_claim_year = models.PositiveIntegerField(
        validators=[MinValueValidator(2024), MaxValueValidator(2100)]
    )
    finance_head_email = models.EmailField()
    cc_emails = models.JSONField(default=list, blank=True)
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__email", "user__username"]

    def __str__(self):
        return self.employee_name or self.user.get_username()


class SmartUploadedBillFile(models.Model):
    class Status(models.TextChoices):
        QUEUED = "QUEUED", "Queued"
        PROCESSING = "PROCESSING", "Processing"
        PROCESSED = "PROCESSED", "Processed"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    upload = models.ForeignKey(
        SmartReimbursementUpload,
        on_delete=models.CASCADE,
        related_name="bill_files",
    )
    file = models.FileField(upload_to="smart_reimbursement_bills/%Y/%m/")
    original_filename = models.CharField(max_length=255)
    detected_mime_type = models.CharField(max_length=100)
    file_size = models.PositiveBigIntegerField()
    content_sha256 = models.CharField(max_length=64)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    expense_attachment = models.OneToOneField(
        ExpenseAttachment,
        on_delete=models.SET_NULL,
        related_name="smart_bill_file",
        null=True,
        blank=True,
    )
    celery_task_id = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.original_filename


class DraftExtractedExpense(models.Model):
    upload = models.ForeignKey(
        SmartReimbursementUpload,
        on_delete=models.CASCADE,
        related_name="draft_expenses",
    )
    bill_file = models.OneToOneField(
        SmartUploadedBillFile,
        on_delete=models.CASCADE,
        related_name="draft_expense",
    )
    expense_item = models.OneToOneField(
        ExpenseItem,
        on_delete=models.SET_NULL,
        related_name="source_draft_expense",
        null=True,
        blank=True,
    )
    expense_date = models.DateField(null=True, blank=True)
    vendor_name = models.CharField(max_length=150, blank=True)
    purpose = models.TextField(blank=True)
    remarks = models.TextField(blank=True)
    category = models.CharField(
        max_length=20,
        choices=ExpenseItem.Category.choices,
        default=ExpenseItem.Category.OTHERS,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    classification_source = models.CharField(
        max_length=20,
        choices=ExpenseItem.ClassificationSource.choices,
        default=ExpenseItem.ClassificationSource.TEXT_HEURISTIC,
    )
    category_confidence = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )
    requires_manual_review = models.BooleanField(default=True)
    manually_reviewed = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="reviewed_draft_expenses",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"Draft expense for {self.bill_file.original_filename}"


class VendorCategoryRule(models.Model):
    vendor_keyword = models.CharField(max_length=150, unique=True)
    category = models.CharField(max_length=20, choices=ExpenseItem.Category.choices)
    match_priority = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["match_priority", "vendor_keyword"]

    def __str__(self):
        return f"{self.vendor_keyword} -> {self.get_category_display()}"


class SystemSetting(models.Model):
    company_name = models.CharField(max_length=255, default="NL Technologies Pvt. Ltd.")
    company_address = models.TextField(blank=True)
    cto_email = models.EmailField(blank=True)
    finance_head_email = models.EmailField(blank=True)
    default_email_subject_prefix = models.CharField(
        max_length=255,
        default="Monthly Expense Reimbursement Summary",
    )
    default_email_body_note = models.TextField(blank=True)
    quick_claim_allowed_recipient_domains = models.JSONField(default=list, blank=True)
    quick_claim_confidence_threshold = models.FloatField(
        default=0.6,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )
    quick_claim_llm_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.company_name

    def save(self, *args, **kwargs):
        self.quick_claim_allowed_recipient_domains = normalize_quick_claim_allowed_recipient_domains(
            self.quick_claim_allowed_recipient_domains
        )
        super().save(*args, **kwargs)


def get_system_settings() -> SystemSetting:
    system_setting = SystemSetting.objects.order_by("id").first()
    if system_setting:
        return system_setting
    return SystemSetting.objects.create()


class EmailDispatchLog(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"

    batch = models.ForeignKey(
        MonthlyReimbursementBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="email_dispatch_logs",
    )
    smart_reimbursement_upload = models.ForeignKey(
        SmartReimbursementUpload,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="email_dispatch_logs",
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reimbursement_email_dispatches",
    )
    subject = models.CharField(max_length=255)
    body = models.TextField()
    to_email = models.EmailField()
    cc_email = models.EmailField(blank=True)
    cc_emails = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    attached_reports = models.ManyToManyField(
        GeneratedReport,
        blank=True,
        related_name="email_logs",
    )
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.subject

