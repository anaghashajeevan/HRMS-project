// src/api/companyLogo.ts
import api from './axios';

export interface CompanyLogo {
  id: string;
  name: string;
  logo: string;
  logo_url: string | null;
  tagline: string;
  company_url: string;
  is_active: boolean;
  uploaded_at: string;
}

const BASE = '/logos';

export const companyLogoApi = {
  list: async (): Promise<CompanyLogo[]> => {
    const { data } = await api.get(`${BASE}/`);
    return Array.isArray(data) ? data : data.results || [];
  },

  create: async (formData: FormData): Promise<CompanyLogo> => {
    const { data } = await api.post(`${BASE}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  update: async (id: string, formData: FormData): Promise<CompanyLogo> => {
    const { data } = await api.patch(`${BASE}/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/${id}/`);
  },

  setActive: async (id: string): Promise<CompanyLogo> => {
    const { data } = await api.post(`${BASE}/${id}/set-active/`);
    return data;
  },
};