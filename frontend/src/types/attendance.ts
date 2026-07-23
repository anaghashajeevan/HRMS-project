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