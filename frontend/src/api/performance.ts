// ==============================================================================
// PERFORMANCE MANAGEMENT API — TYPES
// Phase: Rating Scales, Org Priorities, Dept KRAs, KRA Library, KPI Library
// ==============================================================================

import api from './axios';
import type {
  RatingScale, RatingScaleCreatePayload,
  OrganizationalPriority, OrgPriorityCreatePayload,
  DepartmentalKRA, DeptKRACreatePayload,
  DepartmentalKPI, DepartmentalKPICreatePayload,
  KRALibrary, KRALibraryCreatePayload, KRALibraryMini,
  KPILibraryItem, KPILibraryCreatePayload,
  PaginatedResponse,PerformanceCycle, PerformanceCycleCreatePayload,
  EmployeeScorecardListItem, EmployeeScorecardDetail,
  EmployeeKRA, EmployeeKRACreatePayload,
  EmployeeKPI, EmployeeKPICreatePayload,
  EmployeeKPIEvidence,
  AddLibraryKRAPayload, SendBackPayload,KRAPeerNomination, NominatePeersPayload,
  PeerRating, PeerRatingSubmitPayload, PeerRatingDeclinePayload,
  PendingPeerReview, EmployeeForPeer,
} from '../types/performance';

// Helper to unwrap paginated or plain array responses
function unwrapList<T>(data: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

// ==============================================================================
// RATING SCALES
// ==============================================================================

export const ratingScalesApi = {
  list: async (params?: { is_active?: boolean }): Promise<RatingScale[]> => {
    const { data } = await api.get<PaginatedResponse<RatingScale> | RatingScale[]>(
      '/rating-scales/',
      { params }
    );
    return unwrapList(data);
  },

  getById: async (id: string): Promise<RatingScale> => {
    const { data } = await api.get<RatingScale>(`/rating-scales/${id}/`);
    return data;
  },

  create: async (payload: RatingScaleCreatePayload): Promise<RatingScale> => {
    const { data } = await api.post<RatingScale>('/rating-scales/', payload);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<RatingScaleCreatePayload>
  ): Promise<RatingScale> => {
    const { data } = await api.patch<RatingScale>(`/rating-scales/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/rating-scales/${id}/`);
  },

  seedDefaults: async (): Promise<{ message: string; total: number }> => {
    const { data } = await api.post('/rating-scales/seed-defaults/');
    return data;
  },
};

// ==============================================================================
// ORGANIZATIONAL PRIORITIES
// ==============================================================================

export const orgPrioritiesApi = {
  list: async (params?: {
    financial_year?: string;
    is_active?: boolean;
  }): Promise<OrganizationalPriority[]> => {
    const { data } = await api.get<
      PaginatedResponse<OrganizationalPriority> | OrganizationalPriority[]
    >('/organizational-priorities/', { params });
    return unwrapList(data);
  },

  getById: async (id: string): Promise<OrganizationalPriority> => {
    const { data } = await api.get<OrganizationalPriority>(
      `/organizational-priorities/${id}/`
    );
    return data;
  },

  create: async (payload: OrgPriorityCreatePayload): Promise<OrganizationalPriority> => {
    const { data } = await api.post<OrganizationalPriority>(
      '/organizational-priorities/',
      payload
    );
    return data;
  },

  update: async (
    id: string,
    payload: Partial<OrgPriorityCreatePayload>
  ): Promise<OrganizationalPriority> => {
    const { data } = await api.patch<OrganizationalPriority>(
      `/organizational-priorities/${id}/`,
      payload
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/organizational-priorities/${id}/`);
  },

  byYear: async (fy: string): Promise<OrganizationalPriority[]> => {
    const { data } = await api.get<OrganizationalPriority[]>(
      '/organizational-priorities/by-year/',
      { params: { fy } }
    );
    return data;
  },
};

// ==============================================================================
// DEPARTMENTAL KRAs
// ==============================================================================

export const deptKRAsApi = {
  list: async (params?: {
    department?: string;
    financial_year?: string;
    is_active?: boolean;
  }): Promise<DepartmentalKRA[]> => {
    const { data } = await api.get<
      PaginatedResponse<DepartmentalKRA> | DepartmentalKRA[]
    >('/departmental-kras/', { params });
    return unwrapList(data);
  },

  getById: async (id: string): Promise<DepartmentalKRA> => {
    const { data } = await api.get<DepartmentalKRA>(`/departmental-kras/${id}/`);
    return data;
  },

  create: async (payload: DeptKRACreatePayload): Promise<DepartmentalKRA> => {
    const { data } = await api.post<DepartmentalKRA>('/departmental-kras/', payload);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<DeptKRACreatePayload>
  ): Promise<DepartmentalKRA> => {
    const { data } = await api.patch<DepartmentalKRA>(
      `/departmental-kras/${id}/`,
      payload
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/departmental-kras/${id}/`);
  },
};

// ==============================================================================
// DEPARTMENTAL KPIs
// ==============================================================================

export const deptKPIsApi = {
  list: async (params?: { dept_kra?: string }): Promise<DepartmentalKPI[]> => {
    const { data } = await api.get<
      PaginatedResponse<DepartmentalKPI> | DepartmentalKPI[]
    >('/departmental-kpis/', { params });
    return unwrapList(data);
  },

  create: async (payload: DepartmentalKPICreatePayload): Promise<DepartmentalKPI> => {
    const { data } = await api.post<DepartmentalKPI>('/departmental-kpis/', payload);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<DepartmentalKPICreatePayload>
  ): Promise<DepartmentalKPI> => {
    const { data } = await api.patch<DepartmentalKPI>(
      `/departmental-kpis/${id}/`,
      payload
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/departmental-kpis/${id}/`);
  },
};

// ==============================================================================
// KRA LIBRARY
// ==============================================================================

export const kraLibraryApi = {
  list: async (params?: {
    kra_source?: string;
    is_active?: boolean;
    peer_rating_required?: boolean;
  }): Promise<KRALibrary[]> => {
    const { data } = await api.get<PaginatedResponse<KRALibrary> | KRALibrary[]>(
      '/kra-library/',
      { params }
    );
    return unwrapList(data);
  },

  getById: async (id: string): Promise<KRALibrary> => {
    const { data } = await api.get<KRALibrary>(`/kra-library/${id}/`);
    return data;
  },

  create: async (payload: KRALibraryCreatePayload): Promise<KRALibrary> => {
    const { data } = await api.post<KRALibrary>('/kra-library/', payload);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<KRALibraryCreatePayload>
  ): Promise<KRALibrary> => {
    const { data } = await api.patch<KRALibrary>(`/kra-library/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/kra-library/${id}/`);
  },

  forEmployee: async (employeeId: string): Promise<KRALibrary[]> => {
    const { data } = await api.get<KRALibrary[]>(
      `/kra-library/for-employee/${employeeId}/`
    );
    return data;
  },

  mini: async (): Promise<KRALibraryMini[]> => {
    const { data } = await api.get<KRALibraryMini[]>('/kra-library/mini/');
    return data;
  },
};

// ==============================================================================
// KPI LIBRARY
// ==============================================================================

export const kpiLibraryApi = {
  list: async (params?: {
    kra?: string;
    indicator_type?: string;
    kpi_type?: string;
    is_active?: boolean;
  }): Promise<KPILibraryItem[]> => {
    const { data } = await api.get<
      PaginatedResponse<KPILibraryItem> | KPILibraryItem[]
    >('/kpi-library/', { params });
    return unwrapList(data);
  },

  getById: async (id: string): Promise<KPILibraryItem> => {
    const { data } = await api.get<KPILibraryItem>(`/kpi-library/${id}/`);
    return data;
  },

  create: async (payload: KPILibraryCreatePayload): Promise<KPILibraryItem> => {
    const { data } = await api.post<KPILibraryItem>('/kpi-library/', payload);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<KPILibraryCreatePayload>
  ): Promise<KPILibraryItem> => {
    const { data } = await api.patch<KPILibraryItem>(
      `/kpi-library/${id}/`,
      payload
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/kpi-library/${id}/`);
  },
};


export const performanceCyclesApi = {
  list: async (params?: {
    cycle_type?: string;
    status?: string;
    financial_year?: string;
  }): Promise<PerformanceCycle[]> => {
    const { data } = await api.get<
      PaginatedResponse<PerformanceCycle> | PerformanceCycle[]
    >('/performance-cycles/', { params });
    return unwrapList(data);
  },

  getById: async (id: string): Promise<PerformanceCycle> => {
    const { data } = await api.get<PerformanceCycle>(`/performance-cycles/${id}/`);
    return data;
  },

  create: async (payload: PerformanceCycleCreatePayload): Promise<PerformanceCycle> => {
    const { data } = await api.post<PerformanceCycle>('/performance-cycles/', payload);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<PerformanceCycleCreatePayload>
  ): Promise<PerformanceCycle> => {
    const { data } = await api.patch<PerformanceCycle>(
      `/performance-cycles/${id}/`,
      payload
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/performance-cycles/${id}/`);
  },

  /**
   * Activate cycle → auto-creates scorecards for all applicable employees.
   */
  activate: async (id: string): Promise<{ message: string; scorecards_created: number }> => {
    const { data } = await api.post(`/performance-cycles/${id}/activate/`);
    return data;
  },

  close: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/performance-cycles/${id}/close/`);
    return data;
  },

  myActive: async (): Promise<PerformanceCycle[]> => {
    const { data } = await api.get<PerformanceCycle[]>('/performance-cycles/my-active/');
    return data;
  },
};

// ==============================================================================
// EMPLOYEE SCORECARDS
// ==============================================================================

export const employeeScorecardsApi = {
  list: async (params?: {
    employee?: string;
    cycle?: string;
    status?: string;
  }): Promise<EmployeeScorecardListItem[]> => {
    const { data } = await api.get<
      PaginatedResponse<EmployeeScorecardListItem> | EmployeeScorecardListItem[]
    >('/employee-scorecards/', { params });
    return unwrapList(data);
  },

  getById: async (id: string): Promise<EmployeeScorecardDetail> => {
    const { data } = await api.get<EmployeeScorecardDetail>(
      `/employee-scorecards/${id}/`
    );
    return data;
  },

  myScorecards: async (): Promise<EmployeeScorecardListItem[]> => {
    const { data } = await api.get<EmployeeScorecardListItem[]>(
      '/employee-scorecards/my-scorecards/'
    );
    return data;
  },

  teamScorecards: async (cycleId?: string): Promise<EmployeeScorecardListItem[]> => {
    const params = cycleId ? { cycle: cycleId } : {};
    const { data } = await api.get<EmployeeScorecardListItem[]>(
      '/employee-scorecards/team-scorecards/',
      { params }
    );
    return data;
  },

  /**
   * Add a KRA from the library to this scorecard.
   * If include_all_kpis=true, also adds all active KPIs from the library KRA.
   */
  addLibraryKRA: async (
    scorecardId: string,
    payload: AddLibraryKRAPayload
  ): Promise<EmployeeKRA> => {
    const { data } = await api.post(
      `/employee-scorecards/${scorecardId}/add-library-kra/`,
      payload
    );
    return data;
  },

  submit: async (scorecardId: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/employee-scorecards/${scorecardId}/submit/`);
    return data;
  },

  approve: async (scorecardId: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/employee-scorecards/${scorecardId}/approve/`);
    return data;
  },

  sendBack: async (
    scorecardId: string,
    payload: SendBackPayload
  ): Promise<{ message: string }> => {
    const { data } = await api.post(
      `/employee-scorecards/${scorecardId}/send-back/`,
      payload
    );
    return data;
  },

  signOff: async (scorecardId: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/employee-scorecards/${scorecardId}/sign-off/`);
    return data;
  },
  submitSelfReview: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/employee-scorecards/${id}/submit-self-review/`);
    return data;
  },

  submitFinalReview: async (id: string): Promise<any> => {
    const { data } = await api.post(`/employee-scorecards/${id}/submit-final-review/`);
    return data;
  },

  finalize: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/employee-scorecards/${id}/finalize/`);
    return data;
  },
  bulkFinalize: async (cycleId: string): Promise<{ message: string; count: number }> => {
    const { data } = await api.post('/employee-scorecards/bulk-finalize/', {
      cycle_id: cycleId,
    });
    return data;
  },
  allScorecards: async (params?: {
    cycle?: string;
    status?: string;
    department?: string;
    rating?: number;
    search?: string;
  }): Promise<EmployeeScorecardListItem[]> => {
    const { data } = await api.get<EmployeeScorecardListItem[]>(
      '/employee-scorecards/all-scorecards/',
      { params }
    );
    return data;
  },

  calibrationStats: async (cycleId: string): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_rating: Record<string, number>;
    avg_final_score: number;
    department_breakdown: Array<{
      id: string;
      name: string;
      count: number;
      avg_score: number;
    }>;
  }> => {
    const { data } = await api.get(
      '/employee-scorecards/calibration-stats/',
      { params: { cycle: cycleId } }
    );
    return data;
  },
};
// ==============================================================================
// PERFORMANCE REPORTS API
// ==============================================================================

export const performanceReportsApi = {
  individual: async (employeeId?: string): Promise<any> => {
    const params: any = { type: 'individual' };
    if (employeeId) params.employee_id = employeeId;
    const { data } = await api.get('/reports/data/', { params });   // ⬅️ Changed
    return data;
  },

  team: async (managerId?: string, cycleId?: string): Promise<any> => {
    const params: any = { type: 'team' };
    if (managerId) params.manager_id = managerId;
    if (cycleId) params.cycle_id = cycleId;
    const { data } = await api.get('/reports/data/', { params });   // ⬅️ Changed
    return data;
  },

  department: async (cycleId: string): Promise<any> => {
    const { data } = await api.get('/reports/data/', {              // ⬅️ Changed
      params: { type: 'department', cycle_id: cycleId },
    });
    return data;
  },

  cycleComparison: async (cycleIds: string[]): Promise<any> => {
    const { data } = await api.get('/reports/data/', {              // ⬅️ Changed
      params: { type: 'cycle_comparison', cycle_ids: cycleIds.join(',') },
    });
    return data;
  },

  kra: async (cycleId: string): Promise<any> => {
    const { data } = await api.get('/reports/data/', {              // ⬅️ Changed
      params: { type: 'kra', cycle_id: cycleId },
    });
    return data;
  },

  company: async (cycleId: string): Promise<any> => {
    const { data } = await api.get('/reports/data/', {              // ⬅️ Changed
      params: { type: 'company', cycle_id: cycleId },
    });
    return data;
  },

  export: async (params: {
    type: 'company' | 'department' | 'team' | 'individual' | 'kra';
    format: 'excel' | 'pdf';
    cycle_id?: string;
    employee_id?: string;
    manager_id?: string;
  }): Promise<{ blob: Blob; filename: string }> => {
    const { format, ...reportParams } = params;
    const response = await api.get('/reports/export/', {
      // `format` is interpreted by DRF as a renderer selector. Use a
      // domain-specific parameter so PDF/Excel export reaches the view.
      params: { ...reportParams, file_format: format },
      responseType: 'blob',
    });

    const disposition = response.headers['content-disposition'];
    let filename = `report.${params.format === 'excel' ? 'xlsx' : 'pdf'}`;
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match) filename = match[1];
    }

    return { blob: response.data, filename };
  },
};
// ==============================================================================
// DASHBOARD STATS API
// ==============================================================================

export const dashboardApi = {
  getStats: async (): Promise<any> => {
    const { data } = await api.get('/dashboard/stats/');
    return data;
  },
};
// ==============================================================================
// EMPLOYEE KRAs
// ==============================================================================

export const employeeKRAsApi = {
  list: async (params?: { scorecard?: string }): Promise<EmployeeKRA[]> => {
    const { data } = await api.get<PaginatedResponse<EmployeeKRA> | EmployeeKRA[]>(
      '/employee-kras/',
      { params }
    );
    return unwrapList(data);
  },

  getById: async (id: string): Promise<EmployeeKRA> => {
    const { data } = await api.get<EmployeeKRA>(`/employee-kras/${id}/`);
    return data;
  },

  create: async (payload: EmployeeKRACreatePayload): Promise<EmployeeKRA> => {
    const { data } = await api.post<EmployeeKRA>('/employee-kras/', payload);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<EmployeeKRACreatePayload>
  ): Promise<EmployeeKRA> => {
    const { data } = await api.patch<EmployeeKRA>(`/employee-kras/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/employee-kras/${id}/`);
  },
};

// ==============================================================================
// EMPLOYEE KPIs
// ==============================================================================

export const employeeKPIsApi = {
  list: async (params?: { employee_kra?: string }): Promise<EmployeeKPI[]> => {
    const { data } = await api.get<PaginatedResponse<EmployeeKPI> | EmployeeKPI[]>(
      '/employee-kpis/',
      { params }
    );
    return unwrapList(data);
  },

  create: async (payload: EmployeeKPICreatePayload): Promise<EmployeeKPI> => {
    const { data } = await api.post<EmployeeKPI>('/employee-kpis/', payload);
    return data;
  },

  update: async (
    id: string,
    payload: Partial<EmployeeKPICreatePayload>
  ): Promise<EmployeeKPI> => {
    const { data } = await api.patch<EmployeeKPI>(`/employee-kpis/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/employee-kpis/${id}/`);
  },
};

// ==============================================================================
// KPI EVIDENCE UPLOADS
// ==============================================================================

export const kpiEvidencesApi = {
  list: async (params?: { kpi?: string }): Promise<EmployeeKPIEvidence[]> => {
    const { data } = await api.get<
      PaginatedResponse<EmployeeKPIEvidence> | EmployeeKPIEvidence[]
    >('/kpi-evidences/', { params });
    return unwrapList(data);
  },

  upload: async (formData: FormData): Promise<EmployeeKPIEvidence> => {
    const { data } = await api.post<EmployeeKPIEvidence>('/kpi-evidences/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/kpi-evidences/${id}/`);
  },
};


export const peerNominationsApi = {
  list: async (params?: { employee_kra?: string }): Promise<KRAPeerNomination[]> => {
    const { data } = await api.get<
      PaginatedResponse<KRAPeerNomination> | KRAPeerNomination[]
    >('/peer-nominations/', { params });
    return unwrapList(data);
  },

  nominate: async (
    payload: NominatePeersPayload
  ): Promise<{ status: string; message: string }> => {
    const { data } = await api.post(
      '/peer-nominations/nominate-peers/',
      payload
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/peer-nominations/${id}/`);
  },
};

// ==============================================================================
// PEER RATINGS
// ==============================================================================

export const peerRatingsApi = {
  list: async (params?: { status?: string; nomination?: string }): Promise<PeerRating[]> => {
    const { data } = await api.get<
      PaginatedResponse<PeerRating> | PeerRating[]
    >('/peer-ratings/', { params });
    return unwrapList(data);
  },

  getById: async (id: string): Promise<PeerRating> => {
    const { data } = await api.get<PeerRating>(`/peer-ratings/${id}/`);
    return data;
  },

  myPendingReviews: async (): Promise<PendingPeerReview[]> => {
    const { data } = await api.get<PendingPeerReview[]>(
      '/peer-ratings/my-pending-reviews/'
    );
    return data;
  },

  submit: async (
    id: string,
    payload: PeerRatingSubmitPayload
  ): Promise<{ message: string }> => {
    const { data } = await api.post(`/peer-ratings/${id}/submit/`, payload);
    return data;
  },

  decline: async (
    id: string,
    payload: PeerRatingDeclinePayload
  ): Promise<{ message: string }> => {
    const { data } = await api.post(`/peer-ratings/${id}/decline/`, payload);
    return data;
  },
};

// ==============================================================================
// PEER SEARCH
// ==============================================================================

export const peerSearchApi = {
  search: async (params?: {
    exclude_employee?: string;
    search?: string;
  }): Promise<EmployeeForPeer[]> => {
    const { data } = await api.get<EmployeeForPeer[]>('/peer-search/', {
      params,
    });
    return data;
  },
};
