import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Check, FileText, Loader2, Plus, Search, UserRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { recruitmentApi, type CandidateApplication, type CandidateApplicationRequisitionOption, type RecruitmentStage } from '../../api/recruitment';

function errorMessage(error: any, fallback: string) {
  const data = error?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const first = Object.values(data).flat().find((value) => typeof value === 'string');
    if (first) return first as string;
  }
  return fallback;
}

export default function CandidateApplicationsPage() {
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [requisitions, setRequisitions] = useState<CandidateApplicationRequisitionOption[]>([]);
  const [stages, setStages] = useState<RecruitmentStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screeningId, setScreeningId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ requisition: '', stage: '', decision: '' });
  const [form, setForm] = useState({
    requisition: '', first_name: '', last_name: '', email: '', phone: '', internal_notes: '', resume: null as File | null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [applicationRows, requisitionOptions, configuredStages] = await Promise.all([
        recruitmentApi.candidateApplications(filters), recruitmentApi.candidateApplicationOptions(), recruitmentApi.stages(),
      ]);
      setApplications(applicationRows);
      setRequisitions(requisitionOptions);
      setStages(configuredStages);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load candidate applications'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const visibleApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return applications;
    return applications.filter((application) => [
      application.candidate_name, application.candidate_email, application.candidate_phone,
      application.requisition_number, application.position_title, application.department_name, application.stage_name,
    ].some((value) => value.toLowerCase().includes(query)));
  }, [applications, search]);

  const resetForm = () => setForm({ requisition: '', first_name: '', last_name: '', email: '', phone: '', internal_notes: '', resume: null });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.resume) {
      toast.error('Choose the candidate resume file');
      return;
    }
    if (form.resume.size > 4 * 1024 * 1024) {
      toast.error('Resume must be 4 MB or smaller');
      return;
    }
    const data = new FormData();
    data.append('requisition', form.requisition);
    data.append('first_name', form.first_name.trim());
    data.append('last_name', form.last_name.trim());
    data.append('email', form.email.trim());
    data.append('phone', form.phone.trim());
    data.append('internal_notes', form.internal_notes.trim());
    data.append('resume', form.resume);

    setSaving(true);
    try {
      await recruitmentApi.createCandidateApplication(data);
      toast.success('Candidate application added at the New stage');
      setShowForm(false);
      resetForm();
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save candidate application'));
    } finally {
      setSaving(false);
    }
  };

  const downloadResume = async (application: CandidateApplication) => {
    try {
      const blob = await recruitmentApi.downloadCandidateResume(application.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = application.resume_filename || 'candidate-resume';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download resume'));
    }
  };

  const saveScreeningDecision = async (application: CandidateApplication, decision: 'PASS' | 'HOLD' | 'REJECT') => {
    const prompts = {
      PASS: 'Why is this candidate moving to the next stage?',
      HOLD: 'Add a note explaining why this candidate is on hold:',
      REJECT: 'Enter the reason for rejecting this candidate:',
    };
    const notes = window.prompt(prompts[decision]);
    if (notes === null) return;
    if (notes.trim().length < 2) {
      toast.error('Enter at least 2 characters of screening notes');
      return;
    }
    setScreeningId(application.id);
    try {
      const updated = await recruitmentApi.screenCandidateApplication(application.id, decision, notes.trim());
      toast.success(decision === 'PASS' ? `Moved to ${updated.stage_name}` : decision === 'HOLD' ? 'Candidate placed on hold' : 'Candidate rejected');
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save screening decision'));
    } finally {
      setScreeningId(null);
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
              <p className="text-sm font-semibold text-indigo-600">Recruitment · Candidate screening</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">Candidate applications</h1>
              <p className="mt-1 text-sm text-gray-500">Review resumes, record screening decisions, and advance candidates through configured stages.</p>
            </div>
            <button disabled={!requisitions.length} onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="h-4 w-4" />Add candidate
            </button>
          </div>

          {!loading && requisitions.length === 0 && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">There are no approved requisitions to accept applications for. Approve a requisition first.</div>}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">{visibleApplications.length} application{visibleApplications.length === 1 ? '' : 's'}</p>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="application-search">Search applications</label>
              <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input id="application-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidates" className="w-52 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm" /></div>
              <select aria-label="Filter by requisition" value={filters.requisition} onChange={(event) => setFilters({ ...filters, requisition: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">All requisitions</option>{requisitions.map((item) => <option key={item.id} value={item.id}>{item.requisition_number} · {item.position_title}</option>)}</select>
              <select aria-label="Filter by stage" value={filters.stage} onChange={(event) => setFilters({ ...filters, stage: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">All stages</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}{stage.is_active ? '' : ' (inactive)'}</option>)}</select>
              <select aria-label="Filter by decision" value={filters.decision} onChange={(event) => setFilters({ ...filters, decision: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">All decisions</option><option value="PENDING">Pending</option><option value="PASS">Pass</option><option value="HOLD">Hold</option><option value="REJECT">Reject</option></select>
            </div>
          </div>

          {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div> : visibleApplications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center"><UserRound className="mx-auto h-10 w-10 text-gray-300" /><h2 className="mt-3 font-semibold text-gray-900">No candidate applications</h2><p className="mt-1 text-sm text-gray-500">Add a candidate and attach their resume to start a recruitment pipeline.</p></div>
          ) : <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="divide-y divide-gray-100">{visibleApplications.map((application) => (
              <article key={application.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><UserRound className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-gray-900">{application.candidate_name}</h2>
                    <p className="text-sm text-gray-600">{application.candidate_email} · {application.candidate_phone}</p>
                    <p className="mt-1 text-sm text-gray-500">{application.requisition_number} · {application.position_title} · {application.department_name}</p>
                    {application.internal_notes && <p className="mt-1 max-w-2xl whitespace-pre-wrap text-xs text-gray-500">{application.internal_notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{application.stage_name}</span>
                  <button onClick={() => void downloadResume(application)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><ArrowDownToLine className="h-4 w-4" /><span className="hidden sm:inline">Resume</span></button>
                </div>
                <div className="w-full border-t border-gray-100 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-gray-600"><span className="font-semibold">Decision:</span> {application.screening_decision.charAt(0) + application.screening_decision.slice(1).toLowerCase()}</div>
                    {['new', 'screening'].includes(application.stage_code) && <div className="flex flex-wrap gap-2">
                      <button disabled={screeningId === application.id} onClick={() => void saveScreeningDecision(application, 'PASS')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check className="h-3.5 w-3.5" />Pass to next stage</button>
                      <button disabled={screeningId === application.id} onClick={() => void saveScreeningDecision(application, 'HOLD')} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Hold</button>
                      <button disabled={screeningId === application.id} onClick={() => void saveScreeningDecision(application, 'REJECT')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>
                    </div>}
                  </div>
                  {application.screening_notes && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{application.screening_notes}</p>}
                  <details className="mt-2 text-xs text-gray-600"><summary className="cursor-pointer font-semibold">Screening history ({application.screening_history.length})</summary><ol className="mt-2 space-y-2 border-l border-gray-200 pl-3">{application.screening_history.map((entry) => <li key={entry.id}><p className="font-medium">{entry.from_stage_name ? `${entry.from_stage_name} → ` : ''}{entry.to_stage_name} · {entry.decision}</p><p>{entry.notes}</p><p className="text-gray-400">{entry.changed_by_name || 'HR'} · {new Date(entry.created_at).toLocaleString()}</p></li>)}</ol></details>
                </div>
              </article>
            ))}</div>
          </div>}
        </main>
      </div>

      {showForm && <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
        <form onSubmit={submit} className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-gray-900">Add candidate</h2><p className="mt-1 text-sm text-gray-500">The application will be added to the New stage.</p></div><button type="button" onClick={() => setShowForm(false)} aria-label="Close" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700 sm:col-span-2">Approved requisition<select required value={form.requisition} onChange={(event) => setForm({ ...form, requisition: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"><option value="">Choose requisition</option>{requisitions.map((requisition) => <option key={requisition.id} value={requisition.id}>{requisition.requisition_number} · {requisition.position_title} · {requisition.department_name} · {requisition.openings} opening(s)</option>)}</select></label>
            <label className="text-sm font-medium text-gray-700">First name<input required maxLength={100} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-gray-700">Last name<input maxLength={100} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-gray-700">Email<input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-gray-700">Phone<input required type="tel" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-gray-700 sm:col-span-2">Resume <span className="font-normal text-gray-500">(PDF, DOC, or DOCX; max 4 MB)</span><span className="mt-1 flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2"><FileText className="h-4 w-4 text-gray-400" /><input required type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setForm({ ...form, resume: event.target.files?.[0] || null })} className="min-w-0 flex-1 text-sm" /></span></label>
            <label className="text-sm font-medium text-gray-700 sm:col-span-2">Internal notes<textarea rows={3} maxLength={10000} value={form.internal_notes} onChange={(event) => setForm({ ...form, internal_notes: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5" /></label>
          </div>
          <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Save application</button></div>
        </form>
      </div>}
    </div>
  );
}
