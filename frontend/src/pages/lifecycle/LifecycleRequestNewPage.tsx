import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Info, AlertCircle } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { lifecycleRequestsApi } from '../../api/workflow';
import { employeesApi } from '../../api/employees';
import { positionsApi ,structuresApi} from '../../api/masterData';
import type { ChangeType } from '../../types/workflow';
import type { EmployeeDetail } from '../../types/employee';
import toast from 'react-hot-toast';

interface DropdownOption {
  id: string;
  label: string;
}

export default function LifecycleRequestNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedEmployeeId = searchParams.get('employee') || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dropdowns
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [positions, setPositions] = useState<DropdownOption[]>([]);
  const [locations, setLocations] = useState<DropdownOption[]>([]);
  const [managers, setManagers] = useState<any[]>([]);

  // Selected employee + current snapshot
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(preselectedEmployeeId);
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetail | null>(null);

  // Form state
  const [changeType, setChangeType] = useState<ChangeType>('PROMOTION');
  const [proposedPosition, setProposedPosition] = useState<string>('');
  const [proposedManager, setProposedManager] = useState<string>('');
  const [proposedLocation, setProposedLocation] = useState<string>('');
  const [proposedStatus, setProposedStatus] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  // ---------- Load all dropdown data once ----------
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [emps, pos, deps, mgrs] = await Promise.all([
  employeesApi.list({ page: 1 }),
  positionsApi.list(),
  structuresApi.list(),                        // ⬅ FIXED
  employeesApi.getManagers(),
]);
setAllEmployees(emps.results);
setPositions(
  pos.results.map((p: any) => ({               // ⬅ FIXED (.results)
    id: p.id,
    label: `${p.title} (${p.grade_band}) - ${p.department_name}`,
  }))
);
setLocations(
  deps.results                                  // ⬅ FIXED (.results)
    .filter((d: any) => d.is_active)
    .map((d: any) => ({
      id: d.id,
      label: `${d.name} (${d.type})`,
    }))
);
setManagers(mgrs);
      } catch (err) {
        toast.error('Failed to load dropdown data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ---------- Load selected employee details ----------
  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeDetail(null);
      return;
    }
    const fetchEmp = async () => {
      try {
        const data = await employeesApi.getById(selectedEmployeeId);
        setEmployeeDetail(data);
      } catch (err) {
        toast.error('Failed to load employee details');
      }
    };
    fetchEmp();
  }, [selectedEmployeeId]);

  // ---------- Change type presets ----------
  const changeTypeHint = useMemo(() => {
    switch (changeType) {
      case 'PROMOTION':
        return 'Change position to a higher grade with pay increase';
      case 'TRANSFER':
        return 'Move employee to a different department or location';
      case 'REDESIGNATION':
        return 'Change position title (typically same grade)';
      case 'MANAGER_CHANGE':
        return 'Change the reporting manager only';
      case 'CONFIRMATION':
        return 'Confirm employee from PROBATION → ACTIVE status';
      default:
        return '';
    }
  }, [changeType]);

  // Set default proposed status when change type = CONFIRMATION
  useEffect(() => {
    if (changeType === 'CONFIRMATION') {
      setProposedStatus('ACTIVE');
    } else {
      setProposedStatus('');
    }
  }, [changeType]);

  // ---------- Validation ----------
  const validate = (): string | null => {
    if (!selectedEmployeeId) return 'Please select an employee';
    if (!effectiveDate) return 'Effective date is required';
    if (!reason.trim() || reason.trim().length < 10)
      return 'Reason must be at least 10 characters';

    const hasChange =
      proposedPosition || proposedManager || proposedLocation || proposedStatus;
    if (!hasChange)
      return 'At least one proposed change (position/manager/location/status) is required';

    // Change type specific validation
    if (changeType === 'PROMOTION' && !proposedPosition)
      return 'Promotion requires a new position';
    if (changeType === 'TRANSFER' && !proposedLocation && !proposedPosition)
      return 'Transfer requires a new location or position';
    if (changeType === 'MANAGER_CHANGE' && !proposedManager)
      return 'Manager change requires a new manager';
    if (changeType === 'CONFIRMATION' && proposedStatus !== 'ACTIVE')
      return 'Confirmation must set status to ACTIVE';

    return null;
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employee: selectedEmployeeId,
        change_type: changeType,
        proposed_position: proposedPosition || null,
        proposed_manager: proposedManager || null,
        proposed_location: proposedLocation || null,
        proposed_status: proposedStatus || '',
        effective_date: effectiveDate,
        reason: reason.trim(),
      };
      const created = await lifecycleRequestsApi.create(payload);
      toast.success(`Request ${created.request_number} submitted for approval`);
      navigate(`/lifecycle-requests/${created.id}`);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        'Failed to create request';
      toast.error(detail);
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
              onClick={() => navigate('/lifecycle-requests')}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">
                New Lifecycle Request
              </h1>
              <p className="text-sm text-gray-500">
                Submit a change that will flow through the approval workflow
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-4xl space-y-4">
            {/* Employee + Change Type */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">
                Request Details
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    disabled={!!preselectedEmployeeId}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50"
                  >
                    <option value="">Select employee...</option>
                    {allEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                    Change Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={changeType}
                    onChange={(e) => setChangeType(e.target.value as ChangeType)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="PROMOTION">Promotion</option>
                    <option value="TRANSFER">Transfer</option>
                    <option value="REDESIGNATION">Re-designation</option>
                    <option value="MANAGER_CHANGE">Manager Change</option>
                    <option value="CONFIRMATION">Confirmation (Probation → Active)</option>
                  </select>
                </div>
              </div>
              <p className="mt-2 flex items-start gap-1 text-xs text-gray-500">
                <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                {changeTypeHint}
              </p>
            </div>

            {/* Current vs Proposed */}
            {employeeDetail && (
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">
                  Changes
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* CURRENT (read-only) */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-3 text-xs font-bold uppercase text-gray-500">
                      Current
                    </h3>
                    <FieldRow
                      label="Position"
                      value={
                        employeeDetail.position
                          ? `${employeeDetail.position.title} (${employeeDetail.position.grade_band})`
                          : '—'
                      }
                    />
                    <FieldRow
                      label="Department"
                      value={employeeDetail.position?.department_name || '—'}
                    />
                    <FieldRow
                      label="Reporting Manager"
                      value={employeeDetail.reporting_manager?.full_name || '—'}
                    />
                    <FieldRow
                      label="Location"
                      value={employeeDetail.structure_location?.name || '—'}
                    />
                    <FieldRow label="Status" value={employeeDetail.status} />
                  </div>

                  {/* PROPOSED */}
                  <div className="rounded-xl border-2 border-primary-200 bg-primary-50/40 p-4">
                    <h3 className="mb-3 text-xs font-bold uppercase text-primary-700">
                      Proposed
                    </h3>

                    <div className="space-y-3">
                      <SelectField
                        label="New Position"
                        value={proposedPosition}
                        onChange={setProposedPosition}
                        options={positions}
                        placeholder="— No change —"
                      />
                      <SelectField
                        label="New Reporting Manager"
                        value={proposedManager}
                        onChange={setProposedManager}
                        options={managers.map((m) => ({
                          id: m.id,
                          label: `${m.full_name} (${m.employee_id})`,
                        }))}
                        placeholder="— No change —"
                      />
                      <SelectField
                        label="New Location / Department"
                        value={proposedLocation}
                        onChange={setProposedLocation}
                        options={locations}
                        placeholder="— No change —"
                      />
                      <SelectField
                        label="New Status"
                        value={proposedStatus}
                        onChange={setProposedStatus}
                        options={[
                          { id: 'ACTIVE', label: 'Active' },
                          { id: 'PROBATION', label: 'Probation' },
                          { id: 'SUSPENDED', label: 'Suspended' },
                        ]}
                        placeholder="— No change —"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Effective Date + Reason */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                    Effective Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Reason / Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Explain the reason for this change (minimum 10 characters)..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  {reason.length}/500 characters
                </p>
              </div>
            </div>

            {/* Workflow Info Banner */}
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Approval Workflow</p>
                <p className="mt-1 text-amber-700">
                  This request will follow the configured Lifecycle approval
                  workflow. Approvers will be notified via email + in-app
                  notifications. Once fully approved, changes will be applied
                  automatically and a letter will be generated.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => navigate('/lifecycle-requests')}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !selectedEmployeeId}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Submit for Approval
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// HELPER COMPONENTS
// ==============================================================================

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex items-start justify-between border-b border-gray-200 pb-2 last:mb-0 last:border-0 last:pb-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="max-w-[60%] text-right text-sm text-gray-900">
        {value}
      </span>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}