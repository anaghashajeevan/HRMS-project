// import api from './axios';
// import type {
//   PolicyCategory, PolicyListItem, PolicyDetail,
//   PolicyVersion, PolicyDistribution,
//   ComplianceStats, PolicyComment,
// } from '../types/policy';

// const BASE = '/policies';

// // ==============================================================================
// // CATEGORIES
// // ==============================================================================

// export const policyCategoriesApi = {
//   list: async (): Promise<PolicyCategory[]> => {
//     const { data } = await api.get(`${BASE}/categories/`);
//     return Array.isArray(data) ? data : data.results || [];
//   },

//   create: async (payload: Partial<PolicyCategory>): Promise<PolicyCategory> => {
//     const { data } = await api.post(`${BASE}/categories/`, payload);
//     return data;
//   },

//   update: async (id: string, payload: Partial<PolicyCategory>): Promise<PolicyCategory> => {
//     const { data } = await api.patch(`${BASE}/categories/${id}/`, payload);
//     return data;
//   },

//   delete: async (id: string): Promise<void> => {
//     await api.delete(`${BASE}/categories/${id}/`);
//   },

//   seedDefaults: async (): Promise<{ ok: boolean; message: string }> => {
//     const { data } = await api.post(`${BASE}/categories/seed-defaults/`);
//     return data;
//   },
// };

// // ==============================================================================
// // POLICIES
// // ==============================================================================

// export const policiesApi = {
//   list: async (params?: {
//     status?: string;
//     category?: string;
//     is_mandatory?: boolean;
//   }): Promise<PolicyListItem[]> => {
//     const { data } = await api.get(`${BASE}/policies/`, { params });
//     return Array.isArray(data) ? data : data.results || [];
//   },

//   getById: async (id: string): Promise<PolicyDetail> => {
//     const { data } = await api.get(`${BASE}/policies/${id}/`);
//     return data;
//   },

//   create: async (formData: FormData): Promise<PolicyDetail> => {
//     const { data } = await api.post(`${BASE}/policies/`, formData, {
//       headers: { 'Content-Type': 'multipart/form-data' },
//     });
//     return data;
//   },

//   update: async (id: string, payload: any): Promise<PolicyDetail> => {
//     const { data } = await api.patch(`${BASE}/policies/${id}/`, payload);
//     return data;
//   },

//   delete: async (id: string): Promise<void> => {
//     await api.delete(`${BASE}/policies/${id}/`);
//   },

//   // Workflow actions
//   submitForReview: async (id: string): Promise<{ ok: boolean; message: string }> => {
//     const { data } = await api.post(`${BASE}/policies/${id}/submit-for-review/`);
//     return data;
//   },

//   approve: async (id: string, comments?: string): Promise<{ ok: boolean; message: string }> => {
//     const { data } = await api.post(`${BASE}/policies/${id}/approve/`, { comments });
//     return data;
//   },

//   reject: async (id: string, reason: string): Promise<{ ok: boolean; message: string }> => {
//     const { data } = await api.post(`${BASE}/policies/${id}/reject/`, { reason });
//     return data;
//   },

//   publish: async (id: string): Promise<{ ok: boolean; message: string; distributed_to: number }> => {
//     const { data } = await api.post(`${BASE}/policies/${id}/publish/`);
//     return data;
//   },

//   createVersion: async (id: string, formData: FormData): Promise<PolicyVersion> => {
//     const { data } = await api.post(`${BASE}/policies/${id}/create-version/`, formData, {
//       headers: { 'Content-Type': 'multipart/form-data' },
//     });
//     return data;
//   },

//   // Compliance
//   getCompliance: async (id: string): Promise<ComplianceStats> => {
//     const { data } = await api.get(`${BASE}/policies/${id}/compliance/`);
//     return data;
//   },

//   getDistributions: async (id: string): Promise<PolicyDistribution[]> => {
//     const { data } = await api.get(`${BASE}/policies/${id}/distributions/`);
//     return data;
//   },

//   // Employee-facing
//   library: async (): Promise<PolicyListItem[]> => {
//     const { data } = await api.get(`${BASE}/policies/library/`);
//     return data;
//   },

//   myAcknowledgments: async (): Promise<PolicyDistribution[]> => {
//     const { data } = await api.get(`${BASE}/policies/my-acknowledgments/`);
//     return data;
//   },

//   acknowledge: async (id: string): Promise<{ ok: boolean; message: string }> => {
//     const { data } = await api.post(`${BASE}/policies/${id}/acknowledge/`);
//     return data;
//   },

//   recordView: async (id: string, timeSpent: number): Promise<void> => {
//     await api.post(`${BASE}/policies/${id}/record-view/`, {
//       time_spent_seconds: timeSpent,
//     });
//   },
//   pendingApprovals: async (): Promise<PolicyListItem[]> => {
//   const { data } = await api.get(`${BASE}/policies/pending-approvals/`);
//   return Array.isArray(data) ? data : data.results || [];
// },
// };

// // ==============================================================================
// // COMMENTS
// // ==============================================================================

// export const policyCommentsApi = {
//   list: async (policyId: string): Promise<PolicyComment[]> => {
//     const { data } = await api.get(`${BASE}/comments/`, {
//       params: { policy: policyId },
//     });
//     return Array.isArray(data) ? data : data.results || [];
//   },

//   create: async (payload: {
//     policy: string;
//     content: string;
//     parent?: string;
//   }): Promise<PolicyComment> => {
//     const { data } = await api.post(`${BASE}/comments/`, payload);
//     return data;
//   },

//   resolve: async (id: string): Promise<{ ok: boolean }> => {
//     const { data } = await api.post(`${BASE}/comments/${id}/resolve/`);
//     return data;
//   },
// };



import api from './axios';
import type {
  PolicyCategory, PolicyListItem, PolicyDetail,
  PolicyVersion, PolicyDistribution,
  ComplianceStats, PolicyComment,
} from '../types/policy';

const BASE = '/policies';

// ==============================================================================
// CATEGORIES
// ==============================================================================

export const policyCategoriesApi = {
  list: async (): Promise<PolicyCategory[]> => {
    const { data } = await api.get(`${BASE}/categories/`);
    return Array.isArray(data) ? data : data.results ?? [];
  },

  create: async (payload: Partial<PolicyCategory>): Promise<PolicyCategory> => {
    const { data } = await api.post(`${BASE}/categories/`, payload);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<PolicyCategory>
  ): Promise<PolicyCategory> => {
    const { data } = await api.patch(`${BASE}/categories/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/categories/${id}/`);
  },

  seedDefaults: async (): Promise<{ ok: boolean; message: string }> => {
    const { data } = await api.post(`${BASE}/categories/seed-defaults/`);
    return data;
  },
};

// ==============================================================================
// POLICIES
// ==============================================================================

export const policiesApi = {
  // ── HR-facing ──────────────────────────────────────────────────────────────

  list: async (params?: {
    status?: string;
    category?: string;
    is_mandatory?: boolean;
  }): Promise<PolicyListItem[]> => {
    const { data } = await api.get(`${BASE}/policies/`, { params });
    return Array.isArray(data) ? data : data.results ?? [];
  },

  getById: async (id: string): Promise<PolicyDetail> => {
    const { data } = await api.get(`${BASE}/policies/${id}/`);
    return data;
  },

  create: async (formData: FormData): Promise<PolicyDetail> => {
    const { data } = await api.post(`${BASE}/policies/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  update: async (id: string, payload: any): Promise<PolicyDetail> => {
    const { data } = await api.patch(`${BASE}/policies/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/policies/${id}/`);
  },

  // ── Workflow ────────────────────────────────────────────────────────────────

  submitForReview: async (
    id: string
  ): Promise<{ ok: boolean; message: string }> => {
    const { data } = await api.post(
      `${BASE}/policies/${id}/submit-for-review/`
    );
    return data;
  },

  approve: async (
    id: string,
    comments?: string
  ): Promise<{ ok: boolean; message: string }> => {
    const { data } = await api.post(`${BASE}/policies/${id}/approve/`, {
      comments: comments ?? '',
    });
    return data;
  },

  reject: async (
    id: string,
    reason: string
  ): Promise<{ ok: boolean; message: string }> => {
    const { data } = await api.post(`${BASE}/policies/${id}/reject/`, {
      reason,
    });
    return data;
  },

  returnForChanges: async (
    id: string,
    comments: string
  ): Promise<{ ok: boolean; message: string }> => {
    const { data } = await api.post(
      `${BASE}/policies/${id}/return-for-changes/`,
      { comments }
    );
    return data;
  },

  publish: async (
    id: string
  ): Promise<{ ok: boolean; message: string; distributed_to: number }> => {
    const { data } = await api.post(`${BASE}/policies/${id}/publish/`);
    return data;
  },

  // ── Versions ────────────────────────────────────────────────────────────────

  createVersion: async (
    id: string,
    formData: FormData
  ): Promise<PolicyVersion> => {
    const { data } = await api.post(
      `${BASE}/policies/${id}/create-version/`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },

  // ── Compliance (HR only) ────────────────────────────────────────────────────

  getCompliance: async (id: string): Promise<ComplianceStats> => {
    const { data } = await api.get(`${BASE}/policies/${id}/compliance/`);
    return data;
  },

  getDistributions: async (id: string): Promise<PolicyDistribution[]> => {
    const { data } = await api.get(`${BASE}/policies/${id}/distributions/`);
    return Array.isArray(data) ? data : data.results ?? [];
  },

  // ── Employee-facing ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/policies/policies/library/
   * Returns all PUBLISHED policies with my_status attached.
   */
  library: async (): Promise<PolicyListItem[]> => {
    const { data } = await api.get(`${BASE}/policies/library/`);
    console.log('[PolicyAPI] library raw response:', data);
    // Backend returns plain list (pagination_class = None)
    return Array.isArray(data) ? data : data.results ?? [];
  },

  /**
   * GET /api/v1/policies/policies/my-acknowledgments/
   * Returns distributions assigned to current user.
   */
  myAcknowledgments: async (): Promise<PolicyDistribution[]> => {
    const { data } = await api.get(`${BASE}/policies/my-acknowledgments/`);
    return Array.isArray(data) ? data : data.results ?? [];
  },

  /**
   * POST /api/v1/policies/policies/{id}/acknowledge/
   */
  acknowledge: async (
    id: string
  ): Promise<{ ok: boolean; message: string }> => {
    const { data } = await api.post(`${BASE}/policies/${id}/acknowledge/`);
    return data;
  },

  /**
   * POST /api/v1/policies/policies/{id}/record-view/
   */
  recordView: async (id: string, timeSpent: number): Promise<void> => {
    await api.post(`${BASE}/policies/${id}/record-view/`, {
      time_spent_seconds: timeSpent,
    });
  },

  /**
   * GET /api/v1/policies/policies/pending-approvals/
   */
  pendingApprovals: async (): Promise<PolicyListItem[]> => {
    const { data } = await api.get(`${BASE}/policies/pending-approvals/`);
    return Array.isArray(data) ? data : data.results ?? [];
  },
};

// ==============================================================================
// COMMENTS
// ==============================================================================

export const policyCommentsApi = {
  list: async (policyId: string): Promise<PolicyComment[]> => {
    const { data } = await api.get(`${BASE}/comments/`, {
      params: { policy: policyId },
    });
    return Array.isArray(data) ? data : data.results ?? [];
  },

  create: async (payload: {
    policy: string;
    content: string;
    parent?: string;
  }): Promise<PolicyComment> => {
    const { data } = await api.post(`${BASE}/comments/`, payload);
    return data;
  },

  resolve: async (id: string): Promise<{ ok: boolean }> => {
    const { data } = await api.post(`${BASE}/comments/${id}/resolve/`);
    return data;
  },
};