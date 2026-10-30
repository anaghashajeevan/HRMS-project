import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { addEmployeeExitClearanceItem, checkEmployeeExitReadiness, createEmployeeExitFNFRun, createEmployeeExitRequest, decideEmployeeExitRequest, getEmployeeExitClearance, getEmployeeExitDocumentStatus, getEmployeeExitRequests, getExitEligibleEmployees, issueEmployeeExitDocument, previewEmployeeExitEncashment, previewEmployeeExitFullFinal, updateEmployeeExitClearanceItem } from '../../../api/payrollApi';
import { useAuth } from '../../../context/AuthContext';
import SearchableSelect from '../../../components/SearchableSelect';

type ExitRow = {
  id: string; employee: string; employee_name: string; employee_code: string;
  proposed_exit_date: string; exit_type: string; reason: string; status: string;
  current_step_number: number; requested_by_name: string; approved_at?: string;
  rejection_reason?: string; frozen_snapshot: Record<string, unknown>; can_decide: boolean;
  fnf_run?: { id: string; status: string; run_type: string } | null;
  approval_actions: Array<{ step_number: number; step_name: string; assigned_to_name: string; status: string; comments: string }>;
};

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';

export default function EmployeeExitsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canInitiate = Boolean(user?.role_codes?.some(role => ['HR_ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'REPORTING_MANAGER'].includes(role)));
  const isPayrollAdmin = Boolean(user?.role_codes?.some(role => ['HR_ADMIN', 'SYSTEM_ADMIN'].includes(role)));
  const [approvalRows, setApprovalRows] = useState<ExitRow[]>([]);
  const [myRows, setMyRows] = useState<ExitRow[]>([]);
  const [approvedRows, setApprovedRows] = useState<ExitRow[]>([]);
  const [activeView, setActiveView] = useState<'approvals' | 'mine' | 'approved' | 'new'>('approvals');
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [encashment, setEncashment] = useState<Record<string, any>>({});
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Record<string, any>>({});
  const [fullFinal, setFullFinal] = useState<Record<string, any>>({});
  const [previewingFullFinal, setPreviewingFullFinal] = useState<string | null>(null);
  const [clearance, setClearance] = useState<Record<string, any>>({});
  const [clearanceLoading, setClearanceLoading] = useState<string | null>(null);
  const [handoverForms, setHandoverForms] = useState<Record<string, any>>({});
  const [exitDocuments, setExitDocuments] = useState<Record<string, any>>({});
  const [exitDocumentsLoading, setExitDocumentsLoading] = useState<string | null>(null);
  const [issuingExitDocument, setIssuingExitDocument] = useState<string | null>(null);
  const [form, setForm] = useState({ employee: '', proposed_exit_date: '', exit_type: 'RESIGNATION', reason: '', notice_period_days: '', notice_served_days: '', recovery_notes: '', recovery_amount: '', other_dues_amount: '', other_dues_notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [approvalResult, myResult, approvedResult, people] = await Promise.all([
        getEmployeeExitRequests('approvals'),
        canInitiate ? getEmployeeExitRequests('mine') : Promise.resolve({ data: [] }),
        isPayrollAdmin ? getEmployeeExitRequests('approved') : Promise.resolve({ data: [] }),
        canInitiate ? getExitEligibleEmployees() : Promise.resolve({ data: [] }),
      ]);
      setApprovalRows(approvalResult.data.results || approvalResult.data);
      setMyRows(myResult.data.results || myResult.data);
      setApprovedRows(approvedResult.data.results || approvedResult.data);
      setEmployees(people.data);
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not load employee exits.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [canInitiate, isPayrollAdmin]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createEmployeeExitRequest({
        employee: form.employee,
        proposed_exit_date: form.proposed_exit_date,
        exit_type: form.exit_type,
        reason: form.reason,
        settlement_inputs: {
          notice_period_days: form.notice_period_days ? Number(form.notice_period_days) : null,
          notice_served_days: form.notice_served_days ? Number(form.notice_served_days) : null,
          recovery_notes: form.recovery_notes,
          recovery_amount: form.recovery_amount ? Number(form.recovery_amount) : 0,
          other_dues_amount: form.other_dues_amount ? Number(form.other_dues_amount) : 0,
          other_dues_notes: form.other_dues_notes,
        },
      });
      toast.success('Exit request submitted for approval.');
      setForm({ employee: '', proposed_exit_date: '', exit_type: 'RESIGNATION', reason: '', notice_period_days: '', notice_served_days: '', recovery_notes: '', recovery_amount: '', other_dues_amount: '', other_dues_notes: '' });
      setActiveView('mine');
      await load();
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not submit exit request.'); }
    finally { setSaving(false); }
  };

  const decide = async (row: ExitRow, decision: 'approve' | 'reject') => {
    const comments = window.prompt(decision === 'reject' ? 'Reason for rejection (required):' : 'Approval comments (optional):');
    if (comments === null) return;
    try {
      await decideEmployeeExitRequest(row.id, decision, comments);
      toast.success(decision === 'approve' ? 'Approval recorded.' : 'Exit request rejected.');
      await load();
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not process this decision.'); }
  };

  const previewEncashment = async (row: ExitRow) => {
    setPreviewing(row.id);
    try {
      const result = await previewEmployeeExitEncashment(row.id);
      setEncashment(current => ({ ...current, [row.id]: result.data }));
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not calculate encashment preview.'); }
    finally { setPreviewing(null); }
  };

  const checkReadiness = async (row: ExitRow) => {
    setCheckingReadiness(row.id);
    try {
      const result = await checkEmployeeExitReadiness(row.id);
      setReadiness(current => ({ ...current, [row.id]: result.data }));
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not check exit readiness.'); }
    finally { setCheckingReadiness(null); }
  };

  const reviewFullFinal = async (row: ExitRow) => {
    setPreviewingFullFinal(row.id);
    try {
      const result = await previewEmployeeExitFullFinal(row.id);
      setFullFinal(current => ({ ...current, [row.id]: result.data }));
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not calculate the F&F review.'); }
    finally { setPreviewingFullFinal(null); }
  };

  const createFNFRun = async (row: ExitRow) => {
    if (!window.confirm(`Create the single-employee F&F payroll run for ${row.employee_name}? The run will enter the payroll review and approval workflow.`)) return;
    setPreviewingFullFinal(row.id);
    try {
      const result = await createEmployeeExitFNFRun(row.id);
      toast.success('F&F payroll run created. Continue in the payroll run workflow.');
      navigate(`/payroll/runs/${result.data.id}`);
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not create the F&F payroll run.'); }
    finally { setPreviewingFullFinal(null); }
  };

  const loadClearance = async (row: ExitRow) => {
    setClearanceLoading(row.id);
    try {
      const response = await getEmployeeExitClearance(row.id);
      setClearance(current => ({ ...current, [row.id]: response.data }));
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not load exit clearance.'); }
    finally { setClearanceLoading(null); }
  };

  const addHandover = async (row: ExitRow) => {
    const values = handoverForms[row.id] || {};
    if (!String(values.title || '').trim()) { toast.error('Enter a handover task title.'); return; }
    try {
      const response = await addEmployeeExitClearanceItem(row.id, values);
      setClearance(current => ({ ...current, [row.id]: response.data }));
      setHandoverForms(current => ({ ...current, [row.id]: {} }));
      toast.success('Clearance task added.');
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not add the clearance task.'); }
  };

  const resolveClearance = async (row: ExitRow, item: any, action: 'complete' | 'waive' | 'reopen') => {
    const reason = action === 'waive'
      ? window.prompt(`Reason for exception: ${item.title}`)
      : action === 'complete' ? (window.prompt(`Completion note for: ${item.title}`, '') ?? null) : '';
    if (reason === null) return;
    try {
      const response = await updateEmployeeExitClearanceItem(row.id, item.id, { action, reason });
      setClearance(current => ({ ...current, [row.id]: response.data }));
      toast.success(action === 'waive' ? 'Reasoned exception recorded.' : action === 'complete' ? 'Task marked complete.' : 'Task reopened.');
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not update this clearance task.'); }
  };

  const loadExitDocuments = async (row: ExitRow) => {
    setExitDocumentsLoading(row.id);
    try {
      const response = await getEmployeeExitDocumentStatus(row.id);
      setExitDocuments(current => ({ ...current, [row.id]: response.data }));
    } catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not load exit document eligibility.'); }
    finally { setExitDocumentsLoading(null); }
  };

  const issueExitDocument = async (row: ExitRow, documentType: string, label: string) => {
    if (!window.confirm(`Issue ${label} for ${row.employee_name}? The issued PDF will be available in the employee's Profile > Exit Documents.`)) return;
    setIssuingExitDocument(`${row.id}:${documentType}`);
    try {
      await issueEmployeeExitDocument(row.id, documentType);
      toast.success(`${label} issued and added to the employee profile.`);
      await loadExitDocuments(row);
    } catch (error: any) { toast.error(error?.response?.data?.detail || `Could not issue ${label.toLowerCase()}.`); }
    finally { setIssuingExitDocument(null); }
  };

  const rows = activeView === 'mine' ? myRows : activeView === 'approved' ? approvedRows : approvalRows;

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold text-gray-900">Employee Exits</h1><p className="mt-1 text-sm text-gray-500">Review exits assigned to you, track your submissions, or start a request.</p></header>

    <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-3" aria-label="Employee exit sections">
      <button onClick={() => setActiveView('approvals')} className={`rounded-lg px-4 py-2 text-sm font-medium ${activeView === 'approvals' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}>Pending approvals <span className="ml-1 opacity-80">({approvalRows.length})</span></button>
      {canInitiate && <button onClick={() => setActiveView('mine')} className={`rounded-lg px-4 py-2 text-sm font-medium ${activeView === 'mine' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}>My requests <span className="ml-1 opacity-80">({myRows.length})</span></button>}
      {isPayrollAdmin && <button onClick={() => setActiveView('approved')} className={`rounded-lg px-4 py-2 text-sm font-medium ${activeView === 'approved' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}>Approved exits <span className="ml-1 opacity-80">({approvedRows.length})</span></button>}
      {canInitiate && <button onClick={() => setActiveView('new')} className={`rounded-lg px-4 py-2 text-sm font-medium ${activeView === 'new' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}>New exit request</button>}
    </nav>

    {canInitiate && activeView === 'new' && <form onSubmit={submit} className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 md:grid-cols-2">
      <h2 className="md:col-span-2 text-base font-semibold text-gray-900">New exit request</h2>
      <label className="text-sm text-gray-700">Employee<SearchableSelect className={`${inputClass} mt-1`} required disabled={loading || employees.length === 0} value={form.employee} placeholder={loading ? 'Loading employees…' : employees.length ? 'Search employee ID or name…' : 'No eligible employees found'} options={employees.map(person => ({ value: person.id, label: `${person.employee_id} — ${person.full_name}` }))} noOptionsMessage="No eligible employees match your search." onChange={employee => setForm(current => ({ ...current, employee }))} />{!loading && employees.length === 0 && <span className="mt-1 block text-xs text-amber-700">Only active or probationary employees are available. Managers see their direct reports.</span>}</label>
      <label className="text-sm text-gray-700">Proposed last working date<input className={`${inputClass} mt-1`} required type="date" value={form.proposed_exit_date} onChange={e => setForm({ ...form, proposed_exit_date: e.target.value })} /></label>
      <label className="text-sm text-gray-700">Exit type<select className={`${inputClass} mt-1`} value={form.exit_type} onChange={e => setForm({ ...form, exit_type: e.target.value })}>{['RESIGNATION', 'RETIREMENT', 'TERMINATION', 'CONTRACT_END', 'OTHER'].map(type => <option key={type}>{type}</option>)}</select></label>
      <label className="text-sm text-gray-700">Reason<textarea className={`${inputClass} mt-1`} rows={2} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></label>
      <label className="text-sm text-gray-700">Notice period (days)<input className={`${inputClass} mt-1`} type="number" min="0" value={form.notice_period_days} onChange={e => setForm({ ...form, notice_period_days: e.target.value })} /></label>
      <label className="text-sm text-gray-700">Notice served (days)<input className={`${inputClass} mt-1`} type="number" min="0" value={form.notice_served_days} onChange={e => setForm({ ...form, notice_served_days: e.target.value })} /></label>
      <label className="text-sm text-gray-700">Recovery amount (₹)<input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={form.recovery_amount} onChange={e => setForm({ ...form, recovery_amount: e.target.value })} /></label>
      <label className="text-sm text-gray-700">Recovery reason<textarea className={`${inputClass} mt-1`} rows={2} value={form.recovery_notes} onChange={e => setForm({ ...form, recovery_notes: e.target.value })} /></label>
      <label className="text-sm text-gray-700">Other dues amount (₹)<input className={`${inputClass} mt-1`} type="number" min="0" step="0.01" value={form.other_dues_amount} onChange={e => setForm({ ...form, other_dues_amount: e.target.value })} /></label>
      <label className="text-sm text-gray-700">Other dues notes<textarea className={`${inputClass} mt-1`} rows={2} value={form.other_dues_notes} onChange={e => setForm({ ...form, other_dues_notes: e.target.value })} /></label>
      <div className="md:col-span-2 flex justify-end"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit for approval'}</button></div>
    </form>}

    {activeView !== 'new' && <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="border-b px-5 py-4"><h2 className="font-semibold text-gray-900">{activeView === 'mine' ? 'My submitted requests' : activeView === 'approved' ? 'Approved exits' : 'Approvals assigned to me'}</h2><p className="mt-1 text-sm text-gray-500">{activeView === 'mine' ? 'Only requests you submitted appear here.' : activeView === 'approved' ? 'Approved exit cases ready for settlement preparation.' : 'Only requests awaiting your approval appear here.'}</p></div>
      {loading ? <p className="p-5 text-sm text-gray-500">Loading…</p> : rows.length === 0 ? <p className="p-5 text-sm text-gray-500">{activeView === 'mine' ? 'You have not submitted any exit requests.' : activeView === 'approved' ? 'There are no approved exits ready for settlement.' : 'No exit requests are currently assigned to you.'}</p> : <div className="divide-y">{rows.map(row => <article key={row.id} className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-gray-900">{row.employee_name} <span className="font-normal text-gray-500">({row.employee_code})</span></h3><p className="text-sm text-gray-600">{row.exit_type} · Last working date: {row.proposed_exit_date}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{row.can_decide ? 'Needs your approval' : activeView === 'mine' && row.status === 'PENDING_APPROVAL' ? 'Awaiting approver' : row.status.replaceAll('_', ' ')}</span></div>
        {row.reason && <p className="text-sm text-gray-600">{row.reason}</p>}
        <div className="flex flex-wrap gap-2">{row.approval_actions.map((action, index) => <span key={`${action.step_number}-${index}`} className="rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600">Step {action.step_number}: {action.step_name} — {action.assigned_to_name} ({action.status.toLowerCase()})</span>)}</div>
        {row.can_decide && <div className="flex gap-2"><button onClick={() => void decide(row, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">Approve</button><button onClick={() => void decide(row, 'reject')} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700">Reject</button></div>}
        {row.can_decide && <button onClick={() => void checkReadiness(row)} disabled={checkingReadiness === row.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50">{checkingReadiness === row.id ? 'Checking…' : 'Check leave and payroll readiness'}</button>}
        {readiness[row.id] && <div className={`rounded-lg p-3 text-sm ${readiness[row.id].can_approve ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
          <p className="font-medium">{readiness[row.id].can_approve ? 'Ready for final exit approval.' : 'Resolve these items before final exit approval:'}</p>
          {readiness[row.id].findings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{readiness[row.id].findings.map((finding: any, index: number) => <li key={`${finding.code}-${finding.record_id}-${index}`}>{finding.description}</li>)}</ul>}
        </div>}
        {row.status === 'APPROVED' && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Exit date recorded and request inputs frozen for settlement.</div>}
        {row.status === 'APPROVED' && isPayrollAdmin && <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h4 className="font-semibold text-gray-900">Stage 2 · Exit clearance</h4><p className="text-xs text-gray-600">Assets, reimbursements, and manual work handover. Pending tasks must be completed or exceptionally waived before F&F run creation.</p></div>
            <button onClick={() => void loadClearance(row)} disabled={clearanceLoading === row.id} className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700">{clearanceLoading === row.id ? 'Loading…' : clearance[row.id] ? 'Refresh checklist' : 'Open checklist'}</button>
          </div>
          {clearance[row.id] && <>
            <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">Pending {clearance[row.id].summary.pending}</span><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-900">Completed {clearance[row.id].summary.completed}</span><span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-900">Exceptions {clearance[row.id].summary.exceptions}</span><span className={`rounded-full px-2.5 py-1 ${clearance[row.id].summary.ready_for_settlement ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{clearance[row.id].summary.ready_for_settlement ? 'Ready for F&F' : 'Clearance required'}</span></div>
            <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h5 className="text-sm font-medium text-gray-800">Leave and payroll validation</h5><p className="text-xs text-gray-500">Check pending leave and unfinished payroll activity against the approved snapshot.</p></div><button onClick={() => void checkReadiness(row)} disabled={checkingReadiness === row.id} className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">{checkingReadiness === row.id ? 'Checking…' : 'Validate now'}</button></div>{readiness[row.id] && <div className={`mt-2 rounded-md p-2 text-xs ${readiness[row.id].can_approve ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}><p className="font-medium">{readiness[row.id].can_approve ? 'No pending leave or payroll blockers.' : 'Resolve these blockers before F&F:'}</p>{readiness[row.id].findings?.map((finding: any, index: number) => <p key={`${finding.code}-${index}`} className="mt-1">• {finding.description}</p>)}</div>}</div>
            {clearance[row.id].items.length === 0 ? <p className="mt-3 text-sm text-gray-600">No outstanding asset or reimbursement items were found. Add work handover tasks below if needed.</p> : <div className="mt-3 space-y-2">{clearance[row.id].items.map((item: any) => <article key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase text-indigo-700">{item.category.replaceAll('_', ' ')}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{item.status.replaceAll('_', ' ')}</span></div><h5 className="mt-1 text-sm font-medium text-gray-900">{item.title}</h5>{item.description && <p className="mt-1 text-xs text-gray-600">{item.description}</p>}<p className="mt-1 text-xs text-gray-500">Responsible: {item.responsible_person || 'Unassigned'}{item.due_date ? ` · Due ${item.due_date}` : ''}{item.resolved_by ? ` · Updated by ${item.resolved_by}` : ''}</p>{item.exception_reason && <p className="mt-1 text-xs text-violet-800">Exception reason: {item.exception_reason}</p>}</div>
              {item.status === 'PENDING' ? <div className="flex gap-2"><button onClick={() => void resolveClearance(row, item, 'complete')} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white">Complete</button><button onClick={() => void resolveClearance(row, item, 'waive')} className="rounded-md border border-violet-200 px-2.5 py-1 text-xs font-medium text-violet-700">Approve exception</button></div> : <button onClick={() => void resolveClearance(row, item, 'reopen')} className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-700">Reopen</button>}</div>
            </article>)}</div>}
            <div className="mt-4 grid gap-2 rounded-lg border border-dashed border-indigo-200 bg-white p-3 md:grid-cols-2">
              <h5 className="md:col-span-2 text-sm font-semibold text-gray-800">Add handover / other clearance task</h5>
              <input className={inputClass} placeholder="Task title" value={handoverForms[row.id]?.title || ''} onChange={e => setHandoverForms(current => ({ ...current, [row.id]: { ...current[row.id], title: e.target.value } }))} />
              <input className={inputClass} placeholder="Responsible person / team" value={handoverForms[row.id]?.responsible_person || ''} onChange={e => setHandoverForms(current => ({ ...current, [row.id]: { ...current[row.id], responsible_person: e.target.value } }))} />
              <input className={inputClass} type="date" aria-label="Task due date" value={handoverForms[row.id]?.due_date || ''} onChange={e => setHandoverForms(current => ({ ...current, [row.id]: { ...current[row.id], due_date: e.target.value } }))} />
              <select className={inputClass} value={handoverForms[row.id]?.category || 'HANDOVER'} onChange={e => setHandoverForms(current => ({ ...current, [row.id]: { ...current[row.id], category: e.target.value } }))}><option value="HANDOVER">Work handover</option><option value="OTHER">Other clearance</option></select>
              <textarea className={`${inputClass} md:col-span-2`} rows={2} placeholder="Task details" value={handoverForms[row.id]?.description || ''} onChange={e => setHandoverForms(current => ({ ...current, [row.id]: { ...current[row.id], description: e.target.value } }))} />
              <div className="md:col-span-2 flex justify-end"><button onClick={() => void addHandover(row)} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white">Add task</button></div>
            </div>
          </>}
        </section>}
        {row.status === 'APPROVED' && isPayrollAdmin && <section className="rounded-xl border border-sky-100 bg-sky-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold text-gray-900">Exit documents</h4><p className="text-xs text-gray-600">Issue eligible certificates and the paid F&F statement. Employees access issued PDFs from Profile → Exit Documents.</p></div><button onClick={() => void loadExitDocuments(row)} disabled={exitDocumentsLoading === row.id} className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm font-medium text-sky-700">{exitDocumentsLoading === row.id ? 'Checking…' : exitDocuments[row.id] ? 'Refresh eligibility' : 'Check document eligibility'}</button></div>
          {exitDocuments[row.id] && <div className="mt-3 grid gap-2 md:grid-cols-3">{exitDocuments[row.id].items.map((item: any) => <article key={item.document_type} className="rounded-lg border border-gray-200 bg-white p-3"><div className="flex items-start justify-between gap-2"><h5 className="text-sm font-semibold text-gray-800">{item.label}</h5><span className={`rounded-full px-2 py-0.5 text-xs ${item.issued ? 'bg-emerald-100 text-emerald-800' : item.eligible ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-600'}`}>{item.issued ? 'Issued' : item.eligible ? 'Eligible' : 'Not ready'}</span></div>{item.reason && !item.issued && <p className="mt-2 text-xs text-gray-500">{item.reason}</p>}{item.issued && <p className="mt-2 text-xs text-gray-500">Issued {new Date(item.issued_at).toLocaleDateString()}</p>}{item.eligible && !item.issued && <button onClick={() => void issueExitDocument(row, item.document_type, item.label)} disabled={issuingExitDocument === `${row.id}:${item.document_type}`} className="mt-3 rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{issuingExitDocument === `${row.id}:${item.document_type}` ? 'Generating…' : 'Generate and issue'}</button>}</article>)}</div>}
        </section>}
        {row.status === 'APPROVED' && <details className="rounded-lg border border-gray-200 p-3 text-sm"><summary className="cursor-pointer font-medium text-gray-800">View frozen leave and payroll snapshot</summary><div className="mt-3 space-y-4">
          <div><h4 className="font-medium text-gray-700">Leave balances ({Array.isArray((row.frozen_snapshot as any)?.leave_balances) ? (row.frozen_snapshot as any).leave_balances.length : 0})</h4><div className="mt-1 space-y-1">{((row.frozen_snapshot as any)?.leave_balances || []).map((balance: any) => <p key={balance.balance_id} className="text-xs text-gray-600">{balance.leave_type_code} · {balance.year}: available {balance.available} days · encashment {balance.can_encash ? 'eligible' : 'not eligible'}</p>)}</div></div>
          <div><h4 className="font-medium text-gray-700">Completed payroll periods ({Array.isArray((row.frozen_snapshot as any)?.completed_payroll) ? (row.frozen_snapshot as any).completed_payroll.length : 0})</h4><div className="mt-1 space-y-1">{((row.frozen_snapshot as any)?.completed_payroll || []).map((pay: any, index: number) => <p key={`${pay.run_id}-${index}`} className="text-xs text-gray-600">{pay.period_start} to {pay.period_end}: net ₹{pay.net_pay} ({pay.run_status})</p>)}</div></div>
        </div></details>}
        {row.status === 'APPROVED' && <button onClick={() => void previewEncashment(row)} disabled={previewing === row.id} className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 disabled:opacity-50">{previewing === row.id ? 'Calculating…' : 'Preview leave encashment'}</button>}
        {row.status === 'APPROVED' && isPayrollAdmin && <button onClick={() => void reviewFullFinal(row)} disabled={previewingFullFinal === row.id} className="rounded-lg border border-violet-200 px-3 py-1.5 text-sm font-medium text-violet-700 disabled:opacity-50">{previewingFullFinal === row.id ? 'Calculating…' : 'Review F&F calculation'}</button>}
        {row.status === 'APPROVED' && isPayrollAdmin && !row.fnf_run && <button onClick={() => void createFNFRun(row)} disabled={previewingFullFinal === row.id} className="rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">{previewingFullFinal === row.id ? 'Creating…' : 'Create F&F payroll run'}</button>}
        {row.fnf_run && <button onClick={() => navigate(`/payroll/runs/${row.fnf_run!.id}`)} className="rounded-lg border border-violet-200 px-3 py-1.5 text-sm font-medium text-violet-700">Open F&F run · {row.fnf_run.status.replaceAll('_', ' ')}</button>}
        {fullFinal[row.id] && <div className="overflow-x-auto rounded-xl border border-violet-100 bg-violet-50/50 p-4">
          <div className="mb-3 flex flex-wrap justify-between gap-2"><h4 className="font-semibold text-gray-900">Full & Final calculation review</h4><span className="text-sm font-semibold text-violet-800">Before statutory deductions: ₹{Number(fullFinal[row.id].total_before_statutory_deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
          <table className="min-w-full text-left text-xs"><thead className="text-gray-500"><tr><th className="py-2 pr-4">Item</th><th className="py-2 pr-4">Period / detail</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{fullFinal[row.id].lines.map((line: any) => <tr key={line.code} className="border-t border-violet-100"><td className="py-2 pr-4">{line.label}</td><td className="py-2 pr-4">{line.period || line.detail}</td><td className="py-2 text-right">₹{Number(line.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table>
          {fullFinal[row.id].warnings?.map((warning: string, index: number) => <p key={index} className="mt-2 text-xs text-amber-800">{warning}</p>)}
          <p className="mt-3 text-xs text-gray-500">{fullFinal[row.id].notice} This is a preview; it does not create a payroll run or pay the employee.</p>
        </div>}
        {encashment[row.id] && <div className="overflow-x-auto rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <div className="mb-3 flex flex-wrap justify-between gap-2"><h4 className="font-semibold text-gray-900">Encashment preview</h4><span className="text-sm font-semibold text-blue-800">Total: ₹{Number(encashment[row.id].total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} · {encashment[row.id].total_encashable_days} days</span></div>
          {encashment[row.id].lines.length === 0 ? <p className="text-sm text-gray-600">No frozen leave balances qualify under the configured policy.</p> : <table className="min-w-full text-left text-xs"><thead className="text-gray-500"><tr><th className="py-2 pr-4">Leave type / year</th><th className="py-2 pr-4">Available</th><th className="py-2 pr-4">Encashable</th><th className="py-2 pr-4">Basis / divisor</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{encashment[row.id].lines.map((line: any) => <tr key={line.balance_id} className="border-t border-blue-100"><td className="py-2 pr-4">{line.leave_type_code} · {line.year}</td><td className="py-2 pr-4">{line.available_days}</td><td className="py-2 pr-4">{line.encashable_days}</td><td className="py-2 pr-4">{line.salary_basis} ÷ {line.divisor_days}</td><td className="py-2 text-right">₹{Number(line.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table>}
          <p className="mt-3 text-xs text-gray-500">Read-only preview using frozen leave balances and policy. Creating the F&F payroll run posts eligible items into the payroll approval workflow.</p>
        </div>}
        {row.status === 'REJECTED' && <p className="text-xs text-red-700">{row.rejection_reason}</p>}
      </article>)}</div>}
    </section>}
  </div>;
}
