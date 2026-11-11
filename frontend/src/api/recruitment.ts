import api from './axios';

export type HiringStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'FILLED' | 'REJECTED' | 'CANCELLED';

export interface RecruitmentSettings {
  allowed_requester_roles: string[];
  updated_at: string;
}

export interface RecruitmentStage {
  id: string; code: string; name: string; order: number; is_active: boolean;
  is_terminal: boolean; terminal_outcome: 'OPEN' | 'HIRED' | 'REJECTED';
}
export interface RecruitmentEmailTemplate {
  id: string; name: string; purpose: string; subject: string; body: string; is_active: boolean;
}
export interface InterviewScorecard {
  id: string; name: string; description: string; criteria: Array<{ label: string; weight: number; guidance?: string }>; is_active: boolean;
}
export interface OfferRule {
  id: string; name: string; grade_band: string; currency: string; minimum_salary: string;
  maximum_salary: string; maximum_signing_bonus: string; required_approvers: string[]; is_active: boolean;
}

export interface HiringPositionOption {
  id: string;
  title: string;
  grade_band: string;
  department_id: string;
  department_name: string;
  budgeted_count: number;
  filled_count: number;
  reserved_openings: number;
  available_openings: number;
}

export interface HiringLocationOption { id: string; name: string; type: string }
export interface ReplacementEmployeeOption { id: string; full_name: string; employee_id: string; position_id: string }
export interface CandidateApplication {
  id: string; candidate_id: string; candidate_name: string; candidate_email: string; candidate_phone: string;
  resume_filename: string; requisition: string; requisition_number: string; position_title: string;
  department_name: string; stage: string; stage_name: string; stage_code: string;
  internal_notes: string; screening_decision: 'PENDING' | 'PASS' | 'HOLD' | 'REJECT'; screening_notes: string;
  screening_history: Array<{ id: string; from_stage_name: string | null; to_stage_name: string; decision: 'PENDING' | 'PASS' | 'HOLD' | 'REJECT'; notes: string; changed_by_name: string | null; created_at: string }>;
  created_at: string; updated_at: string;
}
export interface CandidateApplicationRequisitionOption {
  id: string; requisition_number: string; position_title: string; department_name: string; grade_band: string; openings: number;
}
export interface CandidateInterviewOption {
  id: string; candidate_name: string; candidate_email: string; requisition_number: string; position_title: string;
}
export interface InterviewerOption { id: string; employee_id: string; full_name: string; role_names: string[] }
export interface InterviewScorecardOption {
  id: string; name: string; criteria: Array<{ label: string; weight: number; guidance?: string }>;
}
export interface CandidateInterviewEvaluation {
  id: string; interviewer: string; interviewer_name: string; ratings: Record<string, number>;
  comments: string; recommendation: 'PASS' | 'HOLD' | 'REJECT'; weighted_score: number; submitted_at: string;
}
export interface CandidateInterview {
  id: string; candidate_application: string; candidate_name: string; candidate_email: string;
  requisition_number: string; position_title: string; current_stage: string; current_stage_code: string;
  resume_filename: string; round_name: string;
  scheduled_at: string; duration_minutes: number; meeting_details: string; scorecard: string;
  scorecard_name: string; scorecard_criteria: Array<{ label: string; weight: number; guidance?: string }>;
  interviewers: Array<{ id: string; full_name: string; employee_id: string }>;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'; evaluations: CandidateInterviewEvaluation[];
  my_evaluation_id: string | null; created_at: string;
}
export interface CandidateBackgroundCheck {
  id: string; application_id: string; candidate_name: string; check_type: 'REFERENCE' | 'BACKGROUND';
  label: string; contact_or_provider: string; requested_date: string; completed_date: string | null;
  is_required: boolean; status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  outcome: 'PENDING' | 'PASS' | 'FAIL' | 'UNABLE_TO_VERIFY'; result_summary: string; notes: string;
  created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
}
export interface ReferenceCheckApplicationOption {
  id: string; candidate_name: string; candidate_email: string; requisition_number: string; position_title: string;
}
export interface CandidateOfferApplicationOption {
  id: string; candidate_name: string; candidate_email: string; requisition_number: string;
  position_title: string; grade_band: string;
}
export interface CandidateOfferEmployeeOption { id: string; employee_id: string; full_name: string; official_email: string }
export interface AcceptedOfferEmployeeOption {
  id: string; candidate_name: string; candidate_email: string; position_id: string; position_title: string;
  department_id: string; location_id: string; employee_name: string | null;
}
export interface CandidateOfferApproval {
  id: string; role_code: string; assigned_to: string; assigned_to_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; comments: string; acted_at: string | null;
}
export interface CandidateOffer {
  id: string; application_id: string; candidate_name: string; candidate_email: string;
  requisition_number: string; position_title: string; grade_band: string; rule: string; rule_name: string;
  currency: string; annual_salary: string; signing_bonus: string; joining_date: string; expires_on: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'REJECTED' | 'WITHDRAWN';
  notes: string; approvals: CandidateOfferApproval[]; my_approval_id: string | null;
  employee_id: string | null; employee_name: string | null; offer_letter_filename: string;
  offer_letter_sent_at: string | null; offer_letter_error: string;
  created_at: string; approved_at: string | null; sent_at: string | null; responded_at: string | null;
}

export interface HiringApprovalAction {
  id: string;
  step_number: number;
  step_name: string;
  assigned_to: string;
  assigned_to_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  comments: string;
  acted_at: string | null;
  due_at: string;
}

export interface HiringRequisition {
  id: string;
  requisition_number: string;
  requested_by: string;
  requested_by_name: string;
  department: string;
  department_name: string;
  position: string;
  position_title: string;
  position_grade: string;
  grade_band: string;
  location: string;
  location_name: string;
  openings: number;
  is_replacement: boolean;
  replacing_employee: string | null;
  replacing_employee_name: string | null;
  reason: string;
  target_start_date: string;
  budgeted_count_at_request: number;
  filled_count_at_request: number;
  available_openings_now: number;
  status: HiringStatus;
  workflow: string;
  workflow_name: string;
  workflow_steps_snapshot: Array<{ step_number: number; step_name: string; approver_type: string }>;
  current_step_number: number;
  rejection_reason: string;
  approval_actions: HiringApprovalAction[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HiringRequisitionPayload {
  department: string;
  position: string;
  grade_band: string;
  location: string;
  openings: number;
  is_replacement: boolean;
  replacing_employee: string | null;
  reason: string;
  target_start_date: string;
}

function unwrap<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results;
}

export const recruitmentApi = {
  settings: async () => (await api.get<RecruitmentSettings>('/recruitment/settings/')).data,
  updateSettings: async (payload: Pick<RecruitmentSettings, 'allowed_requester_roles'>) =>
    (await api.patch<RecruitmentSettings>('/recruitment/settings/', payload)).data,
  positionOptions: async (replacingEmployeeId?: string) => (await api.get<{ positions: HiringPositionOption[]; locations: HiringLocationOption[] }>(
    '/recruitment/position-options/', { params: replacingEmployeeId ? { replacing_employee: replacingEmployeeId } : {} },
  )).data,
  replacementEmployees: async () => (await api.get<ReplacementEmployeeOption[]>('/recruitment/replacement-employee-options/')).data,
  candidateApplicationOptions: async () => (await api.get<CandidateApplicationRequisitionOption[]>('/recruitment/application-options/')).data,
  candidateApplications: async (params: { requisition?: string; stage?: string; decision?: string } = {}) =>
    (await api.get<CandidateApplication[]>('/recruitment/applications/', { params })).data,
  screenCandidateApplication: async (applicationId: string, decision: 'PASS' | 'HOLD' | 'REJECT', notes: string) =>
    (await api.post<CandidateApplication>(`/recruitment/applications/${applicationId}/screen/`, { decision, notes })).data,
  createCandidateApplication: async (formData: FormData) => (await api.post<CandidateApplication>('/recruitment/applications/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data,
  downloadCandidateResume: async (applicationId: string) => (await api.get<Blob>(
    `/recruitment/applications/${applicationId}/resume/`, { responseType: 'blob' },
  )).data,
  candidateInterviewOptions: async () => (await api.get<{
    applications: CandidateInterviewOption[]; scorecards: InterviewScorecardOption[]; interviewers: InterviewerOption[];
  }>('/recruitment/interview-options/')).data,
  candidateInterviews: async (status?: string) => (await api.get<CandidateInterview[]>('/recruitment/interviews/', {
    params: status ? { status } : {},
  })).data,
  scheduleCandidateInterview: async (payload: {
    application: string; round_name: string; scheduled_at: string; duration_minutes: number;
    meeting_details: string; scorecard: string; interviewers: string[];
  }) => (await api.post<CandidateInterview>('/recruitment/interviews/', payload)).data,
  evaluateCandidateInterview: async (interviewId: string, payload: {
    ratings: Record<string, number>; comments: string; recommendation: 'PASS' | 'HOLD' | 'REJECT';
  }) => (await api.post<CandidateInterviewEvaluation>(`/recruitment/interviews/${interviewId}/evaluate/`, payload)).data,
  recordInterviewOutcome: async (applicationId: string, decision: 'PASS' | 'HOLD' | 'REJECT', notes: string) =>
    (await api.post<CandidateApplication>(`/recruitment/applications/${applicationId}/interview-outcome/`, { decision, notes })).data,
  referenceCheckData: async () => (await api.get<{ applications: ReferenceCheckApplicationOption[]; checks: CandidateBackgroundCheck[] }>('/recruitment/background-checks/')).data,
  createBackgroundCheck: async (payload: { application: string; check_type: 'REFERENCE' | 'BACKGROUND'; label: string; contact_or_provider: string; requested_date: string; is_required: boolean; notes: string }) =>
    (await api.post<CandidateBackgroundCheck>('/recruitment/background-checks/', payload)).data,
  updateBackgroundCheck: async (id: string, payload: Partial<Pick<CandidateBackgroundCheck, 'check_type' | 'label' | 'contact_or_provider' | 'requested_date' | 'completed_date' | 'is_required' | 'status' | 'outcome' | 'result_summary' | 'notes'>>) =>
    (await api.patch<CandidateBackgroundCheck>(`/recruitment/background-checks/${id}/`, payload)).data,
  recordReferenceCheckOutcome: async (applicationId: string, decision: 'PASS' | 'HOLD' | 'REJECT', notes: string) =>
    (await api.post<CandidateApplication>(`/recruitment/applications/${applicationId}/reference-check-outcome/`, { decision, notes })).data,
  candidateOffers: async () => (await api.get<CandidateOffer[]>('/recruitment/offers/')).data,
  candidateOfferOptions: async () => (await api.get<{ applications: CandidateOfferApplicationOption[]; rules: OfferRule[]; employees: CandidateOfferEmployeeOption[]; accepted_offers: AcceptedOfferEmployeeOption[] }>('/recruitment/offer-options/')).data,
  createCandidateOffer: async (payload: { application: string; annual_salary: string; signing_bonus: string; joining_date: string; expires_on: string; notes: string }) =>
    (await api.post<CandidateOffer>('/recruitment/offers/', payload)).data,
  approveCandidateOffer: async (id: string, decision: 'APPROVE' | 'REJECT', comments: string) =>
    (await api.post<CandidateOffer>(`/recruitment/offers/${id}/approve/`, { decision, comments })).data,
  sendCandidateOffer: async (id: string) => (await api.post<CandidateOffer>(`/recruitment/offers/${id}/send/`)).data,
  respondToCandidateOffer: async (id: string, decision: 'ACCEPTED' | 'DECLINED', notes: string) =>
    (await api.post<CandidateOffer>(`/recruitment/offers/${id}/response/`, { decision, notes })).data,
  retryAcceptedOfferLetter: async (id: string) => (await api.post<CandidateOffer>(`/recruitment/offers/${id}/retry-letter/`)).data,
  linkCandidateOfferEmployee: async (id: string, employee: string) => (await api.post<CandidateOffer>(`/recruitment/offers/${id}/employee/`, { employee })).data,
  downloadAcceptedOfferLetter: async (id: string) => (await api.get<Blob>(`/recruitment/offers/${id}/letter/`, { responseType: 'blob' })).data,
  list: async (statusFilter?: string) => unwrap((await api.get<HiringRequisition[] | { results: HiringRequisition[] }>(
    '/recruitment/requisitions/', { params: statusFilter ? { status: statusFilter } : {} },
  )).data),
  create: async (payload: HiringRequisitionPayload) =>
    (await api.post<HiringRequisition>('/recruitment/requisitions/', payload)).data,
  approve: async (id: string, comments: string) =>
    (await api.post<{ detail: string; requisition: HiringRequisition }>(`/recruitment/requisitions/${id}/approve/`, { comments })).data,
  reject: async (id: string, reason: string) =>
    (await api.post<{ detail: string; requisition: HiringRequisition }>(`/recruitment/requisitions/${id}/reject/`, { reason })).data,
  cancel: async (id: string) =>
    (await api.post<{ detail: string; requisition: HiringRequisition }>(`/recruitment/requisitions/${id}/cancel/`)).data,
  stages: async () => unwrap((await api.get<RecruitmentStage[] | { results: RecruitmentStage[] }>('/recruitment/stages/')).data),
  saveStage: async (id: string | null, payload: Omit<RecruitmentStage, 'id'>) =>
    (await (id ? api.patch<RecruitmentStage>(`/recruitment/stages/${id}/`, payload) : api.post<RecruitmentStage>('/recruitment/stages/', payload))).data,
  deleteStage: async (id: string) => { await api.delete(`/recruitment/stages/${id}/`); },
  emailTemplates: async () => unwrap((await api.get<RecruitmentEmailTemplate[] | { results: RecruitmentEmailTemplate[] }>('/recruitment/email-templates/')).data),
  saveEmailTemplate: async (id: string | null, payload: Omit<RecruitmentEmailTemplate, 'id'>) =>
    (await (id ? api.patch<RecruitmentEmailTemplate>(`/recruitment/email-templates/${id}/`, payload) : api.post<RecruitmentEmailTemplate>('/recruitment/email-templates/', payload))).data,
  deleteEmailTemplate: async (id: string) => { await api.delete(`/recruitment/email-templates/${id}/`); },
  scorecards: async () => unwrap((await api.get<InterviewScorecard[] | { results: InterviewScorecard[] }>('/recruitment/scorecards/')).data),
  saveScorecard: async (id: string | null, payload: Omit<InterviewScorecard, 'id'>) =>
    (await (id ? api.patch<InterviewScorecard>(`/recruitment/scorecards/${id}/`, payload) : api.post<InterviewScorecard>('/recruitment/scorecards/', payload))).data,
  deleteScorecard: async (id: string) => { await api.delete(`/recruitment/scorecards/${id}/`); },
  offerRules: async () => unwrap((await api.get<OfferRule[] | { results: OfferRule[] }>('/recruitment/offer-rules/')).data),
  saveOfferRule: async (id: string | null, payload: Omit<OfferRule, 'id'>) =>
    (await (id ? api.patch<OfferRule>(`/recruitment/offer-rules/${id}/`, payload) : api.post<OfferRule>('/recruitment/offer-rules/', payload))).data,
  deleteOfferRule: async (id: string) => { await api.delete(`/recruitment/offer-rules/${id}/`); },
};
