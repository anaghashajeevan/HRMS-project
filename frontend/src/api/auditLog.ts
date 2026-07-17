import api from './axios';
import type { AuditLogEntry, PaginatedResponse } from '../types/documents';

export const auditLogApi = {
  getByEmployee: async (employeeId: string, page = 1): Promise<PaginatedResponse<AuditLogEntry>> => {
    const { data } = await api.get<PaginatedResponse<AuditLogEntry>>(
      `/employees/${employeeId}/audit-log/`,
      { params: { page } },
    );
    return data;
  },
};