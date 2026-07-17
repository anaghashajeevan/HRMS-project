import { useEffect, useState } from 'react';
import {
  User, Briefcase, Landmark, FileText, Mail, Phone, Calendar,
  MapPin, Building2, Loader2, Save, Edit2, X, Key, Shield,
  TrendingUp,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import DocumentsTab from '../components/DocumentsTab';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { employeesApi } from '../api/employees';
import type { EmployeeDetail } from '../types/employee';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';
import CareerHistoryTab from '../components/CareerHistoryTab';

type TabKey = 'personal' | 'employment' | 'bank' | 'documents' | 'career';

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PROBATION: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  TERMINATED: 'bg-red-100 text-red-700',
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // Editable fields (only these two — rest is read-only)
  const [editForm, setEditForm] = useState({
    phone_number: '',
    personal_email: '',
  });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await employeesApi.getMe();
      setEmployee(data);
      setEditForm({
        phone_number: data.phone_number || '',
        personal_email: data.personal_email || '',
      });
    } catch {
      toast.error('Failed to load your profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartEdit = () => {
    if (!employee) return;
    setEditForm({
      phone_number: employee.phone_number || '',
      personal_email: employee.personal_email || '',
    });
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    if (employee) {
      setEditForm({
        phone_number: employee.phone_number || '',
        personal_email: employee.personal_email || '',
      });
    }
  };

  const handleSave = async () => {
    if (!editForm.phone_number.trim()) {
      toast.error('Phone number is required');
      return;
    }
    setSaving(true);
    try {
      const updated = await employeesApi.updateMe({
        phone_number: editForm.phone_number,
        personal_email: editForm.personal_email || undefined,
      });
      setEmployee(updated);
      toast.success('Profile updated');
      setEditMode(false);
      refreshUser();
    } catch (err) {
      const error = err as AxiosError<Record<string, string[] | string>>;
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  if (loading || !employee) {
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

  const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="mt-1 text-sm text-gray-600">
              View and manage your personal information
            </p>
          </div>

          {/* Profile Header Card */}
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 p-6 text-white shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white backdrop-blur">
                  {initials}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{employee.full_name}</h2>
                  <p className="mt-1 text-sm text-primary-100">
                    {employee.employee_id}
                    {employee.position && ` • ${employee.position.title}`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      statusStyles[employee.status] || 'bg-gray-100 text-gray-700'
                    }`}>
                      {employee.status}
                    </span>
                    {user?.role_codes.map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setPasswordModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/30"
              >
                <Key className="h-4 w-4" />
                Change Password
              </button>
            </div>
          </div>

          {/* Info Notice */}
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="flex items-start gap-2 text-sm text-blue-800">
              <Shield className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                You can update your <strong>phone number</strong> and <strong>personal email</strong>.
                For other changes, please contact HR.
              </span>
            </p>
          </div>

          {/* Tabs */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between border-b border-gray-200 px-6">
              <nav className="flex gap-6">
                {[
                  { key: 'personal', label: 'Personal', icon: User },
                  { key: 'employment', label: 'Employment', icon: Briefcase },
                  { key: 'bank', label: 'Bank & Statutory', icon: Landmark },
                  { key: 'documents', label: 'Documents', icon: FileText },
                  { key: 'career', label: 'Career', icon: TrendingUp },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as TabKey)}
                    className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition ${
                      activeTab === tab.key
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>

              {/* Edit button only on personal tab */}
              {activeTab === 'personal' && !editMode && (
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
            </div>

            <div className="p-6">
              {/* PERSONAL TAB */}
              {activeTab === 'personal' && (
                <>
                  {editMode ? (
                    // ---------- Edit Mode ----------
                    <div className="max-w-2xl">
                      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <p className="text-xs text-amber-800">
                          ✏️ You're editing only fields you're allowed to change.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Phone Number *
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                              type="tel"
                              value={editForm.phone_number}
                              onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                              placeholder="+91 98765 43210"
                              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Personal Email
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                              type="email"
                              value={editForm.personal_email}
                              onChange={(e) => setEditForm({ ...editForm, personal_email: e.target.value })}
                              placeholder="you@personal.com"
                              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ---------- View Mode ----------
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <InfoField icon={User} label="First Name" value={employee.first_name} />
                      <InfoField icon={User} label="Last Name" value={employee.last_name} />
                      <InfoField icon={Calendar} label="Date of Birth" value={formatDate(employee.date_of_birth)} />
                      <InfoField icon={User} label="Gender" value={employee.gender || '—'} />
                      <InfoField icon={Mail} label="Official Email" value={employee.official_email} />
                      <InfoField
                        icon={Mail}
                        label="Personal Email"
                        value={employee.personal_email || '—'}
                        editable
                      />
                      <InfoField
                        icon={Phone}
                        label="Phone Number"
                        value={employee.phone_number}
                        editable
                      />
                    </div>
                  )}
                </>
              )}

              {/* EMPLOYMENT TAB */}
              {activeTab === 'employment' && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <InfoField icon={Briefcase} label="Employee ID" value={employee.employee_id} />
                  <InfoField icon={Briefcase} label="Status" value={employee.status} />
                  <InfoField
                    icon={Briefcase}
                    label="Position"
                    value={employee.position ? `${employee.position.title} (${employee.position.grade_band})` : '—'}
                  />
                  <InfoField
                    icon={Building2}
                    label="Department"
                    value={employee.position?.department_name || '—'}
                  />
                  <InfoField
                    icon={User}
                    label="Reporting Manager"
                    value={employee.reporting_manager?.full_name || '—'}
                  />
                  <InfoField
                    icon={MapPin}
                    label="Location"
                    value={employee.structure_location?.name || '—'}
                  />
                  <InfoField
                    icon={Calendar}
                    label="Date of Joining"
                    value={formatDate(employee.date_of_joining)}
                  />
                </div>
              )}

              {/* BANK TAB */}
              {activeTab === 'bank' && (
                <div>
                  <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3">
                    <p className="text-sm text-green-800">
                      🔒 Your bank & statutory details are encrypted and only visible to you and HR.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <InfoField label="Bank Account" value={employee.bank_account || '—'} />
                    <InfoField label="IFSC Code" value={employee.bank_ifsc_code || '—'} />
                    <InfoField label="PAN Number" value={employee.pan_number || '—'} />
                    <InfoField label="Aadhaar Number" value={employee.aadhaar_number || '—'} />
                    <InfoField label="UAN Number" value={employee.uan_number || '—'} />
                  </div>
                  <p className="mt-4 text-xs text-gray-500">
                    To update bank or statutory details, please contact HR.
                  </p>
                </div>
              )}

              {/* DOCUMENTS TAB */}
              {activeTab === 'documents' && (
                <DocumentsTab employeeId={employee.id} />
              )}
              {activeTab === 'career' && (
  <CareerHistoryTab employeeId={employee.id} />
)}
            </div>
          </div>
        </main>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </div>
  );
}

// ---------- Reusable Info Field ----------
interface InfoFieldProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  editable?: boolean;
}

function InfoField({ icon: Icon, label, value, editable }: InfoFieldProps) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-gray-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
        {editable && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 normal-case">
            editable
          </span>
        )}
      </p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}