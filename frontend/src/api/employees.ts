// src/api/employees.ts
import api from './axios';
import type {
  PaginatedEmployees, EmployeeDetail,CareerHistoryResponse,
} from '../types/employee';

interface ListParams {
  page?: number;
  search?: string;
  status?: string;
  ordering?: string;
}

export interface EmployeeCreatePayload {
  first_name: string;
  last_name: string;
  official_email: string;
  personal_email?: string;
  phone_number: string;
  date_of_birth: string;
  gender?: string;
  status?: string;
  position?: string | null;
  reporting_manager?: string | null;
  structure_location?: string | null;
  date_of_joining: string;
  date_of_exit?: string | null;

  // Bank / statutory
  bank_account_encrypted?: string;
  bank_ifsc_code?: string;
  pan_number_encrypted?: string;
  aadhaar_number_encrypted?: string;
  uan_number_encrypted?: string;

  // Optional user account
  create_user_account?: boolean;
  password?: string;
  role_ids?: string[];
}

export interface ManagerOption {
  id: string;
  employee_id: string;
  full_name: string;
  official_email: string;
}

export const employeesApi = {
  list: async (params: ListParams = {}): Promise<PaginatedEmployees> => {
    const { data } = await api.get<PaginatedEmployees>('/employees/', { params });
    return data;
  },

  getById: async (id: string): Promise<EmployeeDetail> => {
    const { data } = await api.get<EmployeeDetail>(`/employees/${id}/`);
    return data;
  },

  create: async (payload: EmployeeCreatePayload): Promise<EmployeeDetail> => {
    const { data } = await api.post<EmployeeDetail>('/employees/', payload);
    return data;
  },

  update: async (id: string, payload: Partial<EmployeeCreatePayload>): Promise<EmployeeDetail> => {
    const { data } = await api.patch<EmployeeDetail>(`/employees/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/employees/${id}/`);
  },
  getMe: async (): Promise<EmployeeDetail> => {
    const { data } = await api.get<EmployeeDetail>('/employees/me/');
    return data;
  },

  updateMe: async (payload: { phone_number?: string; personal_email?: string }): Promise<EmployeeDetail> => {
    const { data } = await api.patch<EmployeeDetail>('/employees/me/', payload);
    return data;
  },
  getManagers: async (search?: string, role?: string): Promise<ManagerOption[]> => {
    const params: any = {};
    if (search) params.search = search;
    if (role) params.role = role; // 👈 Add role parameter

    const { data } = await api.get<ManagerOption[]>('/employees/managers/', { params });
    return data;
  },
  getCareerHistory: async (employeeId: string): Promise<CareerHistoryResponse> => {
    const { data } = await api.get<CareerHistoryResponse>(
      `/employees/${employeeId}/career-history/`
    );
    return data;
  },
    bulkImportTemplate: async (): Promise<Blob> => {
    const { data } = await api.get('/employees/bulk-import-template/', {
      responseType: 'blob',
    });
    return data;
  },

  bulkImport: async (
    file: File,
    skipExisting: boolean = true
  ): Promise<{
    ok: boolean;
    message: string;
    total_rows: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
    created_employees: Array<{ employee_id: string; full_name: string; email: string }>;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('skip_existing', skipExisting ? 'true' : 'false');

    const { data } = await api.post('/employees/bulk-import/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};