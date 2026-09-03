export interface UserAccountInfo {
  username: string;
  email: string;
  is_active: boolean;
  is_locked_out: boolean;
  last_login: string | null;
  roles: string[];
}

export interface EmployeeListItem {
  id: string;
  employee_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  official_email: string;
  phone_number: string;
  status: 'ACTIVE' | 'PROBATION' | 'SUSPENDED' | 'TERMINATED';
  position_title: string | null;
  department_name: string | null;
  manager_name: string | null;
  date_of_joining: string;
  role_names?: string[];
  role_codes?: string[];
}

export interface EmployeeDetail {
  id: string;
  employee_id: string;
  status: string;
  first_name: string;
  last_name: string;
  full_name: string;
  official_email: string;
  personal_email: string | null;
  phone_number: string;
  date_of_birth: string;
  gender: string | null;

  position: {
    id: string;
    title: string;
    grade_band: string;
    department_name: string;
  } | null;

  reporting_manager: {
    id: string;
    employee_id: string;
    full_name: string;
    official_email: string;
  } | null;

  structure_location: {
    id: string;
    name: string;
    type: string;
  } | null;

  date_of_joining: string;
  date_of_exit: string | null;

  bank_account: string | null;
  bank_ifsc_code: string | null;
  pan_number: string | null;
  aadhaar_number: string | null;
  uan_number: string | null;
  has_user_account: boolean;
  user_account_info: UserAccountInfo | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedEmployees {
  count: number;
  next: string | null;
  previous: string | null;
  results: EmployeeListItem[];
}

export interface CareerHistoryEntry {
  id: number;
  event_type: string;
  field_name: string;
  from_value: string | null;
  to_value: string | null;
  changed_at: string;
  changed_by: string;
  changed_by_id: string | null;
}

export interface CareerHistoryResponse {
  count: number;
  employee: {
    id: string;
    employee_id: string;
    full_name: string;
    date_of_joining: string;
  };
  timeline: CareerHistoryEntry[];
}