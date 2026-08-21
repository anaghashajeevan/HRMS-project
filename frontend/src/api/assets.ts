// ==============================================================================
// ASSET MANAGEMENT API
// ==============================================================================

import api from './axios';
import type {
  AssetCategory,
  AssetListItem,
  AssetDetail,
  AssetAllocation,
  AllocateAssetPayload,
  ReturnAssetPayload,
  AssetStats,
  PaginatedAssets,
} from '../types/asset';

// ------------------------------------------------------------------------------
// ASSET CATEGORIES API
// ------------------------------------------------------------------------------

export const assetCategoriesApi = {
  list: async (): Promise<AssetCategory[]> => {
    const { data } = await api.get<{ results: AssetCategory[] } | AssetCategory[]>(
      '/assets/categories/'
    );
    return Array.isArray(data) ? data : data.results;
  },

  getById: async (id: string): Promise<AssetCategory> => {
    const { data } = await api.get<AssetCategory>(`/assets/categories/${id}/`);
    return data;
  },

  create: async (payload: Partial<AssetCategory>): Promise<AssetCategory> => {
    const { data } = await api.post<AssetCategory>('/assets/categories/', payload);
    return data;
  },

  update: async (id: string, payload: Partial<AssetCategory>): Promise<AssetCategory> => {
    const { data } = await api.patch<AssetCategory>(`/assets/categories/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/assets/categories/${id}/`);
  },
};

// ------------------------------------------------------------------------------
// ASSETS API
// ------------------------------------------------------------------------------

interface AssetListParams {
  page?: number;
  category?: string;
  status?: string;
  condition?: string;
  search?: string;
  ordering?: string;
}

export const assetsApi = {
  list: async (params: AssetListParams = {}): Promise<PaginatedAssets> => {
    const { data } = await api.get<PaginatedAssets>('/assets/', { params });
    return data;
  },

  getById: async (id: string): Promise<AssetDetail> => {
    const { data } = await api.get<AssetDetail>(`/assets/${id}/`);
    return data;
  },

  create: async (payload: FormData | Partial<AssetDetail>): Promise<AssetDetail> => {
    const isFormData = payload instanceof FormData;
    const { data } = await api.post<AssetDetail>('/assets/', payload, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return data;
  },

  update: async (
    id: string,
    payload: FormData | Partial<AssetDetail>
  ): Promise<AssetDetail> => {
    const isFormData = payload instanceof FormData;
    const { data } = await api.patch<AssetDetail>(`/assets/${id}/`, payload, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/assets/${id}/`);
  },

  // ESS
  getMyAssets: async (): Promise<AssetAllocation[]> => {
    const { data } = await api.get<AssetAllocation[]>('/assets/my-assets/');
    return data;
  },

  // HR / Manager
  getEmployeeAssets: async (employeeId: string): Promise<AssetAllocation[]> => {
    const { data } = await api.get<AssetAllocation[]>(`/assets/employee/${employeeId}/`);
    return data;
  },

  // Available assets for allocation dropdown
  getAvailable: async (categoryId?: string): Promise<AssetListItem[]> => {
    const { data } = await api.get<AssetListItem[]>('/assets/available/', {
      params: categoryId ? { category: categoryId } : {},
    });
    return data;
  },

  // Stats
  getStats: async (): Promise<AssetStats> => {
    const { data } = await api.get<AssetStats>('/assets/stats/');
    return data;
  },
};

// ------------------------------------------------------------------------------
// ASSET ALLOCATIONS API
// ------------------------------------------------------------------------------

interface AllocationListParams {
  status?: AllocationStatus | string;
  employee?: string;
  asset?: string;
  page?: number;
}

export const assetAllocationsApi = {
  list: async (params: AllocationListParams = {}): Promise<AssetAllocation[]> => {
    const { data } = await api.get<{ results: AssetAllocation[] } | AssetAllocation[]>(
      '/assets/allocations/',
      { params }
    );
    return Array.isArray(data) ? data : data.results;
  },

  getById: async (id: string): Promise<AssetAllocation> => {
    const { data } = await api.get<AssetAllocation>(`/assets/allocations/${id}/`);
    return data;
  },

  allocate: async (payload: AllocateAssetPayload): Promise<AssetAllocation> => {
    const { data } = await api.post<AssetAllocation>(
      '/assets/allocations/allocate/',
      payload
    );
    return data;
  },

  returnAsset: async (
    allocationId: string,
    payload: ReturnAssetPayload
  ): Promise<{ status: string; message: string; allocation: AssetAllocation }> => {
    const { data } = await api.post(
      `/assets/allocations/${allocationId}/return/`,
      payload
    );
    return data;
  },
};

type AllocationStatus = 'ALLOCATED' | 'RETURNED' | 'DAMAGED' | 'LOST';