import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { recruitmentApi, type InterviewScorecard, type OfferRule, type RecruitmentSettings, type RecruitmentStage } from '../../api/recruitment';

type Tab = 'stages' | 'scorecards' | 'offers';
const roles = [['SYSTEM_ADMIN', 'System administrator'], ['HR_ADMIN', 'HR administrator'], ['MANAGER', 'Manager'], ['REPORTING_MANAGER', 'Reporting manager'], ['HOD', 'Department head']];
const approverRoles = [['HR_ADMIN', 'HR administrator'], ['FINANCE_ADMIN', 'Finance approver'], ['SYSTEM_ADMIN', 'System administrator']];
const errorText = (error: any) => error?.response?.data?.detail || Object.values(error?.response?.data || {}).flat().find((value) => typeof value === 'string') || 'Could not save hiring configuration';

export default function RecruitmentSettingsPage() {
  const [tab, setTab] = useState<Tab>('stages');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesterSettings, setRequesterSettings] = useState<RecruitmentSettings | null>(null);
  const [stages, setStages] = useState<RecruitmentStage[]>([]);
  const [scorecards, setScorecards] = useState<InterviewScorecard[]>([]);
  const [offerRules, setOfferRules] = useState<OfferRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [stageForm, setStageForm] = useState({ code: '', name: '', order: '1', is_active: true, is_terminal: false, terminal_outcome: 'OPEN' as 'OPEN' | 'HIRED' | 'REJECTED' });
  const [scorecardForm, setScorecardForm] = useState({ name: '', description: '', criteriaText: 'Communication | 25\nRole knowledge | 35\nProblem solving | 25\nCulture and collaboration | 15', is_active: true });
  const [offerForm, setOfferForm] = useState({ name: '', grade_band: '', currency: 'INR', minimum_salary: '', maximum_salary: '', maximum_signing_bonus: '0', required_approvers: ['HR_ADMIN'], is_active: true });

  const load = async () => {
    setLoading(true);
    try {
      const [settings, stageRows, scorecardRows, offerRows] = await Promise.all([
        recruitmentApi.settings(), recruitmentApi.stages(), recruitmentApi.scorecards(), recruitmentApi.offerRules(),
      ]);
      setRequesterSettings(settings);
      setStages(stageRows);
      setScorecards(scorecardRows);
      setOfferRules(offerRows);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setStageForm({ code: '', name: '', order: String(stages.length + 1), is_active: true, is_terminal: false, terminal_outcome: 'OPEN' });
    setScorecardForm({ name: '', description: '', criteriaText: 'Communication | 25\nRole knowledge | 35\nProblem solving | 25\nCulture and collaboration | 15', is_active: true });
    setOfferForm({ name: '', grade_band: '', currency: 'INR', minimum_salary: '', maximum_salary: '', maximum_signing_bonus: '0', required_approvers: ['HR_ADMIN'], is_active: true });
  };

  const startEditStage = (item: RecruitmentStage) => { setEditingId(item.id); setStageForm({ ...item, order: String(item.order) }); };
  const startEditScorecard = (item: InterviewScorecard) => {
    setEditingId(item.id);
    setScorecardForm({ name: item.name, description: item.description, is_active: item.is_active, criteriaText: item.criteria.map((criterion) => `${criterion.label} | ${criterion.weight}${criterion.guidance ? ` | ${criterion.guidance}` : ''}`).join('\n') });
  };
  const startEditOffer = (item: OfferRule) => { setEditingId(item.id); setOfferForm({ ...item, minimum_salary: item.minimum_salary, maximum_salary: item.maximum_salary, maximum_signing_bonus: item.maximum_signing_bonus }); };

  const saveRequesterRoles = async () => {
    if (!requesterSettings) return;
    setSaving(true);
    try {
      setRequesterSettings(await recruitmentApi.updateSettings({ allowed_requester_roles: requesterSettings.allowed_requester_roles }));
      toast.success('Requisition requester roles saved');
    } catch (error) { toast.error(errorText(error)); } finally { setSaving(false); }
  };

  const saveStage = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      const code = stageForm.code || stageForm.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await recruitmentApi.saveStage(editingId, { ...stageForm, code, order: Number(stageForm.order) });
      toast.success('Application stage saved'); resetForm(); await load();
    } catch (error) { toast.error(errorText(error)); } finally { setSaving(false); }
  };

  const saveScorecard = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      const criteria = scorecardForm.criteriaText.split('\n').filter((line) => line.trim()).map((line) => {
        const [label, weight, ...guidance] = line.split('|').map((part) => part.trim());
        return { label, weight: Number(weight), guidance: guidance.join(' | ') };
      });
      await recruitmentApi.saveScorecard(editingId, { name: scorecardForm.name, description: scorecardForm.description, criteria, is_active: scorecardForm.is_active });
      toast.success('Interview scorecard saved'); resetForm(); await load();
    } catch (error) { toast.error(errorText(error)); } finally { setSaving(false); }
  };

  const saveOffer = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { await recruitmentApi.saveOfferRule(editingId, offerForm); toast.success('Offer rule saved'); resetForm(); await load(); }
    catch (error) { toast.error(errorText(error)); } finally { setSaving(false); }
  };

  const removeItem = async (kind: Tab, id: string) => {
    if (!window.confirm('Delete this configuration?')) return;
    setSaving(true);
    try {
      if (kind === 'stages') await recruitmentApi.deleteStage(id);
      if (kind === 'scorecards') await recruitmentApi.deleteScorecard(id);
      if (kind === 'offers') await recruitmentApi.deleteOfferRule(id);
      toast.success('Configuration deleted');
      if (editingId === id) resetForm();
      await load();
    } catch (error) { toast.error(errorText(error)); } finally { setSaving(false); }
  };

  const toggleRole = (role: string) => {
    if (!requesterSettings) return;
    const current = requesterSettings.allowed_requester_roles;
    const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
    if (!next.length) return toast.error('At least one requester role must remain enabled');
    setRequesterSettings({ ...requesterSettings, allowed_requester_roles: next });
  };

  return <div className="flex h-screen bg-gray-50"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><Topbar /><main className="flex-1 overflow-y-auto p-6">
    <Link to="/recruitment/requisitions" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-indigo-700"><ArrowLeft className="h-4 w-4" />Hiring requisitions</Link>
    <div className="mb-6"><p className="text-sm font-semibold text-indigo-600">Recruitment setup</p><h1 className="mt-1 text-2xl font-bold text-gray-900">Hiring rules</h1><p className="mt-1 text-sm text-gray-500">Configure who can request hires and the defaults used by the recruitment process.</p></div>

    {requesterSettings && <section className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">Requisition access and approvals</h2><p className="mt-1 text-sm text-gray-500">Approval steps are managed in the shared workflow editor.</p></div><div className="flex gap-2"><Link to="/settings/approval-workflows" className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Approval workflow</Link><button onClick={() => void saveRequesterRoles()} disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save requester roles</button></div></div><div className="mt-4 flex flex-wrap gap-5">{roles.map(([code, label]) => <label key={code} className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={requesterSettings.allowed_requester_roles.includes(code)} onChange={() => toggleRole(code)} />{label}</label>)}</div><p className="mt-3 text-xs text-gray-500">Approver steps support reporting manager, department head, HR, Finance, system administrator, or a named employee. Openings over budget are blocked; no budget bypass is enabled.</p></section>}

    <div className="mb-4 flex flex-wrap gap-2">{([['stages', 'Application stages'], ['scorecards', 'Interview scorecards'], ['offers', 'Offer rules']] as [Tab, string][]).map(([key, label]) => <button key={key} onClick={() => { setTab(key); resetForm(); }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}`}>{label}</button>)}</div>

    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><h2 className="mb-4 font-semibold text-gray-900">Configured {tab === 'stages' ? 'stages' : tab === 'scorecards' ? 'scorecards' : 'offer rules'}</h2>
        <div className="space-y-3">
          {tab === 'stages' && stages.map((item) => <CatalogRow key={item.id} title={`${item.order}. ${item.name}`} subtitle={`${item.code} · ${item.is_terminal ? item.terminal_outcome : 'Open stage'}`} active={item.is_active} onEdit={() => startEditStage(item)} onDelete={() => void removeItem(tab, item.id)} />)}
          {tab === 'scorecards' && scorecards.map((item) => <CatalogRow key={item.id} title={item.name} subtitle={`${item.criteria.length} criteria · ${item.description || 'No description'}`} active={item.is_active} onEdit={() => startEditScorecard(item)} onDelete={() => void removeItem(tab, item.id)} />)}
          {tab === 'offers' && offerRules.map((item) => <CatalogRow key={item.id} title={`${item.name} · ${item.grade_band}`} subtitle={`${item.currency} ${Number(item.minimum_salary).toLocaleString()}–${Number(item.maximum_salary).toLocaleString()} · approvals: ${item.required_approvers.join(', ')}`} active={item.is_active} onEdit={() => startEditOffer(item)} onDelete={() => void removeItem(tab, item.id)} />)}
          {((tab === 'stages' && !stages.length) || (tab === 'scorecards' && !scorecards.length) || (tab === 'offers' && !offerRules.length)) && <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">No configuration added yet.</p>}
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-gray-900">{editingId ? 'Edit' : 'Add'} {tab === 'stages' ? 'stage' : tab === 'scorecards' ? 'scorecard' : 'offer rule'}</h2>{editingId && <button onClick={resetForm} className="text-sm font-semibold text-gray-500">New</button>}</div>
        {tab === 'stages' && <form onSubmit={saveStage} className="space-y-3"><Field label="Stage name"><input required value={stageForm.name} onChange={(event) => setStageForm({ ...stageForm, name: event.target.value, code: editingId ? stageForm.code : '' })} className={inputClass} /></Field><Field label="Code (auto-created if blank)"><input value={stageForm.code} onChange={(event) => setStageForm({ ...stageForm, code: event.target.value })} className={inputClass} /></Field><Field label="Order"><input required type="number" min="1" value={stageForm.order} onChange={(event) => setStageForm({ ...stageForm, order: event.target.value })} className={inputClass} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stageForm.is_terminal} onChange={(event) => setStageForm({ ...stageForm, is_terminal: event.target.checked, terminal_outcome: event.target.checked ? 'REJECTED' : 'OPEN' })} />Terminal stage</label>{stageForm.is_terminal && <Field label="Terminal result"><select value={stageForm.terminal_outcome} onChange={(event) => setStageForm({ ...stageForm, terminal_outcome: event.target.value as 'HIRED' | 'REJECTED' })} className={inputClass}><option value="HIRED">Hired</option><option value="REJECTED">Rejected</option></select></Field>}<ActiveCheck checked={stageForm.is_active} onChange={(is_active) => setStageForm({ ...stageForm, is_active })} /><SaveButton saving={saving} editing={Boolean(editingId)} /></form>}
        {tab === 'scorecards' && <form onSubmit={saveScorecard} className="space-y-3"><Field label="Scorecard name"><input required value={scorecardForm.name} onChange={(event) => setScorecardForm({ ...scorecardForm, name: event.target.value })} className={inputClass} /></Field><Field label="Description"><textarea rows={2} value={scorecardForm.description} onChange={(event) => setScorecardForm({ ...scorecardForm, description: event.target.value })} className={inputClass} /></Field><Field label="Criteria (one per line: label | weight | optional guidance)"><textarea required rows={8} value={scorecardForm.criteriaText} onChange={(event) => setScorecardForm({ ...scorecardForm, criteriaText: event.target.value })} className={inputClass} /></Field><p className="text-xs text-gray-500">Weights must add up to 100.</p><ActiveCheck checked={scorecardForm.is_active} onChange={(is_active) => setScorecardForm({ ...scorecardForm, is_active })} /><SaveButton saving={saving} editing={Boolean(editingId)} /></form>}
        {tab === 'offers' && <form onSubmit={saveOffer} className="space-y-3"><Field label="Rule name"><input required value={offerForm.name} onChange={(event) => setOfferForm({ ...offerForm, name: event.target.value })} className={inputClass} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Grade"><input required value={offerForm.grade_band} onChange={(event) => setOfferForm({ ...offerForm, grade_band: event.target.value })} className={inputClass} placeholder="G5" /></Field><Field label="Currency"><input required maxLength={3} value={offerForm.currency} onChange={(event) => setOfferForm({ ...offerForm, currency: event.target.value.toUpperCase() })} className={inputClass} /></Field><Field label="Minimum salary"><input required type="number" min="0" step="0.01" value={offerForm.minimum_salary} onChange={(event) => setOfferForm({ ...offerForm, minimum_salary: event.target.value })} className={inputClass} /></Field><Field label="Maximum salary"><input required type="number" min="0" step="0.01" value={offerForm.maximum_salary} onChange={(event) => setOfferForm({ ...offerForm, maximum_salary: event.target.value })} className={inputClass} /></Field><Field label="Maximum signing bonus"><input required type="number" min="0" step="0.01" value={offerForm.maximum_signing_bonus} onChange={(event) => setOfferForm({ ...offerForm, maximum_signing_bonus: event.target.value })} className={inputClass} /></Field></div><fieldset><legend className="mb-2 text-sm font-medium text-gray-700">Required offer approvers</legend><div className="flex flex-wrap gap-4">{approverRoles.map(([code, label]) => <label key={code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={offerForm.required_approvers.includes(code)} onChange={() => setOfferForm({ ...offerForm, required_approvers: offerForm.required_approvers.includes(code) ? offerForm.required_approvers.filter((role) => role !== code) : [...offerForm.required_approvers, code] })} />{label}</label>)}</div></fieldset><ActiveCheck checked={offerForm.is_active} onChange={(is_active) => setOfferForm({ ...offerForm, is_active })} /><SaveButton saving={saving} editing={Boolean(editingId)} /></form>}
      </section>
    </div>}
  </main></div></div>;
}

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-gray-700">{label}{children}</label>; }
function ActiveCheck({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />Active</label>; }
function SaveButton({ saving, editing }: { saving: boolean; editing: boolean }) { return <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editing ? 'Save changes' : 'Add configuration'}</button>; }
function CatalogRow({ title, subtitle, active, onEdit, onDelete }: { title: string; subtitle: string; active: boolean; onEdit: () => void; onDelete: () => void }) { return <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-gray-800">{title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{active ? 'Active' : 'Inactive'}</span></div><p className="mt-1 break-words text-xs text-gray-500">{subtitle}</p></div><div className="flex shrink-0 gap-1"><button onClick={onEdit} className="rounded px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">Edit</button><button onClick={onDelete} aria-label="Delete" className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></div>; }
