export interface Role {
  id: string;
  role_name: string;
  code: string;
  description: string | null;
  level: number;
  is_active: boolean;
  user_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyStructure {
  id: string;
  name: string;
  type: 'COMPANY' | 'BUSINESS_UNIT' | 'DEPARTMENT' | 'COST_CENTER' | 'LOCATION';
  parent: string | null;
  parent_name: string | null;
  cost_center_code: string | null;
  is_active: boolean;
  children_count: number;
  employee_count: number;
  created_at?: string;
}

export interface JobPosition {
  id: string;
  title: string;
  grade_band: string;
  department: string;
  department_name: string;
  budgeted_count: number;
  actual_count: number;
  vacancy_count: number;
  is_full: boolean;
  salary_min: string | null;
  salary_max: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeIdSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  is_editable: boolean;
  updated_at: string;
  updated_by_name: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}