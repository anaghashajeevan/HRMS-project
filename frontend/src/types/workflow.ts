// ==============================================================================
// APPROVAL WORKFLOW TYPES
// ==============================================================================

export type ApproverType =
  | 'REPORTING_MANAGER'
  | 'SKIP_LEVEL_MANAGER'
  | 'DEPARTMENT_HEAD'
  | 'HR_ADMIN'
  | 'SYSTEM_ADMIN'
  | 'SPECIFIC_EMPLOYEE';

export interface WorkflowStep {
  id?: string;
  step_number: number;
  step_name: string;
  approver_type: ApproverType;
  approver_type_display?: string;
  specific_employee?: string | null;
  specific_employee_name?: string | null;
  sla_hours: number;
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  module: 'LIFECYCLE';
  module_display?: string;
  description: string;
  is_active: boolean;
  steps: WorkflowStep[];
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalWorkflowCreatePayload {
  name: string;
  module: 'LIFECYCLE';
  description?: string;
  is_active: boolean;
  steps: Omit<WorkflowStep, 'id' | 'approver_type_display' | 'specific_employee_name'>[];
}

export interface ApproverOption {
  id: string;
  label: string;
  category: 'Dynamic' | 'By Role' | 'Specific Employee';
  employee_id?: string;
  roles?: string[];
}

// ==============================================================================
// LETTER TEMPLATE TYPES
// ==============================================================================

export type LetterTemplateType =
  | 'PROMOTION'
  | 'TRANSFER'
  | 'REDESIGNATION'
  | 'CONFIRMATION'
  | 'MANAGER_CHANGE'
  | 'PERFORMANCE_RATING'
  | 'APPRAISAL_LETTER'
  | 'PIP_LETTER';

export type CreationMethod = 'AI' | 'MANUAL' | 'AI_EDITED';

export interface LetterTemplate {
  id: string;
  name: string;
  template_type: LetterTemplateType;
  template_type_display?: string;
  subject: string;
  body_html: string;
  creation_method: CreationMethod;
  creation_method_display?: string;
  ai_prompt?: string | null;
  is_default: boolean;
  is_active: boolean;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LetterTemplateCreatePayload {
  name: string;
  template_type: LetterTemplateType;
  subject: string;
  body_html: string;
  creation_method: CreationMethod;
  ai_prompt?: string;
  is_default?: boolean;
  is_active?: boolean;
}

export interface AIGenerateRequest {
  prompt: string;
  template_type: LetterTemplateType;
}

export interface AIGenerateResponse {
  html: string;
}

// ==============================================================================
// LIFECYCLE CHANGE REQUEST TYPES
// ==============================================================================

export type ChangeType =
  | 'PROMOTION'
  | 'TRANSFER'
  | 'REDESIGNATION'
  | 'MANAGER_CHANGE'
  | 'CONFIRMATION';
  

export type RequestStatus = 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type ActionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalAction {
  id: string;
  step_number: number;
  step_name: string;
  assigned_to: string;
  assigned_to_name: string;
  assigned_to_employee_id: string;
  status: ActionStatus;
  status_display: string;
  acted_at: string | null;
  comments: string | null;
  due_at: string;
  created_at: string;
}

export interface LifecycleRequestListItem {
  id: string;
  request_number: string;
  employee: string;
  employee_name: string;
  employee_id_display: string;
  change_type: ChangeType;
  change_type_display: string;
  status: RequestStatus;
  status_display: string;
  current_step_number: number;
  effective_date: string;
  requested_by: string;
  requested_by_name: string;
  created_at: string;
  completed_at: string | null;
}

export interface LifecycleRequestDetail extends LifecycleRequestListItem {
  current_position: string | null;
  current_position_title: string | null;
  proposed_position: string | null;
  proposed_position_title: string | null;
  current_manager: string | null;
  current_manager_name: string | null;
  proposed_manager: string | null;
  proposed_manager_name: string | null;
  current_location: string | null;
  current_location_name: string | null;
  proposed_location: string | null;
  proposed_location_name: string | null;
  current_status: string;
  proposed_status: string;
  reason: string;
  workflow: string;
  workflow_name: string;
  workflow_total_steps: number;
  rejection_reason: string | null;
  letter_template: string | null;
  generated_document: string | null;
  letter_url: string | null;
  approval_actions: ApprovalAction[];
  updated_at: string;
}

export interface LifecycleRequestCreatePayload {
  employee: string;
  change_type: ChangeType;
  proposed_position?: string | null;
  proposed_manager?: string | null;
  proposed_location?: string | null;
  proposed_status?: string;
  effective_date: string;
  reason: string;
}

export interface ApprovePayload {
  comments?: string;
  letter_template_id?: string;
}

export interface RejectPayload {
  reason: string;
}

export interface PaginatedLifecycleRequests {
  count: number;
  next: string | null;
  previous: string | null;
  results: LifecycleRequestListItem[];
}

export interface LifecycleListParams {
  page?: number;
  status?: string;
  change_type?: string;
  employee?: string;
  ordering?: string;
}

// ==============================================================================
// NOTIFICATION TYPES
// ==============================================================================

export type NotificationType =
  | 'APPROVAL_REQUEST'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'LETTER_GENERATED'
  | 'SYSTEM';

export interface Notification {
  id: string;
  notification_type: NotificationType;
  notification_type_display: string;
  title: string;
  message: string;
  link: string;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface PaginatedNotifications {
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
}