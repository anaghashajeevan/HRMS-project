import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Check, ChevronDown, Clock3, Loader2, Plus, Settings2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { useAuth } from '../../context/AuthContext';
import { recruitmentApi, type HiringLocationOption, type HiringPositionOption, type HiringRequisition, type RecruitmentSettings, type ReplacementEmployeeOption } from '../../api/recruitment';

function isHr(user: { role_codes?: string[] } | null) {
  return Boolean(user?.role_codes?.some((role) => role === 'HR_ADMIN' || role === 'SYSTEM_ADMIN'));
}

function messageFor(error: any, fallback: string) {
  const data = error?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const first = Object.values(data).flat().find((value) => typeof value === 'string');
    if (first) return first as string;
  }
  return fallback;
}

export default function HiringRequisitionsPage() {
  const { user } = useAuth();
  const [requisitions, setRequisitions] = useState<HiringRequisition[]>([]);
  const [positions, setPositions] = useState<HiringPositionOption[]>([]);
  const [locations, setLocations] = useState<HiringLocationOption[]>([]);
  const [settings, setSettings] = useState<RecruitmentSettings | null>(null);
  const [replacementEmployees, setReplacementEmployees] = useState<ReplacementEmployeeOption[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    position: '', location: '', openings: '1', is_replacement: false,
    replacing_employee: '', reason: '', target_start_date: '',
  });

  const selectedPosition = positions.find((item) => item.id === form.position);
  const matchingReplacementEmployees = replacementEmployees.filter((employee) => employee.position_id === form.position);
  const roleCodes = user?.role_codes || [];
  const canManageRules = isHr(user);
  const canRequest = Boolean(settings && roleCodes.some((role) => settings.allowed_requester_roles.includes(role)));

  const loadPage = async () => {
    setLoading(true);
    try {
      const [reqs, options, rules] = await Promise.all([
        recruitmentApi.list(statusFilter || undefined),
        recruitmentApi.positionOptions(),
        recruitmentApi.settings(),
      ]);
      setRequisitions(reqs);
      setPositions(options.positions);
      setLocations(options.locations);
      setSettings(rules);
    } catch (error) {
      toast.error(messageFor(error, 'Could not load hiring requisitions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPage(); }, [statusFilter]);

  useEffect(() => {
    if (!form.is_replacement) {
      setReplacementEmployees([]);
      setForm((current) => ({ ...current, replacing_employee: '' }));
      recruitmentApi.positionOptions().then((result) => setPositions(result.positions)).catch(() => undefined);
      return;
    }
    recruitmentApi.replacementEmployees()
      .then(setReplacementEmployees)
      .catch(() => toast.error('Could not load active employees for replacement'));
  }, [form.is_replacement]);

  useEffect(() => {
    if (!form.is_replacement || !form.replacing_employee) return;
    recruitmentApi.positionOptions(form.replacing_employee)
      .then((result) => setPositions(result.positions))
      .catch(() => toast.error('Could not refresh replacement position capacity'));
  }, [form.is_replacement, form.replacing_employee]);

  const visibleRequisitions = useMemo(() => requisitions, [requisitions]);

  const closeForm = () => {
    setShowForm(false);
    setForm({ position: '', location: '', openings: '1', is_replacement: false, replacing_employee: '', reason: '', target_start_date: '' });
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPosition || !form.location) return;
    setSaving(true);
    try {
      const created = await recruitmentApi.create({
        department: selectedPosition.department_id,
        position: selectedPosition.id,
        grade_band: selectedPosition.grade_band,
        location: form.location,
        openings: Number(form.openings),
        is_replacement: form.is_replacement,
        replacing_employee: form.is_replacement ? form.replacing_employee || null : null,
        reason: form.reason.trim(),
        target_start_date: form.target_start_date,
      });
      toast.success(`Requisition ${created.requisition_number} sent for approval`);
      closeForm();
      await loadPage();
    } catch (error) {
      toast.error(messageFor(error, 'Could not submit the requisition'));
    } finally {
      setSaving(false);
    }
  };

  const approve = async (requisition: HiringRequisition) => {
    const comments = window.prompt(`Approve ${requisition.requisition_number}? Optional comments:`, '');
    if (comments === null) return;
    setActionId(requisition.id);
    try {
      const result = await recruitmentApi.approve(requisition.id, comments);
      toast.success(result.detail);
      await loadPage();
    } catch (error) {
      toast.error(messageFor(error, 'Could not approve this requisition'));
    } finally {
      setActionId(null);
    }
  };

  const reject = async (requisition: HiringRequisition) => {
    const reason = window.prompt(`Reject ${requisition.requisition_number}. Enter a reason:`);
    if (reason === null) return;
    if (reason.trim().length < 2) {
      toast.error('Enter a rejection reason');
      return;
    }
    setActionId(requisition.id);
    try {
      const result = await recruitmentApi.reject(requisition.id, reason.trim());
      toast.success(result.detail);
      await loadPage();
    } catch (error) {
      toast.error(messageFor(error, 'Could not reject this requisition'));
    } finally {
      setActionId(null);
    }
  };

  const cancel = async (requisition: HiringRequisition) => {
    if (!window.confirm(`Cancel ${requisition.requisition_number}? Its reserved openings will be released.`)) return;
    setActionId(requisition.id);
    try {
      const result = await recruitmentApi.cancel(requisition.id);
      toast.success(result.detail);
      await loadPage();
    } catch (error) {
      toast.error(messageFor(error, 'Could not cancel this requisition'));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-indigo-600">Recruitment · Stage 1</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">Hiring requisitions</h1>
              <p className="mt-1 text-sm text-gray-500">Request, approve, and reserve budgeted position openings.</p>
            </div>
            <div className="flex gap-2">
              {canManageRules && <Link to="/settings/recruitment" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Settings2 className="h-4 w-4" />Hiring rules</Link>}
              {canRequest && <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" />New requisition</button>}
            </div>
          </div>

          {showForm && (
            <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
              <form onSubmit={handleCreate} className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div><h2 className="text-xl font-bold text-gray-900">Request a hire</h2><p className="mt-1 text-sm text-gray-500">The selected openings are reserved while approval is pending.</p></div>
                  <button type="button" onClick={closeForm} aria-label="Close" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-gray-700 sm:col-span-2">Position
                    <select required value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value, replacing_employee: '' })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5">
                      <option value="">Choose an active position</option>
                      {positions.map((position) => <option key={position.id} value={position.id} disabled={position.available_openings < 1 && !form.is_replacement}>{position.title} · {position.grade_band} · {position.department_name} · {position.available_openings} available</option>)}
                    </select>
                    {selectedPosition && <span className="mt-1 block text-xs font-normal text-gray-500">Budget {selectedPosition.budgeted_count} · Filled {selectedPosition.filled_count} · Reserved {selectedPosition.reserved_openings}</span>}
                  </label>
                  <label className="text-sm font-medium text-gray-700">Openings
                    <input required type="number" min="1" max={selectedPosition?.available_openings || undefined} value={form.openings} onChange={(event) => setForm({ ...form, openings: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
                  </label>
                  <label className="text-sm font-medium text-gray-700">Target start date
                    <input required type="date" value={form.target_start_date} onChange={(event) => setForm({ ...form, target_start_date: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
                  </label>
                  <label className="text-sm font-medium text-gray-700 sm:col-span-2">Work location
                    <select required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"><option value="">Choose location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.type === 'HQ' ? ' · HQ' : ''}</option>)}</select>
                  </label>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.is_replacement} onChange={(event) => setForm({ ...form, is_replacement: event.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />This is a replacement hire</label>
                    {form.is_replacement && <select required value={form.replacing_employee} onChange={(event) => setForm({ ...form, replacing_employee: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"><option value="">{!form.position ? 'Choose a position first' : matchingReplacementEmployees.length ? 'Choose employee being replaced' : 'No employees assigned to this position'}</option>{matchingReplacementEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_id}</option>)}</select>}
                  </div>
                  <label className="text-sm font-medium text-gray-700 sm:col-span-2">Business reason
                    <textarea required minLength={10} rows={4} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Explain why the role is needed and the expected impact." className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
                  </label>
                </div>
                <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                  <button type="button" onClick={closeForm} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                  <button disabled={saving || !selectedPosition || selectedPosition.available_openings < Number(form.openings)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Submit for approval</button>
                </div>
              </form>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">{visibleRequisitions.length} requisition{visibleRequisitions.length === 1 ? '' : 's'}</p>
            <label className="flex items-center gap-2 text-sm text-gray-600">Status <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2"><option value="">All</option><option value="PENDING_APPROVAL">Pending approval</option><option value="APPROVED">Approved</option><option value="FILLED">Filled</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option></select></label>
          </div>

          {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div> : visibleRequisitions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center"><BriefcaseBusiness className="mx-auto h-10 w-10 text-gray-300" /><h2 className="mt-3 font-semibold text-gray-900">No requisitions found</h2><p className="mt-1 text-sm text-gray-500">Create a request once an active position and approval workflow are configured.</p></div>
          ) : <div className="space-y-4">{visibleRequisitions.map((requisition) => {
            const myPendingAction = requisition.approval_actions.find((action) => action.assigned_to === user?.employee?.id && action.status === 'PENDING');
            const canCancel = canManageRules || requisition.requested_by === user?.employee?.id;
            return <article key={requisition.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-gray-900">{requisition.requisition_number}</h2><StatusBadge status={requisition.status} /></div><p className="mt-1 text-sm text-gray-600">{requisition.position_title} · {requisition.grade_band} · {requisition.department_name}</p></div>
                <div className="text-right text-sm text-gray-500"><p>{requisition.openings} opening{requisition.openings === 1 ? '' : 's'}</p><p>Start by {new Date(`${requisition.target_start_date}T00:00:00`).toLocaleDateString()}</p></div>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <Info label="Requested by" value={requisition.requested_by_name} />
                <Info label="Location" value={requisition.location_name} />
                <Info label="Budget at request" value={`${requisition.filled_count_at_request} filled / ${requisition.budgeted_count_at_request} budgeted`} />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{requisition.reason}</p>
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500"><Clock3 className="h-3.5 w-3.5" />Approval progress</p>
                <div className="flex flex-wrap gap-2">{requisition.workflow_steps_snapshot.map((step) => {
                  const actions = requisition.approval_actions.filter((action) => action.step_number === step.step_number);
                  const state = actions.some((action) => action.status === 'REJECTED') ? 'Rejected' : actions.length && actions.every((action) => action.status === 'APPROVED') ? 'Approved' : actions.some((action) => action.status === 'PENDING') ? 'Pending' : 'Waiting';
                  return <div key={step.step_number} className="min-w-36 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"><p className="text-xs font-semibold text-gray-800">{step.step_number}. {step.step_name}</p><p className="mt-1 text-xs text-gray-500">{state}{actions.length ? ` · ${actions.map((action) => action.assigned_to_name).join(', ')}` : ''}</p></div>;
                })}</div>
              </div>
              {requisition.status === 'REJECTED' && requisition.rejection_reason && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">Rejected: {requisition.rejection_reason}</p>}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {myPendingAction && <><button disabled={actionId === requisition.id} onClick={() => void reject(requisition)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><X className="h-4 w-4" />Reject</button><button disabled={actionId === requisition.id} onClick={() => void approve(requisition)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check className="h-4 w-4" />Approve</button></>}
                {canCancel && ['PENDING_APPROVAL', 'APPROVED'].includes(requisition.status) && <button disabled={actionId === requisition.id} onClick={() => void cancel(requisition)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-50">Cancel requisition</button>}
              </div>
            </article>;
          })}</div>}
        </main>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-gray-400">{label}</p><p className="mt-0.5 font-medium text-gray-700">{value}</p></div>;
}

function StatusBadge({ status }: { status: HiringRequisition['status'] }) {
  const styles: Record<HiringRequisition['status'], string> = {
    PENDING_APPROVAL: 'bg-amber-50 text-amber-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    FILLED: 'bg-blue-50 text-blue-700',
    REJECTED: 'bg-red-50 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };
  const labels: Record<HiringRequisition['status'], string> = {
    PENDING_APPROVAL: 'Pending approval', APPROVED: 'Approved', FILLED: 'Filled', REJECTED: 'Rejected', CANCELLED: 'Cancelled',
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}<ChevronDown className="ml-1 inline h-3 w-3" /></span>;
}
