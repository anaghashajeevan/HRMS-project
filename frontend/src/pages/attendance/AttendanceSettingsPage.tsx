import { type ChangeEvent, useEffect, useState } from 'react';
import { CalendarRange, Download, FileSpreadsheet, Loader2, Mail, Save, Send, ServerCog, ShieldCheck, Timer, type LucideIcon } from 'lucide-react';

import type { AttendanceSettings, AutomationRunMode } from '../../types/attendance';
import { attendanceSettingsApi, attendanceMonthlyReportApi, attendanceReportsApi } from '../../api/attendance';
import { Button } from '../../components/attendance/Button';
import { FormField } from '../../components/attendance/FormField';
import { SecretField } from '../../components/attendance/SecretField';
import { SettingsSection } from '../../components/attendance/SettingsSection';
import { Toast, type ToastState } from '../../components/attendance/Toast';

type LoadingAction = 'save' | 'test_essl' | 'test_email' | 'generate_monthly' | 'send_monthly' | null;

export default function AttendanceSettingsPage() {
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiPassword, setApiPassword] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [monthlyMonth, setMonthlyMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyStatus, setMonthlyStatus] = useState<string>('Not Generated');
  const [monthlyLastSent, setMonthlyLastSent] = useState<string>('-');
  const [monthlyDownloadUrl, setMonthlyDownloadUrl] = useState<string>('');

  const [action, setAction] = useState<LoadingAction>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await attendanceSettingsApi.get();
      setSettings(data);
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to load settings.' });
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  async function saveSettings() {
    if (!settings) return;
    setAction('save');
    try {
      const payload: any = { ...settings };
      if (apiPassword) payload.api_password = apiPassword;
      if (smtpPassword) payload.smtp_password = smtpPassword;
      // Remove read-only fields
      delete payload.id;
      delete payload.updated_at;
      delete payload.secret_statuses;
      delete payload.report_receiver_display;
      delete payload.report_receiver_configured;

      const response = await attendanceSettingsApi.update(payload);
      setSettings(response.settings);
      setApiPassword('');
      setSmtpPassword('');
      setToast({ type: 'success', message: response.message || 'Settings saved.' });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save settings.' });
    } finally {
      setAction(null);
    }
  }

  async function testEssl() {
    setAction('test_essl');
    try {
      const result = await attendanceSettingsApi.testEssl();
      setToast({ type: result.ok ? 'success' : 'error', message: result.message });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.message || 'eSSL test failed.' });
    } finally {
      setAction(null);
    }
  }

  async function testEmail() {
    setAction('test_email');
    try {
      const result = await attendanceSettingsApi.testEmail();
      const msg = result.sent_to ? `Test email sent to ${result.sent_to}` : result.message;
      setToast({ type: result.ok ? 'success' : 'error', message: msg });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.message || 'Test email failed.' });
    } finally {
      setAction(null);
    }
  }

  async function generateMonthly() {
    setAction('generate_monthly');
    try {
      const result = await attendanceMonthlyReportApi.generate(monthlyMonth);
      if (result.monthlyReport) {
        setMonthlyStatus(result.monthlyReport.status);
        setMonthlyLastSent(result.monthlyReport.lastSentTime);
        setMonthlyDownloadUrl(result.monthlyReport.downloadUrl);
      }
      setToast({ type: 'success', message: result.message });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.message || 'Monthly generation failed.' });
    } finally {
      setAction(null);
    }
  }

  async function sendMonthly() {
    setAction('send_monthly');
    try {
      const result = await attendanceMonthlyReportApi.send(monthlyMonth);
      if (result.monthlyReport) {
        setMonthlyStatus(result.monthlyReport.status);
        setMonthlyLastSent(result.monthlyReport.lastSentTime);
        setMonthlyDownloadUrl(result.monthlyReport.downloadUrl);
      }
      setToast({ type: result.ok ? 'success' : 'error', message: result.message });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.message || 'Monthly email failed.' });
    } finally {
      setAction(null);
    }
  }

  async function downloadMonthly() {
    if (!monthlyDownloadUrl) return;
    try {
      const match = monthlyDownloadUrl.match(/monthly\/([^/]+)\/download/);
      if (!match) return;
      const blob = await attendanceReportsApi.downloadMonthly(match[1]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Monthly_Attendance_${monthlyMonth}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setToast({ type: 'error', message: 'Download failed.' });
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <span className="text-sm font-semibold">Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toast toast={toast} />
      <header className="mb-7">
        <p className="text-sm font-semibold text-blue-300">Admin Only</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Automation Settings</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Manage eSSL, SMTP, attendance rules, and schedule values. Secret fields are write-only.
        </p>
      </header>

      <form className="grid gap-5" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-5 xl:grid-cols-2">
          <SettingsSection title="eSSL API Settings">
            <SectionLabel icon={ServerCog} text="Device connection" />
            <FormField label="eSSL API URL" value={settings.essl_api_url} onChange={(e) => updateField('essl_api_url', e.target.value)} />
            <FormField label="Device Serial Number" value={settings.device_serial_number} onChange={(e) => updateField('device_serial_number', e.target.value)} />
            <FormField label="API Username" value={settings.api_username} onChange={(e) => updateField('api_username', e.target.value)} />
            <SecretField label="API Password" name="api_password" status={settings.secret_statuses.api_password} value={apiPassword} onChange={(e: ChangeEvent<HTMLInputElement>) => setApiPassword(e.target.value)} />
          </SettingsSection>

          <SettingsSection title="SMTP Email Settings">
            <SectionLabel icon={Mail} text="Report delivery" />
            <FormField label="SMTP Host" value={settings.smtp_host} onChange={(e) => updateField('smtp_host', e.target.value)} />
            <FormField label="SMTP Port" type="number" value={settings.smtp_port} onChange={(e) => updateField('smtp_port', Number(e.target.value))} />
            <FormField label="Sender Email" type="email" value={settings.sender_email} onChange={(e) => updateField('sender_email', e.target.value)} />
            <SecretField label="SMTP Password" name="smtp_password" status={settings.secret_statuses.smtp_password} value={smtpPassword} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpPassword(e.target.value)} />
            <ReadOnlyReceiver value={settings.report_receiver_display} configured={settings.report_receiver_configured} />
            <FormField label="CC Emails" textarea value={settings.cc_emails} onChange={(e) => updateField('cc_emails', e.target.value)} />
          </SettingsSection>

          <SettingsSection title="Attendance Rules">
            <SectionLabel icon={ShieldCheck} text="Punch processing" />
            <FormField label="Shift In Time" type="time" value={settings.shift_in_time} onChange={(e) => updateField('shift_in_time', e.target.value)} />
            <FormField label="Shift Out Time" type="time" value={settings.shift_out_time} onChange={(e) => updateField('shift_out_time', e.target.value)} />
            <FormField label="Duplicate Punch Ignore Seconds" type="number" value={settings.duplicate_punch_ignore_seconds} onChange={(e) => updateField('duplicate_punch_ignore_seconds', Number(e.target.value))} />
          </SettingsSection>

          <SettingsSection title="Automation Schedule">
            <SectionLabel icon={Timer} text="Scheduled email" />
            <ToggleField label="Enable Daily Report Email" helper="Scheduled daily email sends only when enabled." checked={settings.enable_daily_report_email} onChange={(v) => updateField('enable_daily_report_email', v)} />
            <FormField label="Auto Send Time" type="time" value={settings.auto_send_time} onChange={(e) => updateField('auto_send_time', e.target.value)} />
          </SettingsSection>

          <SettingsSection title="Monthly Report Settings">
            <SectionLabel icon={CalendarRange} text="Monthly attendance workbook" />
            <ToggleField label="Enable Monthly Report Email" helper="Scheduled monthly email sends only when enabled." checked={settings.enable_monthly_report} onChange={(v) => updateField('enable_monthly_report', v)} />
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-300">Automation Run Mode</span>
              <select
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#070A12]/80 px-3 text-sm text-slate-100 outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                value={settings.automation_run_mode}
                onChange={(e) => updateField('automation_run_mode', e.target.value as AutomationRunMode)}
              >
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
                <option value="BOTH">Both</option>
              </select>
            </label>
            <FormField label="Monthly CC Emails" textarea value={settings.monthly_cc_emails} onChange={(e) => updateField('monthly_cc_emails', e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Report Start Date" type="date" value={settings.monthly_report_start_date || ''} onChange={(e) => updateField('monthly_report_start_date', e.target.value)} />
              <FormField label="Report End Date" type="date" value={settings.monthly_report_end_date || ''} onChange={(e) => updateField('monthly_report_end_date', e.target.value)} />
            </div>
            <FormField label="Monthly Send Day" type="number" min="1" max="31" value={settings.monthly_send_day} onChange={(e) => updateField('monthly_send_day', e.target.value)} />
            <FormField label="Monthly Send Time" type="time" value={settings.monthly_send_time} onChange={(e) => updateField('monthly_send_time', e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Full Day Minimum Hours" type="number" min="0" step="0.25" value={settings.full_day_min_hours} onChange={(e) => updateField('full_day_min_hours', Number(e.target.value))} />
              <FormField label="Half Day Minimum Hours" type="number" min="0" step="0.25" value={settings.half_day_min_hours} onChange={(e) => updateField('half_day_min_hours', Number(e.target.value))} />
              <FormField label="Full Day Out Time" type="time" value={settings.full_day_out_time} onChange={(e) => updateField('full_day_out_time', e.target.value)} />
              <FormField label="Half Day Out Time" type="time" value={settings.half_day_out_time} onChange={(e) => updateField('half_day_out_time', e.target.value)} />
              <FormField label="Lunch Start Time" type="time" value={settings.lunch_start_time} onChange={(e) => updateField('lunch_start_time', e.target.value)} />
              <FormField label="Lunch End Time" type="time" value={settings.lunch_end_time} onChange={(e) => updateField('lunch_end_time', e.target.value)} />
            </div>
            <FormField label="Excluded Dates from Absent Calculation" textarea value={settings.excluded_dates} onChange={(e) => updateField('excluded_dates', e.target.value)} />

            {/* Manual monthly actions */}
            <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-300">Report Month</span>
                  <input type="month" value={monthlyMonth} onChange={(e) => setMonthlyMonth(e.target.value)} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#070A12]/80 px-3 text-sm text-slate-100 outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20 sm:max-w-xs" />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-300">
                    <span>Status: <strong className="text-white">{monthlyStatus}</strong></span>
                    <span className="ml-3">Last sent: <strong className="text-white">{monthlyLastSent}</strong></span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button loading={action === 'generate_monthly'} onClick={generateMonthly} type="button">
                      <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                      Generate Monthly Excel
                    </Button>
                    <Button variant="primary" loading={action === 'send_monthly'} onClick={sendMonthly} type="button">
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Send Monthly Email
                    </Button>
                    {monthlyDownloadUrl && (
                      <button onClick={downloadMonthly} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-bold text-slate-100 transition hover:border-blue-400/45 hover:bg-blue-500/10">
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>
        </div>

        <div className="flex flex-wrap justify-end gap-3 rounded-2xl border border-white/10 bg-[#0E1422]/80 p-4 shadow-glass backdrop-blur-xl">
          <Button loading={action === 'test_essl'} onClick={testEssl} type="button">Test eSSL Connection</Button>
          <Button loading={action === 'test_email'} onClick={testEmail} type="button">Send Test Email</Button>
          <Button variant="primary" loading={action === 'save'} onClick={saveSettings} type="button">
            <Save className="h-4 w-4" aria-hidden="true" />
            Save Settings
          </Button>
        </div>
      </form>
    </>
  );
}

function ReadOnlyReceiver({ value, configured }: { value: string; configured: boolean }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-slate-300">Report Receiver Email</span>
      <div className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-slate-100">
        <span className={configured ? 'break-all font-semibold text-white' : 'text-slate-500'}>
          {configured ? value : 'Not configured'}
        </span>
      </div>
      <span className="text-xs leading-5 text-slate-500">This email is controlled by .env CTO_EMAIL.</span>
      {!configured && (
        <span className="rounded-lg border border-red-400/35 bg-red-500/12 px-3 py-2 text-xs font-semibold leading-5 text-red-100">
          CTO_EMAIL is not configured in .env.
        </span>
      )}
    </div>
  );
}

function ToggleField({ label, helper, checked, onChange }: { label: string; helper: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2">
      <span>
        <span className="block text-sm font-medium text-slate-300">{label}</span>
        <span className="block text-xs text-slate-500">{helper}</span>
      </span>
      <input checked={checked} className="h-5 w-5 rounded border-white/20 bg-slate-950 text-blue-500 focus:ring-blue-500/30" type="checkbox" onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function SectionLabel({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-sm text-blue-300">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}