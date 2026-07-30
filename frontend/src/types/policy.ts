// ==============================================================================
// POLICY MANAGEMENT TYPES
// ==============================================================================

// CATEGORY
export interface PolicyCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  color_code: string;
  display_order: number;
  is_active: boolean;
  policy_count: number;
  created_at: string;
  updated_at: string;
}

// VERSION
export interface PolicyVersion {
  id: string;
  policy: string;
  version_number: string;
  content_html: string;
  content_file: string | null;
  file_url: string | null;
  content_type: 'HTML' | 'PDF' | 'DOCX';
  change_summary: string;
  created_by: string | null;
  created_by_name: string | null;
  is_published: boolean;
  published_at: string | null;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

export interface PolicyVersionMini {
  id: string;
  version_number: string;
  is_published: boolean;
  effective_from: string;
  created_at: string;
}

// APPROVAL
export interface PolicyApproval {
  id: string;
  version: string;
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

// ACK STATS
export interface AckStats {
  total: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  percentage: number;
}

// POLICY LIST
export type PolicyStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED' | 'EXPIRED';

export interface PolicyListItem {
  id: string;
  policy_number: string;
  title: string;
  summary: string;
  category: string;
  category_name: string;
  category_code: string;
  category_color: string;
  priority: string;
  priority_display: string;
  tags: string;
  status: PolicyStatus;
  status_display: string;
  current_version_number: string | null;
  version_count: number;
  requires_acknowledgment: boolean;
  is_mandatory: boolean;
  effective_date: string | null;
  expiry_date: string | null;
  published_at: string | null;
  policy_owner: string | null;
  policy_owner_name: string | null;
  ack_stats: AckStats | null;
  return_count?: number;              // ← ADD
  returned_at?: string | null; 
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Employee-specific (from library endpoint)
  my_status?: {
    distributed: boolean;
    acknowledged: boolean;
    acknowledged_at: string | null;
    deadline: string | null;
    is_overdue: boolean;
  };
}

// POLICY DETAIL
export interface PolicyDetail extends Omit<PolicyListItem, 'category'> {
  category: PolicyCategory;
  current_version: PolicyVersion | null;
  versions: PolicyVersionMini[];
  applies_to_all: boolean;
  applicable_departments: string[];
  applicable_department_names: Array<{ id: string; name: string }>;
  applicable_positions: string[];
  applicable_position_titles: Array<{ id: string; title: string }>;
  applicable_locations: string[];
  applicable_location_names: Array<{ id: string; name: string }>;
  applicable_employee_statuses: string;
  acknowledgment_deadline_days: number;
  acknowledgment_text: string;
  review_interval_months: number;
  next_review_date: string | null;
  last_reviewed_at: string | null;
  created_by: string | null;
  created_by_name: string | null;
  return_comments?: string;                          // ← ADD
  returned_at?: string | null;                       // ← ADD
  returned_by?: string | null;                       // ← ADD
  returned_by_name?: string | null;                  // ← ADD
  return_count?: number;     
}

// DISTRIBUTION
export interface PolicyDistribution {
  id: string;
  policy: string;
  version: string;
  employee: string;
  employee_code: string;
  employee_name: string;
  employee_department: string | null;
  policy_title: string;
  policy_number: string;
  version_number: string;
  distributed_at: string;
  email_sent: boolean;
  first_opened_at: string | null;
  last_viewed_at: string | null;
  total_views: number;
  total_time_spent_seconds: number;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledgment_method: string;
  deadline: string;
  days_until_deadline: number | null;
  is_overdue: boolean;
  reminders_sent: number;
  is_invalidated: boolean;
  created_at: string;
}

// COMPLIANCE
export interface ComplianceStats {
  total: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  percentage: number;
  by_department: Array<{
    department: string;
    total: number;
    acknowledged: number;
    percentage: number;
  }>;
}

// COMMENT
export interface PolicyComment {
  id: string;
  policy: string;
  employee: string;
  employee_name: string;
  employee_code: string;
  parent: string | null;
  content: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  replies: PolicyComment[];
  created_at: string;
  updated_at: string;
}