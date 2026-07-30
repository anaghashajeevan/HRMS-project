// ==============================================================================
// ATTENDANCE API — All attendance-related backend calls
// ==============================================================================

import api from './axios';
import type {
  AttendanceDashboardData,
  LivePresenceResponse,
  AttendanceSettings,
  AttendanceSettingsUpdatePayload,
  AutomationRunResponse,
  MonthlyReportActionResponse,
  MonthlyReportLog,
  TestEsslResponse,
  TestEmailResponse,
} from '../types/attendance';

const BASE = '/attendance';

// ==============================================================================
// DASHBOARD
// ==============================================================================

export const attendanceDashboardApi = {
  getDashboard: async (): Promise<AttendanceDashboardData> => {
    const { data } = await api.get<AttendanceDashboardData>(`${BASE}/dashboard/`);
    return data;
  },
};

// ==============================================================================
// LIVE PRESENCE
// ==============================================================================

export const attendanceLivePresenceApi = {
  get: async (): Promise<LivePresenceResponse> => {
    const { data } = await api.get<LivePresenceResponse>(`${BASE}/live-presence/`);
    return data;
  },
};

// ==============================================================================
// AUTOMATION
// ==============================================================================

export const attendanceAutomationApi = {
  run: async (): Promise<AutomationRunResponse> => {
    const { data } = await api.post<AutomationRunResponse>(`${BASE}/run-automation/`);
    return data;
  },
};

// ==============================================================================
// SETTINGS
// ==============================================================================

export const attendanceSettingsApi = {
  get: async (): Promise<AttendanceSettings> => {
    const { data } = await api.get<AttendanceSettings>(`${BASE}/settings/`);
    return data;
  },

  update: async (
    payload: AttendanceSettingsUpdatePayload
  ): Promise<{ ok: boolean; message: string; settings: AttendanceSettings }> => {
    const { data } = await api.patch(`${BASE}/settings/`, payload);
    return data;
  },

  testEssl: async (): Promise<TestEsslResponse> => {
    const { data } = await api.post<TestEsslResponse>(`${BASE}/settings/test-essl/`);
    return data;
  },

  testEmail: async (): Promise<TestEmailResponse> => {
    const { data } = await api.post<TestEmailResponse>(`${BASE}/settings/test-email/`);
    return data;
  },
};

// ==============================================================================
// MONTHLY REPORT
// ==============================================================================

export const attendanceMonthlyReportApi = {
  generate: async (monthYYYYMM: string): Promise<MonthlyReportActionResponse> => {
    const { data } = await api.post<MonthlyReportActionResponse>(
      `${BASE}/monthly-report/generate/`,
      { month: monthYYYYMM }
    );
    return data;
  },

  send: async (monthYYYYMM: string): Promise<MonthlyReportActionResponse> => {
    const { data } = await api.post<MonthlyReportActionResponse>(
      `${BASE}/monthly-report/send/`,
      { month: monthYYYYMM }
    );
    return data;
  },

  history: async (): Promise<MonthlyReportLog[]> => {
    const { data } = await api.get<MonthlyReportLog[]>(
      `${BASE}/monthly-report/history/`
    );
    return data;
  },
};

// ==============================================================================
// REPORT DOWNLOADS (returns full URL for direct download link)
// ==============================================================================

export const attendanceReportsApi = {
  buildDailyDownloadUrl: (logId: string): string => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
    return `${baseUrl}${BASE}/reports/daily/${logId}/download/`;
  },

  buildMonthlyDownloadUrl: (logId: string): string => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
    return `${baseUrl}${BASE}/reports/monthly/${logId}/download/`;
  },

  /**
   * Download a report file with JWT auth (returns blob for programmatic download).
   * Use this when you need to trigger download via JS.
   */
  downloadDaily: async (logId: string): Promise<Blob> => {
    const { data } = await api.get(`${BASE}/reports/daily/${logId}/download/`, {
      responseType: 'blob',
    });
    return data;
  },

  downloadMonthly: async (logId: string): Promise<Blob> => {
    const { data } = await api.get(`${BASE}/reports/monthly/${logId}/download/`, {
      responseType: 'blob',
    });
    return data;
  },
};


import type {
  MonthlyAttendanceData,
  DayDetailData,
  TeamAttendanceData,AllEmployeesAttendanceData, 
} from '../types/attendance';

// ==============================================================================
// PERSONAL ATTENDANCE
// ==============================================================================

export const personalAttendanceApi = {

  getMyMonth: async (year: number, month: number): Promise<MonthlyAttendanceData> => {
    const { data } = await api.get<MonthlyAttendanceData>(
      `${BASE}/my-attendance/month/`,
      { params: { year, month } }
    );
    return data;
  },

  getMyDay: async (date: string): Promise<DayDetailData> => {
    const { data } = await api.get<DayDetailData>(
      `${BASE}/my-attendance/day/`,
      { params: { date } }
    );
    return data;
  },

  getTeamMonth: async (
    year: number,
    month: number,
    managerId?: string
  ): Promise<TeamAttendanceData> => {
    const params: any = { year, month };
    if (managerId) params.manager_id = managerId;
    const { data } = await api.get<TeamAttendanceData>(
      `${BASE}/team-attendance/month/`,
      { params }
    );
    return data;
  },

  getEmployeeMonth: async (
    employeeId: string,
    year: number,
    month: number
  ): Promise<MonthlyAttendanceData> => {
    const { data } = await api.get<MonthlyAttendanceData>(
      `${BASE}/employee-attendance/${employeeId}/month/`,
      { params: { year, month } }
    );
    return data;
  },

  getAllEmployees: async (
    year: number,
    month: number,
    filters?: { department_id?: string; search?: string }
  ): Promise<AllEmployeesAttendanceData> => {
    const params: any = { year, month };
    if (filters?.department_id) params.department_id = filters.department_id;
    if (filters?.search) params.search = filters.search;

    const { data } = await api.get<AllEmployeesAttendanceData>(
      `${BASE}/all-employees-attendance/`,
      { params }
    );
    return data;
  },
};