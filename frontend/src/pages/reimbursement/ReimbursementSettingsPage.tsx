import { useEffect, useState } from 'react';
import {
  Cog, Loader2, Save, CheckCircle2, XCircle, AlertCircle,
  Mail, Database, Eye, Send, Info,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { reimbursementSettingsApi, reimbursementEmailApi } from '../../api/reimbursement';
import type { ReimbursementSystemSetting, SystemConfigStatus } from '../../types/reimbursement';
import toast from 'react-hot-toast';

export default function ReimbursementSettingsPage() {
  const [settings, setSettings] = useState<ReimbursementSystemSetting | null>(null);
  const [configStatus, setConfigStatus] = useState<SystemConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [ctoEmail, setCtoEmail] = useState('');
  const [financeEmail, setFinanceEmail] = useState('');
  const [emailSubjectPrefix, setEmailSubjectPrefix] = useState('');
  const [emailBodyNote, setEmailBodyNote] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [settingsData, statusData] = await Promise.all([
          reimbursementSettingsApi.get(),
          reimbursementSettingsApi.configStatus(),
        ]);
        setSettings(settingsData);
        setConfigStatus(statusData);

        setCompanyName(settingsData.company_name || '');
        setCompanyAddress(settingsData.company_address || '');
        setCtoEmail(settingsData.cto_email || '');
        setFinanceEmail(settingsData.finance_head_email || '');
        setEmailSubjectPrefix(settingsData.default_email_subject_prefix || '');
        setEmailBodyNote(settingsData.default_email_body_note || '');
        setAllowedDomains(
          (settingsData.quick_claim_allowed_recipient_domains || []).join(', ')
        );
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      const updated = await reimbursementSettingsApi.update({
        company_name: companyName,
        company_address: companyAddress,
        default_email_subject_prefix: emailSubjectPrefix,
        default_email_body_note: emailBodyNote,
      });
      setSettings(updated);
      toast.success('Company settings saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRecipients = async () => {
    setSaving(true);
    try {
      const domains = allowedDomains.split(',').map((d) => d.trim()).filter(Boolean);
      const updated = await reimbursementSettingsApi.update({
        cto_email: ctoEmail,
        finance_head_email: financeEmail,
        quick_claim_allowed_recipient_domains: domains,
      });
      setSettings(updated);
      toast.success('Recipient settings saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!testEmail.trim()) {
      toast.error('Enter a test email address');
      return;
    }
    setTestingSmtp(true);
    try {
      const result = await reimbursementEmailApi.testSmtp(testEmail);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'SMTP test failed');
    } finally {
      setTestingSmtp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <Cog className="h-6 w-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">Reimbursement Settings</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              {/* Company Settings */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 text-base font-semibold text-gray-900">Company Settings</h2>
                <div className="space-y-3">
                  <Field label="Company Name" value={companyName} onChange={setCompanyName} />
                  <Field label="Company Address" value={companyAddress} onChange={setCompanyAddress} multiline />
                  <Field label="Default Email Subject" value={emailSubjectPrefix} onChange={setEmailSubjectPrefix} />
                  <Field label="Default Email Body Note" value={emailBodyNote} onChange={setEmailBodyNote} multiline />
                </div>
                <button onClick={handleSaveCompany} disabled={saving} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Company Settings
                </button>
              </div>

              {/* Recipient Settings */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 text-base font-semibold text-gray-900">Recipient Settings</h2>
                <div className="space-y-3">
                  <Field label="CTO Email" value={ctoEmail} onChange={setCtoEmail} type="email" />
                  <Field label="Finance Head Email" value={financeEmail} onChange={setFinanceEmail} type="email" />
                  <Field label="Allowed Recipient Domains" value={allowedDomains} onChange={setAllowedDomains} placeholder="vbsai.com, gmail.com" />
                  <p className="text-xs text-gray-500">Comma-separated domains. Employees can only send to these.</p>
                </div>
                <button onClick={handleSaveRecipients} disabled={saving} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Recipient Settings
                </button>
              </div>

              {/* SMTP Test */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 text-base font-semibold text-gray-900">SMTP Test</h2>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <button onClick={handleTestSmtp} disabled={testingSmtp} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {testingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send Test
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN — Status */}
            <div className="space-y-6">
              {/* SMTP Status */}
              {configStatus?.email && (
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
                    <Mail className="h-5 w-5 text-primary-600" />
                    SMTP Configuration Status
                  </h2>
                  <div className="space-y-2">
                    <StatusRow label="Email Host" value={configStatus.email.email_host} />
                    <StatusRow label="Port" value={String(configStatus.email.email_port)} />
                    <StatusRow label="TLS Enabled" ok={configStatus.email.email_use_tls} />
                    <StatusRow label="Sender Configured" ok={configStatus.email.default_from_email_configured} />
                    <StatusRow label="Password Configured" ok={configStatus.email.email_password_configured} />
                    <StatusRow label="CTO Email Configured" ok={configStatus.email.cto_email_configured} />
                    <StatusRow label="Finance Email Configured" ok={configStatus.email.finance_head_email_configured} />
                  </div>
                </div>
              )}

              {/* OCR Status */}
              {configStatus?.ocr && (
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
                    <Eye className="h-5 w-5 text-primary-600" />
                    OCR / Tesseract Status
                  </h2>
                  <div className="space-y-2">
                    <StatusRow label="Tesseract Configured" ok={configStatus.ocr.tesseract_cmd_configured} />
                    <StatusRow label="Tesseract Available" ok={configStatus.ocr.tesseract_available} />
                    <StatusRow label="Tesseract Version" value={configStatus.ocr.tesseract_version || 'N/A'} />
                  </div>
                </div>
              )}

              {/* Database Status */}
              {configStatus?.database && (
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
                    <Database className="h-5 w-5 text-primary-600" />
                    System Health
                  </h2>
                  <StatusRow label="Database Connected" ok={configStatus.database.connected} />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type, multiline, placeholder }: any) {
  const Component = multiline ? 'textarea' : 'input';
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase text-gray-500">{label}</label>
      <Component
        type={type || 'text'}
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        rows={multiline ? 3 : undefined}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value?: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      {value !== undefined ? (
        <span className="text-sm font-medium text-gray-900">{value}</span>
      ) : (
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {ok ? 'Configured' : 'Not Set'}
        </span>
      )}
    </div>
  );
}