export interface EmployeeDocument {
  id: string;
  employee: string;
  document_type: string;
  document_type_display: string;
  document_name: string;
  file_path: string;
  file_url: string;
  file_size_kb: number;
  mime_type: string;
  expiry_date: string | null;
  is_expired: boolean;
  days_until_expiry: number | null;
  alert_fired_count: number;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
}

export interface AuditLogEntry {
  id: number;
  employee: string;
  field_name: string;
  field_display: string;
  old_value: string | null;
  new_value: string | null;
  old_value_display: string | null;   
  new_value_display: string | null;   
  modified_by: string | null;
  modified_by_name: string;
  modified_by_id: string | null;
  changed_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}