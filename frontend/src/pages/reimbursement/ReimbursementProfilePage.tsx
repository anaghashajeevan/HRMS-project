import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Loader2, Save, ArrowLeft, CheckCircle2, Info,
  Mail, Building2, Calendar, AlertCircle,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { reimbursementProfileApi } from '../../api/reimbursement';
import type { ReimbursementProfile } from '../../types/reimbursement';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

function generateYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => current - 1 + i);
}

export default function ReimbursementProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ReimbursementProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [employeeName, setEmployeeName] = useState('');
  const [department, setDepartment] = useState('');
  const [claimMonth, setClaimMonth] = useState<number>(new Date().getMonth() + 1);
  const [claimYear, setClaimYear] = useState<number>(new Date().getFullYear());
  const [financeEmail, setFinanceEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');

  const years = generateYears();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const data = await reimbursementProfileApi.get();
        setProfile(data);

        // Pre-fill form
        // Pre-fill form with profile data or HRMS employee data as fallback
if (data.employee_name) {
  setEmployeeName(data.employee_name);
} else if (user?.employee?.first_name) {
  setEmployeeName(
    `${user.employee.first_name} ${user.employee.last_name || ''}`.trim()
  );
}

if (data.department) {
  setDepartment(data.department);
} else if (user && (user.employee as any)?.department_name) {
  setDepartment((user.employee as any).department_name);
}

if (data.default_claim_month) setClaimMonth(data.default_claim_month);
if (data.default_claim_year) setClaimYear(data.default_claim_year);
if (data.finance_head_email) setFinanceEmail(data.finance_head_email);
if (data.cc_emails?.length) setCcEmails(data.cc_emails.join(', '));
      } catch (err) {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!employeeName.trim()) return toast.error('Employee name is required');
    if (!department.trim()) return toast.error('Department is required');
    if (!financeEmail.trim()) return toast.error('Finance head email is required');

    setSaving(true);
    try {
      const payload = {
        employee_name: employeeName.trim(),
        department: department.trim(),
        default_claim_month: claimMonth,
        default_claim_year: claimYear,
        finance_head_email: financeEmail.trim(),
        cc_emails: ccEmails
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      };

      const updated = await reimbursementProfileApi.update(payload);
      setProfile(updated);
      toast.success('Profile saved successfully!');

      // If came from smart upload, go back
      if (updated.is_complete) {
        navigate('/reimbursements/smart-upload');
      }
    } catch (err: any) {
      const errors = err?.response?.data;
      if (errors) {
        // Show first error
        const firstKey = Object.keys(errors)[0];
        const firstError = Array.isArray(errors[firstKey])
          ? errors[firstKey][0]
          : errors[firstKey];
        toast.error(typeof firstError === 'string' ? firstError : JSON.stringify(firstError));
      } else {
        toast.error('Save failed');
      }
    } finally {
      setSaving(false);
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
          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => navigate('/reimbursements/smart-upload')}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Reimbursement Profile
              </h1>
              <p className="text-sm text-gray-500">
                Setup your details before uploading bills
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-2xl space-y-6">
            {/* Status Badge */}
            {profile?.is_complete ? (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-800 ring-1 ring-green-200">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Profile is complete. You can upload bills.</span>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Profile Incomplete</p>
                  <p className="mt-1 text-amber-700">
                    Fill in all required fields below to enable Smart Upload.
                  </p>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Why is this needed?</p>
                <p className="mt-1 text-blue-700">
                  Your profile determines which month's claim to create and where
                  to send the reimbursement report. The finance head email is where
                  your claim reports will be emailed after confirmation.
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-gray-900">
                <User className="h-5 w-5 text-primary-600" />
                Your Details
              </h2>

              <div className="space-y-4">
                {/* Employee Name */}
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                    Employee Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Your full name"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="e.g. Engineering, Sales, HR"
                  />
                </div>

                {/* Claim Month + Year */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                      Claim Month <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={claimMonth}
                      onChange={(e) => setClaimMonth(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                      Claim Year <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={claimYear}
                      onChange={(e) => setClaimYear(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Finance Email Section */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-gray-900">
                <Mail className="h-5 w-5 text-primary-600" />
                Finance Recipient
              </h2>

              <div className="space-y-4">
                {/* Finance Head Email */}
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                    Finance Head Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={financeEmail}
                    onChange={(e) => setFinanceEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="finance@yourcompany.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Your reimbursement report will be emailed to this address
                  </p>
                </div>

                {/* CC Emails */}
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                    CC Emails{' '}
                    <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-500 normal-case">
                      Optional
                    </span>
                  </label>
                  <input
                    type="text"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="manager@company.com, hr@company.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Comma-separated email addresses to CC on the report
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => navigate('/reimbursements/smart-upload')}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Profile
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}