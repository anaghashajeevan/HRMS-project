import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Loader2, Plus, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { recruitmentApi, type CandidateBackgroundCheck, type ReferenceCheckApplicationOption } from '../../api/recruitment';

function errorMessage(error: any, fallback: string) {
  const data = error?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const value = Object.values(data).flat().find((item) => typeof item === 'string');
    if (value) return value as string;
  }
  return fallback;
}

const today = new Date().toISOString().slice(0, 10);

export default function ReferenceChecksPage() {
  const [applications, setApplications] = useState<ReferenceCheckApplicationOption[]>([]);
  const [checks, setChecks] = useState<CandidateBackgroundCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<CandidateBackgroundCheck | null>(null);
  const [addForm, setAddForm] = useState({ check_type: 'REFERENCE' as 'REFERENCE' | 'BACKGROUND', label: '', contact_or_provider: '', requested_date: today, is_required: true, notes: '' });
  const [editForm, setEditForm] = useState({ contact_or_provider: '', status: 'PENDING' as CandidateBackgroundCheck['status'], outcome: 'PENDING' as CandidateBackgroundCheck['outcome'], completed_date: '', is_required: true, result_summary: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await recruitmentApi.referenceCheckData();
      setApplications(data.applications);
      setChecks(data.checks);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load reference checks'));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => applications.map((application) => ({
    application,
    checks: checks.filter((check) => check.application_id === application.id),
  })), [applications, checks]);

  const addCheck = async (event: React.FormEvent, applicationId: string) => {
    event.preventDefault();
    setSaving(true);
    try {
      await recruitmentApi.createBackgroundCheck({ application: applicationId, ...addForm });
      setAddingFor(null);
      setAddForm({ check_type: 'REFERENCE', label: '', contact_or_provider: '', requested_date: today, is_required: true, notes: '' });
      toast.success('Check added');
      await load();
    } catch (error) { toast.error(errorMessage(error, 'Could not add check')); }
    finally { setSaving(false); }
  };

  const openEdit = (check: CandidateBackgroundCheck) => {
    setEditing(check);
    setEditForm({ contact_or_provider: check.contact_or_provider, status: check.status, outcome: check.outcome, completed_date: check.completed_date || '', is_required: check.is_required, result_summary: check.result_summary, notes: check.notes });
  };

  const saveCheck = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await recruitmentApi.updateBackgroundCheck(editing.id, { ...editForm, completed_date: editForm.completed_date || null });
      setEditing(null);
      toast.success('Check updated');
      await load();
    } catch (error) { toast.error(errorMessage(error, 'Could not update check')); }
    finally { setSaving(false); }
  };

  const recordOutcome = async (applicationId: string, decision: 'PASS' | 'HOLD' | 'REJECT') => {
    const prompts = { PASS: 'Add a brief note explaining why the candidate is advancing to Offer:', HOLD: 'Add a note explaining why the candidate is on hold:', REJECT: 'Enter the reason for rejecting the candidate:' };
    const notes = window.prompt(prompts[decision]);
    if (notes === null) return;
    setSaving(true);
    try {
      await recruitmentApi.recordReferenceCheckOutcome(applicationId, decision, notes);
      toast.success(decision === 'PASS' ? 'Candidate advanced to Offer' : `Reference check outcome recorded: ${decision.toLowerCase()}`);
      await load();
    } catch (error) { toast.error(errorMessage(error, 'Could not record outcome')); }
    finally { setSaving(false); }
  };

  const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
  const requiredChecksPassed = (rows: CandidateBackgroundCheck[]) => rows.some((row) => row.is_required) && rows.filter((row) => row.is_required).every((row) => row.status === 'COMPLETED' && row.outcome === 'PASS');

  return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="min-w-0 flex-1"><Topbar /><div className="mx-auto max-w-6xl p-6">
    <div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><ClipboardCheck /></div><div><h1 className="text-2xl font-bold text-slate-900">Reference & Background Checks</h1><p className="text-sm text-slate-600">Track candidate verification and advance successful candidates to Offer.</p></div></div>
    {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div> : grouped.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">No candidates are waiting at Reference Check.</div> : <div className="space-y-5">{grouped.map(({ application, checks: rows }) => <section key={application.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">{application.candidate_name}</h2><p className="text-sm text-slate-600">{application.candidate_email} · {application.position_title} · {application.requisition_number}</p></div><div className="flex gap-2"><button onClick={() => { setAddingFor(addingFor === application.id ? null : application.id); setEditing(null); }} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Plus size={16} /> Add check</button><button disabled={saving} onClick={() => void recordOutcome(application.id, 'HOLD')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Hold</button><button disabled={saving} onClick={() => void recordOutcome(application.id, 'REJECT')} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50">Reject</button><button disabled={saving || !requiredChecksPassed(rows)} onClick={() => void recordOutcome(application.id, 'PASS')} title={!requiredChecksPassed(rows) ? 'All required checks must be completed with a Pass outcome.' : ''} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={16} /> Advance to Offer</button></div></div>
      {!rows.length && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Add at least one required check. Required checks must all pass before the candidate can advance.</p>}
      {rows.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2">Check</th><th>Contact / Provider</th><th>Status</th><th>Outcome</th><th>Completed</th><th>Required</th><th /></tr></thead><tbody>{rows.map((check) => <tr key={check.id} className="border-b last:border-0"><td className="py-3"><div className="font-medium">{check.label}</div><div className="text-xs text-slate-500">{check.check_type === 'REFERENCE' ? 'Reference' : 'Background'}</div></td><td>{check.contact_or_provider || '—'}</td><td>{check.status.replace('_', ' ')}</td><td>{check.outcome.replaceAll('_', ' ')}</td><td>{check.completed_date || '—'}</td><td>{check.is_required ? 'Yes' : 'No'}</td><td><button onClick={() => openEdit(check)} className="rounded-md border px-3 py-1.5 text-xs">Update</button></td></tr>)}</tbody></table></div>}
      {addingFor === application.id && <form onSubmit={(event) => void addCheck(event, application.id)} className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-2"><label className="text-sm">Type<select className={fieldClass} value={addForm.check_type} onChange={(e) => setAddForm({ ...addForm, check_type: e.target.value as 'REFERENCE' | 'BACKGROUND' })}><option value="REFERENCE">Reference</option><option value="BACKGROUND">Background</option></select></label><label className="text-sm">Check name<input required className={fieldClass} placeholder="Previous employer reference" value={addForm.label} onChange={(e) => setAddForm({ ...addForm, label: e.target.value })} /></label><label className="text-sm">Contact or provider<input className={fieldClass} value={addForm.contact_or_provider} onChange={(e) => setAddForm({ ...addForm, contact_or_provider: e.target.value })} /></label><label className="text-sm">Requested date<input required type="date" className={fieldClass} value={addForm.requested_date} onChange={(e) => setAddForm({ ...addForm, requested_date: e.target.value })} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addForm.is_required} onChange={(e) => setAddForm({ ...addForm, is_required: e.target.checked })} /> Required for offer</label><label className="text-sm md:col-span-2">Internal notes<textarea className={fieldClass} rows={2} value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} /></label><div className="flex gap-2 md:col-span-2"><button disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save check'}</button><button type="button" onClick={() => setAddingFor(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></div></form>}
    </section>)}</div>}
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={(event) => void saveCheck(event)} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Update {editing.label}</h2><p className="text-sm text-slate-500">Result summaries and notes are visible to HR only.</p></div><button type="button" onClick={() => setEditing(null)}><X /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Contact / provider<input className={fieldClass} value={editForm.contact_or_provider} onChange={(e) => setEditForm({ ...editForm, contact_or_provider: e.target.value })} /></label><label className="text-sm">Status<select className={fieldClass} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as CandidateBackgroundCheck['status'], outcome: e.target.value === 'COMPLETED' ? editForm.outcome : 'PENDING' })}><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label><label className="text-sm">Outcome<select className={fieldClass} value={editForm.outcome} onChange={(e) => { const outcome = e.target.value as CandidateBackgroundCheck['outcome']; setEditForm({ ...editForm, outcome, status: outcome === 'PENDING' ? editForm.status : 'COMPLETED', completed_date: outcome === 'PENDING' ? editForm.completed_date : (editForm.completed_date || today) }); }}><option value="PENDING">Pending</option><option value="PASS">Pass</option><option value="FAIL">Fail</option><option value="UNABLE_TO_VERIFY">Unable to verify</option></select></label><label className="text-sm">Completed date<input required={editForm.status === 'COMPLETED'} type="date" className={fieldClass} value={editForm.completed_date} onChange={(e) => setEditForm({ ...editForm, completed_date: e.target.value })} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.is_required} onChange={(e) => setEditForm({ ...editForm, is_required: e.target.checked })} /> Required for offer</label><label className="text-sm sm:col-span-2">Result summary<textarea className={fieldClass} rows={3} value={editForm.result_summary} onChange={(e) => setEditForm({ ...editForm, result_summary: e.target.value })} /></label><label className="text-sm sm:col-span-2">Internal notes<textarea className={fieldClass} rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></label></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"><Save size={16} />{saving ? 'Saving…' : 'Save update'}</button></div></form></div>}
  </div></main></div>;
}
