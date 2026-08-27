// // ==============================================================================
// // PERFORMANCE MANAGEMENT — TYPES
// // ==============================================================================

// // ------------------------------------------------------------------------------
// // RATING SCALE
// // ------------------------------------------------------------------------------
// // src/types/performance.ts
// export interface RatingScale {
//   id: string;
//   rating: number;
//   label: string;
//   description: string;
//   min_percent: number;
//   max_percent: number;
//   color_code: string;
//   triggers_pip: boolean;
//   is_active: boolean;
//   created_at: string;
//   updated_at: string;
// }

// export interface RatingScaleCreatePayload {
//   rating: number;
//   label: string;
//   description?: string;
//   min_percent: number;
//   max_percent: number;
//   color_code?: string;
//   triggers_pip?: boolean;
//   is_active?: boolean;
// }

// // ------------------------------------------------------------------------------
// // ORGANIZATIONAL PRIORITY
// // ------------------------------------------------------------------------------

// export type ReviewFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

// export interface OrganizationalPriority {
//   id: string;
//   financial_year: string;
//   priority_number: number;
//   title: string;
//   description: string;
//   target: string;
//   owner: string | null;
//   owner_name: string | null;
//   owner_employee_id: string | null;
//   review_frequency: ReviewFrequency;
//   review_frequency_display: string;
//   is_active: boolean;
//   created_by: string | null;
//   created_by_name: string | null;
//   created_at: string;
//   updated_at: string;
// }

// export interface OrgPriorityCreatePayload {
//   financial_year: string;
//   priority_number: number;
//   title: string;
//   description: string;
//   target: string;
//   owner?: string | null;
//   review_frequency: ReviewFrequency;
//   is_active?: boolean;
// }

// // ------------------------------------------------------------------------------
// // DEPARTMENTAL KRA / KPI
// // ------------------------------------------------------------------------------

// export type KPIType =
//   | 'NUMERIC_UP'
//   | 'NUMERIC_DOWN'
//   | 'PERCENTAGE'
//   | 'RATING'
//   | 'BOOLEAN'
//   | 'CURRENCY';

// export interface DepartmentalKPI {
//   id: string;
//   dept_kra: string;
//   name: string;
//   kpi_type: KPIType;
//   kpi_type_display: string;
//   formula: string;
//   target: string;
//   data_source: string;
//   weight: number;
//   created_at: string;
// }

// export interface DepartmentalKPICreatePayload {
//   dept_kra: string;
//   name: string;
//   kpi_type: KPIType;
//   formula?: string;
//   target: string;
//   data_source?: string;
//   weight?: number;
// }

// export interface DepartmentalKRA {
//   id: string;
//   department: string;
//   department_name: string;
//   financial_year: string;
//   linked_priority: string | null;
//   linked_priority_title: string | null;
//   name: string;
//   description: string;
//   weight_in_dept: number;
//   owner: string | null;
//   owner_name: string | null;
//   is_active: boolean;
//   kpis: DepartmentalKPI[];
//   created_at: string;
//   updated_at: string;
// }

// export interface DeptKRACreatePayload {
//   department: string;
//   financial_year: string;
//   linked_priority?: string | null;
//   name: string;
//   description: string;
//   weight_in_dept?: number;
//   owner?: string | null;
//   is_active?: boolean;
// }

// // ------------------------------------------------------------------------------
// // KRA LIBRARY / KPI LIBRARY
// // ------------------------------------------------------------------------------

// export type KRASource = 'ROLE' | 'COMMON' | 'DEPARTMENTAL';

// export type IndicatorType =
//   | 'OUTPUT'
//   | 'QUALITY'
//   | 'EFFICIENCY'
//   | 'TIMELINESS'
//   | 'COMPLIANCE'
//   | 'CAPABILITY';

// export type MeasurementFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

// export interface KPILibraryItem {
//   id: string;
//   kra: string;
//   kra_name: string;
//   name: string;
//   description: string;
//   indicator_type: IndicatorType;
//   indicator_type_display: string;
//   kpi_type: KPIType;
//   kpi_type_display: string;
//   default_formula: string;
//   default_data_source: string;
//   measurement_frequency: MeasurementFrequency;
//   measurement_frequency_display: string;
//   suggested_baseline: string;
//   suggested_target_minimum: string;
//   suggested_target_expected: string;
//   suggested_target_exceptional: string;
//   is_active: boolean;
//   created_at: string;
// }

// export interface KPILibraryCreatePayload {
//   kra: string;
//   name: string;
//   description?: string;
//   indicator_type: IndicatorType;
//   kpi_type: KPIType;
//   default_formula?: string;
//   default_data_source?: string;
//   measurement_frequency?: MeasurementFrequency;
//   suggested_baseline?: string;
//   suggested_target_minimum?: string;
//   suggested_target_expected?: string;
//   suggested_target_exceptional?: string;
//   is_active?: boolean;
// }

// export interface KRALibrary {
//   id: string;
//   name: string;
//   description: string;
//   kra_source: KRASource;
//   kra_source_display: string;
//   applicable_positions: string[];
//   applicable_position_titles: Array<{ id: string; title: string }>;
//   applicable_departments: string[];
//   applicable_department_names: Array<{ id: string; name: string }>;
//   peer_rating_required: boolean;
//   is_mandatory: boolean;
//   suggested_weight_min: number;
//   suggested_weight_max: number;
//   is_active: boolean;
//   kpi_options: KPILibraryItem[];
//   kpi_count: number;
//   created_by: string | null;
//   created_by_name: string | null;
//   created_at: string;
//   updated_at: string;
// }

// export interface KRALibraryCreatePayload {
//   name: string;
//   description: string;
//   kra_source: KRASource;
//   applicable_positions?: string[];
//   applicable_departments?: string[];
//   peer_rating_required?: boolean;
//   is_mandatory?: boolean;
//   suggested_weight_min?: number;
//   suggested_weight_max?: number;
//   is_active?: boolean;
// }

// export interface KRALibraryMini {
//   id: string;
//   name: string;
//   kra_source: KRASource;
//   peer_rating_required: boolean;
// }

// // ------------------------------------------------------------------------------
// // PAGINATED WRAPPERS
// // ------------------------------------------------------------------------------

// export interface PaginatedResponse<T> {
//   count: number;
//   next: string | null;
//   previous: string | null;
//   results: T[];
// }


// export type CycleType = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
// export type CycleStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';

// export type CyclePhase =
//   | 'NOT_STARTED'
//   | 'GOAL_SETTING'
//   | 'MANAGER_REVIEW'
//   | 'WORKING'
//   | 'PEER_RATING'
//   | 'SELF_REVIEW'
//   | 'FINAL_REVIEW'
//   | 'FINALIZATION'
//   | 'COMPLETED'
//   | 'UNKNOWN';

// export interface PerformanceCycle {
//   id: string;
//   name: string;
//   cycle_type: CycleType;
//   cycle_type_display: string;
//   financial_year: string;
//   period_start: string;
//   period_end: string;

//   goal_setting_start: string;
//   goal_setting_end: string;
//   manager_review_start: string;
//   manager_review_end: string;
//   working_start: string;
//   working_end: string;
//   peer_rating_start: string;
//   peer_rating_end: string;
//   self_review_start: string;
//   self_review_end: string;
//   final_review_start: string;
//   final_review_end: string;
//   finalization_start: string;
//   finalization_end: string;

//   status: CycleStatus;
//   status_display: string;
//   current_phase: CyclePhase;

//   applicable_departments: string[];
//   applicable_department_names: Array<{ id: string; name: string }>;

//   description: string;
//   scorecard_count: number;
//   created_by: string | null;
//   created_by_name: string | null;
//   created_at: string;
//   updated_at: string;
// }

// export interface PerformanceCycleCreatePayload {
//   name: string;
//   cycle_type: CycleType;
//   financial_year: string;
//   period_start: string;
//   period_end: string;
//   goal_setting_start: string;
//   goal_setting_end: string;
//   manager_review_start: string;
//   manager_review_end: string;
//   working_start: string;
//   working_end: string;
//   peer_rating_start: string;
//   peer_rating_end: string;
//   self_review_start: string;
//   self_review_end: string;
//   final_review_start: string;
//   final_review_end: string;
//   finalization_start: string;
//   finalization_end: string;
//   status?: CycleStatus;
//   applicable_departments?: string[];
//   description?: string;
// }

// // ------------------------------------------------------------------------------
// // EMPLOYEE SCORECARD
// // ------------------------------------------------------------------------------

// export type ScorecardStatus =
//   | 'DRAFT'
//   | 'SUBMITTED'
//   | 'MANAGER_REVIEWING'
//   | 'SENT_BACK'
//   | 'APPROVED'
//   | 'SIGNED_OFF'
//   | 'SELF_REVIEW_PENDING'
//   | 'SELF_REVIEWED'
//   | 'MANAGER_REVIEW_PENDING'
//   | 'MANAGER_REVIEWED'
//   | 'FINALIZED';

// export type EmployeeKRASource = 'LIBRARY' | 'CUSTOM' | 'MANDATORY' | 'INHERITED';

// // ------------------------------------------------------------------------------
// // EMPLOYEE KPI + EVIDENCE
// // ------------------------------------------------------------------------------

// export interface EmployeeKPIEvidence {
//   id: string;
//   kpi: string;
//   file: string;
//   file_url: string | null;
//   file_name: string;
//   file_size_kb: number;
//   mime_type: string;
//   description: string;
//   uploaded_by: string | null;
//   uploaded_by_name: string | null;
//   uploaded_at: string;
// }

// export interface EmployeeKPI {
//   id: string;
//   employee_kra: string;
//   library_kpi: string | null;
//   name: string;
//   description: string;
//   indicator_type: IndicatorType;
//   indicator_type_display: string;
//   kpi_type: KPIType;
//   kpi_type_display: string;
//   formula: string;
//   baseline: string;
//   target_minimum: string;
//   target_expected: string;
//   target_exceptional: string;
//   data_source: string;
//   weight_in_kra: number;
//   action_plan: string;
//   self_actual: string;
//   self_rating: number | null;
//   self_comment: string;
//   self_reviewed_at: string | null;
//   manager_actual: string;
//   manager_rating: number | null;
//   manager_comment: string;
//   manager_override_reason: string;
//   manager_reviewed_at: string | null;
//   weighted_score: number | null;
//   display_order: number;
//   evidences: EmployeeKPIEvidence[];
//   created_at: string;
//   updated_at: string;
// }

// export interface EmployeeKPICreatePayload {
//   employee_kra: string;
//   library_kpi?: string | null;
//   name: string;
//   description?: string;
//   indicator_type: IndicatorType;
//   kpi_type: KPIType;
//   formula?: string;
//   baseline?: string;
//   target_minimum?: string;
//   target_expected: string;
//   target_exceptional?: string;
//   data_source?: string;
//   weight_in_kra: number;
//   action_plan?: string;
//   display_order?: number;
// }

// // ------------------------------------------------------------------------------
// // EMPLOYEE KRA
// // ------------------------------------------------------------------------------

// export interface EmployeeKRA {
//   id: string;
//   scorecard: string;
//   library_kra: string | null;
//   name: string;
//   description: string;
//   weight: number;
//   peer_rating_required: boolean;
//   kra_source: EmployeeKRASource;
//   kra_source_display: string;
//   linked_priority: string | null;
//   linked_priority_title: string | null;
//   rationale: string;
//   kra_score: number | null;
//   display_order: number;
//   kpis: EmployeeKPI[];
//   created_at: string;
//   updated_at: string;
// }

// export interface EmployeeKRACreatePayload {
//   scorecard: string;
//   library_kra?: string | null;
//   name: string;
//   description: string;
//   weight: number;
//   peer_rating_required?: boolean;
//   kra_source?: EmployeeKRASource;
//   linked_priority?: string | null;
//   rationale?: string;
//   display_order?: number;
// }

// // ------------------------------------------------------------------------------
// // EMPLOYEE SCORECARD
// // ------------------------------------------------------------------------------

// export interface EmployeeScorecardListItem {
//   id: string;
//   employee: string;
//   employee_name: string;
//   employee_id_display: string;
//   cycle: string;
//   cycle_name: string;
//   cycle_type: CycleType;
//   status: ScorecardStatus;
//   status_display: string;
//   total_weight: number;
//   kra_count: number;
//   final_score: number | null;
//   final_rating: number | null;
//   created_at: string;
// }

// export interface EmployeeScorecardDetail {
//   id: string;
//   employee: string;
//   employee_name: string;
//   employee_id_display: string;
//   employee_position: string | null;
//   employee_department: string | null;
//   reporting_manager_name: string | null;
//   cycle: PerformanceCycle;
//   status: ScorecardStatus;
//   status_display: string;
//   total_weight: number;
//   self_score: number | null;
//   peer_score: number | null;
//   manager_score: number | null;
//   final_score: number | null;
//   final_rating: number | null;
//   employee_signed_off_at: string | null;
//   manager_signed_off_at: string | null;
//   manager_signed_off_by: string | null;
//   manager_signed_off_by_name: string | null;
//   sent_back_reason: string | null;
//   sent_back_at: string | null;
//   kras: EmployeeKRA[];
//   created_at: string;
//   updated_at: string;
// }

// export interface AddLibraryKRAPayload {
//   library_kra_id: string;
//   weight?: number;
//   include_all_kpis?: boolean;
// }

// export interface SendBackPayload {
//   reason: string;
// }

// export type PeerRatingStatus = 'PENDING' | 'SUBMITTED' | 'DECLINED';

// export interface EmployeeForPeer {
//   id: string;
//   employee_id: string;
//   full_name: string;
//   position_title: string | null;
//   department_name: string | null;
// }

// export interface PeerRating {
//   id: string;
//   nomination: string;
//   peer_name: string;
//   peer_employee_id: string;
//   rating: number | null;
//   strengths_comment: string;
//   improvements_comment: string;
//   additional_comments: string;
//   is_anonymous_to_employee: boolean;
//   status: PeerRatingStatus;
//   status_display: string;
//   decline_reason: string;
//   submitted_at: string | null;
//   due_at: string | null;
//   created_at: string;
// }

// export interface KRAPeerNomination {
//   id: string;
//   employee_kra: string;
//   nominated_peer: string;
//   peer: EmployeeForPeer;
//   nominated_by: string | null;
//   nominated_by_name: string | null;
//   nominated_at: string;
//   rating: PeerRating | null;
// }

// export interface NominatePeersPayload {
//   employee_kra_id: string;
//   peer_ids: string[];
// }

// export interface PeerRatingSubmitPayload {
//   rating: number;
//   strengths_comment?: string;
//   improvements_comment?: string;
//   additional_comments?: string;
// }

// export interface PeerRatingDeclinePayload {
//   decline_reason: string;
// }

// export interface PendingPeerReview {
//   id: string;
//   employee_name: string;
//   employee_id_display: string;
//   employee_position: string | null;
//   kra_name: string;
//   kra_description: string;
//   cycle_name: string;
//   status: PeerRatingStatus;
//   status_display: string;
//   due_at: string | null;
//   submitted_at: string | null;
//   rating: number | null;}


// ==============================================================================
// PERFORMANCE MANAGEMENT — NEW ANNUAL/MONTHLY ARCHITECTURE TYPES
// ==============================================================================

// export type AnnualPlanStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

// export type QuarterlyReviewStatus = 'PENDING' | 'UNDER_REVIEW' | 'COMPLETED';

// export type MonthlyPlanStatus =
//   | 'DRAFT'
//   | 'OPEN'
//   | 'REVIEW_DUE'
//   | 'EMPLOYEE_SUBMITTED'
//   | 'UNDER_REVIEW'
//   | 'RETURNED'
//   | 'APPROVED'
//   | 'CLOSED';

// export type KRAType = 'COMMON' | 'DEPARTMENTAL' | 'INDIVIDUAL';

// export type KPIMetricType =
//   | 'NUMERIC_UP'
//   | 'NUMERIC_DOWN'
//   | 'PERCENTAGE'
//   | 'RATING'
//   | 'BOOLEAN';

// export type CarryForwardStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// // ------------------------------------------------------------------------------
// // COMMON & DEPARTMENTAL KRA MASTERS (HR Pre-Configuration)
// // ------------------------------------------------------------------------------

// export interface CommonKPIMaster {
//   id: string;
//   common_kra: string;
//   name: string;
//   description?: string;
//   metric_type: KPIMetricType;
//   default_target: string;
//   weight_in_kra: number;
// }

// export interface CommonKRAMaster {
//   id: string;
//   financial_year: string;
//   name: string;
//   description: string;
//   default_weight: number;
//   applies_to_all: boolean;
//   is_active: boolean;
//   kpis: CommonKPIMaster[];
//   created_at: string;
// }

// export interface DepartmentalKPIMaster {
//   id: string;
//   dept_kra: string;
//   name: string;
//   metric_type: KPIMetricType;
//   default_target: string;
//   weight_in_kra: number;
// }

// export interface DepartmentalKRAMaster {
//   id: string;
//   financial_year: string;
//   department: string;
//   department_name?: string;
//   name: string;
//   description: string;
//   default_weight: number;
//   is_active: boolean;
//   kpis: DepartmentalKPIMaster[];
//   created_at: string;
// }

// // ------------------------------------------------------------------------------
// // MONTHLY KPI, EVIDENCE & KRA
// // ------------------------------------------------------------------------------

// export interface MonthlyKPIEvidence {
//   id: string;
//   kpi: string;
//   file: string;
//   file_name: string;
//   file_size_kb: number;
//   uploaded_by?: string;
//   uploaded_by_name?: string;
//   uploaded_at: string;
// }

// export interface MonthlyKPI {
//   id: string;
//   monthly_kra: string;
//   name: string;
//   metric_type: KPIMetricType;
//   weight_in_kra: number;
//   target_value: string;
//   actual_value: string;
//   achievement_percentage: number | null;
//   employee_comment: string;
//   manager_comment: string;
//   manager_actual:string;
//   manager_rating: number | null;
//   weighted_score: number | null;
//   display_order: number;
//   evidences: MonthlyKPIEvidence[];
// }

// export interface MonthlyKRA {
//   id: string;
//   monthly_plan: string;
//   kra_type: KRAType;
//   kra_type_display?: string;
//   source_library_kra?: string | null;
//   source_dept_kra?: string | null;
//   name: string;
//   description: string;
//   weight: number;
//   peer_rating_required: boolean;
//   kra_start_date: string;
//   kra_end_date: string;
//   kra_score: number | null;
//   display_order: number;
//   kpis: MonthlyKPI[];
//   peer_nominations?: MonthlyPeerNomination[]; 
// }

// // ------------------------------------------------------------------------------
// // MONTHLY PLAN & QUARTERLY REVIEW
// // ------------------------------------------------------------------------------

// export interface MonthlyPeerRating {
//   id: string;
//   nomination: string;
//   peer_name?: string;
//   peer_employee_id?: string;
//   target_employee_name?: string;
//   target_employee_id?: string;
//   kra_name?: string;
//   kra_description?: string;
//   financial_year?: string;
//   status: 'PENDING' | 'SUBMITTED' | 'DECLINED';
//   status_display?: string;
//   rating: number | null;
//   strengths_comment?: string;
//   improvements_comment?: string;
//   additional_comments?: string;
//   decline_reason?: string;
//   submitted_at: string | null;
//   created_at: string;
// }

// export interface MonthlyPeerNomination {
//   id: string;
//   monthly_kra: string;
//   nominated_peer: string;
//   peer_name?: string;
//   peer_employee_id?: string;
//   nominated_by?: string | null;
//   nominated_by_name?: string | null;
//   rating?: MonthlyPeerRating | null;
//   created_at: string;
// }

// export interface MonthlyPerformancePlan {
//   id: string;
//   annual_plan: string;
//   quarterly_review: string;
//   month: number;
//   year: number;
//   month_start_date: string;
//   month_end_date: string;
//   status: MonthlyPlanStatus;
//   status_display?: string;
//   monthly_score: number | null;
//   employee_comments: string;
//   manager_comments: string;
//   employee_submitted_at: string | null;
//   manager_reviewed_at: string | null;
//   is_locked: boolean;
//   kras: MonthlyKRA[];
// }

// export interface QuarterlyReview {
//   id: string;
//   annual_plan: string;
//   quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
//   status: QuarterlyReviewStatus;
//   status_display?: string;
//   quarterly_score: number | null;
//   quarterly_rating: number | null;
//   monthly_plans: MonthlyPerformancePlan[];
// }

// // ------------------------------------------------------------------------------
// // ANNUAL PERFORMANCE PLAN
// //------------------------------------------------------------------------------

// export interface AnnualPerformancePlanListItem {
//   id: string;
//   employee: string;
//   employee_name: string;
//   employee_id_display: string;
//   financial_year: string;
//   plan_start_date: string;
//   plan_end_date: string;
//   status: AnnualPlanStatus;
//   status_display: string;
//   annual_score: number | null;
//   annual_rating: number | null;
// }

// export interface AnnualPerformancePlanDetail {
//   id: string;
//   employee: string;
//   employee_name: string;
//   employee_id_display: string;
//   financial_year: string;
//   plan_start_date: string;
//   plan_end_date: string;
//   status: AnnualPlanStatus;
//   status_display: string;
//   annual_score: number | null;
//   annual_rating: number | null;
//   created_at: string;
//   quarterly_reviews: QuarterlyReview[];
// }

// // ------------------------------------------------------------------------------
// // CARRY FORWARD
// // ------------------------------------------------------------------------------

// export interface CarryForwardRecord {
//   id: string;
//   annual_plan: string;
//   source_kpi: string;
//   source_kpi_name?: string;  // 👈 ADD
//   source_kra_name?: string;  // 👈 ADD
//   source_month_name: string;
//   shortfall_amount: string;
//   destination_kpi?: string;
//   destination_month_name: string;
//   reason: string;
//   status: CarryForwardStatus;
//   requested_by_name?: string;
//   approved_by_name?: string;
//   created_at: string;
// }




// ==============================================================================
// PERFORMANCE MANAGEMENT — COMPLETE TYPE DEFINITIONS
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. MASTER SETTINGS TYPES (Rating Scales, Org Priorities, Library)
// ------------------------------------------------------------------------------

export interface RatingScale {
  id: string;
  rating: number;
  label: string;
  description: string;
  min_percent: number;
  max_percent: number;
  color_code: string;
  triggers_pip: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RatingScaleCreatePayload {
  rating: number;
  label: string;
  description?: string;
  min_percent: number;
  max_percent: number;
  color_code?: string;
  triggers_pip?: boolean;
  is_active?: boolean;
}

export type ReviewFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

export interface OrganizationalPriority {
  id: string;
  financial_year: string;
  priority_number: number;
  title: string;
  description: string;
  target: string;
  owner: string | null;
  owner_name: string | null;
  owner_employee_id: string | null;
  review_frequency: ReviewFrequency;
  review_frequency_display?: string;
  is_active: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgPriorityCreatePayload {
  financial_year: string;
  priority_number: number;
  title: string;
  description: string;
  target: string;
  owner?: string | null;
  review_frequency: ReviewFrequency;
  is_active?: boolean;
}

export type KRASource = 'ROLE' | 'COMMON' | 'DEPARTMENTAL';

export type IndicatorType =
  | 'OUTPUT'
  | 'QUALITY'
  | 'EFFICIENCY'
  | 'TIMELINESS'
  | 'COMPLIANCE'
  | 'CAPABILITY';

export type MeasurementFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

export interface KPILibraryItem {
  id: string;
  kra: string;
  kra_name?: string;
  name: string;
  description: string;
  indicator_type: IndicatorType;
  indicator_type_display?: string;
  kpi_type: KPIMetricType;
  kpi_type_display?: string;
  default_formula: string;
  default_data_source: string;
  measurement_frequency: MeasurementFrequency;
  measurement_frequency_display?: string;
  suggested_baseline: string;
  suggested_target_minimum: string;
  suggested_target_expected: string;
  suggested_target_exceptional: string;
  is_active: boolean;
  created_at: string;
}

export interface KPILibraryCreatePayload {
  kra: string;
  name: string;
  description?: string;
  indicator_type: IndicatorType;
  kpi_type: KPIMetricType;
  default_formula?: string;
  default_data_source?: string;
  measurement_frequency?: MeasurementFrequency;
  suggested_baseline?: string;
  suggested_target_minimum?: string;
  suggested_target_expected?: string;
  suggested_target_exceptional?: string;
  is_active?: boolean;
}

export interface KRALibrary {
  id: string;
  name: string;
  description: string;
  kra_source: KRASource;
  kra_source_display?: string;
  applicable_positions: string[];
  applicable_position_titles: Array<{ id: string; title: string }>;
  applicable_departments: string[];
  applicable_department_names: Array<{ id: string; name: string }>;
  peer_rating_required: boolean;
  is_mandatory: boolean;
  suggested_weight_min: number;
  suggested_weight_max: number;
  is_active: boolean;
  kpi_options: KPILibraryItem[];
  kpi_count: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface KRALibraryCreatePayload {
  name: string;
  description: string;
  kra_source: KRASource;
  applicable_positions?: string[];
  applicable_departments?: string[];
  peer_rating_required?: boolean;
  is_mandatory?: boolean;
  suggested_weight_min?: number;
  suggested_weight_max?: number;
  is_active?: boolean;
}

// ------------------------------------------------------------------------------
// 2. OPERATIONAL ANNUAL & MONTHLY PERFORMANCE TYPES
// ------------------------------------------------------------------------------

export type AnnualPlanStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export type QuarterlyReviewStatus = 'PENDING' | 'UNDER_REVIEW' | 'COMPLETED';

export type MonthlyPlanStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'REVIEW_DUE'
  | 'EMPLOYEE_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'RETURNED'
  | 'APPROVED'
  | 'CLOSED';

export type KRAType = 'COMMON' | 'DEPARTMENTAL' | 'INDIVIDUAL';

export type KPIMetricType =
  | 'NUMERIC_UP'
  | 'NUMERIC_DOWN'
  | 'PERCENTAGE'
  | 'RATING'
  | 'BOOLEAN';

export type CarryForwardStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CommonKPIMaster {
  id: string;
  common_kra: string;
  name: string;
  description?: string;
  metric_type: KPIMetricType;
  default_target: string;
  weight_in_kra: number;
}

export interface CommonKRAMaster {
  id: string;
  financial_year: string;
  name: string;
  description: string;
  default_weight: number;
  applies_to_all: boolean;
  is_active: boolean;
  kpis: CommonKPIMaster[];
  created_at: string;
}

export interface DepartmentalKPIMaster {
  id: string;
  dept_kra: string;
  name: string;
  metric_type: KPIMetricType;
  default_target: string;
  weight_in_kra: number;
}

export interface DepartmentalKRAMaster {
  id: string;
  financial_year: string;
  department: string;
  department_name?: string;
  name: string;
  description: string;
  default_weight: number;
  is_active: boolean;
  kpis: DepartmentalKPIMaster[];
  created_at: string;
}

export interface MonthlyKPIEvidence {
  id: string;
  kpi: string;
  file: string;
  file_name: string;
  file_size_kb: number;
  uploaded_by?: string;
  uploaded_by_name?: string;
  uploaded_at: string;
}

export interface MonthlyKPI {
  id: string;
  monthly_kra: string;
  name: string;
  metric_type: KPIMetricType;
  weight_in_kra: number;
  target_value: string;
  actual_value: string;
  manager_actual?: string;
  achievement_percentage: number | null;
  employee_comment: string;
  manager_comment: string;
  manager_rating: number | null;
  weighted_score: number | null;
  display_order: number;
  evidences: MonthlyKPIEvidence[];
}

export interface MonthlyPeerRating {
  id: string;
  nomination: string;
  peer_name?: string;
  peer_employee_id?: string;
  target_employee_name?: string;
  target_employee_id?: string;
  kra_name?: string;
  kra_description?: string;
  financial_year?: string;
  status: 'PENDING' | 'SUBMITTED' | 'DECLINED';
  status_display?: string;
  rating: number | null;
  strengths_comment?: string;
  improvements_comment?: string;
  additional_comments?: string;
  decline_reason?: string;
  submitted_at: string | null;
  created_at: string;
}

export interface MonthlyPeerNomination {
  id: string;
  monthly_kra: string;
  nominated_peer: string;
  peer_name?: string;
  peer_employee_id?: string;
  nominated_by?: string | null;
  nominated_by_name?: string | null;
  rating?: MonthlyPeerRating | null;
  created_at: string;
}

export interface MonthlyKRA {
  id: string;
  monthly_plan: string;
  kra_type: KRAType;
  kra_type_display?: string;
  source_library_kra?: string | null;
  source_dept_kra?: string | null;
  name: string;
  description: string;
  weight: number;
  kra_start_date: string;
  kra_end_date: string;
  peer_rating_required: boolean;
  kra_score: number | null;
  display_order: number;
  kpis: MonthlyKPI[];
  peer_nominations?: MonthlyPeerNomination[];
}

export interface MonthlyPerformancePlan {
  id: string;
  annual_plan: string;
  quarterly_review: string;
  month: number;
  year: number;
  month_start_date: string;
  month_end_date: string;
  status: MonthlyPlanStatus;
  status_display?: string;
  monthly_score: number | null;
  employee_comments: string;
  manager_comments: string;
  employee_submitted_at: string | null;
  manager_reviewed_at: string | null;
  is_locked: boolean;
  kras: MonthlyKRA[];
}

export interface QuarterlyReview {
  id: string;
  annual_plan: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  status: QuarterlyReviewStatus;
  status_display?: string;
  quarterly_score: number | null;
  quarterly_rating: number | null;
  monthly_plans: MonthlyPerformancePlan[];
}

export interface AnnualPerformancePlanListItem {
  id: string;
  employee: string;
  employee_name: string;
  employee_id_display: string;
  financial_year: string;
  plan_start_date: string;
  plan_end_date: string;
  status: AnnualPlanStatus;
  status_display: string;
  annual_score: number | null;
  annual_rating: number | null;
}

export interface AnnualPerformancePlanDetail {
  id: string;
  employee: string;
  employee_name: string;
  employee_id_display: string;
  financial_year: string;
  plan_start_date: string;
  plan_end_date: string;
  status: AnnualPlanStatus;
  status_display: string;
  annual_score: number | null;
  annual_rating: number | null;
  created_at: string;
  quarterly_reviews: QuarterlyReview[];
}

export interface CarryForwardRecord {
  id: string;
  annual_plan: string;
  source_kpi: string;
  source_kpi_name?: string;
  source_kra_name?: string;
  source_month_name: string;
  shortfall_amount: string;
  destination_kpi?: string;
  destination_month_name: string;
  reason: string;
  status: CarryForwardStatus;
  requested_by?: string;
  requested_by_name?: string;
  approved_by_name?: string;
  created_at: string;
}