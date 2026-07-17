import api from './axios';
import type {
  Role, CompanyStructure, JobPosition, EmployeeIdSetting,
  PaginatedResponse,
} from '../types/masterData';

// ---------- ROLES ----------
export const rolesApi = {
  list: async (): Promise<PaginatedResponse<Role>> => {
    const { data } = await api.get<PaginatedResponse<Role>>('/roles/');
    return data;
  },
  create: async (payload: Partial<Role>): Promise<Role> => {
    const { data } = await api.post<Role>('/roles/', payload);
    return data;
  },
  update: async (id: string, payload: Partial<Role>): Promise<Role> => {
    const { data } = await api.patch<Role>(`/roles/${id}/`, payload);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/roles/${id}/`);
  },
};

// ---------- COMPANY STRUCTURES ----------
export const structuresApi = {
  list: async (params?: { type?: string }): Promise<PaginatedResponse<CompanyStructure>> => {
    const { data } = await api.get<PaginatedResponse<CompanyStructure>>('/company-structures/', { params });
    return data;
  },
  create: async (payload: Partial<CompanyStructure>): Promise<CompanyStructure> => {
    const { data } = await api.post<CompanyStructure>('/company-structures/', payload);
    return data;
  },
  update: async (id: string, payload: Partial<CompanyStructure>): Promise<CompanyStructure> => {
    const { data } = await api.patch<CompanyStructure>(`/company-structures/${id}/`, payload);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/company-structures/${id}/`);
  },
};

// ---------- JOB POSITIONS ----------
export const positionsApi = {
  list: async (): Promise<PaginatedResponse<JobPosition>> => {
    const { data } = await api.get<PaginatedResponse<JobPosition>>('/job-positions/');
    return data;
  },
  create: async (payload: Partial<JobPosition>): Promise<JobPosition> => {
    const { data } = await api.post<JobPosition>('/job-positions/', payload);
    return data;
  },
  update: async (id: string, payload: Partial<JobPosition>): Promise<JobPosition> => {
    const { data } = await api.patch<JobPosition>(`/job-positions/${id}/`, payload);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/job-positions/${id}/`);
  },
};

// ---------- EMPLOYEE ID SETTINGS ----------
export const employeeIdSettingsApi = {
  list: async (): Promise<PaginatedResponse<EmployeeIdSetting>> => {
    const { data } = await api.get<PaginatedResponse<EmployeeIdSetting>>('/employee-id-settings/');
    return data;
  },
  update: async (id: string, value: string): Promise<EmployeeIdSetting> => {
    const { data } = await api.patch<EmployeeIdSetting>(`/employee-id-settings/${id}/`, { value });
    return data;
  },
  preview: async (payload: {
    prefix: string;
    include_year: boolean;
    padding: number;
  }): Promise<{ preview: string }> => {
    const { data } = await api.post<{ preview: string }>('/employee-id-settings/preview/', payload);
    return data;
  },
};