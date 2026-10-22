import api from './axios';

// The employee endpoint is paginated (20 rows per page by default), and its
// status choices are uppercase. Fetch all selectable payroll employees across
// active and probation statuses instead of relying on one lowercase query.
export const getPayrollEmployees = async () => {
  const employees = new Map<string, any>();
  for (const status of ['ACTIVE', 'PROBATION']) {
    let page = 1;
    let hasNext = true;
    while (hasNext) {
      const response = await api.get('/employees/', { params: { status, page } });
      const payload = response.data;
      const rows = Array.isArray(payload) ? payload : (payload.results || []);
      rows.forEach((employee: any) => employees.set(employee.id, employee));
      hasNext = Boolean(payload?.next);
      page += 1;
    }
  }
  return Array.from(employees.values()).sort((a, b) =>
    String(a.employee_id || '').localeCompare(String(b.employee_id || '')),
  );
};

// ─── Salary Components ───
export const getComponents = (params?: Record<string, string>) =>
  api.get('/payroll/components/', { params });

export const getComponentsMini = () =>
  api.get('/payroll/components/mini/');

export const createComponent = (data: any) =>
  api.post('/payroll/components/', data);

export const updateComponent = (id: string, data: any) =>
  api.put(`/payroll/components/${id}/`, data);

export const deleteComponent = (id: string) =>
  api.delete(`/payroll/components/${id}/`);

// ─── Salary Structures ───
export const getStructures = (params?: Record<string, string>) =>
  api.get('/payroll/structures/', { params });

export const getStructure = (id: string) =>
  api.get(`/payroll/structures/${id}/`);

export const createStructure = (data: any) =>
  api.post('/payroll/structures/', data);

export const updateStructure = (id: string, data: any) =>
  api.put(`/payroll/structures/${id}/`, data);

export const deleteStructure = (id: string) =>
  api.delete(`/payroll/structures/${id}/`);

// ─── Statutory Rules ───
export const getStatutoryRules = (params?: Record<string, string>) =>
  api.get('/payroll/statutory-rules/', { params });

export const getActiveStatutoryRules = () =>
  api.get('/payroll/statutory-rules/active/');

export const createStatutoryRule = (data: any) =>
  api.post('/payroll/statutory-rules/', data);

export const updateStatutoryRule = (id: string, data: any) =>
  api.put(`/payroll/statutory-rules/${id}/`, data);

export const deleteStatutoryRule = (id: string) =>
  api.delete(`/payroll/statutory-rules/${id}/`);

// ─── Pay Calendar ───
export const getPayCalendars = (params?: Record<string, string>) =>
  api.get('/payroll/calendar/', { params });

export const createPayCalendar = (data: any) =>
  api.post('/payroll/calendar/', data);

export const autoCreateCalendar = (data: { year: number; month: number }) =>
  api.post('/payroll/calendar/auto-create/', data);

export const autoCreateYear = (data: { year: number }) =>
  api.post('/payroll/calendar/auto-create-year/', data);

export const updatePayCalendar = (id: string, data: any) =>
  api.put(`/payroll/calendar/${id}/`, data);

export const deletePayCalendar = (id: string) =>
  api.delete(`/payroll/calendar/${id}/`);

// ─── Salary Assignments ───
export const getAssignments = (params?: Record<string, string>) =>
  api.get('/payroll/assignments/', { params });

export const createAssignment = (data: any) =>
  api.post('/payroll/assignments/', data);

export const getAssignmentHistory = (employeeId: string) =>
  api.get(`/payroll/assignments/history/${employeeId}/`);

export const getCurrentAssignments = (params?: Record<string, string>) =>
  api.get('/payroll/assignments/current/', { params });

export const getLatestAssignments = (params?: Record<string, string>) =>
  api.get('/payroll/assignments/latest/', { params });

// ─── Payroll Profiles ───
export const getProfiles = (params?: Record<string, string>) =>
  api.get('/payroll/profiles/', { params });

export const getProfileOverview = (page = 1) =>
  api.get('/payroll/profiles/overview/', { params: { page } });

export const getProfile = (id: string) =>
  api.get(`/payroll/profiles/${id}/`);

export const createProfile = (data: any) =>
  api.post('/payroll/profiles/', data);

export const updateProfile = (id: string, data: any) =>
  api.patch(`/payroll/profiles/${id}/`, data);

// ─── Preview ───
export const previewStructure = (data: { structure_id: string; ctc_annual: number; effective_from?: string }) =>
  api.post('/payroll/preview/', data);

export const calculatePreview = (data: {
  employee_id: string;
  period_start: string;
  period_end: string;
}) => api.post('/payroll/calculate-preview/', data);

// ─── Seed ───
export const seedDefaults = () =>
  api.post('/payroll/seed-defaults/');

// ─── Pay Runs (Phase 4) ───
export const getPayRuns = (params?: Record<string, string>) =>
  api.get('/payroll/runs/', { params });

export const downloadStatutoryReturn = async (runId: string, type: 'pf' | 'esi') => {
  const response = await api.get(`/payroll/runs/${runId}/statutory-exports/${type}/`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  const disposition = response.headers['content-disposition'] || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  anchor.download = filename || (type === 'pf' ? 'EPFO_ECR.txt' : 'ESIC_Contribution_Review.xlsx');
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export const getPayRun = (id: string) =>
  api.get(`/payroll/runs/${id}/`);

export const createPayRun = (data: any) =>
  api.post('/payroll/runs/', data);

export const transitionPayRun = (id: string, action: string, data?: any) =>
  api.post(`/payroll/runs/${id}/${action}/`, data || {});

export const getRunEmployees = (runId: string, params?: Record<string, string>) =>
  api.get(`/payroll/runs/${runId}/employees/`, { params });

export const getRunAdjustments = (runId: string) =>
  api.get(`/payroll/runs/${runId}/adjustments/`);

export const createRunAdjustment = (runId: string, data: {
  employee: string;
  adjustment_type: 'VARIABLE_EARNING' | 'DEDUCTION' | 'REIMBURSEMENT';
  label: string;
  amount: number;
  reason?: string;
}) => api.post(`/payroll/runs/${runId}/adjustments/`, data);

export const getRunEmployee = (runId: string, empId: string) =>
  api.get(`/payroll/runs/${runId}/employees/${empId}/`);

export const excludeRunEmployee = (runId: string, empId: string, data: any) =>
  api.post(`/payroll/runs/${runId}/employees/${empId}/exclude/`, data);

export const getRunVariance = (runId: string) =>
  api.get(`/payroll/runs/${runId}/variance/`);

export const getRunAuditLog = (runId: string) =>
  api.get(`/payroll/runs/${runId}/audit-log/`);

export const getRunPaymentBatches = (runId: string) =>
  api.get(`/payroll/runs/${runId}/payment-batches/`);

export const createRunPaymentBatch = (runId: string, payment_mode: string = 'NEFT') =>
  api.post(`/payroll/runs/${runId}/payment-batches/`, { payment_mode });

export const downloadPaymentBatchFile = async (batchId: string, format: 'csv' | 'pdf') => {
  const response = await api.get(`/payroll/payment-batches/${batchId}/export/${format}/`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `payment_batch.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export const refreshPaymentBatchBankDetails = (batchId: string) =>
  api.post(`/payroll/payment-batches/${batchId}/refresh-bank-details/`);

export const updatePaymentLineStatus = (batchId: string, lineId: string, data: {
  status: string; utr_number?: string; settlement_date?: string; failure_reason?: string;
}) => api.patch(`/payroll/payment-batches/${batchId}/lines/${lineId}/status/`, data);

// Payslips are employee scoped; HR/System admins can also review requests.
export const getEligiblePayslipRuns = () => api.get('/payroll/payslips/eligible-runs/');
export const getPayslipRequests = (params?: Record<string, string>) =>
  api.get('/payroll/payslips/requests/', { params });
export const requestPayslip = (run_id: string, reason = '') =>
  api.post('/payroll/payslips/requests/', { run_id, reason });
export const decidePayslipRequest = (requestId: string, decision: 'approve' | 'reject', reason = '') =>
  api.post(`/payroll/payslips/requests/${requestId}/${decision}/`, { reason });
export const downloadPayslip = async (requestId: string) => {
  const response = await api.get(`/payroll/payslips/requests/${requestId}/download/`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'payslip.pdf';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};
