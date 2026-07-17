import api from './axios';
import type { EmployeeDocument, PaginatedResponse } from '../types/documents';

export const documentsApi = {
  listByEmployee: async (employeeId: string): Promise<PaginatedResponse<EmployeeDocument>> => {
    const { data } = await api.get<PaginatedResponse<EmployeeDocument>>('/employee-documents/', {
      params: { employee: employeeId },
    });
    return data;
  },

  upload: async (
    employeeId: string,
    file: File,
    documentType: string,
    documentName: string,
    expiryDate?: string,
  ): Promise<EmployeeDocument> => {
    const formData = new FormData();
    formData.append('employee', employeeId);
    formData.append('document_type', documentType);
    formData.append('document_name', documentName);
    formData.append('file_path', file);
    if (expiryDate) {
      formData.append('expiry_date', expiryDate);
    }

    const { data } = await api.post<EmployeeDocument>('/employee-documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  delete: async (documentId: string): Promise<void> => {
    await api.delete(`/employee-documents/${documentId}/`);
  },
};