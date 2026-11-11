import { useCallback, useEffect, useState } from 'react';
import { Check, Download, Loader2, Send, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { useAuth } from '../../context/AuthContext';
import { recruitmentApi, type CandidateOffer, type CandidateOfferApplicationOption, type CandidateOfferEmployeeOption, type OfferRule } from '../../api/recruitment';

function errorMessage(error: any, fallback: string) {
  const data = error?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const message = Object.values(data).flat().find((value) => typeof value === 'string');
    if (message) return message as string;
  }
  return fallback;
}

const today = new Date().toISOString().slice(0, 10);
const dateInDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export default function CandidateOffersPage() {
  const { user } = useAuth();
  const isHr = Boolean(user?.role_codes?.some((role) => role === 'HR_ADMIN' || role === 'SYSTEM_ADMIN'));
  const [offers, setOffers] = useState<CandidateOffer[]>([]);
  const [applications, setApplications] = useState<CandidateOfferApplicationOption[]>([]);
  const [rules, setRules] = useState<OfferRule[]>([]);
  const [employees, setEmployees] = useState<CandidateOfferEmployeeOption[]>([]);
  const [employeeSelections, setEmployeeSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ application: '', annual_salary: '', signing_bonus: '0', joining_date: dateInDays(45), expires_on: dateInDays(14), notes: '' });
  const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await recruitmentApi.candidateOffers();
      setOffers(rows);
      if (isHr) {
        const options = await recruitmentApi.candidateOfferOptions();
        setApplications(options.applications);
        setRules(options.rules);
        setEmployees(options.employees);
        if (!form.application && options.applications[0]) setForm((current) => ({ ...current, application: options.applications[0].id }));
      }
    } catch (error) { toast.error(errorMessage(error, 'Could not load offers')); }
    finally { setLoading(false); }
  }, [isHr]);
  useEffect(() => { void load(); }, [load]);

  const selectedApplication = applications.find((application) => application.id === form.application);
  const selectedRule = rules.find((rule) => rule.grade_band === selectedApplication?.grade_band);

  const createOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedApplication || !selectedRule) { toast.error('An active offer rule is required for this candidate grade.'); return; }
    setSaving(true);
    try {
      await recruitmentApi.createCandidateOffer(form);
      toast.success('Offer submitted for approval');
      setForm((current) => ({ ...current, annual_salary: '', signing_bonus: '0', notes: '' }));
      await load();
    } catch (error) { toast.error(errorMessage(error, 'Could not create offer')); }
    finally { setSaving(false); }
  };

  const approve = async (offer: CandidateOffer, decision: 'APPROVE' | 'REJECT') => {
    const comments = window.prompt(decision === 'APPROVE' ? 'Add approval comments:' : 'Enter the reason for rejecting this offer:');
    if (comments === null) return;
    setSaving(true);
    try { await recruitmentApi.approveCandidateOffer(offer.id, decision, comments); toast.success(decision === 'APPROVE' ? 'Offer approved' : 'Offer rejected'); await load(); }
    catch (error) { toast.error(errorMessage(error, 'Could not record approval')); }
    finally { setSaving(false); }
  };

  const send = async (offer: CandidateOffer) => {
    if (!window.confirm(`Send the offer email to ${offer.candidate_email}? This sends the offer details without the formal offer letter PDF.`)) return;
    setSaving(true);
    try { await recruitmentApi.sendCandidateOffer(offer.id); toast.success('Offer email sent to the candidate'); await load(); }
    catch (error) { toast.error(errorMessage(error, 'Could not send offer')); }
    finally { setSaving(false); }
  };

  const response = async (offer: CandidateOffer, decision: 'ACCEPTED' | 'DECLINED') => {
    const notes = window.prompt(`Record the candidate's ${decision.toLowerCase()} response:`);
    if (notes === null) return;
    setSaving(true);
    try {
      const updated = await recruitmentApi.respondToCandidateOffer(offer.id, decision, notes);
      if (decision === 'ACCEPTED' && updated.offer_letter_error) toast.error(`Candidate moved to Hired, but formal letter delivery failed: ${updated.offer_letter_error}`);
      else toast.success(decision === 'ACCEPTED' ? (updated.offer_letter_sent_at ? 'Offer accepted; candidate moved to Hired and the configured email backend reported success' : 'Offer accepted; candidate moved to Hired') : 'Offer marked declined');
      await load();
    }
    catch (error) { toast.error(errorMessage(error, 'Could not record candidate response')); }
    finally { setSaving(false); }
  };

  const retryLetter = async (offer: CandidateOffer) => {
    if (offer.offer_letter_sent_at && !window.confirm('Resend the formal offer letter PDF to the candidate?')) return;
    setSaving(true);
    try {
      const updated = await recruitmentApi.retryAcceptedOfferLetter(offer.id);
      if (updated.offer_letter_error) toast.error(`Formal letter email failed: ${updated.offer_letter_error}`);
      else toast.success('Formal offer letter email submitted to the configured email backend');
      await load();
    } catch (error) { toast.error(errorMessage(error, 'Could not retry formal letter delivery')); }
    finally { setSaving(false); }
  };

  const linkEmployee = async (offer: CandidateOffer) => {
    const employeeId = employeeSelections[offer.id];
    if (!employeeId) { toast.error('Select the employee profile first.'); return; }
    const targetEmployee = employees.find((employee) => employee.id === employeeId);
    if (!targetEmployee) { toast.error('The selected employee is unavailable. Refresh and select again.'); return; }
    if (!window.confirm(offer.employee_name
      ? `Move this offer letter from ${offer.employee_name} to ${targetEmployee.full_name}?`
      : `Attach this offer letter to ${targetEmployee.full_name}?`)) return;
    setSaving(true);
    try { await recruitmentApi.linkCandidateOfferEmployee(offer.id, employeeId); toast.success(`Offer letter linked to ${targetEmployee.full_name}'s employee documents`); await load(); }
    catch (error) { toast.error(errorMessage(error, 'Could not attach offer letter to employee')); }
    finally { setSaving(false); }
  };

  const downloadLetter = async (offer: CandidateOffer) => {
    try {
      const blob = await recruitmentApi.downloadAcceptedOfferLetter(offer.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = offer.offer_letter_filename || `offer-${offer.id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(errorMessage(error, 'Could not download offer letter')); }
  };

  return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="min-w-0 flex-1"><Topbar /><div className="mx-auto max-w-6xl p-6">
    <div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><ShieldCheck /></div><div><h1 className="text-2xl font-bold text-slate-900">Candidate Offers</h1><p className="text-sm text-slate-600">Prepare offers, complete configured approvals, and record candidate responses.</p></div></div>
    {isHr && <form onSubmit={(event) => void createOffer(event)} className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Prepare offer</h2>{!applications.length ? <p className="text-sm text-slate-600">No candidates are waiting in Offer without an existing offer.</p> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm">Candidate<select required className={field} value={form.application} onChange={(event) => setForm({ ...form, application: event.target.value })}>{applications.map((application) => <option key={application.id} value={application.id}>{application.candidate_name} · {application.position_title} · Grade {application.grade_band}</option>)}</select></label><label className="text-sm">Annual salary ({selectedRule?.currency || 'currency'})<input required type="number" min={0} step="0.01" className={field} value={form.annual_salary} onChange={(event) => setForm({ ...form, annual_salary: event.target.value })} /></label><label className="text-sm">Signing bonus<input required type="number" min={0} step="0.01" className={field} value={form.signing_bonus} onChange={(event) => setForm({ ...form, signing_bonus: event.target.value })} /></label><label className="text-sm">Joining date<input required type="date" min={today} className={field} value={form.joining_date} onChange={(event) => setForm({ ...form, joining_date: event.target.value })} /></label><label className="text-sm">Offer expires<input required type="date" min={today} className={field} value={form.expires_on} onChange={(event) => setForm({ ...form, expires_on: event.target.value })} /></label><label className="text-sm">Applicable offer rule<div className="mt-2 text-sm text-slate-700">{selectedRule ? `${selectedRule.name}: ${selectedRule.currency} ${selectedRule.minimum_salary}–${selectedRule.maximum_salary}; bonus up to ${selectedRule.maximum_signing_bonus}` : 'No active rule for this candidate grade.'}</div></label><label className="text-sm sm:col-span-2 lg:col-span-3">Internal notes<textarea className={field} rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><button disabled={saving || !selectedRule} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit offer for approval'}</button></>}</form>}
    {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div> : offers.length === 0 ? <div className="rounded-xl border bg-white p-8 text-center text-slate-600">No offers to display.</div> : <div className="space-y-4">{offers.map((offer) => <section key={offer.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{offer.candidate_name}</h2><p className="text-sm text-slate-600">{offer.position_title} · {offer.requisition_number} · Grade {offer.grade_band}</p><p className="mt-2 text-sm font-medium">{offer.currency} {Number(offer.annual_salary).toLocaleString()} annual · {offer.currency} {Number(offer.signing_bonus).toLocaleString()} signing bonus</p><p className="text-sm text-slate-600">Joining {offer.joining_date} · Expires {offer.expires_on}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">{offer.status.replaceAll('_', ' ')}</span></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{offer.approvals.map((approval) => <div key={approval.id} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex justify-between gap-2"><span>{approval.role_code.replaceAll('_', ' ')} · {approval.assigned_to_name}</span><span>{approval.status}</span></div>{approval.comments && <p className="mt-1 text-slate-600">{approval.comments}</p>}</div>)}</div>
      <div className="mt-4 flex flex-wrap gap-2">{offer.my_approval_id && offer.status === 'PENDING_APPROVAL' && <><button disabled={saving} onClick={() => void approve(offer, 'APPROVE')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"><Check size={16} /> Approve</button><button disabled={saving} onClick={() => void approve(offer, 'REJECT')} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Reject</button></>}{isHr && offer.status === 'APPROVED' && <button disabled={saving} onClick={() => void send(offer)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"><Send size={16} /> Send offer email</button>}{isHr && offer.status === 'SENT' && <><button disabled={saving} onClick={() => void response(offer, 'ACCEPTED')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">Record accepted</button><button disabled={saving} onClick={() => void response(offer, 'DECLINED')} className="rounded-lg border px-3 py-2 text-sm">Record declined</button></>}</div>
      {isHr && offer.status === 'ACCEPTED' && <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3"><p className="text-sm font-medium text-emerald-900">Candidate is Hired. Acceptance does not create an employee profile automatically.</p>{offer.offer_letter_sent_at ? <p className="mt-2 text-sm text-emerald-800">The configured email backend reported success at {new Date(offer.offer_letter_sent_at).toLocaleString()}. This does not confirm delivery to the candidate’s inbox.</p> : offer.offer_letter_error ? <p className="mt-2 text-sm text-red-700">Formal letter email failed: {offer.offer_letter_error}</p> : <p className="mt-2 text-sm text-amber-800">The formal offer letter email has not been confirmed as sent yet.</p>}<div className="mt-3 flex flex-wrap items-center gap-2">{offer.offer_letter_filename && <button onClick={() => void downloadLetter(offer)} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><Download size={15} /> Download PDF</button>}<button disabled={saving} onClick={() => void retryLetter(offer)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{offer.offer_letter_sent_at ? 'Resend formal letter email' : offer.offer_letter_filename ? 'Retry letter email' : 'Generate letter and retry email'}</button>{offer.employee_name && <span className="text-sm text-emerald-800">Currently attached to {offer.employee_name}’s employee documents.</span>}{offer.offer_letter_filename && <><select className="rounded-lg border bg-white px-3 py-2 text-sm" value={employeeSelections[offer.id] || offer.employee_id || ''} onChange={(event) => setEmployeeSelections({ ...employeeSelections, [offer.id]: event.target.value })}><option value="">Select employee profile…</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_id}) · {employee.official_email}</option>)}</select><button disabled={saving || !(employeeSelections[offer.id] || offer.employee_id)} onClick={() => void linkEmployee(offer)} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-50">{offer.employee_name ? 'Move / attach letter' : 'Attach offer letter'}</button></>}</div>{!offer.employee_name && <p className="mt-2 text-xs text-emerald-800">Create the new hire’s employee profile first, then select it here. This links the PDF only; it does not create the employee record.</p>}</div>}
    </section>)}</div>}
  </div></main></div>;
}
