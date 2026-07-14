export interface Role {
  id: string;
  role_name: string;
  code: string;
  description?: string;
  level: number;
  is_active: boolean;
}

export interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  official_email: string;
  status: string;
  date_of_joining: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  is_ldap_user: boolean;
  mfa_enabled: boolean;
  is_active: boolean;
  last_login: string | null;
  employee: Employee | null;
  roles: Role[];
  role_codes: string[];
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: UserProfile;
}

export interface LoginPayload {
  email: string;              
  password: string;
  device_id?: string;
}