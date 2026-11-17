import api from './axios';

export type OnboardingTaskType = 'TASK' | 'DOCUMENT' | 'ACKNOWLEDGEMENT';
export type OnboardingTaskOwner = 'EMPLOYEE' | 'HR' | 'MANAGER' | 'IT_ADMIN' | 'OTHER';

export interface OnboardingTemplateTask {
  id?: string;
  title: string;
  description: string;
  task_type: OnboardingTaskType;
  task_type_display?: string;
  owner_type: OnboardingTaskOwner;
  owner_type_display?: string;
  owner_employee: string | null;
  owner_employee_name?: string | null;
  employee_document_type: string;
  due_days_from_joining: number;
  is_required: boolean;
  order: number;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  department: string | null;
  department_name: string | null;
  department_path: string | null;
  position: string | null;
  position_title: string | null;
  location: string | null;
  location_name: string | null;
  location_path: string | null;
  is_active: boolean;
  tasks: OnboardingTemplateTask[];
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export type OnboardingTemplatePayload = Pick<OnboardingTemplate,
  'name' | 'description' | 'department' | 'position' | 'location' | 'is_active' | 'tasks'>;

export interface OnboardingSetupOptions {
  departments: { id: string; name: string; type: string; parent_name: string; path: string }[];
  positions: { id: string; title: string; department_name: string }[];
  locations: { id: string; name: string; type: string; parent_name: string; path: string }[];
  employees: { id: string; employee_number: string; full_name: string; position_title: string }[];
  accepted_offers: {
    id: string; candidate_name: string; employee_id: string; employee_number: string;
    employee_name: string; position_title: string; joining_date: string;
    compatible_template_ids: string[];
  }[];
}

export interface OnboardingTask {
  id: string; title: string; description: string; task_type: OnboardingTaskType;
  task_type_display: string; owner_type: OnboardingTaskOwner; owner_type_display: string;
  employee_document_type: string; due_date: string | null; is_required: boolean; order: number;
  status: string; status_display: string; assigned_to: string | null; assigned_to_name: string | null;
  completion_notes: string; completed_at: string | null; case_id: string; employee_name: string;
  employee_number: string; joining_date: string;
  submissions: { id: string; document_id: string; document_name: string; document_url: string | null; status: string; review_comments: string; submitted_at: string }[];
}

export interface OnboardingCase {
  id: string; offer: string; employee: string; employee_name: string; employee_number: string;
  candidate_name: string; template: string | null; template_display: string; joining_date: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'; started_at: string;
  tasks: OnboardingTask[];
}

type Paginated<T> = { results: T[] };
const unwrapList = <T,>(data: T[] | Paginated<T>): T[] =>
  Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];

export const onboardingApi = {
  templates: async () => unwrapList((await api.get<OnboardingTemplate[] | Paginated<OnboardingTemplate>>('/onboarding/templates/')).data),
  cases: async () => unwrapList((await api.get<OnboardingCase[] | Paginated<OnboardingCase>>('/onboarding/cases/')).data),
  tasks: async () => unwrapList((await api.get<OnboardingTask[] | Paginated<OnboardingTask>>('/onboarding/tasks/')).data),
  options: async () => (await api.get<OnboardingSetupOptions>('/onboarding/setup-options/')).data,
  start: async (offer: string, template: string) => (await api.post<OnboardingCase>('/onboarding/cases/', { offer, template })).data,
  updateTaskProgress: async (id: string, status: string, completion_notes = '') => (await api.post<OnboardingTask>(`/onboarding/tasks/${id}/progress/`, { status, completion_notes })).data,
  assignTask: async (id: string, assigned_to: string | null) => (await api.post<OnboardingTask>(`/onboarding/tasks/${id}/assign/`, { assigned_to })).data,
  uploadTaskDocument: async (id: string, file: File, document_name: string) => {
    const payload = new FormData(); payload.append('file', file); payload.append('document_name', document_name);
    return (await api.post<OnboardingTask>(`/onboarding/tasks/${id}/upload-document/`, payload)).data;
  },
  reviewTaskDocument: async (id: string, submission_id: string, decision: 'VERIFY' | 'REJECT', comments = '') =>
    (await api.post<OnboardingTask>(`/onboarding/tasks/${id}/review-document/`, { submission_id, decision, comments })).data,
  createTemplate: async (payload: OnboardingTemplatePayload) =>
    (await api.post<OnboardingTemplate>('/onboarding/templates/', payload)).data,
  updateTemplate: async (id: string, payload: OnboardingTemplatePayload) =>
    (await api.patch<OnboardingTemplate>(`/onboarding/templates/${id}/`, payload)).data,
  deleteTemplate: async (id: string) => { await api.delete(`/onboarding/templates/${id}/`); },
};
