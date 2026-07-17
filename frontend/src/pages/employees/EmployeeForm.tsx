import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, User, Briefcase, Landmark, UserPlus, Eye, EyeOff } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { employeesApi, type EmployeeCreatePayload } from '../../api/employees';
import { structuresApi, positionsApi, rolesApi } from '../../api/masterData';
import type { CompanyStructure, JobPosition, Role } from '../../types/masterData';
import type { ManagerOption } from '../../api/employees';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

const initialForm: EmployeeCreatePayload = {
  first_name: '',
  last_name: '',
  official_email: '',
  personal_email: '',
  phone_number: '',
  date_of_birth: '',
  gender: 'MALE',
  status: 'PROBATION',
  position: null,
  reporting_manager: null,
  structure_location: null,
  date_of_joining: '',
  date_of_exit: null,
  bank_account_encrypted: '',
  bank_ifsc_code: '',
  pan_number_encrypted: '',
  aadhaar_number_encrypted: '',
  uan_number_encrypted: '',
  create_user_account: false,
  password: '',
  role_ids: [],
};

export default function EmployeeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [form, setForm] = useState<EmployeeCreatePayload>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  // Master data
  const [departments, setDepartments] = useState<CompanyStructure[]>([]);
  const [hasExistingAccount, setHasExistingAccount] = useState(false);
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Load master data + employee (if editing)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [deptData, posData, mgrData, roleData] = await Promise.all([
          structuresApi.list({ type: 'DEPARTMENT' }),
          positionsApi.list(),
          employeesApi.getManagers(),
          rolesApi.list(),
        ]);
        setDepartments(deptData.results);
        setPositions(posData.results);
        setManagers(mgrData);
        setRoles(roleData.results);

        if (isEditMode && id) {
          const emp = await employeesApi.getById(id);
          setForm({
            first_name: emp.first_name,
            last_name: emp.last_name,
            official_email: emp.official_email,
            personal_email: emp.personal_email || '',
            phone_number: emp.phone_number,
            date_of_birth: emp.date_of_birth,
            gender: emp.gender || 'MALE',
            status: emp.status,
            position: emp.position?.id || null,
            reporting_manager: emp.reporting_manager?.id || null,
            structure_location: emp.structure_location?.id || null,
            date_of_joining: emp.date_of_joining,
            date_of_exit: emp.date_of_exit,
            bank_ifsc_code: emp.bank_ifsc_code || '',
          });
          setHasExistingAccount(emp.has_user_account);
        }
      } catch {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, isEditMode]);

  const update = <K extends keyof EmployeeCreatePayload>(key: K, value: EmployeeCreatePayload[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors({ ...errors, [key]: '' });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.first_name.trim()) errs.first_name = 'Required';
    if (!form.last_name.trim()) errs.last_name = 'Required';
    if (!form.official_email.trim()) errs.official_email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.official_email)) errs.official_email = 'Invalid email';
    if (!form.phone_number.trim()) errs.phone_number = 'Required';
    if (!form.date_of_birth) errs.date_of_birth = 'Required';
    if (!form.date_of_joining) errs.date_of_joining = 'Required';
    if (form.create_user_account && !isEditMode && (!form.password || form.password.length < 8)) {
      errs.password = 'Password must be at least 8 characters';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors below');
      return;
    }

    setSaving(true);
    try {
      // Clean payload — remove empty strings for optional fields
      const payload: EmployeeCreatePayload = {
        ...form,
        personal_email: form.personal_email || undefined,
        position: form.position || null,
        reporting_manager: form.reporting_manager || null,
        structure_location: form.structure_location || null,
        date_of_exit: form.date_of_exit || null,
      };
      if (!form.create_user_account) {
        delete payload.password;
        delete payload.role_ids;
        delete payload.create_user_account;
}
      if (isEditMode && id) {
  // Keep create_user_account/password/role_ids ONLY if creating account now
  if (!form.create_user_account) {
    delete payload.create_user_account;
    delete payload.password;
    delete payload.role_ids;
  }
  await employeesApi.update(id, payload);
  toast.success(
    form.create_user_account
      ? 'Employee updated and login account created'
      : 'Employee updated'
  );
  navigate(`/employees/${id}`);
} else {
        const emp = await employeesApi.create(payload);
        toast.success(`Employee ${emp.employee_id} created`);
        navigate(`/employees/${emp.id}`);
      }
    } catch (err) {
      const error = err as AxiosError<Record<string, string[] | string>>;
      const data = error.response?.data;
      if (data && typeof data === 'object') {
        const newErrors: Record<string, string> = {};
        Object.entries(data).forEach(([key, val]) => {
          newErrors[key] = Array.isArray(val) ? val[0] : String(val);
        });
        setErrors(newErrors);
      }
      toast.error('Failed to save employee');
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
          <button
            onClick={() => navigate(isEditMode ? `/employees/${id}` : '/employees')}
            className="mb-4 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'Edit Employee' : 'Add New Employee'}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {isEditMode
                ? 'Update employee details'
                : 'Fill in the details. Employee ID will be auto-generated.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
            {/* Personal Info */}
            <SectionCard icon={User} title="Personal Information">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="First Name *" error={errors.first_name}>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => update('first_name', e.target.value)}
                    className={inputCls(errors.first_name)}
                  />
                </Field>
                <Field label="Last Name *" error={errors.last_name}>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => update('last_name', e.target.value)}
                    className={inputCls(errors.last_name)}
                  />
                </Field>
                <Field label="Official Email *" error={errors.official_email}>
                  <input
                    type="email"
                    value={form.official_email}
                    onChange={(e) => update('official_email', e.target.value)}
                    className={inputCls(errors.official_email)}
                  />
                </Field>
                <Field label="Personal Email" error={errors.personal_email}>
                  <input
                    type="email"
                    value={form.personal_email || ''}
                    onChange={(e) => update('personal_email', e.target.value)}
                    className={inputCls(errors.personal_email)}
                  />
                </Field>
                <Field label="Phone Number *" error={errors.phone_number}>
                  <input
                    type="tel"
                    value={form.phone_number}
                    onChange={(e) => update('phone_number', e.target.value)}
                    placeholder="+91 98765 43210"
                    className={inputCls(errors.phone_number)}
                  />
                </Field>
                <Field label="Date of Birth *" error={errors.date_of_birth}>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => update('date_of_birth', e.target.value)}
                    className={inputCls(errors.date_of_birth)}
                  />
                </Field>
                <Field label="Gender">
                  <select
                    value={form.gender || 'MALE'}
                    onChange={(e) => update('gender', e.target.value)}
                    className={inputCls()}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
              </div>
            </SectionCard>

            {/* Employment Info */}
            <SectionCard icon={Briefcase} title="Employment Details">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Date of Joining *" error={errors.date_of_joining}>
                  <input
                    type="date"
                    value={form.date_of_joining}
                    onChange={(e) => update('date_of_joining', e.target.value)}
                    className={inputCls(errors.date_of_joining)}
                  />
                </Field>
                <Field label="Status">
                  <select
                    value={form.status || 'PROBATION'}
                    onChange={(e) => update('status', e.target.value)}
                    className={inputCls()}
                  >
                    <option value="PROBATION">Probation</option>
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="TERMINATED">Terminated</option>
                  </select>
                </Field>
                <Field label="Department / Location">
                  <select
                    value={form.structure_location || ''}
                    onChange={(e) => update('structure_location', e.target.value || null)}
                    className={inputCls()}
                  >
                    <option value="">— None —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Position">
                  <select
                    value={form.position || ''}
                    onChange={(e) => update('position', e.target.value || null)}
                    className={inputCls()}
                  >
                    <option value="">— None —</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.grade_band}) — {p.department_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reporting Manager">
                  <select
                    value={form.reporting_manager || ''}
                    onChange={(e) => update('reporting_manager', e.target.value || null)}
                    className={inputCls()}
                  >
                    <option value="">— None —</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.employee_id})
                      </option>
                    ))}
                  </select>
                </Field>
                {isEditMode && (
                  <Field label="Date of Exit">
                    <input
                      type="date"
                      value={form.date_of_exit || ''}
                      onChange={(e) => update('date_of_exit', e.target.value || null)}
                      className={inputCls()}
                    />
                  </Field>
                )}
              </div>
            </SectionCard>

            {/* Bank / Statutory */}
            <SectionCard icon={Landmark} title="Bank & Statutory (Optional)">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Bank Account Number">
                  <input
                    type="text"
                    value={form.bank_account_encrypted || ''}
                    onChange={(e) => update('bank_account_encrypted', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
                <Field label="IFSC Code">
                  <input
                    type="text"
                    value={form.bank_ifsc_code || ''}
                    onChange={(e) => update('bank_ifsc_code', e.target.value.toUpperCase())}
                    className={inputCls()}
                  />
                </Field>
                <Field label="PAN Number">
                  <input
                    type="text"
                    value={form.pan_number_encrypted || ''}
                    onChange={(e) => update('pan_number_encrypted', e.target.value.toUpperCase())}
                    className={inputCls()}
                  />
                </Field>
                <Field label="Aadhaar Number">
                  <input
                    type="text"
                    value={form.aadhaar_number_encrypted || ''}
                    onChange={(e) => update('aadhaar_number_encrypted', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
                <Field label="UAN Number">
                  <input
                    type="text"
                    value={form.uan_number_encrypted || ''}
                    onChange={(e) => update('uan_number_encrypted', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Create User Account (only on new employee) */}
            {/* Create User Account — show on new employee, OR on edit if no account exists */}
{(!isEditMode || (isEditMode && !hasExistingAccount)) && (
  <SectionCard icon={UserPlus} title="Login Account (Optional)">
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={form.create_user_account || false}
        onChange={(e) => update('create_user_account', e.target.checked)}
        className="h-4 w-4 rounded"
      />
      Create login account for this employee
    </label>

    {isEditMode && !hasExistingAccount && (
      <p className="mt-2 text-xs text-gray-500">
        💡 This employee doesn't have a login account yet. Check the box above to create one.
      </p>
    )}

    {form.create_user_account && (
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Password *" error={errors.password}>
  <div className="relative">
    <input
      type={showPassword ? 'text' : 'password'}
      value={form.password || ''}
      onChange={(e) => update('password', e.target.value)}
      placeholder="Min 8 characters"
      className={inputCls(errors.password) + ' pr-10'}
    />
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      tabIndex={-1}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>
</Field>
        <Field label="Roles">
          <div className="mt-1 space-y-1">
            {roles.filter((r) => r.is_active).map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.role_ids?.includes(r.id) || false}
                  onChange={(e) => {
                    const current = form.role_ids || [];
                    if (e.target.checked) {
                      update('role_ids', [...current, r.id]);
                    } else {
                      update('role_ids', current.filter((x) => x !== r.id));
                    }
                  }}
                  className="h-4 w-4 rounded"
                />
                {r.role_name}
              </label>
            ))}
          </div>
        </Field>
      </div>
    )}
  </SectionCard>
)}

{/* Show existing account info in edit mode */}
{isEditMode && hasExistingAccount && (
  <SectionCard icon={UserPlus} title="Login Account">
    <div className="rounded-lg bg-green-50 border border-green-200 p-3">
      <p className="text-sm text-green-800">
        ✅ This employee already has a login account.
      </p>
    </div>
  </SectionCard>
)}

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate(isEditMode ? `/employees/${id}` : '/employees')}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEditMode ? 'Update Employee' : 'Create Employee'}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

// ---------- Helper Components ----------

interface SectionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}

function SectionCard({ icon: Icon, title, children }: SectionCardProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputCls(error?: string) {
  const base = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2';
  const state = error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-100';
  return `${base} ${state}`;
}