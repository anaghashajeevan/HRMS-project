import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ClipboardCheck, Loader2, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { monthlyKPIsApi, teamPerformanceReviewApi } from '../../api/performance';
import type { MonthlyKPI, TeamPerformanceReviewRow } from '../../types/performance';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function currentFinancialYear() {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

const STATUS_STYLES: Record<string, string> = {
  EMPLOYEE_SUBMITTED: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  RETURNED: 'bg-rose-100 text-rose-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-gray-100 text-gray-700',
};

function KpiReviewEditor({
  kpi,
  editable,
  onSaved,
}: {
  kpi: MonthlyKPI;
  editable: boolean;
  onSaved: () => void;
}) {
  const [managerActual, setManagerActual] = useState(kpi.manager_actual || '');
  const [rating, setRating] = useState(kpi.manager_rating?.toString() || '');
  const [comment, setComment] = useState(kpi.manager_comment || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setManagerActual(kpi.manager_actual || '');
    setRating(kpi.manager_rating?.toString() || '');
    setComment(kpi.manager_comment || '');
  }, [kpi]);

  const save = async () => {
    setSaving(true);
    try {
      await monthlyKPIsApi.update(kpi.id, {
        manager_actual: managerActual,
        manager_rating: rating ? Number(rating) : null,
        manager_comment: comment,
      });
      setSaved(true);
      toast.success('KPI review saved');
      onSaved();
    } catch {
      toast.error('Could not save this KPI review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className={`border-t align-top transition-colors ${saved ? 'border-emerald-200 bg-emerald-50/70' : 'border-gray-100'}`}>
      <td className="px-4 py-3 font-medium text-gray-900">{kpi.name}</td>
      <td className="px-4 py-3 text-gray-600">{kpi.target_value || '—'}</td>
      <td className="px-4 py-3 text-gray-700">
        <div>{kpi.actual_value || '—'}</div>
        {kpi.employee_comment && <p className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-gray-500">{kpi.employee_comment}</p>}
      </td>
      <td className="min-w-36 px-4 py-3">
        <input disabled={!editable} value={managerActual} onChange={(e) => { setManagerActual(e.target.value); setSaved(false); }} aria-label={`${kpi.name} manager actual`} className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm disabled:bg-gray-50" placeholder="Verified result" />
      </td>
      <td className="w-24 px-4 py-3">
        <select disabled={!editable} value={rating} onChange={(e) => { setRating(e.target.value); setSaved(false); }} aria-label={`${kpi.name} manager rating`} className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm disabled:bg-gray-50">
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </td>
      <td className="min-w-48 px-4 py-3">
        <textarea disabled={!editable} value={comment} onChange={(e) => { setComment(e.target.value); setSaved(false); }} aria-label={`${kpi.name} manager comment`} className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm disabled:bg-gray-50" rows={2} placeholder="Review note" />
        {editable && <button disabled={saving} onClick={save} className={`mt-1 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${saved ? 'bg-emerald-600' : 'bg-indigo-600'}`}>{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} {saved ? 'Saved' : 'Save KPI'}</button>}
      </td>
    </tr>
  );
}

export default function TeamPerformanceReviewPage() {
  const now = new Date();
  const [financialYear, setFinancialYear] = useState(currentFinancialYear);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<TeamPerformanceReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('OPEN_REVIEWS');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      setRows(await teamPerformanceReviewApi.list({ financial_year: financialYear, month }));
    } catch {
      toast.error('Could not load team performance reviews');
      setRows([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [financialYear, month]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    needs: rows.filter((row) => row.monthly_plan?.status === 'EMPLOYEE_SUBMITTED').length,
    reviewing: rows.filter((row) => row.monthly_plan?.status === 'UNDER_REVIEW').length,
    approved: rows.filter((row) => ['APPROVED', 'CLOSED'].includes(row.monthly_plan?.status || '')).length,
    returned: rows.filter((row) => row.monthly_plan?.status === 'RETURNED').length,
    noPlan: rows.filter((row) => !row.monthly_plan).length,
  }), [rows]);

  const visibleRows = rows.filter((row) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${row.employee_name} ${row.employee_code} ${row.position} ${row.department}`.toLowerCase().includes(query);
    const status = row.monthly_plan?.status;
    const matchesFilter = filter === 'ALL'
      || (filter === 'OPEN_REVIEWS' && ['EMPLOYEE_SUBMITTED', 'UNDER_REVIEW'].includes(status || ''))
      || (filter === 'NEEDS_REVIEW' && status === 'EMPLOYEE_SUBMITTED')
      || (filter === 'UNDER_REVIEW' && status === 'UNDER_REVIEW')
      || (filter === 'APPROVED' && ['APPROVED', 'CLOSED'].includes(status || ''))
      || (filter === 'RETURNED' && status === 'RETURNED')
      || (filter === 'NO_PLAN' && !row.monthly_plan);
    return matchesSearch && matchesFilter;
  });

  const makeDecision = async (row: TeamPerformanceReviewRow, status: 'UNDER_REVIEW' | 'APPROVED' | 'RETURNED') => {
    if (!row.monthly_plan) return;
    setDecisionBusy(true);
    try {
      await teamPerformanceReviewApi.decide(row.monthly_plan.id, {
        status,
        ...(status === 'RETURNED' ? { manager_comments: returnComment.trim() } : {}),
      });
      setReturnComment('');
      toast.success(status === 'UNDER_REVIEW' ? 'Review opened' : status === 'APPROVED' ? 'Monthly review approved' : 'Returned to employee');
      await load(false);
    } catch {
      toast.error('Could not update the review status');
    } finally {
      setDecisionBusy(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"><Users className="h-3.5 w-3.5" /> Team performance</div>
              <h1 className="text-2xl font-bold text-gray-900">Monthly team review</h1>
              <p className="mt-1 text-sm text-gray-500">Review each employee’s submitted KRAs and KPIs together for the selected month.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                {[0, 1, 2, 3].map((offset) => {
                  const startYear = Number(currentFinancialYear().slice(0, 4)) - offset;
                  const fy = `${startYear}-${String(startYear + 1).slice(-2)}`;
                  return <option key={fy} value={fy}>FY {fy}</option>;
                })}
              </select>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
              </select>
            </div>
          </header>

          <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
            {[
              ['Needs review', counts.needs, 'text-amber-700'],
              ['In review', counts.reviewing, 'text-blue-700'],
              ['Approved', counts.approved, 'text-emerald-700'],
              ['Awaiting employee updates', counts.returned, 'text-rose-700'],
              ['No monthly plan', counts.noPlan, 'text-gray-600'],
            ].map(([label, value, color]) => <div key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"><p className="text-xs font-medium text-gray-500">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>)}
          </section>

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
              <div className="relative min-w-52 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, employee ID, role..." className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm" />
              </div>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                <option value="OPEN_REVIEWS">Open reviews</option><option value="NEEDS_REVIEW">Needs review</option><option value="UNDER_REVIEW">In review</option><option value="RETURNED">Awaiting employee updates</option><option value="APPROVED">Approved</option><option value="NO_PLAN">No monthly plan</option><option value="ALL">All employees</option>
              </select>
              <span className="text-xs text-gray-500">{visibleRows.length} employees</span>
            </div>

            {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div> : visibleRows.length === 0 ? (
              <div className="p-12 text-center"><ClipboardCheck className="mx-auto h-10 w-10 text-gray-300" /><p className="mt-3 font-semibold text-gray-800">No employees in this view</p><p className="mt-1 text-sm text-gray-500">Try another status, month, or financial year.</p></div>
            ) : <div className="divide-y divide-gray-100">
              {visibleRows.map((row) => {
                const plan = row.monthly_plan;
                const isExpanded = expanded === row.employee_id;
                const editable = plan?.status === 'UNDER_REVIEW';
                const kpiCount = plan?.kras.reduce((total, kra) => total + kra.kpis.length, 0) || 0;
                return <article key={row.employee_id}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-4 md:px-6">
                    <button aria-label={isExpanded ? 'Collapse employee review' : 'Expand employee review'} onClick={() => setExpanded(isExpanded ? null : row.employee_id)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                    <button onClick={() => setExpanded(isExpanded ? null : row.employee_id)} className="min-w-48 flex-1 text-left">
                      <p className="font-semibold text-gray-900">{row.employee_name}</p><p className="text-xs text-gray-500">{row.employee_code}{row.position ? ` · ${row.position}` : ''}{row.department ? ` · ${row.department}` : ''}</p>
                    </button>
                    <div className="text-xs text-gray-500">{plan ? `${plan.kras.length} KRAs · ${kpiCount} KPIs` : 'No plan for this month'}</div>
                    {plan && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[plan.status] || 'bg-gray-100 text-gray-700'}`}>{plan.status_display || plan.status.replaceAll('_', ' ')}</span>}
                    {plan && ['EMPLOYEE_SUBMITTED', 'UNDER_REVIEW', 'RETURNED'].includes(plan.status) && <button onClick={() => setExpanded(isExpanded ? null : row.employee_id)} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">{isExpanded ? 'Hide review' : plan.status === 'RETURNED' ? 'View return note' : 'Review'}</button>}
                  </div>

                  {isExpanded && <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-5 md:px-8">
                    {!plan ? <p className="text-sm text-gray-500">An annual plan or monthly plan has not been generated for this employee yet.</p> : <>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div><h3 className="font-semibold text-gray-900">{MONTHS[plan.month - 1]} {plan.year} · {plan.status_display || plan.status}</h3><p className="text-xs text-gray-500">Employee note: {plan.employee_comments || 'No overall note provided.'}</p></div>
                        {plan.status === 'EMPLOYEE_SUBMITTED' && <button disabled={decisionBusy} onClick={() => makeDecision(row, 'UNDER_REVIEW')} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60">Start review</button>}
                      </div>
                      {plan.status === 'RETURNED' && <p className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-800">Returned to employee: {plan.manager_comments || 'Waiting for employee updates.'}</p>}
                      {plan.kras.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-gray-500">No KRAs are included in this monthly plan.</p> : plan.kras.map((kra) => <section key={kra.id} className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3"><div><h4 className="font-semibold text-gray-900">{kra.name}</h4>{kra.description && <p className="text-xs text-gray-500">{kra.description}</p>}</div><span className="text-xs text-gray-500">{kra.weight}% weight · {kra.kpis.length} KPIs</span></div>
                        {kra.kpis.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-2.5">KPI</th><th className="px-4 py-2.5">Target</th><th className="px-4 py-2.5">Employee result</th><th className="px-4 py-2.5">Verified result</th><th className="px-4 py-2.5">Rating</th><th className="px-4 py-2.5">Manager comments</th></tr></thead><tbody>{kra.kpis.map((kpi) => <KpiReviewEditor key={kpi.id} kpi={kpi} editable={editable} onSaved={() => load(false)} />)}</tbody></table></div> : <p className="px-4 py-3 text-sm text-gray-500">No KPIs in this KRA.</p>}
                      </section>)}

                      {editable && <div className="mt-5 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-indigo-100 bg-white p-4">
                        <div className="max-w-xl flex-1"><label className="mb-1 block text-xs font-semibold text-gray-700">Return note</label><textarea value={returnComment} onChange={(e) => setReturnComment(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Explain what the employee should clarify or update" /></div>
                        <div className="flex gap-2"><button disabled={decisionBusy || !returnComment.trim()} onClick={() => makeDecision(row, 'RETURNED')} className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40">Return for changes</button><button disabled={decisionBusy} onClick={() => makeDecision(row, 'APPROVED')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{decisionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve month</button></div>
                      </div>}
                    </>}
                  </div>}
                </article>;
              })}
            </div>}
          </section>
        </main>
      </div>
    </div>
  );
}
