import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Loader2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { recruitmentApi, type CandidateTaskApplicationOption, type CandidateTaskAssessment, type RecruitmentTaskScorecard } from '../../api/recruitment';

const scale = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Below expectations' },
  { value: 3, label: 'Meets expectations' },
  { value: 4, label: 'Exceeds expectations' },
  { value: 5, label: 'Outstanding' },
];
const errorText = (error: any) => error?.response?.data?.detail || Object.values(error?.response?.data || {}).flat().find((value) => typeof value === 'string') || 'Could not save task assessment';

export default function CandidateTasksPage() {
  const [applications, setApplications] = useState<CandidateTaskApplicationOption[]>([]);
  const [scorecards, setScorecards] = useState<RecruitmentTaskScorecard[]>([]);
  const [assessments, setAssessments] = useState<CandidateTaskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [scorecardId, setScorecardId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetails, setTaskDetails] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await recruitmentApi.taskData();
      setApplications(data.applications);
      setScorecards(data.scorecards);
      setAssessments(data.assessments);
    } catch (error) { toast.error(errorText(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectedScorecard = scorecards.find((item) => item.id === scorecardId);
  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

  const openAssignment = (applicationId: string) => {
    setAddingFor(applicationId);
    setEditingResultId(null);
    setScorecardId(scorecards[0]?.id || '');
    setTaskTitle('');
    setTaskDetails('');
  };

  const openResults = (assessment: CandidateTaskAssessment) => {
    setAddingFor(null);
    setEditingResultId(assessment.id);
    setRatings(assessment.ratings);
    setComments(assessment.comments);
  };

  const submitAssignment = async (event: React.FormEvent, applicationId: string) => {
    event.preventDefault();
    if (!selectedScorecard) return toast.error('Choose an active task rubric first');
    setSaving(true);
    try {
      await recruitmentApi.createTaskAssessment({
        application: applicationId,
        scorecard: scorecardId,
        task_title: taskTitle,
        task_details: taskDetails,
      });
      toast.success('Candidate task assigned. Add its results when they are available.');
      setAddingFor(null);
      await load();
    } catch (error) { toast.error(errorText(error)); }
    finally { setSaving(false); }
  };

  const submitResults = async (event: React.FormEvent, assessment: CandidateTaskAssessment) => {
    event.preventDefault();
    if (assessment.criteria_snapshot.some((criterion) => !ratings[criterion.label])) {
      toast.error('Choose a rating for every task point');
      return;
    }
    setSaving(true);
    try {
      await recruitmentApi.saveTaskAssessmentResult(assessment.id, { ratings, comments });
      toast.success('Task results saved');
      setEditingResultId(null);
      await load();
    } catch (error) { toast.error(errorText(error)); }
    finally { setSaving(false); }
  };

  const outcome = async (application: CandidateTaskApplicationOption, decision: 'PASS' | 'HOLD' | 'REJECT') => {
    const prompt = decision === 'PASS' ? 'Add a brief note explaining why the candidate passed the task stage:' : decision === 'HOLD' ? 'Add a note explaining why the candidate is on hold:' : 'Enter the reason for rejecting the candidate:';
    const notes = window.prompt(prompt);
    if (notes === null) return;
    setSaving(true);
    try {
      const updated = await recruitmentApi.recordTaskOutcome(application.id, decision, notes);
      toast.success(decision === 'PASS' ? `Candidate advanced to ${updated.stage_name}` : `Task outcome recorded: ${decision.toLowerCase()}`);
      await load();
    } catch (error) { toast.error(errorText(error)); }
    finally { setSaving(false); }
  };

  return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="min-w-0 flex-1"><Topbar /><div className="mx-auto max-w-6xl p-6">
    <div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><ClipboardCheck /></div><div><p className="text-sm font-semibold text-indigo-600">Recruitment · Candidate evaluation</p><h1 className="text-2xl font-bold text-slate-900">Candidate Tasks</h1><p className="text-sm text-slate-600">Assign a practical task first, then add its ratings after the candidate’s result is available.</p></div></div>
    {!loading && !scorecards.length && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Add an active task rubric in Hiring Rules → Task scorecards before assigning candidate tasks.</p>}
    {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div> : applications.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">No candidates are currently in Tasks.</div> : <div className="space-y-5">{applications.map((application) => {
      const rows = assessments.filter((assessment) => assessment.application_id === application.id);
      const current = application.is_current_task_stage;
      const hasIncompleteTasks = rows.some((assessment) => !assessment.is_assessed);
      return <section key={application.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">{application.candidate_name}</h2><p className="text-sm text-slate-600">{application.candidate_email} · {application.position_title} · {application.requisition_number}</p><p className="mt-1 text-xs text-slate-500">{current ? 'Currently at Tasks' : `Current stage: ${application.current_stage_code.replaceAll('-', ' ')}`}</p></div>{current && <div className="flex flex-wrap gap-2"><button disabled={saving || !scorecards.length} onClick={() => openAssignment(application.id)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><Plus size={16} /> Assign task</button><button disabled={saving} onClick={() => void outcome(application, 'HOLD')} className="rounded-lg border px-3 py-2 text-sm">Hold</button><button disabled={saving} onClick={() => void outcome(application, 'REJECT')} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Reject</button><button disabled={saving || rows.length === 0 || hasIncompleteTasks} title={rows.length === 0 ? 'Assign at least one task first' : hasIncompleteTasks ? 'Enter results for every assigned task first' : ''} onClick={() => void outcome(application, 'PASS')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={16} /> Pass to next stage</button></div>}</div>

        {rows.length === 0 ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No task has been assigned to this candidate yet.</p> : <div className="mt-4 space-y-3">{rows.map((assessment) => <article key={assessment.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-800">{assessment.task_title}</h3><p className="text-xs text-slate-500">{assessment.scorecard_name} · Assigned {new Date(assessment.created_at).toLocaleDateString()}{assessment.is_assessed ? ` · Results entered by ${assessment.assessed_by_name || 'Recruitment team'}` : ''}</p></div>{current && <button disabled={saving} onClick={() => openResults(assessment)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{assessment.is_assessed ? 'Edit results' : 'Enter results'}</button>}</div>
          {assessment.task_details && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{assessment.task_details}</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{assessment.criteria_snapshot.map((criterion) => <div key={criterion.label} className="flex min-w-0 flex-col gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 font-medium text-slate-800">{criterion.label}{criterion.guidance && <small className="mt-1 block font-normal text-slate-500">{criterion.guidance}</small>}</span>{assessment.is_assessed ? <span className="w-fit max-w-full rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800 sm:shrink-0">{assessment.ratings[criterion.label]}/5 · {scale.find((item) => item.value === assessment.ratings[criterion.label])?.label}</span> : <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 sm:shrink-0">Awaiting result</span>}</div>)}</div>
          {assessment.is_assessed && assessment.comments && <p className="mt-3 text-sm text-slate-600">{assessment.comments}</p>}
          {editingResultId === assessment.id && <form onSubmit={(event) => void submitResults(event, assessment)} className="recruitment-form mt-4 space-y-4 rounded-lg bg-slate-50 p-4"><div><h4 className="font-semibold text-slate-800">Enter task results</h4><p className="text-xs text-slate-500">Rate each point from 1 to 5 based on the candidate’s submitted work.</p></div><div className="space-y-3">{assessment.criteria_snapshot.map((criterion) => <label key={criterion.label} className="task-rating-field grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center"><span className="text-sm font-medium text-slate-800"><span className="mr-1 text-red-600" aria-label="required">*</span>{criterion.label}{criterion.guidance && <small className="mt-1 block font-normal text-slate-500">{criterion.guidance}</small>}</span><select required className={inputClass} value={ratings[criterion.label] || ''} onChange={(event) => setRatings({ ...ratings, [criterion.label]: Number(event.target.value) })}><option value="">Select rating</option>{scale.map((item) => <option key={item.value} value={item.value}>{item.value} · {item.label}</option>)}</select></label>)}</div><label className="block text-sm">Assessment notes<textarea rows={2} className={inputClass} value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Optional" /></label><div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save results'}</button><button type="button" onClick={() => setEditingResultId(null)} className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm"><X size={15} />Cancel</button></div></form>}
        </article>)}</div>}

        {addingFor === application.id && <form onSubmit={(event) => void submitAssignment(event, application.id)} className="recruitment-form mt-4 space-y-4 rounded-lg bg-slate-50 p-4"><div><h3 className="font-semibold text-slate-800">Assign task</h3><p className="text-xs text-slate-500">Save the assignment now. Enter ratings and results later when the candidate’s work is available.</p></div><div className="grid gap-3 md:grid-cols-2"><label className="text-sm">Task rubric<select required className={inputClass} value={scorecardId} onChange={(event) => setScorecardId(event.target.value)}><option value="">Choose rubric</option>{scorecards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm">Task or project name<input required className={inputClass} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Build a small inventory API" /></label></div><label className="block text-sm">Task details<textarea rows={3} className={inputClass} value={taskDetails} onChange={(event) => setTaskDetails(event.target.value)} placeholder="Assignment brief, expected deliverables, or repository link" /></label>{selectedScorecard && <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="mb-2 text-xs font-semibold text-slate-600">Points that will be rated later</p><div className="flex flex-wrap gap-2">{selectedScorecard.criteria.map((criterion) => <span key={criterion.label} title={criterion.guidance} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800">{criterion.label}</span>)}</div></div>}<div className="flex gap-2"><button disabled={saving || !selectedScorecard} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save and assign task'}</button><button type="button" onClick={() => setAddingFor(null)} className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm"><X size={15} />Cancel</button></div></form>}
      </section>;
    })}</div>}
  </div></main></div>;
}
