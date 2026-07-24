import api from './axios';
import type {
  LeaveType, LeaveTypeMini,
  Holiday,
  LeaveBalance, AllocateAllResult,
  PaginatedResponse,
} from '../types/leave';

const BASE = '/leave';

function unwrapList<T>(data: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

// ==============================================================================
// LEAVE TYPES
// ==============================================================================

export const leaveTypesApi = {
  list: async (params?: { is_active?: boolean }): Promise<LeaveType[]> => {
    const { data } = await api.get(`${BASE}/leave-types/`, { params });
    return unwrapList(data);
  },

  getById: async (id: string): Promise<LeaveType> => {
    const { data } = await api.get(`${BASE}/leave-types/${id}/`);
    return data;
  },

  create: async (payload: Partial<LeaveType>): Promise<LeaveType> => {
    const { data } = await api.post(`${BASE}/leave-types/`, payload);
    return data;
  },

  update: async (id: string, payload: Partial<LeaveType>): Promise<LeaveType> => {
    const { data } = await api.patch(`${BASE}/leave-types/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/leave-types/${id}/`);
  },

  mini: async (): Promise<LeaveTypeMini[]> => {
    const { data } = await api.get(`${BASE}/leave-types/mini/`);
    return data;
  },

  seedDefaults: async (): Promise<{ ok: boolean; message: string; created: string[] }> => {
    const { data } = await api.post(`${BASE}/leave-types/seed-defaults/`);
    return data;
  },
};

// ==============================================================================
// HOLIDAYS
// ==============================================================================

export const holidaysApi = {
  list: async (params?: { year?: number }): Promise<Holiday[]> => {
    const { data } = await api.get(`${BASE}/holidays/`, { params });
    return unwrapList(data);
  },

  byYear: async (year: number): Promise<Holiday[]> => {
    const { data } = await api.get(`${BASE}/holidays/by-year/`, { params: { year } });
    return data;
  },

  upcoming: async (): Promise<Holiday[]> => {
    const { data } = await api.get(`${BASE}/holidays/upcoming/`);
    return data;
  },

  create: async (payload: Partial<Holiday>): Promise<Holiday> => {
    const { data } = await api.post(`${BASE}/holidays/`, payload);
    return data;
  },

  update: async (id: string, payload: Partial<Holiday>): Promise<Holiday> => {
    const { data } = await api.patch(`${BASE}/holidays/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/holidays/${id}/`);
  },
};

// ==============================================================================
// LEAVE BALANCES
// ==============================================================================

export const leaveBalancesApi = {
  list: async (params?: {
    employee?: string;
    leave_type?: string;
    year?: number;
  }): Promise<LeaveBalance[]> => {
    const { data } = await api.get(`${BASE}/leave-balances/`, { params });
    // Handle both paginated and non-paginated responses
    return Array.isArray(data) ? data : (data.results || []);
  },

  myBalance: async (year?: number): Promise<LeaveBalance[]> => {
    const { data } = await api.get(`${BASE}/leave-balances/my-balance/`, {
      params: year ? { year } : {},
    });
    return data;
  },

  allocateAll: async (year?: number): Promise<AllocateAllResult> => {
    const { data } = await api.post(`${BASE}/leave-balances/allocate-all/`, {
      year: year || new Date().getFullYear(),
    });
    return data;
  },

  allocateEmployee: async (
    employeeId: string,
    year?: number
  ): Promise<{ ok: boolean; message: string; balances_created: number }> => {
    const { data } = await api.post(`${BASE}/leave-balances/allocate-employee/`, {
      employee_id: employeeId,
      year: year || new Date().getFullYear(),
    });
    return data;
  },

  adjust: async (
    balanceId: string,
    adjustment: number,
    reason: string
  ): Promise<{ ok: boolean; message: string; balance: LeaveBalance }> => {
    const { data } = await api.post(`${BASE}/leave-balances/${balanceId}/adjust/`, {
      adjustment,
      reason,
    });
    return data;
  },
};


// ==============================================================================
// LEAVE APPLICATIONS
// ==============================================================================

import type {
  LeaveApplicationListItem,
  LeaveApplicationDetail,
  LeaveValidationResult,
  TeamCalendarResponse,
  HalfDayPeriod,
} from '../types/leave';

export const leaveApplicationsApi = {
  list: async (params?: {
    status?: string;
    leave_type?: string;
    employee?: string;
  }): Promise<LeaveApplicationListItem[]> => {
    const { data } = await api.get(`${BASE}/leave-applications/`, { params });
    return unwrapList(data);
  },

  getById: async (id: string): Promise<LeaveApplicationDetail> => {
    const { data } = await api.get(`${BASE}/leave-applications/${id}/`);
    return data;
  },

  myApplications: async (): Promise<LeaveApplicationListItem[]> => {
    const { data } = await api.get(`${BASE}/leave-applications/my-applications/`);
    return data;
  },

  pendingApprovals: async (): Promise<LeaveApplicationListItem[]> => {
    const { data } = await api.get(`${BASE}/leave-applications/pending-approvals/`);
    return data;
  },

  create: async (payload: {
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    is_half_day?: boolean;
    half_day_period?: HalfDayPeriod;
    contact_during_leave?: string;
    handover_to?: string;
    handover_notes?: string;
    supporting_document?: File | null;
  }): Promise<LeaveApplicationDetail> => {
    const formData = new FormData();
    formData.append('leave_type', payload.leave_type);
    formData.append('start_date', payload.start_date);
    formData.append('end_date', payload.end_date);
    formData.append('reason', payload.reason);
    if (payload.is_half_day) formData.append('is_half_day', 'true');
    if (payload.half_day_period) formData.append('half_day_period', payload.half_day_period);
    if (payload.contact_during_leave) formData.append('contact_during_leave', payload.contact_during_leave);
    if (payload.handover_to) formData.append('handover_to', payload.handover_to);
    if (payload.handover_notes) formData.append('handover_notes', payload.handover_notes);
    if (payload.supporting_document) formData.append('supporting_document', payload.supporting_document);

    const { data } = await api.post(`${BASE}/leave-applications/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  validate: async (payload: {
    leave_type: string;
    start_date: string;
    end_date: string;
    is_half_day?: boolean;
    half_day_period?: HalfDayPeriod;
  }): Promise<LeaveValidationResult> => {
    const { data } = await api.post(`${BASE}/leave-applications/validate/`, payload);
    return data;
  },

  approve: async (
  id: string, 
  comments?: string,
  overrideClash?: boolean       // 🆕 Third parameter
): Promise<{ ok: boolean; message: string }> => {
  const { data } = await api.post(`${BASE}/leave-applications/${id}/approve/`, {
    comments: comments || '',
    override_clash: overrideClash || false,   // 🆕 Send to backend
  });
  return data;
},

  reject: async (id: string, reason: string): Promise<{ ok: boolean; message: string }> => {
    const { data } = await api.post(`${BASE}/leave-applications/${id}/reject/`, {
      reason,
    });
    return data;
  },

  cancel: async (id: string, reason?: string): Promise<{ ok: boolean; message: string }> => {
    const { data } = await api.post(`${BASE}/leave-applications/${id}/cancel/`, {
      reason: reason || '',
    });
    return data;
  },

  teamCalendar: async (startDate: string, endDate: string): Promise<TeamCalendarResponse> => {
    const { data } = await api.get(`${BASE}/leave-applications/team-calendar/`, {
      params: { start_date: startDate, end_date: endDate },
    });
    return data;
  },
};