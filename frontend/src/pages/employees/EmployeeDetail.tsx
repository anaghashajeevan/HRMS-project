import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Loader2, Mail, Phone, Calendar, Briefcase, MapPin, User, Building2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { employeesApi } from '../../api/employees';
import type { EmployeeDetail } from '../../types/employee';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import DocumentsTab from '../../components/DocumentsTab';
import AuditTrailTab from '../../components/AuditTrailTab';
import CareerHistoryTab from '../../components/CareerHistoryTab';

type TabKey = 'personal' | 'employment' | 'bank' | 'documents' | 'career' | 'audit';

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PROBATION: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  TERMINATED: 'bg-red-100 text-red-700',
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('personal');

  const isHRAdmin = user?.role_codes.includes('HR_ADMIN') || user?.role_codes.includes('SYSTEM_ADMIN');

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await employeesApi.getById(id);
        setEmployee(data);
      } catch {
        toast.error('Failed to load employee');
        navigate('/employees');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id, navigate]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
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
          {/* Back button */}
          <button
            onClick={() => navigate('/employees')}
            className="mb-4 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Employees
          </button>

          {/* Profile Header Card */}
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-600 text-2xl font-bold text-white">
                  {initials}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {employee.full_name}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {employee.employee_id}
                    {employee.position && ` • ${employee.position.title}`}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusStyles[employee.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {employee.status}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <Mail className="h-3.5 w-3.5" />
                      {employee.official_email}
                    </span>
                  </div>
                </div>
              </div>

              {isHRAdmin && (
                <button
                 onClick={() => navigate(`/employees/${employee.id}/edit`)}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="border-b border-gray-200">
              <nav className="flex gap-6 px-6">
 {[
  { key: 'personal', label: 'Personal' },
  { key: 'employment', label: 'Employment' },
  { key: 'bank', label: 'Bank & Statutory' },
  { key: 'documents', label: 'Documents' },
  { key: 'career', label: 'Career History' },
  ...(isHRAdmin ? [{ key: 'audit', label: 'Audit Trail' }] : []),
].map((tab) => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key as TabKey)}
      className={`border-b-2 py-3 text-sm font-medium transition ${
        activeTab === tab.key
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {tab.label}
    </button>
  ))}
</nav>
            </div>

            <div className="p-6">
              {activeTab === 'personal' && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <InfoField icon={User} label="First Name" value={employee.first_name} />
                  <InfoField icon={User} label="Last Name" value={employee.last_name} />
                  <InfoField icon={Calendar} label="Date of Birth" value={formatDate(employee.date_of_birth)} />
                  <InfoField icon={User} label="Gender" value={employee.gender || '—'} />
                  <InfoField icon={Mail} label="Official Email" value={employee.official_email} />
                  <InfoField icon={Mail} label="Personal Email" value={employee.personal_email || '—'} />
                  <InfoField icon={Phone} label="Phone Number" value={employee.phone_number} />
                </div>
              )}

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
                  <InfoField
                    icon={Calendar}
                    label="Date of Exit"
                    value={formatDate(employee.date_of_exit)}
                  />
                </div>
              )}

              {activeTab === 'bank' && (
                <div>
                  {!isHRAdmin && (
                    <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      🔒 Sensitive fields are masked. Only HR Admins can view full values.
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <InfoField label="Bank Account" value={employee.bank_account || '—'} />
                    <InfoField label="IFSC Code" value={employee.bank_ifsc_code || '—'} />
                    <InfoField label="PAN Number" value={employee.pan_number || '—'} />
                    <InfoField label="Aadhaar Number" value={employee.aadhaar_number || '—'} />
                    <InfoField label="UAN Number" value={employee.uan_number || '—'} />
                  </div>
                </div>
              )}
              {activeTab === 'documents' && (
  <DocumentsTab employeeId={employee.id} />
)}
{activeTab === 'career' && (
  <CareerHistoryTab employeeId={employee.id} />
)}
{activeTab === 'audit' && isHRAdmin && (
  <AuditTrailTab employeeId={employee.id} />
)}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------- Reusable Field Component ----------

interface InfoFieldProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function InfoField({ icon: Icon, label, value }: InfoFieldProps) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-gray-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}