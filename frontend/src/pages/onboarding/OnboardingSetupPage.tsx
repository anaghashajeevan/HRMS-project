import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { onboardingApi, type OnboardingCase, type OnboardingSetupOptions, type OnboardingTemplate, type OnboardingTemplateTask } from '../../api/onboarding';
import OnboardingTaskCard from './OnboardingTaskCard';

type TemplateForm = {
  name: string; description: string; department: string; position: string; location: string; is_active: boolean; tasks: OnboardingTemplateTask[];
};
const blankTask = (order: number): OnboardingTemplateTask => ({
  title: '', description: '', task_type: 'TASK', owner_type: 'HR',
  owner_employee: null, employee_document_type: 'OTHER',
  due_days_from_joining: 0, is_required: true, order,
});
const blankForm = (): TemplateForm => ({ name: '', description: '', department: '', position: '', location: '', is_active: true, tasks: [blankTask(1)] });
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500';
const errorMessage = (error: any) => error?.response?.data?.detail || error?.response?.data?.offer?.[0] || error?.response?.data?.template?.[0] || error?.response?.data?.tasks?.[0] || 'Could not complete the onboarding request';

export default function OnboardingSetupPage() {
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [options, setOptions] = useState<OnboardingSetupOptions>({ departments: [], positions: [], locations: [], employees: [], accepted_offers: [] });
  const [cases, setCases] = useState<OnboardingCase[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [form, setForm] = useState<TemplateForm>(blankForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [templateRows, setupOptions, caseRows] = await Promise.all([onboardingApi.templates(), onboardingApi.options(), onboardingApi.cases()]);
      setTemplates(Array.isArray(templateRows) ? templateRows : []);
      setOptions(setupOptions);
      setCases(Array.isArray(caseRows) ? caseRows : []);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const selectedOffer = options.accepted_offers.find((offer) => offer.id === selectedOfferId);
  const matchingTemplates = selectedOffer
    ? templates.filter((template) => template.is_active && selectedOffer.compatible_template_ids.includes(template.id))
    : [];
  const startOnboarding = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOfferId || !selectedTemplateId) { toast.error('Select an accepted offer and a matching active template.'); return; }
    setSaving(true);
    try {
      await onboardingApi.start(selectedOfferId, selectedTemplateId);
      toast.success('Onboarding started and checklist copied for the new hire');
      setSelectedOfferId(''); setSelectedTemplateId('');
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const edit = (template: OnboardingTemplate) => {
    setEditingId(template.id);
    setForm({
      name: template.name, description: template.description, department: template.department || '',
      position: template.position || '', location: template.location || '', is_active: template.is_active,
      tasks: template.tasks.map((task, index) => ({ ...task, order: index + 1 })),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const reset = () => { setEditingId(null); setForm(blankForm()); };
  const updateTask = (index: number, changes: Partial<OnboardingTemplateTask>) => setForm((current) => ({
    ...current, tasks: current.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, ...changes } : task),
  }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.tasks.length || form.tasks.some((task) => !task.title.trim())) {
      toast.error('Add a title to every checklist item.'); return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(), description: form.description.trim(), department: form.department || null,
      position: form.position || null, location: form.location || null, is_active: form.is_active,
      tasks: form.tasks.map((task, index) => ({ ...task, title: task.title.trim(), order: index + 1 })),
    };
    try {
      if (editingId) await onboardingApi.updateTemplate(editingId, payload);
      else await onboardingApi.createTemplate(payload);
      toast.success(editingId ? 'Onboarding template updated' : 'Onboarding template created');
      reset(); await load();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };
  const remove = async (template: OnboardingTemplate) => {
    if (!window.confirm(`Delete the onboarding template “${template.name}”?`)) return;
    setSaving(true);
    try { await onboardingApi.deleteTemplate(template.id); toast.success('Onboarding template deleted'); if (editingId === template.id) reset(); await load(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="min-w-0 flex-1"><Topbar /><div className="mx-auto max-w-7xl space-y-6 p-6">
    <header className="flex items-start gap-3"><span className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><ClipboardCheck /></span><div><p className="text-sm font-semibold text-indigo-600">Onboarding</p><h1 className="text-2xl font-bold text-slate-900">Onboarding setup</h1><p className="mt-1 text-sm text-slate-600">Maintain reusable checklists and start onboarding for hires from their accepted, employee-linked offer.</p></div></header>

    <section className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5"><h2 className="text-lg font-semibold text-slate-900">Start onboarding</h2><p className="mb-4 mt-1 text-sm text-slate-600">This uses the employee profile already linked to an accepted recruitment offer. It will not create another employee.</p><form onSubmit={(event) => void startOnboarding(event)} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><label className="text-sm font-medium">Accepted offer<select required className={fieldClass} value={selectedOfferId} onChange={(event) => { setSelectedOfferId(event.target.value); setSelectedTemplateId(''); }}><option value="">{options.accepted_offers.length ? 'Choose an accepted offer' : 'No eligible accepted offers'}</option>{options.accepted_offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.employee_name} ({offer.employee_number}) · {offer.position_title || offer.candidate_name} · joining {offer.joining_date}</option>)}</select></label><label className="text-sm font-medium">Matching onboarding template<select required disabled={!selectedOfferId} className={fieldClass} value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}><option value="">{!selectedOfferId ? 'Select an offer first' : matchingTemplates.length ? 'Choose a template' : 'No active matching templates'}</option>{matchingTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><button disabled={saving || !selectedOfferId || !selectedTemplateId} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}Start onboarding</button></form></section>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Onboarding cases</h2>{loading ? <div className="flex justify-center py-6"><Loader2 className="animate-spin" /></div> : cases.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">No onboarding cases started yet.</p> : <div className="space-y-3">{cases.map((onboardingCase) => <article key={onboardingCase.id} className="space-y-3 rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{onboardingCase.employee_name} ({onboardingCase.employee_number})</h3><p className="text-sm text-slate-600">{onboardingCase.template_display} · Joining {onboardingCase.joining_date}</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{onboardingCase.status.replaceAll('_', ' ')}</span></div><p className="text-xs font-medium text-slate-500">Checklist · {onboardingCase.tasks.length} item(s)</p>{onboardingCase.tasks.map((task) => <OnboardingTaskCard key={task.id} task={task} employees={options.employees} onChanged={() => void load()} />)}</article>)}</div>}</section>

    <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editingId ? 'Edit template' : 'Create template'}</h2>{editingId && <button type="button" onClick={reset} className="text-sm text-slate-600">Create new</button>}</div>
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Template name<input required maxLength={150} className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Example: Software Engineer onboarding" /></label>
        <label className="text-sm font-medium">Department / team scope<select className={fieldClass} value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}><option value="">All departments</option>{options.departments.map((row) => <option key={row.id} value={row.id}>{row.path.replace(/^\/+/, '') || row.name}{row.type === 'TEAM' ? ' (Team)' : ''}</option>)}</select></label>
        <label className="text-sm font-medium">Position scope<select className={fieldClass} value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })}><option value="">All positions</option>{options.positions.map((row) => <option key={row.id} value={row.id}>{row.title}{row.department_name ? ` · ${row.department_name}` : ''}</option>)}</select></label>
        <label className="text-sm font-medium">Work location scope<select className={fieldClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })}><option value="">All locations</option>{options.locations.map((row) => <option key={row.id} value={row.id}>{row.path.replace(/^\/+/, '')}</option>)}</select></label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />Active and available for new hires</label>
        <label className="text-sm font-medium md:col-span-2">Description<textarea rows={2} className={fieldClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Who should use this template and any setup notes" /></label>
      </div>
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Checklist items</h3><p className="text-xs text-slate-500">Use negative due-day values for tasks due before joining; positive values are after joining.</p></div><button type="button" onClick={() => setForm((current) => ({ ...current, tasks: [...current.tasks, blankTask(current.tasks.length + 1)] }))} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><Plus size={16} /> Add item</button></div>
        {!form.tasks.length && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">Add at least one checklist item.</p>}
        {form.tasks.map((task, index) => <div key={index} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-12">
          <label className="text-xs font-medium md:col-span-4">Item title<input required className={fieldClass} value={task.title} onChange={(event) => updateTask(index, { title: event.target.value })} placeholder="Submit identity documents" /></label>
          <label className="text-xs font-medium md:col-span-2">Item type<select className={fieldClass} value={task.task_type} onChange={(event) => updateTask(index, { task_type: event.target.value as OnboardingTemplateTask['task_type'] })}><option value="TASK">Task</option><option value="DOCUMENT">Document submission</option><option value="ACKNOWLEDGEMENT">Policy acknowledgement</option></select></label>
          <label className="text-xs font-medium md:col-span-2">Owner<select className={fieldClass} value={task.owner_type} onChange={(event) => updateTask(index, { owner_type: event.target.value as OnboardingTemplateTask['owner_type'], owner_employee: null })}><option value="EMPLOYEE">New employee</option><option value="HR">HR</option><option value="MANAGER">Reporting manager</option><option value="IT_ADMIN">IT / Administration</option><option value="OTHER">Other</option></select></label>
          {(task.owner_type === 'IT_ADMIN' || task.owner_type === 'OTHER') && <label className="text-xs font-medium md:col-span-3">Assign to employee<select className={fieldClass} value={task.owner_employee || ''} onChange={(event) => updateTask(index, { owner_employee: event.target.value || null })}><option value="">Assign manually after starting</option>{options.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_number}){employee.position_title ? ` · ${employee.position_title}` : ''}</option>)}</select></label>}
          {task.task_type === 'DOCUMENT' && <label className="text-xs font-medium md:col-span-2">Document category<select className={fieldClass} value={task.employee_document_type} onChange={(event) => updateTask(index, { employee_document_type: event.target.value })}><option value="ID_PROOF">ID Proof</option><option value="ADDRESS_PROOF">Address Proof</option><option value="EDUCATION">Education Certificate</option><option value="EXPERIENCE">Experience Certificate</option><option value="PAN">PAN Card</option><option value="AADHAAR">Aadhaar Card</option><option value="PASSPORT">Passport</option><option value="MEDICAL">Medical Certificate</option><option value="OTHER">Other</option></select></label>}
          <label className="text-xs font-medium md:col-span-2">Due day relative to joining<input type="number" className={fieldClass} value={task.due_days_from_joining} onChange={(event) => updateTask(index, { due_days_from_joining: Number(event.target.value) })} /></label>
          <label className="flex items-center gap-2 self-end pb-2 text-xs md:col-span-1"><input type="checkbox" checked={task.is_required} onChange={(event) => updateTask(index, { is_required: event.target.checked })} />Required</label>
          <button type="button" disabled={form.tasks.length === 1} onClick={() => setForm((current) => ({ ...current, tasks: current.tasks.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i + 1 })) }))} title="Remove item" className="self-end justify-self-end rounded p-2 text-rose-600 disabled:opacity-30"><Trash2 size={16} /></button>
          <label className="text-xs font-medium md:col-span-11">Instructions<textarea rows={2} className={fieldClass} value={task.description} onChange={(event) => updateTask(index, { description: event.target.value })} placeholder="What should the owner do or upload?" /></label>
        </div>)}
      </section>
      <div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{editingId ? 'Save template' : 'Create template'}</button></div>
    </form>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Configured templates</h2>{loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> : templates.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">No onboarding templates yet.</p> : <div className="grid gap-3 lg:grid-cols-2">{templates.map((template) => <article key={template.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{template.name}</h3><span className={`rounded-full px-2 py-0.5 text-xs ${template.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{template.is_active ? 'Active' : 'Inactive'}</span></div><p className="mt-1 text-xs text-slate-500">{[template.department_path, template.position_title, template.location_path].filter(Boolean).join(' · ') || 'All departments, positions and locations'} · {template.tasks.length} checklist item(s)</p><p className="mt-2 text-sm text-slate-600">{template.description || 'No description'}</p></div><div className="flex shrink-0 gap-1"><button onClick={() => edit(template)} className="rounded px-2 py-1 text-sm font-medium text-indigo-700">Edit</button><button disabled={saving} onClick={() => void remove(template)} className="rounded p-1 text-rose-600 disabled:opacity-50" title="Delete"><Trash2 size={16} /></button></div></div><ol className="mt-3 list-inside list-decimal space-y-1 text-xs text-slate-600">{template.tasks.map((task) => <li key={task.id}>{task.title} · {task.owner_type_display || task.owner_type.replaceAll('_', ' ')} · {task.due_days_from_joining === 0 ? 'joining day' : `${Math.abs(task.due_days_from_joining)} days ${task.due_days_from_joining < 0 ? 'before' : 'after'} joining`}{task.is_required ? ' · required' : ''}</li>)}</ol></article>)}</div>}</section>
  </div></main></div>;
}
