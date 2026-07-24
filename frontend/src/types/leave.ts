// ==============================================================================
// LEAVE MANAGEMENT TYPES
// ==============================================================================

export type AccrualType = 'YEARLY' | 'MONTHLY' | 'QUARTERLY' | 'ON_DEMAND';
export type GenderApplicability = 'ALL' | 'MALE' | 'FEMALE';

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  description: string;
  is_paid: boolean;
  is_active: boolean;
  accrual_type: AccrualType;
  accrual_type_display: string;
  yearly_quota: number;
  accrual_per_period: number;
  can_carry_forward: boolean;
  max_carry_forward: number;
  carry_forward_expiry_months: number;
  can_encash: boolean;
  max_encashment_days: number;
  encashment_basis: string;
  requires_document: boolean;
  min_days_before_apply: number;
  max_consecutive_days: number;
  can_apply_half_day: boolean;
  allowed_during_probation: boolean;
  requires_manager_approval: boolean;
  requires_hr_approval: boolean;
  hr_approval_threshold_days: number;
  auto_approve: boolean;
  min_service_months: number;
  applicable_gender: GenderApplicability;
  color_code: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface LeaveTypeMini {
  id: string;
  code: string;
  name: string;
  is_paid: boolean;
  color_code: string;
  requires_document: boolean;
  can_apply_half_day: boolean;
}

// ==============================================================================
// HOLIDAY
// ==============================================================================

export type HolidayType = 'NATIONAL' | 'REGIONAL' | 'COMPANY' | 'OPTIONAL' | 'RESTRICTED';

export interface Holiday {
  id: string;
  name: string;
  date: string;
  year: number;
  holiday_type: HolidayType;
  holiday_type_display: string;
  description: string;
  applicable_to_all_locations: boolean;
  applicable_locations: string[];
  location_names: Array<{ id: string; name: string }>;
  is_optional: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ==============================================================================
// LEAVE BALANCE
// ==============================================================================

export interface LeaveBalance {
  id: string;
  employee: string;
  employee_code: string;      // 🆕 NEW
  employee_name: string;      // 🆕 NEW
  employee_department: string | null;  // 🆕 NEW
  leave_type: LeaveTypeMini;
  year: number;
  allocated: string;
  accrued_till_date: string;
  carried_forward: string;
  used: string;
  pending: string;
  encashed: string;
  adjustment: string;
  available: string;
  total_eligible: string;
  last_accrual_date: string | null;
  updated_at: string;
}

export interface AllocateAllResult {
  ok: boolean;
  message: string;
  total_employees: number;
  newly_allocated: number;
  skipped_existing: number;
  errors: Array<{ employee_id: string; error: string }>;
  allocated_details: Array<{
    employee_id: string;
    full_name: string;
    balances_created: number;
  }>;
}

// ==============================================================================
// PAGINATED
// ==============================================================================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}


// ==============================================================================
// LEAVE APPLICATION
// ==============================================================================

export type LeaveApplicationStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';

export type HalfDayPeriod = 'AM' | 'PM';

export interface LeaveApplicationApproval {
  id: string;
  step_number: number;
  step_name: string;
  approver: string;
  approver_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  status_display: string;
  acted_at: string | null;
  comments: string;
  created_at: string;
}

export interface LeaveApplicationListItem {
  id: string;
  application_number: string;
  employee: string;
  employee_name: string;
  employee_code: string;
  leave_type: string;
  leave_type_name: string;
  leave_type_code: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  total_days: string;
  is_half_day: boolean;
  half_day_period: string;
  reason: string;
  status: LeaveApplicationStatus;
  status_display: string;
  is_lop: boolean;
  lop_days: string;
  applied_at: string;
  approved_at: string | null;
}

export interface LeaveApplicationDetail extends Omit<LeaveApplicationListItem, 'leave_type'> {
  employee_department: string | null;
  manager_name: string | null;
  leave_type: LeaveTypeMini;
  contact_during_leave: string;
  supporting_document: string | null;
  supporting_document_url: string | null;
  handover_to: string | null;
  handover_to_name: string | null;
  handover_notes: string;
  current_approver: string | null;
  current_approver_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  rejection_reason: string;
  cancelled_at: string | null;
  cancellation_reason: string;
  updated_at: string;
  approvals: LeaveApplicationApproval[];
}

export interface LeaveApplicationCreatePayload {
  leave_type: string;
  start_date: string;
  end_date: string;
  is_half_day?: boolean;
  half_day_period?: HalfDayPeriod;
  reason: string;
  contact_during_leave?: string;
  supporting_document?: File;
  handover_to?: string;
  handover_notes?: string;
}

export interface LeaveValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  total_days: string;
  is_lop: boolean;
  lop_days: string;
}

// ==============================================================================
// TEAM CALENDAR
// ==============================================================================

export interface TeamCalendarLeaveEvent {
  type: 'leave';
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  leave_type_code: string;
  leave_type_name: string;
  status: LeaveApplicationStatus;
  color: string;
  total_days: string;
  is_half_day: boolean;
}

export interface TeamCalendarHolidayEvent {
  type: 'holiday';
  id: string;
  title: string;
  date: string;
  holiday_type: string;
  color: string;
}

export type TeamCalendarEvent = TeamCalendarLeaveEvent | TeamCalendarHolidayEvent;

export interface ClashWarning {
  date: string;
  count: number;
  employees: Array<{ employee_name: string; leave_type: string }>;
  severity: 'high' | 'medium';
  percentage: number;
}

export interface TeamCalendarResponse {
  events: TeamCalendarEvent[];
  clashes: ClashWarning[];
  team_size: number;
  start_date: string;
  end_date: string;
}