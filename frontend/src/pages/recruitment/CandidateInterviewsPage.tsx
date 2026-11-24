import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, CalendarPlus, Check, Clock3, Loader2, Search, Star, UserRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { useAuth } from '../../context/AuthContext';
import { recruitmentApi, type CandidateInterview, type CandidateInterviewOption, type InterviewerOption, type InterviewScorecardOption } from '../../api/recruitment';

function errorMessage(error: any, fallback: string) {
  const data = error?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const first = Object.values(data).flat().find((value) => typeof value === 'string');
    if (first) return first as string;
  }
  return fallback;
}

function localDateTimeMinimum() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
}

export default function CandidateInterviewsPage() {
  const { user } = useAuth();
  const isHr = Boolean(user?.role_codes?.some((role) => role === 'HR_ADMIN' || role === 'SYSTEM_ADMIN'));
  const canManageHiring = Boolean(isHr || user?.role_codes?.some((role) => role === 'MANAGER' || role === 'REPORTING_MANAGER'));
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [applicationOptions, setApplicationOptions] = useState<CandidateInterviewOption[]>([]);
  const [scorecards, setScorecards] = useState<InterviewScorecardOption[]>([]);
  const [interviewerOptions, setInterviewerOptions] = useState<InterviewerOption[]>([]);
  const [interviewerSearch, setInterviewerSearch] = useState('');
  const [interviewerDropdownOpen, setInterviewerDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [evaluationInterview, setEvaluationInterview] = useState<CandidateInterview | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [scheduleForm, setScheduleForm] = useState({
    application: '', round_name: 'Interview Round 1', scheduled_at: '', duration_minutes: '60',
    meeting_details: '', scorecard: '', interviewers: [] as string[],
  });
  const [evaluationForm, setEvaluationForm] = useState({
    ratings: {} as Record<string, number>, comments: '', recommendation: 'PASS' as 'PASS' | 'HOLD' | 'REJECT',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, options] = await Promise.all([
        recruitmentApi.candidateInterviews(),
        canManageHiring ? recruitmentApi.candidateInterviewOptions() : Promise.resolve(null),
      ]);
      setInterviews(rows);
      setApplicationOptions(options?.applications || []);
      setScorecards(options?.scorecards || []);
      setInterviewerOptions(options?.interviewers || []);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load interviews'));
    } finally {
      setLoading(false);
    }
  }, [canManageHiring]);

  useEffect(() => { void load(); }, [load]);

  const groupedInterviews = useMemo(() => {
    const groups = new Map<string, CandidateInterview[]>();
    interviews.forEach((interview) => {
      const list = groups.get(interview.candidate_application) || [];
      list.push(interview);
      groups.set(interview.candidate_application, list);
    });
    return Array.from(groups.entries()).map(([applicationId, items]) => ({ applicationId, items }));
  }, [interviews]);

  const visibleGroups = groupedInterviews.map((group) => ({
    ...group,
    items: group.items.filter((interview) => !statusFilter || interview.status === statusFilter),
  })).filter((group) => group.items.length > 0);

  const selectedScorecard = scorecards.find((scorecard) => scorecard.id === scheduleForm.scorecard);
  const filteredInterviewers = useMemo(() => {
    const query = interviewerSearch.trim().toLocaleLowerCase();
    return interviewerOptions.filter((person) => !query || person.full_name.toLocaleLowerCase().startsWith(query));
  }, [interviewerOptions, interviewerSearch]);
  const selectedInterviewers = interviewerOptions.filter((person) => scheduleForm.interviewers.includes(person.id));
  const weightedScorePreview = evaluationInterview
    ? evaluationInterview.scorecard_criteria.reduce((total, criterion) => total + (evaluationForm.ratings[criterion.label.trim()] || 3) * criterion.weight / 100, 0)
    : 0;

  const scheduleInterview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scheduleForm.application || !scheduleForm.scorecard || !scheduleForm.scheduled_at || !scheduleForm.interviewers.length) {
      toast.error('Choose the candidate, scorecard, date, and at least one interviewer');
      return;
    }
    setSaving(true);
    try {
      await recruitmentApi.scheduleCandidateInterview({
        application: scheduleForm.application,
        round_name: scheduleForm.round_name.trim(),
        scheduled_at: new Date(scheduleForm.scheduled_at).toISOString(),
        duration_minutes: Number(scheduleForm.duration_minutes),
        meeting_details: scheduleForm.meeting_details.trim(),
        scorecard: scheduleForm.scorecard,
        interviewers: scheduleForm.interviewers,
      });
      toast.success('Interview scheduled');
      setShowSchedule(false);
      setInterviewerSearch('');
      setInterviewerDropdownOpen(false);
      setScheduleForm({ application: '', round_name: 'Interview Round 1', scheduled_at: '', duration_minutes: '60', meeting_details: '', scorecard: '', interviewers: [] });
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not schedule interview'));
    } finally {
      setSaving(false);
    }
  };

  const toggleInterviewer = (employeeId: string) => {
    setScheduleForm((current) => ({
      ...current,
      interviewers: current.interviewers.includes(employeeId)
        ? current.interviewers.filter((id) => id !== employeeId)
        : [...current.interviewers, employeeId],
    }));
  };

  const openEvaluation = (interview: CandidateInterview) => {
    setEvaluationInterview(interview);
    setEvaluationForm({
      ratings: Object.fromEntries(interview.scorecard_criteria.map((criterion) => [criterion.label.trim(), 3])),
      comments: '', recommendation: 'PASS',
    });
  };

  const submitEvaluation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!evaluationInterview) return;
    setEvaluationId(evaluationInterview.id);
    try {
      await recruitmentApi.evaluateCandidateInterview(evaluationInterview.id, evaluationForm);
      toast.success('Interview scorecard submitted');
      setEvaluationInterview(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not submit scorecard'));
    } finally {
      setEvaluationId(null);
    }
  };

  const recordOutcome = async (applicationId: string, decision: 'PASS' | 'HOLD' | 'REJECT') => {
    const prompts = { PASS: 'Why is the candidate advancing?', HOLD: 'Why is the candidate on hold?', REJECT: 'Enter the reason the candidate failed the interview:' };
    const notes = window.prompt(prompts[decision]);
    if (notes === null) return;
    if (notes.trim().length < 2) {
      toast.error('Enter at least 2 characters of outcome notes');
      return;
    }
    try {
      const result = await recruitmentApi.recordInterviewOutcome(applicationId, decision, notes.trim());
      toast.success(decision === 'PASS' ? `Candidate advanced to ${result.stage_name}` : decision === 'HOLD' ? 'Candidate placed on hold' : 'Candidate marked as failed');
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not record interview outcome'));
    }
  };

  const downloadResume = async (interview: CandidateInterview) => {
    try {
      const blob = await recruitmentApi.downloadCandidateResume(interview.candidate_application);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = interview.resume_filename || `${interview.candidate_name.replace(/[^a-z0-9._-]/gi, '_')}-resume`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download candidate resume'));
    }
  };

  return <div className="flex h-screen bg-gray-50"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><Topbar /><main className="flex-1 overflow-y-auto p-6">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-600">Recruitment · Candidate evaluation</p><h1 className="mt-1 text-2xl font-bold text-gray-900">Interviews</h1><p className="mt-1 text-sm text-gray-500">Schedule interview rounds, submit weighted scorecards, and record final outcomes.</p></div>{canManageHiring && <button disabled={!applicationOptions.length || !scorecards.length || !interviewerOptions.length} onClick={() => setShowSchedule(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><CalendarPlus className="h-4 w-4" />Schedule interview</button>}</div>
    {canManageHiring && (!applicationOptions.length || !scorecards.length || !interviewerOptions.length) && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">To schedule, a candidate on a requisition you requested or approve must be in the Interview stage, an active scorecard must exist, and at least one employee must be available as an interviewer.</div>}
    <div className="mb-4 flex items-center justify-between"><p className="text-sm text-gray-500">{visibleGroups.length} candidate{visibleGroups.length === 1 ? '' : 's'}</p><select aria-label="Filter interviews by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">All interview statuses</option><option value="SCHEDULED">Scheduled</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></div>
    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div> : visibleGroups.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center"><UserRound className="mx-auto h-10 w-10 text-gray-300" /><h2 className="mt-3 font-semibold text-gray-900">No interviews found</h2><p className="mt-1 text-sm text-gray-500">{canManageHiring ? 'No interviews are scheduled for requisitions you requested or are assigned to approve.' : 'You do not have any assigned interviews yet.'}</p></div> : <div className="space-y-4">{visibleGroups.map(({ applicationId, items }) => {
      const first = items[0];
      const allForApplication = interviews.filter((interview) => interview.candidate_application === applicationId);
      const activeInterviews = allForApplication.filter((interview) => interview.status !== 'CANCELLED');
      const allCompleted = activeInterviews.length > 0 && activeInterviews.every((interview) => interview.status === 'COMPLETED');
      return <section key={applicationId} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-gray-900">{first.candidate_name}</h2><p className="text-sm text-gray-600">{first.candidate_email}</p><p className="mt-1 text-sm text-gray-500">{first.requisition_number} · {first.position_title} · {first.current_stage}</p></div>{canManageHiring && first.current_stage_code === 'interview' && allCompleted && <div className="flex flex-wrap gap-2"><button onClick={() => void recordOutcome(applicationId, 'PASS')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Pass to next stage</button><button onClick={() => void recordOutcome(applicationId, 'HOLD')} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700">Hold</button><button onClick={() => void recordOutcome(applicationId, 'REJECT')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Fail</button></div>}</div>
        <div className="mt-4 space-y-3">{items.map((interview) => {
          const myEvaluation = interview.evaluations.find((evaluation) => evaluation.interviewer === user?.employee?.id);
          const canEvaluate = Boolean(user?.employee?.id && interview.interviewers.some((interviewer) => interviewer.id === user.employee?.id) && interview.status === 'SCHEDULED' && Date.now() >= new Date(interview.scheduled_at).getTime() && !interview.my_evaluation_id);
          return <article key={interview.id} className="rounded-lg border border-gray-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-gray-800">{interview.round_name} <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">{interview.status}</span></p><p className="mt-1 flex items-center gap-1 text-sm text-gray-500"><Clock3 className="h-4 w-4" />{new Date(interview.scheduled_at).toLocaleString()} · {interview.duration_minutes} minutes · {interview.scorecard_name}</p><p className="mt-1 text-xs text-gray-500">Interviewers: {interview.interviewers.map((person) => person.full_name).join(', ')}</p>{interview.meeting_details && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{interview.meeting_details}</p>}</div><div className="flex gap-2"><button onClick={() => void downloadResume(interview)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"><ArrowDownToLine className="h-4 w-4" />Resume</button>{canEvaluate && <button disabled={evaluationId === interview.id} onClick={() => openEvaluation(interview)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Submit scorecard</button>}</div></div>
            {interview.evaluations.length > 0 && <div className="mt-3 grid gap-2 md:grid-cols-2">{interview.evaluations.map((evaluation) => <div key={evaluation.id} className="rounded-md bg-gray-50 p-3 text-xs"><p className="font-semibold text-gray-800">{evaluation.interviewer_name} · {evaluation.recommendation} · Weighted score: {evaluation.weighted_score}/5</p><p className="mt-1 text-gray-600">{evaluation.comments}</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(evaluation.ratings).map(([label, score]) => { const weight = interview.scorecard_criteria.find((criterion) => criterion.label.trim() === label)?.weight; return <span key={label} className="rounded bg-white px-2 py-1 text-gray-600"><Star className="mr-1 inline h-3 w-3 text-amber-500" />{label}: {score}/5{weight ? ` · ${weight}% weight` : ''}</span>; })}</div></div>)}</div>}
            {myEvaluation && <p className="mt-2 text-xs text-emerald-700">Your evaluation has been submitted.</p>}
          </article>;
        })}</div>
      </section>;
    })}</div>}
  </main></div>

  {showSchedule && <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center"><form onSubmit={scheduleInterview} className="recruitment-form my-0 max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold text-gray-900">Schedule interview</h2><p className="mt-1 text-sm text-gray-500">Candidates are limited to requisitions you requested or are assigned to approve.</p></div><button type="button" onClick={() => setShowSchedule(false)} aria-label="Close" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700 sm:col-span-2">Candidate application<select required value={scheduleForm.application} onChange={(event) => setScheduleForm({ ...scheduleForm, application: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"><option value="">Choose candidate</option>{applicationOptions.map((item) => <option key={item.id} value={item.id}>{item.candidate_name} · {item.requisition_number} · {item.position_title}</option>)}</select></label>
      <label className="text-sm font-medium text-gray-700">Round name<input required maxLength={120} value={scheduleForm.round_name} onChange={(event) => setScheduleForm({ ...scheduleForm, round_name: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
      <label className="text-sm font-medium text-gray-700">Duration (minutes)<input required type="number" min="15" max="480" step="15" value={scheduleForm.duration_minutes} onChange={(event) => setScheduleForm({ ...scheduleForm, duration_minutes: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
      <label className="text-sm font-medium text-gray-700">Date and time<input required type="datetime-local" min={localDateTimeMinimum()} value={scheduleForm.scheduled_at} onChange={(event) => setScheduleForm({ ...scheduleForm, scheduled_at: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
      <label className="text-sm font-medium text-gray-700">Scorecard<select required value={scheduleForm.scorecard} onChange={(event) => setScheduleForm({ ...scheduleForm, scorecard: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"><option value="">Choose scorecard</option>{scorecards.map((scorecard) => <option key={scorecard.id} value={scorecard.id}>{scorecard.name}</option>)}</select></label>
      <div className="text-sm font-medium text-gray-700 sm:col-span-2"><span>Interviewers <span className="text-red-600" aria-label="required">*</span></span><div className="relative mt-1" onBlur={(event) => { const nextFocus = event.relatedTarget; if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) setInterviewerDropdownOpen(false); }}><div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3"><Search className="h-4 w-4 shrink-0 text-gray-400" /><input type="search" role="combobox" aria-label="Search interviewers by name" aria-autocomplete="list" aria-expanded={interviewerDropdownOpen} aria-controls="interviewer-search-results" value={interviewerSearch} onFocus={() => setInterviewerDropdownOpen(true)} onChange={(event) => { setInterviewerSearch(event.target.value); setInterviewerDropdownOpen(true); }} placeholder="Search employees by name..." className="w-full border-0 py-2.5 text-sm outline-none focus:ring-0" /></div>{interviewerDropdownOpen && <div id="interviewer-search-results" role="listbox" aria-multiselectable="true" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">{filteredInterviewers.length ? filteredInterviewers.map((person) => { const selected = scheduleForm.interviewers.includes(person.id); return <button key={person.id} type="button" role="option" aria-selected={selected} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleInterviewer(person.id)} className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-indigo-50 ${selected ? 'bg-indigo-50' : ''}`}><span><span className="block text-sm font-medium text-gray-800">{person.full_name}</span><span className="block text-xs text-gray-500">{person.employee_id} · {person.role_names.length ? person.role_names.map((role) => role.replaceAll('_', ' ')).join(', ') : 'No role assigned'}</span></span>{selected && <Check className="mt-1 h-4 w-4 shrink-0 text-indigo-600" />}</button>; }) : <p className="px-3 py-3 text-sm text-gray-500">No employees found whose name starts with “{interviewerSearch.trim()}”.</p>}</div>}</div>{selectedInterviewers.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{selectedInterviewers.map((person) => <span key={person.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1 text-xs font-medium text-indigo-800">{person.full_name}<button type="button" aria-label={`Remove ${person.full_name}`} onClick={() => toggleInterviewer(person.id)} className="rounded-full p-1 hover:bg-indigo-100"><X className="h-3 w-3" /></button></span>)}</div>}<span className="text-xs font-normal text-gray-500">Type the beginning of an employee’s name to filter, then select one or more interviewers.</span></div>
      <label className="text-sm font-medium text-gray-700 sm:col-span-2">Location or meeting link<textarea rows={2} value={scheduleForm.meeting_details} onChange={(event) => setScheduleForm({ ...scheduleForm, meeting_details: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
      {selectedScorecard && <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 sm:col-span-2"><p className="font-semibold">Scorecard weightage</p><p className="mt-1 text-xs text-indigo-800">Criteria with a higher percentage have a greater effect on the final score.</p><div className="mt-3 space-y-2">{[...selectedScorecard.criteria].sort((a, b) => b.weight - a.weight).map((item) => <div key={item.label} className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate">{item.label}</span><div className="h-2 w-28 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${item.weight}%` }} /></div><span className="w-12 text-right text-xs font-semibold">{item.weight}%</span></div>)}</div></div>}
    </div><div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4"><button type="button" onClick={() => setShowSchedule(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600">Cancel</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}Save interview</button></div></form></div>}

  {evaluationInterview && <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center"><form onSubmit={submitEvaluation} className="recruitment-form my-0 max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold text-gray-900">Interview scorecard</h2><p className="mt-1 text-sm text-gray-500">{evaluationInterview.candidate_name} · {evaluationInterview.round_name} · {evaluationInterview.scorecard_name}</p></div><button type="button" onClick={() => setEvaluationInterview(null)} aria-label="Close" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3"><div><p className="text-sm font-semibold text-indigo-950">Live weighted score preview</p><p className="text-xs text-indigo-800">Higher-weight criteria affect the final score more.</p></div><p className="rounded-lg bg-white px-3 py-2 text-lg font-bold text-indigo-700">{weightedScorePreview.toFixed(2)} <span className="text-xs font-medium">/ 5</span></p></div>
    <div className="space-y-4">{[...evaluationInterview.scorecard_criteria].sort((a, b) => b.weight - a.weight).map((criterion) => <label key={criterion.label} className="block rounded-lg border border-gray-200 p-3 text-sm"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-gray-800">{criterion.label}</span><span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800">Weight {criterion.weight}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${criterion.weight}%` }} /></div>{criterion.guidance && <span className="mt-2 block text-xs text-gray-500">{criterion.guidance}</span>}<select required value={evaluationForm.ratings[criterion.label.trim()] || 3} onChange={(event) => setEvaluationForm({ ...evaluationForm, ratings: { ...evaluationForm.ratings, [criterion.label.trim()]: Number(event.target.value) } })} className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2"><option value={1}>1 · Poor</option><option value={2}>2 · Below expectations</option><option value={3}>3 · Meets expectations</option><option value={4}>4 · Exceeds expectations</option><option value={5}>5 · Outstanding</option></select></label>)}
      <label className="block text-sm font-medium text-gray-700">Overall comments<textarea required minLength={2} rows={4} value={evaluationForm.comments} onChange={(event) => setEvaluationForm({ ...evaluationForm, comments: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
      <label className="block text-sm font-medium text-gray-700">Recommendation<select value={evaluationForm.recommendation} onChange={(event) => setEvaluationForm({ ...evaluationForm, recommendation: event.target.value as 'PASS' | 'HOLD' | 'REJECT' })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"><option value="PASS">Pass</option><option value="HOLD">Hold</option><option value="REJECT">Fail</option></select></label>
    </div><div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4"><button type="button" onClick={() => setEvaluationInterview(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600">Cancel</button><button disabled={evaluationId === evaluationInterview.id} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{evaluationId === evaluationInterview.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Submit evaluation</button></div></form></div>}
  </div>;
}
