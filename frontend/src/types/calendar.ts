export type CalendarStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export interface Holiday {
  id: string;
  name: string;
  date: string;
  year: number;
  holiday_type: 'NATIONAL' | 'REGIONAL' | 'COMPANY' | 'OPTIONAL' | 'RESTRICTED';
  holiday_type_display: string;
  description: string;
  applicable_to_all_locations: boolean;
  applicable_locations: string[];
  location_names: Array<{ id: string; name: string }>;
  is_optional: boolean;
  is_active: boolean;
  calendar?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarApproval {
  id: string;
  step_number: number;
  step_name: string;
  approver: string;
  approver_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  status_display: string;
  acted_at: string | null;
  comments: string;
  created_at: string;
}

export interface AnnualCalendarListItem {
  id: string;
  year: number;
  title: string;
  description: string;
  status: CalendarStatus;
  status_display: string;
  holiday_count: number;
  created_by: string | null;
  created_by_name: string | null;
  published_at: string | null;
  created_at: string;
}

export interface AnnualCalendarDetail extends AnnualCalendarListItem {
  holidays: Holiday[];
  approvals: CalendarApproval[];
  published_by: string | null;
  published_by_name: string | null;
  return_comments: string;
  returned_at: string | null;
  returned_by: string | null;
  returned_by_name: string | null;
  rejection_reason: string;
  rejected_at: string | null;
  updated_at: string;
}

export interface HolidayCreatePayload {
  name: string;
  date: string;
  holiday_type: string;
  description?: string;
  applicable_to_all_locations: boolean;
  applicable_locations?: string[];
  is_optional?: boolean;
}