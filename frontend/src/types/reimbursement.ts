// ==============================================================================
// REIMBURSEMENT MODULE TYPES
// ==============================================================================

// ------------------------------------------------------------------------------
// BATCH
// ------------------------------------------------------------------------------

export type BatchStatus = 'DRAFT' | 'REVIEWING' | 'READY_TO_SEND' | 'SENT' | 'CLOSED';

export interface MonthlyBatch {
  id: number;
  month: number;
  year: number;
  title: string;
  status: BatchStatus;
  total_employees: number;
  total_claimed_amount: string;
  total_approved_amount: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// CLAIM
// ------------------------------------------------------------------------------

export type ClaimSource = 'FORM_IMPORT' | 'QUICK_BULK_UPLOAD';
export type ClaimStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWING' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';

export interface ReimbursementClaim {
  id: number;
  batch: number;
  employee: number;
  employee_name: string;
  employee_code: string;
  source: ClaimSource;
  status: ClaimStatus;
  total_claimed_amount: string;
  total_approved_amount: string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// EXPENSE ITEM
// ------------------------------------------------------------------------------

export type ExpenseCategory =
  | 'TRAVEL' | 'FOOD' | 'OFFICE_UTILITY' | 'OFFICE_SUPPLIES'
  | 'FUEL' | 'OTHER' | 'MEAL' | 'TELEPHONE' | 'HOTEL'
  | 'OFFICE' | 'OTHERS';

export type ExpenseStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'MISMATCH';

export type ClassificationSource = 'VENDOR_RULE' | 'TEXT_HEURISTIC' | 'LLM_FALLBACK' | 'MANUAL';

export type ValidationStatus =
  | 'PENDING' | 'MATCHED' | 'AMOUNT_MISMATCH' | 'DATE_MISMATCH'
  | 'MISSING_BILL' | 'OCR_PENDING' | 'OCR_FAILED' | 'NEEDS_REVIEW';

export type ExtractionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNSUPPORTED';

export interface BillExtraction {
  id: number;
  attachment: number;
  status: ExtractionStatus;
  raw_text: string;
  extracted_vendor: string;
  extracted_date: string | null;
  extracted_amount: string | null;
  extracted_invoice_number: string;
  confidence_score: string | null;
  error_message: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseValidation {
  id: number;
  expense_item: number;
  status: ValidationStatus;
  claimed_amount: string | null;
  extracted_amount: string | null;
  amount_difference: string | null;
  claimed_date: string | null;
  extracted_date: string | null;
  message: string;
  checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseAttachment {
  id: number;
  expense_item: number | null;
  file: string;
  original_filename: string;
  file_type: string;
  extraction: BillExtraction | null;
  uploaded_at: string;
}

export interface ExpenseItem {
  id: number;
  claim: number;
  claim_id: number;
  employee_name: string;
  employee_code: string;
  batch_title: string;
  expense_date: string | null;
  category: ExpenseCategory;
  vendor_name: string;
  description: string;
  classification_source: ClassificationSource;
  category_confidence: number;
  requires_manual_review: boolean;
  claimed_amount: string;
  approved_amount: string;
  status: ExpenseStatus;
  review_notes: string;
  attachments: ExpenseAttachment[];
  attachment_count: number;
  has_attachment: boolean;
  validation: ExpenseValidation | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// SMART UPLOAD (Quick Claim)
// ------------------------------------------------------------------------------

export type SmartUploadStatus =
  | 'UPLOADING' | 'QUEUED' | 'PROCESSING' | 'NEEDS_REVIEW'
  | 'READY_TO_CONFIRM' | 'CONFIRMING' | 'SENT' | 'FAILED' | 'CANCELLED';

export type BillFileStatus = 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'CANCELLED';

export interface SmartUploadedBillFile {
  id: number;
  original_filename: string;
  detected_mime_type: string;
  file_size: number;
  status: BillFileStatus;
  extraction_status: ExtractionStatus | null;
  error_message: string;
  processed_at: string | null;
}

export interface DraftExtractedExpense {
  id: number;
  bill_file: number;
  bill_filename: string;
  expense_date: string | null;
  vendor_name: string;
  purpose: string;
  remarks: string;
  category: ExpenseCategory;
  amount: string | null;
  classification_source: ClassificationSource;
  category_confidence: number;
  requires_manual_review: boolean;
  manually_reviewed: boolean;
  expense_item: number | null;
  created_at: string;
  updated_at: string;
}

export interface SmartReimbursementUpload {
  id: number;
  status: SmartUploadStatus;
  claim: number | null;
  employee_name: string;
  employee_department: string;
  reimbursement_profile: number | null;
  created_by_employee: number | null;
  month: number;
  year: number;
  total_files: number;
  processed_files: number;
  failed_files: number;
  draft_total_amount: string;
  recipient_email: string;
  cc_emails: string[];
  auto_send: boolean;
  excel_report: number | null;
  pdf_report: number | null;
  excel_report_url: string | null;
  pdf_report_url: string | null;
  latest_email_status: {
    status: string;
    sent_at: string | null;
    error_message: string;
  } | null;
  error_message: string;
  sent_at: string | null;
  files: SmartUploadedBillFile[];
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// REPORTS
// ------------------------------------------------------------------------------

export type ReportType =
  | 'COMBINED_EXCEL' | 'COMBINED_PDF'
  | 'EMPLOYEE_EXCEL' | 'EMPLOYEE_PDF'
  | 'QUICK_CLAIM_EXCEL' | 'QUICK_CLAIM_PDF';

export interface GeneratedReport {
  id: number;
  batch: number | null;
  claim: number | null;
  batch_title: string | null;
  claim_employee_name: string | null;
  report_type: ReportType;
  file: string;
  original_filename: string;
  generated_at: string;
  notes: string;
}

// ------------------------------------------------------------------------------
// EMAIL
// ------------------------------------------------------------------------------

export type EmailStatus = 'DRAFT' | 'SENT' | 'FAILED';

export interface EmailDispatchLog {
  id: number;
  batch: number | null;
  smart_reimbursement_upload: number | null;
  triggered_by: number | null;
  subject: string;
  body: string;
  to_email: string;
  cc_email: string;
  cc_emails: string[];
  status: EmailStatus;
  attached_reports: number[];
  error_message: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// SYSTEM SETTINGS
// ------------------------------------------------------------------------------

export interface ReimbursementSystemSetting {
  id: number;
  company_name: string;
  company_address: string;
  cto_email: string;
  finance_head_email: string;
  default_email_subject_prefix: string;
  default_email_body_note: string;
  quick_claim_allowed_recipient_domains: string[];
  quick_claim_confidence_threshold: number;
  quick_claim_llm_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// PROFILE
// ------------------------------------------------------------------------------

export interface ReimbursementProfile {
  id: number | null;
  email: string;
  username: string;
  employee_name: string;
  department: string;
  default_claim_month: number | null;
  default_claim_year: number | null;
  finance_head_email: string;
  cc_emails: string[];
  is_complete: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// ------------------------------------------------------------------------------
// DASHBOARD
// ------------------------------------------------------------------------------

export interface ReimbursementDashboardSummary {
  total_batches: number;
  total_claims: number;
  total_expense_items: number;
  total_employees: number;
  total_claimed_amount: number;
  total_approved_amount: number;
  pending_review_count: number;
  approved_count: number;
  rejected_count: number;
  mismatch_count: number;
}

// ------------------------------------------------------------------------------
// FINANCE REVIEW
// ------------------------------------------------------------------------------

export interface FinanceReviewSummary {
  total_items: number;
  total_claimed_amount: string;
  total_approved_amount: string;
  ready_to_approve_count: number;
  missing_bill_count: number;
  ocr_pending_count: number;
  ocr_failed_count: number;
  amount_mismatch_count: number;
  date_mismatch_count: number;
  needs_review_count: number;
  approved_count: number;
  rejected_count: number;
  ready_to_approve_amount: string;
  approved_amount: string;
  rejected_amount: string;
}

export type FinanceReviewBucket =
  | 'all' | 'ready_to_approve' | 'missing_bill' | 'ocr_pending'
  | 'ocr_failed' | 'amount_mismatch' | 'date_mismatch'
  | 'needs_review' | 'approved' | 'rejected';

// ------------------------------------------------------------------------------
// CONFIG STATUS
// ------------------------------------------------------------------------------

export interface SystemConfigStatus {
  database: { connected: boolean };
  email: {
    email_host: string;
    email_port: number;
    email_use_tls: boolean;
    email_host_user_configured: boolean;
    default_from_email_configured: boolean;
    email_password_configured: boolean;
    cto_email_configured: boolean;
    finance_head_email_configured: boolean;
  };
  ocr: {
    tesseract_cmd_configured: boolean;
    tesseract_available: boolean;
    tesseract_version: string;
  };
}