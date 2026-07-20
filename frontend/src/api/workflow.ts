// ==============================================================================
// WORKFLOW API - Single consolidated file
// Includes: Approval Workflows, Letter Templates, Lifecycle Requests, Notifications
// ==============================================================================

import api from './axios';
import type {
  ApprovalWorkflow,
  ApprovalWorkflowCreatePayload,
  ApproverOption,
  LetterTemplate,
  LetterTemplateCreatePayload,
  AIGenerateRequest,
  AIGenerateResponse,
  LifecycleRequestListItem,
  LifecycleRequestDetail,
  LifecycleRequestCreatePayload,
  PaginatedLifecycleRequests,
  LifecycleListParams,
  ApprovePayload,
  RejectPayload,
  Notification,
  PaginatedNotifications,
} from '../types/workflow';

// ==============================================================================
// APPROVAL WORKFLOWS API
// ==============================================================================

export const approvalWorkflowsApi = {
  list: async (): Promise<ApprovalWorkflow[]> => {
    const { data } = await api.get<
      { results: ApprovalWorkflow[] } | ApprovalWorkflow[]
    >('/approval-workflows/');
    return Array.isArray(data) ? data : data.results;
  },

  getById: async (id: string): Promise<ApprovalWorkflow> => {
    const { data } = await api.get<ApprovalWorkflow>(`/approval-workflows/${id}/`);
    return data;
  },

  create: async (
    payload: ApprovalWorkflowCreatePayload
  ): Promise<ApprovalWorkflow> => {
    const { data } = await api.post<ApprovalWorkflow>(
      '/approval-workflows/',
      payload
    );
    return data;
  },

  update: async (
    id: string,
    payload: Partial<ApprovalWorkflowCreatePayload>
  ): Promise<ApprovalWorkflow> => {
    const { data } = await api.patch<ApprovalWorkflow>(
      `/approval-workflows/${id}/`,
      payload
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/approval-workflows/${id}/`);
  },

  /**
   * Fetch dropdown options for approver selection.
   * Returns dynamic options (Reporting Manager, HR Admin) + specific employees
   * formatted as "ROLE — Employee Name (EMP-ID)".
   */
  getApproverOptions: async (): Promise<ApproverOption[]> => {
    const { data } = await api.get<ApproverOption[]>(
      '/approval-workflows/approver-options/'
    );
    return data;
  },
};

// ==============================================================================
// LETTER TEMPLATES API
// ==============================================================================

export const letterTemplatesApi = {
  list: async (params?: {
    template_type?: string;
    is_active?: boolean;
    is_default?: boolean;
  }): Promise<LetterTemplate[]> => {
    const { data } = await api.get<
      { results: LetterTemplate[] } | LetterTemplate[]
    >('/letter-templates/', { params });
    return Array.isArray(data) ? data : data.results;
  },

  getById: async (id: string): Promise<LetterTemplate> => {
    const { data } = await api.get<LetterTemplate>(`/letter-templates/${id}/`);
    return data;
  },

  create: async (
    payload: LetterTemplateCreatePayload
  ): Promise<LetterTemplate> => {
    const { data } = await api.post<LetterTemplate>(
      '/letter-templates/',
      payload
    );
    return data;
  },

  update: async (
    id: string,
    payload: Partial<LetterTemplateCreatePayload>
  ): Promise<LetterTemplate> => {
    const { data } = await api.patch<LetterTemplate>(
      `/letter-templates/${id}/`,
      payload
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/letter-templates/${id}/`);
  },

  /**
   * Generate letter HTML using Groq AI.
   * User provides a prompt describing what they want.
   */
  generateWithAI: async (
    payload: AIGenerateRequest
  ): Promise<AIGenerateResponse> => {
    const { data } = await api.post<AIGenerateResponse>(
      '/letter-templates/generate-ai/',
      payload
    );
    return data;
  },
};

// ==============================================================================
// LIFECYCLE CHANGE REQUESTS API
// ==============================================================================

export const lifecycleRequestsApi = {
  list: async (
    params: LifecycleListParams = {}
  ): Promise<PaginatedLifecycleRequests> => {
    const { data } = await api.get<PaginatedLifecycleRequests>(
      '/lifecycle-requests/',
      { params }
    );
    return data;
  },

  getById: async (id: string): Promise<LifecycleRequestDetail> => {
    const { data } = await api.get<LifecycleRequestDetail>(
      `/lifecycle-requests/${id}/`
    );
    return data;
  },

  create: async (
    payload: LifecycleRequestCreatePayload
  ): Promise<LifecycleRequestDetail> => {
    const { data } = await api.post<LifecycleRequestDetail>(
      '/lifecycle-requests/',
      payload
    );
    return data;
  },

  /**
   * Approve current pending action.
   * On final step, letter_template_id is required.
   */
  approve: async (
    id: string,
    payload: ApprovePayload
  ): Promise<{ status: string; message: string }> => {
    const { data } = await api.post(
      `/lifecycle-requests/${id}/approve/`,
      payload
    );
    return data;
  },

  reject: async (
    id: string,
    payload: RejectPayload
  ): Promise<{ status: string }> => {
    const { data } = await api.post(
      `/lifecycle-requests/${id}/reject/`,
      payload
    );
    return data;
  },

  /**
   * Fetch requests where the current user has a PENDING action.
   */
  myPendingApprovals: async (): Promise<LifecycleRequestListItem[]> => {
    const { data } = await api.get<LifecycleRequestListItem[]>(
      '/lifecycle-requests/my-pending-approvals/'
    );
    return data;
  },
};

// ==============================================================================
// NOTIFICATIONS API
// ==============================================================================

export const notificationsApi = {
  list: async (params?: {
    is_read?: boolean;
    page?: number;
  }): Promise<PaginatedNotifications> => {
    const { data } = await api.get<PaginatedNotifications>('/notifications/', {
      params,
    });
    return data;
  },

  unreadCount: async (): Promise<number> => {
    const { data } = await api.get<{ count: number }>(
      '/notifications/unread-count/'
    );
    return data.count;
  },

  markRead: async (id: string): Promise<void> => {
    await api.post(`/notifications/${id}/mark-read/`);
  },

  markAllRead: async (): Promise<void> => {
    await api.post('/notifications/mark-all-read/');
  },
};