import { useEffect, useState } from 'react';
import { Check, FileUp, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { onboardingApi, type OnboardingSetupOptions, type OnboardingTask } from '../../api/onboarding';
import { useAuth } from '../../context/AuthContext';

export default function OnboardingTaskCard({
  task, employees = [], onChanged,
}: {
  task: OnboardingTask;
  employees?: OnboardingSetupOptions['employees'];
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const isHr = Boolean(user?.role_codes.some((role) => ['HR_ADMIN', 'SYSTEM_ADMIN'].includes(role)));
  const canUpdate = isHr || user?.employee?.id === task.assigned_to;
  const [nextStatus, setNextStatus] = useState(task.status);
  const [notes, setNotes] = useState(task.completion_notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNextStatus(task.status); setNotes(task.completion_notes || ''); }, [task.status, task.completion_notes]);

  const saveStatus = async () => {
    setSaving(true);
    try { await onboardingApi.updateTaskProgress(task.id, nextStatus, notes); toast.success('Task progress saved'); onChanged(); }
    catch (error: any) { toast.error(error?.response?.data?.status?.[0] || error?.response?.data?.detail || 'Could not update this task'); }
    finally { setSaving(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    try { await onboardingApi.uploadTaskDocument(task.id, file, file.name); toast.success('Document uploaded for HR review'); onChanged(); }
    catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not upload document'); }
    finally { setSaving(false); }
  };
  const review = async (submissionId: string, decision: 'VERIFY' | 'REJECT') => {
    const comments = decision === 'REJECT' ? (window.prompt('Explain what needs to be corrected:') || '').trim() : (window.prompt('Optional review comment:') || '').trim();
    if (decision === 'REJECT' && comments.length < 2) { toast.error('A rejection reason is required.'); return; }
    setSaving(true);
    try { await onboardingApi.reviewTaskDocument(task.id, submissionId, decision, comments); toast.success(decision === 'VERIFY' ? 'Document verified and task completed' : 'Document returned for correction'); onChanged(); }
    catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not review document'); }
    finally { setSaving(false); }
  };
  const assign = async (employeeId: string) => {
    setSaving(true);
    try { await onboardingApi.assignTask(task.id, employeeId || null); toast.success(employeeId ? 'Task assigned' : 'Task unassigned'); onChanged(); }
    catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not assign task'); }
    finally { setSaving(false); }
  };

  return <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{task.title}{task.is_required && <span className="ml-2 text-xs font-normal text-rose-700">Required</span>}</h3><p className="mt-1 text-sm text-slate-600">{task.description || task.task_type_display} · Due {task.due_date || 'not set'}</p><p className="mt-1 text-xs text-slate-500">For {task.employee_name} ({task.employee_number}) · Owner: {task.assigned_to_name || task.owner_type_display || task.owner_type.replaceAll('_', ' ')}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${task.status === 'COMPLETED' || task.status === 'WAIVED' ? 'bg-emerald-50 text-emerald-700' : task.status === 'BLOCKED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{task.status_display}</span></div>

    {isHr && <label className="mt-3 block max-w-md text-xs font-medium text-slate-600">Assign task to<select disabled={saving} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm" value={task.assigned_to || ''} onChange={(event) => void assign(event.target.value)}><option value="">Unassigned</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_number}){employee.position_title ? ` · ${employee.position_title}` : ''}</option>)}</select></label>}

    {canUpdate && <div className="mt-4 space-y-2 border-t border-slate-100 pt-3"><label className="block max-w-sm text-xs font-medium text-slate-600">Progress<select disabled={saving} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}><option value="NOT_STARTED">Not started</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="BLOCKED">Blocked</option>{isHr && <option value="WAIVED">Waived</option>}</select></label><label className="block max-w-xl text-xs font-medium text-slate-600">Comment / blocker<textarea className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add a note for HR or the assignee" /></label><button disabled={saving || nextStatus === task.status && notes === (task.completion_notes || '')} onClick={() => void saveStatus()} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><Save size={15} />Save progress</button></div>}

    {canUpdate && task.task_type === 'DOCUMENT' && task.status !== 'COMPLETED' && <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"><FileUp size={16} />Upload requested document<input type="file" className="sr-only" disabled={saving} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>}
    {task.task_type === 'ACKNOWLEDGEMENT' && <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">This checklist item tracks onboarding progress. It does not yet create or record an acknowledgement in the Policies module.</p>}

    {task.submissions.length > 0 && <div className="mt-4 space-y-2 border-t border-slate-100 pt-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted documents</h4>{task.submissions.map((submission) => <div key={submission.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 p-3 text-sm"><div><a href={submission.document_url || '#'} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 underline">{submission.document_name}</a><p className="text-xs text-slate-500">{submission.status.replaceAll('_', ' ')}{submission.review_comments ? ` · ${submission.review_comments}` : ''}</p></div>{isHr && submission.status === 'PENDING_REVIEW' && <div className="flex gap-2"><button disabled={saving} onClick={() => void review(submission.id, 'VERIFY')} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white"><Check size={14} />Verify</button><button disabled={saving} onClick={() => void review(submission.id, 'REJECT')} className="rounded border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700">Request correction</button></div>}</div>)}</div>}
    {saving && <Loader2 className="mt-2 h-4 w-4 animate-spin text-indigo-600" />}
  </article>;
}
