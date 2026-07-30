import api from './axios';
import type {
  AnnualCalendarListItem,
  AnnualCalendarDetail,
  Holiday,
  HolidayCreatePayload,
} from '../types/calendar';

const BASE = '/leave/annual-calendars';

export const calendarApi = {
  list: async (): Promise<AnnualCalendarListItem[]> => {
    const { data } = await api.get(`${BASE}/`);
    return Array.isArray(data) ? data : data.results ?? [];
  },

  getById: async (id: string): Promise<AnnualCalendarDetail> => {
    const { data } = await api.get(`${BASE}/${id}/`);
    return data;
  },

  create: async (payload: {
    year: number;
    title: string;
    description?: string;
  }): Promise<AnnualCalendarDetail> => {
    const { data } = await api.post(`${BASE}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/${id}/`);
  },

  addHoliday: async (
    calendarId: string,
    payload: HolidayCreatePayload
  ): Promise<Holiday> => {
    const { data } = await api.post(`${BASE}/${calendarId}/add-holiday/`, payload);
    return data;
  },

  removeHoliday: async (calendarId: string, holidayId: string): Promise<void> => {
    await api.delete(`${BASE}/${calendarId}/remove-holiday/${holidayId}/`);
  },

  submitForReview: async (id: string) => {
    const { data } = await api.post(`${BASE}/${id}/submit-for-review/`);
    return data;
  },

  approve: async (id: string, comments?: string) => {
    const { data } = await api.post(`${BASE}/${id}/approve/`, { comments: comments ?? '' });
    return data;
  },

  reject: async (id: string, reason: string) => {
    const { data } = await api.post(`${BASE}/${id}/reject/`, { reason });
    return data;
  },

  returnForChanges: async (id: string, comments: string) => {
    const { data } = await api.post(`${BASE}/${id}/return-for-changes/`, { comments });
    return data;
  },

  publish: async (id: string) => {
    const { data } = await api.post(`${BASE}/${id}/publish/`);
    return data;
  },

  getPublished: async (year: number): Promise<AnnualCalendarDetail> => {
    const { data } = await api.get(`${BASE}/published/`, { params: { year } });
    return data;
  },

  pendingApprovals: async (): Promise<AnnualCalendarListItem[]> => {
    const { data } = await api.get(`${BASE}/pending-approvals/`);
    return Array.isArray(data) ? data : data.results ?? [];
  },

  amendAddHoliday: async (
  calendarId: string,
  payload: HolidayCreatePayload & { reason: string }
): Promise<Holiday> => {
  const { data } = await api.post(
    `${BASE}/${calendarId}/amend-add-holiday/`,
    payload
  );
  return data;
},

amendRemoveHoliday: async (
  calendarId: string,
  holidayId: string,
  reason: string
): Promise<{ ok: boolean }> => {
  const { data } = await api.post(
    `${BASE}/${calendarId}/amend-remove-holiday/`,
    { holiday_id: holidayId, reason }
  );
  return data;
},

getAmendments: async (calendarId: string): Promise<any[]> => {
  const { data } = await api.get(`${BASE}/${calendarId}/amendments/`);
  return Array.isArray(data) ? data : data.results ?? [];
},
};