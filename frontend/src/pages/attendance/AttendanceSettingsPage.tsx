import { type ChangeEvent, useEffect, useState } from 'react';
import { CalendarRange, Download, FileSpreadsheet, Loader2, Mail, Save, Send, ServerCog, ShieldCheck, Timer,Plus, Trash2, Wifi, CheckCircle2, XCircle, Edit3 , type LucideIcon } from 'lucide-react';

import type { AttendanceSettings, AutomationRunMode ,EsslDevice, EsslDevicePayload} from '../../types/attendance';
import { attendanceSettingsApi, attendanceMonthlyReportApi, attendanceReportsApi,esslDevicesApi } from '../../api/attendance';
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
  
  const [deviceData, setDeviceData] = useState<{ mode: string; devices: EsslDevice[] }>({ mode: 'EMPTY', devices: [] });
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<EsslDevice | null>(null);
  const [deviceForm, setDeviceForm] = useState<EsslDevicePayload>({
    name: '',
    serial_number: '',
    role: 'BOTH',
    is_active: true,
  });
  const [savingDevice, setSavingDevice] = useState(false);
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    setLoadingDevices(true);
    try {
      const res = await esslDevicesApi.list();
      setDeviceData(res);
    } catch (err) {
      console.error('Failed to load eSSL devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  }

  // Smart Role Determination
  const activeDevices = deviceData.devices.filter((d) => d.is_active);
  const hasBoth = activeDevices.some((d) => d.role === 'BOTH');
  const hasIn = activeDevices.some((d) => d.role === 'PUNCH_IN');
  const hasOut = activeDevices.some((d) => d.role === 'PUNCH_OUT');

  // Can user add another device?
  const canAddDevice = !hasBoth && !(hasIn && hasOut);

  // Available roles for the modal
  const getAvailableRoles = () => {
    if (editingDevice) {
      return [
        { value: 'BOTH', label: 'Both (Single device - In + Out)' },
        { value: 'PUNCH_IN', label: 'Punch In only' },
        { value: 'PUNCH_OUT', label: 'Punch Out only' },
      ];
    }
    if (activeDevices.length === 0) {
      return [
        { value: 'BOTH', label: 'Both (Single device - In + Out)' },
        { value: 'PUNCH_IN', label: 'Punch In only' },
        { value: 'PUNCH_OUT', label: 'Punch Out only' },
      ];
    }
    if (hasIn) return [{ value: 'PUNCH_OUT', label: 'Punch Out only' }];
    if (hasOut) return [{ value: 'PUNCH_IN', label: 'Punch In only' }];
    return [];
  };

  const handleOpenAddDevice = () => {
    setEditingDevice(null);
    const available = getAvailableRoles();
    setDeviceForm({
      name: '',
      serial_number: '',
      role: (available[0]?.value as any) || 'BOTH',
      is_active: true,
    });
    setDeviceModalOpen(true);
  };

  const handleOpenEditDevice = (device: EsslDevice) => {
    setEditingDevice(device);
    setDeviceForm({
      name: device.name,
      serial_number: device.serial_number,
      role: device.role,
      is_active: device.is_active,
    });
    setDeviceModalOpen(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDevice(true);
    try {
      if (editingDevice) {
        await esslDevicesApi.update(editingDevice.id, deviceForm);
        setToast({ type: 'success', message: 'Device updated successfully.' });
      } else {
        await esslDevicesApi.create(deviceForm);
        setToast({ type: 'success', message: 'Device added successfully.' });
      }
      setDeviceModalOpen(false);
      loadDevices();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to save device.' });
    } finally {
      setSavingDevice(false);
    }
  };

  const handleRemoveDevice = async (device: EsslDevice) => {
    if (!confirm(`Are you sure you want to remove device "${device.name}"?`)) return;
    try {
      await esslDevicesApi.remove(device.id);
      setToast({ type: 'success', message: 'Device removed.' });
      loadDevices();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to remove device.' });
    }
  };

  const handleTestDevice = async (device: EsslDevice) => {
    setTestingDeviceId(device.id);
    try {
      const res = await esslDevicesApi.test(device.id);
      setToast({ type: res.ok ? 'success' : 'error', message: res.message });
      loadDevices();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.message || 'Device connection test failed.' });
    } finally {
      setTestingDeviceId(null);
    }
  };



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
          
          {/* ================= 1. eSSL API & DEVICES SETTINGS ================= */}
          <SettingsSection title="eSSL API Settings">
            <SectionLabel icon={ServerCog} text="Global Device Connection & Credentials" />
            <FormField label="eSSL API URL" value={settings.essl_api_url} onChange={(e) => updateField('essl_api_url', e.target.value)} />
            <FormField label="API Username" value={settings.api_username} onChange={(e) => updateField('api_username', e.target.value)} />
            <SecretField label="API Password" name="api_password" status={settings.secret_statuses.api_password} value={apiPassword} onChange={(e: ChangeEvent<HTMLInputElement>) => setApiPassword(e.target.value)} />

            {/* ================= BIOMETRIC DEVICES MANAGER ================= */}
            <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">Biometric Devices</h4>
                  <p className="text-xs text-slate-400">
                    Mode:{' '}
                    <strong className="text-blue-300">
                      {deviceData.mode === 'SINGLE' && 'Single Device (In + Out)'}
                      {deviceData.mode === 'DUAL' && 'Dual Devices (Separate In / Out)'}
                      {deviceData.mode === 'INVALID' && 'Invalid Configuration'}
                      {deviceData.mode === 'EMPTY' && 'Fallback (.env / Global)'}
                    </strong>
                  </p>
                </div>
                {canAddDevice && (
                  <Button type="button" onClick={handleOpenAddDevice}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Device
                  </Button>
                )}
              </div>

              {/* Notice Banners */}
              {hasBoth && (
                <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                  ⚠️ 'Both' device is active. To switch to dual In/Out devices, remove or deactivate this device first.
                </div>
              )}
              {hasIn && !hasOut && (
                <div className="mb-3 rounded-lg border border-blue-400/30 bg-blue-500/10 p-2.5 text-xs text-blue-200">
                  ℹ️ 'Punch In' device configured. Click <strong>Add Device</strong> to configure the 'Punch Out' device.
                </div>
              )}
              {hasOut && !hasIn && (
                <div className="mb-3 rounded-lg border border-blue-400/30 bg-blue-500/10 p-2.5 text-xs text-blue-200">
                  ℹ️ 'Punch Out' device configured. Click <strong>Add Device</strong> to configure the 'Punch In' device.
                </div>
              )}

              {/* Devices Table / List */}
              {loadingDevices ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading devices...</div>
              ) : deviceData.devices.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-[#070A12]/80 p-4 text-center text-xs text-slate-400">
                  No devices added yet. System is currently using default `.env` serial number. Click <strong>Add Device</strong> to configure.
                </div>
              ) : (
                <div className="space-y-2">
                  {deviceData.devices.map((device) => (
                    <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#070A12]/80 p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{device.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            device.role === 'BOTH' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                            device.role === 'PUNCH_IN' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                            'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          }`}>
                            {device.role_display}
                          </span>
                          {!device.is_active && (
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">Inactive</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Serial: <strong className="text-slate-200">{device.serial_number}</strong>
                          {device.last_test_message && (
                            <span className="ml-3 inline-flex items-center gap-1">
                              {device.last_test_ok ? (
                                <CheckCircle2 className="h-3 w-3 text-green-400" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-400" />
                              )}
                              <span className={device.last_test_ok ? 'text-green-300' : 'text-red-300'}>
                                {device.last_test_message}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          loading={testingDeviceId === device.id}
                          onClick={() => handleTestDevice(device)}
                          className="min-h-9 px-3 text-xs"
                        >
                          <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                          Test
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditDevice(device)}
                          className="rounded-lg border border-white/10 bg-white/[0.05] p-2 text-slate-300 hover:bg-white/10"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDevice(device)}
                          className="rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SettingsSection>

          {/* ================= 2. SMTP EMAIL SETTINGS ================= */}
          <SettingsSection title="SMTP Email Settings">
            <SectionLabel icon={Mail} text="Report delivery" />
            <FormField label="SMTP Host" value={settings.smtp_host} onChange={(e) => updateField('smtp_host', e.target.value)} />
            <FormField label="SMTP Port" type="number" value={settings.smtp_port} onChange={(e) => updateField('smtp_port', Number(e.target.value))} />
            <FormField label="Sender Email" type="email" value={settings.sender_email} onChange={(e) => updateField('sender_email', e.target.value)} />
            <SecretField label="SMTP Password" name="smtp_password" status={settings.secret_statuses.smtp_password} value={smtpPassword} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpPassword(e.target.value)} />
            <ReadOnlyReceiver value={settings.report_receiver_display} configured={settings.report_receiver_configured} />
            <FormField label="CC Emails" textarea value={settings.cc_emails} onChange={(e) => updateField('cc_emails', e.target.value)} />
          </SettingsSection>

          {/* ================= 3. ATTENDANCE RULES ================= */}
          <SettingsSection title="Attendance Rules">
            <SectionLabel icon={ShieldCheck} text="Punch processing" />
            <FormField label="Shift In Time" type="time" value={settings.shift_in_time} onChange={(e) => updateField('shift_in_time', e.target.value)} />
            <FormField label="Shift Out Time" type="time" value={settings.shift_out_time} onChange={(e) => updateField('shift_out_time', e.target.value)} />
            <FormField label="Duplicate Punch Ignore Seconds" type="number" value={settings.duplicate_punch_ignore_seconds} onChange={(e) => updateField('duplicate_punch_ignore_seconds', Number(e.target.value))} />
          </SettingsSection>

          {/* ================= 4. AUTOMATION SCHEDULE ================= */}
          <SettingsSection title="Automation Schedule">
            <SectionLabel icon={Timer} text="Scheduled email" />
            <ToggleField label="Enable Daily Report Email" helper="Scheduled daily email sends only when enabled." checked={settings.enable_daily_report_email} onChange={(v) => updateField('enable_daily_report_email', v)} />
            <FormField label="Auto Send Time" type="time" value={settings.auto_send_time} onChange={(e) => updateField('auto_send_time', e.target.value)} />
          </SettingsSection>

          {/* ================= 5. MONTHLY REPORT SETTINGS ================= */}
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

      {/* ================= DEVICE ADD/EDIT MODAL ================= */}
      {deviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0E1422] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {editingDevice ? 'Edit Biometric Device' : 'Add Biometric Device'}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Configure machine serial number and role. Credentials are shared with global eSSL settings.
            </p>

            <form onSubmit={handleSaveDevice} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Device Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Gate IN"
                  value={deviceForm.name}
                  onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-[#070A12]/80 px-3 text-sm text-slate-100 outline-none transition focus:border-blue-400/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Device Serial Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NYU7251902533"
                  value={deviceForm.serial_number}
                  onChange={(e) => setDeviceForm({ ...deviceForm, serial_number: e.target.value })}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-[#070A12]/80 px-3 text-sm text-slate-100 outline-none transition focus:border-blue-400/60"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Device Role</label>
                <select
                  value={deviceForm.role}
                  onChange={(e) => setDeviceForm({ ...deviceForm, role: e.target.value as any })}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-[#070A12]/80 px-3 text-sm text-slate-100 outline-none transition focus:border-blue-400/60"
                >
                  {getAvailableRoles().map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={deviceForm.is_active}
                  onChange={(e) => setDeviceForm({ ...deviceForm, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-slate-950 text-blue-500"
                />
                <span className="text-sm text-slate-300">Device Active</span>
              </label>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeviceModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <Button type="submit" variant="primary" loading={savingDevice}>
                  Save Device
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
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