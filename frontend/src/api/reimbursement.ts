// ==============================================================================
// REIMBURSEMENT API — Single consolidated file
// ==============================================================================

import api from './axios';
import type {
  MonthlyBatch, ReimbursementClaim, ExpenseItem,
  SmartReimbursementUpload, DraftExtractedExpense,
  GeneratedReport, EmailDispatchLog,
  ReimbursementSystemSetting, ReimbursementProfile,
  ReimbursementDashboardSummary, FinanceReviewSummary,
  SystemConfigStatus, ExpenseAttachment, BillExtraction,
  ExpenseValidation,
} from '../types/reimbursement';

const BASE = '/reimbursements';

// ==============================================================================
// DASHBOARD
// ==============================================================================

export const reimbursementDashboardApi = {
  summary: async (): Promise<ReimbursementDashboardSummary> => {
    const { data } = await api.get(`${BASE}/dashboard-summary/`);
    return data;
  },
};

// ==============================================================================
// BATCHES
// ==============================================================================

export const batchesApi = {
  list: async (): Promise<MonthlyBatch[]> => {
    const { data } = await api.get(`${BASE}/batches/`);
    return Array.isArray(data) ? data : data.results || [];
  },

  getById: async (id: number): Promise<MonthlyBatch> => {
    const { data } = await api.get(`${BASE}/batches/${id}/`);
    return data;
  },

  generateCombinedExcel: async (id: number): Promise<GeneratedReport> => {
    const { data } = await api.post(`${BASE}/batches/${id}/generate-combined-excel/`);
    return data;
  },

  generateCombinedPdf: async (id: number): Promise<GeneratedReport> => {
    const { data } = await api.post(`${BASE}/batches/${id}/generate-combined-pdf/`);
    return data;
  },
};

// ==============================================================================
// CLAIMS
// ==============================================================================

export const claimsApi = {
  list: async (params?: {
    batch?: number;
    employee?: number;
    status?: string;
  }): Promise<ReimbursementClaim[]> => {
    const { data } = await api.get(`${BASE}/claims/`, { params });
    return Array.isArray(data) ? data : data.results || [];
  },

  getById: async (id: number): Promise<ReimbursementClaim> => {
    const { data } = await api.get(`${BASE}/claims/${id}/`);
    return data;
  },

  validate: async (id: number): Promise<any> => {
    const { data } = await api.post(`${BASE}/claims/${id}/validate/`);
    return data;
  },

  approveMatched: async (id: number): Promise<any> => {
    const { data } = await api.post(`${BASE}/claims/${id}/approve-matched/`);
    return data;
  },

  generateEmployeeExcel: async (id: number): Promise<GeneratedReport> => {
    const { data } = await api.post(`${BASE}/claims/${id}/generate-employee-excel/`);
    return data;
  },

  generateEmployeePdf: async (id: number): Promise<GeneratedReport> => {
    const { data } = await api.post(`${BASE}/claims/${id}/generate-employee-pdf/`);
    return data;
  },
};

// ==============================================================================
// EXPENSE ITEMS
// ==============================================================================

export const expenseItemsApi = {
  list: async (params?: {
    claim?: number;
    category?: string;
    status?: string;
  }): Promise<ExpenseItem[]> => {
    const { data } = await api.get(`${BASE}/expense-items/`, { params });
    return Array.isArray(data) ? data : data.results || [];
  },

  getById: async (id: number): Promise<ExpenseItem> => {
    const { data } = await api.get(`${BASE}/expense-items/${id}/`);
    return data;
  },

  uploadAttachment: async (id: number, file: File): Promise<ExpenseAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post(
      `${BASE}/expense-items/${id}/upload-attachment/`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },

  validate: async (id: number): Promise<ExpenseValidation> => {
    const { data } = await api.post(`${BASE}/expense-items/${id}/validate/`);
    return data;
  },

  approve: async (
    id: number,
    payload: { approved_amount: string; review_notes?: string }
  ): Promise<ExpenseItem> => {
    const { data } = await api.post(`${BASE}/expense-items/${id}/approve/`, payload);
    return data;
  },

  reject: async (
    id: number,
    payload: { review_notes: string }
  ): Promise<ExpenseItem> => {
    const { data } = await api.post(`${BASE}/expense-items/${id}/reject/`, payload);
    return data;
  },
};

// ==============================================================================
// ATTACHMENTS
// ==============================================================================

export const attachmentsApi = {
  list: async (params?: { expense_item?: number }): Promise<ExpenseAttachment[]> => {
    const { data } = await api.get(`${BASE}/attachments/`, { params });
    return Array.isArray(data) ? data : data.results || [];
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`${BASE}/attachments/${id}/`);
  },

  runOcr: async (id: number): Promise<BillExtraction> => {
    const { data } = await api.post(`${BASE}/attachments/${id}/run-ocr/`);
    return data;
  },
};

// ==============================================================================
// SMART UPLOAD (Quick Claim)
// ==============================================================================

export const quickClaimApi = {
  upload: async (formData: FormData): Promise<SmartReimbursementUpload> => {
    const { data } = await api.post(`${BASE}/quick-claims/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getStatus: async (id: number): Promise<SmartReimbursementUpload> => {
    const { data } = await api.get(`${BASE}/quick-claims/${id}/status/`);
    return data;
  },

  getDraftExpenses: async (id: number): Promise<DraftExtractedExpense[]> => {
    const { data } = await api.get(`${BASE}/quick-claims/${id}/draft-expenses/`);
    return data;
  },

  updateDraftExpense: async (
    uploadId: number,
    itemId: number,
    payload: Partial<DraftExtractedExpense>
  ): Promise<DraftExtractedExpense> => {
    const { data } = await api.patch(
      `${BASE}/quick-claims/${uploadId}/items/${itemId}/`,
      payload
    );
    return data;
  },

  confirmAndSend: async (id: number): Promise<any> => {
    const { data } = await api.post(`${BASE}/quick-claims/${id}/confirm-and-send/`);
    return data;
  },

  cancel: async (id: number): Promise<SmartReimbursementUpload> => {
    const { data } = await api.post(`${BASE}/quick-claims/${id}/cancel/`);
    return data;
  },
};

// ==============================================================================
// PROFILE
// ==============================================================================

export const reimbursementProfileApi = {
  get: async (): Promise<ReimbursementProfile> => {
    const { data } = await api.get(`${BASE}/my-reimbursement-profile/`);
    return data;
  },

  update: async (payload: Partial<ReimbursementProfile>): Promise<ReimbursementProfile> => {
    const { data } = await api.put(`${BASE}/my-reimbursement-profile/`, payload);
    return data;
  },
};

// ==============================================================================
// FINANCE REVIEW
// ==============================================================================

export const financeReviewApi = {
  summary: async (): Promise<FinanceReviewSummary> => {
    const { data } = await api.get(`${BASE}/finance-review-summary/`);
    return data;
  },

  items: async (bucket?: string): Promise<ExpenseItem[]> => {
    const { data } = await api.get(`${BASE}/finance-review-items/`, {
      params: bucket ? { bucket } : {},
    });
    return data;
  },
};

// ==============================================================================
// REPORTS
// ==============================================================================

export const reimbursementReportsApi = {
  list: async (): Promise<GeneratedReport[]> => {
    const { data } = await api.get(`${BASE}/reports/`);
    return data;
  },

  centerSummary: async (): Promise<any> => {
    const { data } = await api.get(`${BASE}/report-center-summary/`);
    return data;
  },
};

// ==============================================================================
// EMAIL
// ==============================================================================

export const reimbursementEmailApi = {
  preview: async (batchId: number, templateType?: string): Promise<any> => {
    const { data } = await api.get(`${BASE}/email-control/preview/`, {
      params: { batch: batchId, template_type: templateType },
    });
    return data;
  },

  send: async (payload: {
    batch: number;
    report_ids: number[];
    to_email: string;
    cc_email?: string;
    subject: string;
    body: string;
  }): Promise<EmailDispatchLog> => {
    const { data } = await api.post(`${BASE}/email-control/send/`, payload);
    return data;
  },

  testSmtp: async (testToEmail: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.post(`${BASE}/email-control/test-smtp/`, {
      test_to_email: testToEmail,
    });
    return data;
  },

  logs: async (): Promise<EmailDispatchLog[]> => {
    const { data } = await api.get(`${BASE}/email-logs/`);
    return data;
  },
};

// ==============================================================================
// SYSTEM SETTINGS
// ==============================================================================

export const reimbursementSettingsApi = {
  get: async (): Promise<ReimbursementSystemSetting> => {
    const { data } = await api.get(`${BASE}/system-settings/`);
    return data;
  },

  update: async (
    payload: Partial<ReimbursementSystemSetting>
  ): Promise<ReimbursementSystemSetting> => {
    const { data } = await api.patch(`${BASE}/system-settings/`, payload);
    return data;
  },

  configStatus: async (): Promise<SystemConfigStatus> => {
    const { data } = await api.get(`${BASE}/system-settings/config-status/`);
    return data;
  },
};

// ==============================================================================
// FORMS (Excel upload)
// ==============================================================================

export const reimbursementFormsApi = {
  list: async (): Promise<any[]> => {
    const { data } = await api.get(`${BASE}/forms/`);
    return data;
  },

  upload: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post(`${BASE}/forms/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  import: async (id: number): Promise<any> => {
    const { data } = await api.post(`${BASE}/forms/${id}/import/`);
    return data;
  },
};