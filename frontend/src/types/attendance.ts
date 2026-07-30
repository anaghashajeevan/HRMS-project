// ==============================================================================
// ATTENDANCE MODULE TYPES
// ==============================================================================

// ------------------------------------------------------------------------------
// DASHBOARD
// ------------------------------------------------------------------------------

export interface AttendanceSummary {
  totalEmployeesPresent: number;
  lateComing: number;
  earlyExit: number;
  missingPunch: number;
  totalBreakTime: string;
  reportSentStatus: string;
  lastSentTime: string;
}

export interface AttendanceRow {
  employeeCode: string;
  employeeName: string;
  punchIn: string;
  punchOut: string;
  workingHours: string;
  breakTime: string;
  netWorkingHours: string;
  lateStatus: 'Late' | 'On Time';
  earlyExit: 'Yes' | 'No';
  missingPunch: 'Yes' | 'No';
  liveStatus: 'NOT_ARRIVED' | 'IN_OFFICE' | 'OUTSIDE' | 'COMPLETED_DAY';
  punchCount: number;
  lastPunchTime: string;
  currentPresenceDisplay: 'Not Arrived' | 'In Office' | 'Outside' | 'Completed Day';
  status: string;
  isUnknownEmployee: boolean;
}

export interface DashboardMonthlyReport {
  available: boolean;
  status: string;
  periodLabel: string;
  sentTo: string;
  sentAt: string;
  downloadUrl: string;
  employeesCount: number;
  attendanceDays: number;
  absentDays: number;
  missingPunchDays: number;
  totalWorkingHours: string;
}

export interface AttendanceDashboardData {
  reportDate: string;
  apiStatus: string;
  summary: AttendanceSummary;
  attendanceRows: AttendanceRow[];
  monthlyReport: DashboardMonthlyReport;
  downloadReportUrl: string;
}

// ------------------------------------------------------------------------------
// LIVE PRESENCE
// ------------------------------------------------------------------------------

export type LivePresenceStatus = 'NOT_ARRIVED' | 'IN_OFFICE' | 'OUTSIDE' | 'COMPLETED_DAY';

export interface LivePresenceSummary {
  total_employees: number;
  in_office: number;
  outside: number;
  not_arrived: number;
}

export interface LivePresenceEmployee {
  employee_code: string;
  employee_name: string;
  punch_in: string;
  punch_out: string;
  break_time: string;
  net_hours: string;
  missing_punch: boolean;
  current_presence: LivePresenceStatus;
  current_presence_display: string;
  last_punch_time: string;
  status: string;
}

export interface LivePresenceResponse {
  ok: boolean;
  date: string;
  last_updated: string;
  summary: LivePresenceSummary;
  employees: LivePresenceEmployee[];
  warning?: string;
}

// ------------------------------------------------------------------------------
// SETTINGS
// ------------------------------------------------------------------------------

export type AutomationRunMode = 'DAILY' | 'MONTHLY' | 'BOTH';
export type MonthlyReportMode = 'previous_month' | 'current_month';

export interface AttendanceSettings {
  id: string;
  // eSSL
  essl_api_url: string;
  device_serial_number: string;
  api_username: string;
  // SMTP
  smtp_host: string;
  smtp_port: number;
  sender_email: string;
  report_receiver_email: string;
  cc_emails: string;
  // Report receiver display
  report_receiver_display: string;
  report_receiver_configured: boolean;
  // Daily
  auto_send_time: string;
  enable_daily_report_email: boolean;
  // Automation
  automation_run_mode: AutomationRunMode;
  // Shift rules
  shift_in_time: string;
  shift_out_time: string;
  duplicate_punch_ignore_seconds: number;
  // Monthly
  enable_monthly_report: boolean;
  monthly_report_receiver_email: string;
  monthly_cc_emails: string;
  monthly_report_start_date: string | null;
  monthly_report_end_date: string | null;
  monthly_send_day: string;
  monthly_send_time: string;
  monthly_report_mode: MonthlyReportMode;
  // Working hour rules
  full_day_min_hours: number;
  half_day_min_hours: number;
  full_day_out_time: string;
  half_day_out_time: string;
  lunch_start_time: string;
  lunch_end_time: string;
  excluded_dates: string;
  // Meta
  updated_at: string;
  secret_statuses: {
    api_password: 'Configured' | 'Not Configured';
    smtp_password: 'Configured' | 'Not Configured';
  };
}

export interface AttendanceSettingsUpdatePayload extends Partial<AttendanceSettings> {
  api_password?: string;
  smtp_password?: string;
}

// ------------------------------------------------------------------------------
// AUTOMATION RUN RESPONSE
// ------------------------------------------------------------------------------

export interface AutomationRunResponse {
  ok: boolean;
  message: string;
  steps: string[];
  report_type: string;
  email_sent: boolean;
  download_url: string;
  daily_download_url: string;
  monthly_download_url: string;
  monthlyReport: DashboardMonthlyReport | null;
}

// ------------------------------------------------------------------------------
// MONTHLY REPORT ACTIONS
// ------------------------------------------------------------------------------

export interface MonthlyReportActionResponse {
  ok: boolean;
  message: string;
  monthlyReport: {
    status: string;
    lastSentTime: string;
    downloadUrl: string;
  };
}

export interface MonthlyReportLog {
  id: string;
  month: number;
  year: number;
  report_file: string;
  sent_to: string;
  cc: string;
  sent_at: string | null;
  status: string;
  status_display: string;
  error_message: string;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// TEST ACTIONS
// ------------------------------------------------------------------------------

export interface TestEsslResponse {
  ok: boolean;
  message: string;
  log_count?: number;
}

export interface TestEmailResponse {
  ok: boolean;
  message: string;
  sent_to?: string;
  server_pid?: number;
  exception_class?: string;
}


// ==============================================================================
// PERSONAL ATTENDANCE VIEWS
// ==============================================================================

export type DayStatus =
  | 'present'
  | 'absent'
  | 'missing_punch'
  | 'weekend'
  | 'weekend_present'
  | 'holiday'
  | 'future'
  | 'on_leave'         
  | 'on_half_leave';  

export interface DayEntry {
  date: string;
  day_name: string;
  day_number: number;
  status: DayStatus;
  is_weekend: boolean;
  is_holiday: boolean;
  is_future: boolean;
  is_today: boolean;
  punch_in: string | null;
  punch_out: string | null;
  total_punches: number;
  worked_hours: string;
  worked_hours_decimal: number;
  break_time: string;
  is_late: boolean;
  is_early_exit: boolean;
  leave_info: LeaveInfo | null; 
}

export interface MonthlyStats {
  working_days_in_month: number;
  working_days_elapsed: number;
  effective_working_days: number;  
  present_days: number;
  absent_days: number;
  missing_punch_days: number;
  weekend_worked_days: number;
  on_leave_days: number;             
  on_half_leave_days: number;        
  lop_days: number;                 
  total_worked_hours: string;
  total_worked_hours_decimal: number;
  total_break_time: string;
  expected_hours: number;
  expected_hours_full_month: number;
  shortage_hours: number;
  attendance_percent: number;
  full_day_hours: number;
}

export interface EmployeeInfo {
  id: string;
  employee_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
}

export interface MonthlyAttendanceData {
  year: number;
  month: number;
  month_label: string;
  start_date: string;
  end_date: string;
  employee: EmployeeInfo;
  stats: MonthlyStats;
  days: DayEntry[];
}

export interface DayDetailData {
  date: string;
  day_name: string;
  employee: {
    id: string;
    employee_id: string;
    full_name: string;
  };
  attendance: {
    punch_in: string | null;
    punch_out: string | null;
    total_punches: number;
    worked_hours: string;
    break_time: string;
    gross_hours: string;
    is_late: boolean;
    is_early_exit: boolean;
    missing_punch: boolean;
    status: string;
  };
  raw_punches: Array<{ time: string; raw_line: string }>;
  expected_hours: number;
  shift_in: string;
  shift_out: string;
}

export interface TeamMemberAttendance {
  employee: EmployeeInfo;
  stats: MonthlyStats;
}

export interface TeamAttendanceData {
  year: number;
  month: number;
  month_label: string;
  manager: {
    id: string;
    employee_id: string;
    full_name: string;
  };
  team_size: number;
  team_total_shortage: number;
  team_total_on_leave: number;
  team_avg_attendance: number;
  members: TeamMemberAttendance[];
}

export interface LeaveInfo {
  leave_type_code: string;
  leave_type_name: string;
  leave_type_color: string;
  is_half_day: boolean;
  half_day_period: string;
  application_number: string;
  is_paid: boolean;
  is_lop: boolean;
}
export interface AllEmployeesAttendanceData {
  year: number;
  month: number;
  month_label: string;
  total_employees: number;
  total_shortage: number;
  total_on_leave: number; 
  avg_attendance: number;
  departments: Array<{
    name: string;
    employee_count: number;
    total_shortage: number;
    total_on_leave: number; 
    avg_attendance: number;
  }>;
  employees: Array<{
    employee: EmployeeInfo;
    manager_name: string | null;
    stats: MonthlyStats;
  }>;
}