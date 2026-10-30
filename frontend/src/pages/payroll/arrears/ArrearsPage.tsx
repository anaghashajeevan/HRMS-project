import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, CalculatorIcon } from '@heroicons/react/24/outline';
import SearchableSelect from '../../../components/SearchableSelect';
import {
  generateAssignmentArrears, generatePaidPeriodArrears, getArrears,
  getAssignments, getPayRuns, getRunEmployees, previewAssignmentArrears,
  previewPaidPeriodArrears,
} from '../../../api/payrollApi';

const money = (value: number | string) => Number(value || 0).toLocaleString('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const errorText = (error: any) => {
  const data = error?.response?.data;
  return typeof data === 'string' ? data : data?.detail || JSON.stringify(data) || 'The request failed.';
};

export default function ArrearsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paidRuns, setPaidRuns] = useState<any[]>([]);
  const [runEmployees, setRunEmployees] = useState<any[]>([]);
  const [correctionRunId, setCorrectionRunId] = useState('');
  const [correctionEmployeeId, setCorrectionEmployeeId] = useState('');
  const [correctionPreview, setCorrectionPreview] = useState<any>(null);
  const [refreshAttendance, setRefreshAttendance] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [assignmentResponse, arrearsResponse, runsResponse] = await Promise.all([
        getAssignments(), getArrears(), getPayRuns(),
      ]);
      let assignmentRows = assignmentResponse.data.results || assignmentResponse.data;
      let next = assignmentResponse.data.next;
      // Load the remaining pages too; retroactive assignments may be older than the first page.
      while (next) {
        const page = new URL(next, window.location.origin).searchParams.get('page');
        if (!page) break;
        const response = await getAssignments({ page });
        assignmentRows = [...assignmentRows, ...(response.data.results || response.data)];
        next = response.data.next;
      }
      setAssignments(assignmentRows);
      setItems(arrearsResponse.data || []);
      setPaidRuns((runsResponse.data.results || runsResponse.data).filter(
        (run: any) => run.run_type === 'REGULAR' && run.status === 'PAID',
      ));
    } catch (err: any) {
      setError(errorText(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const loadPreview = async (id = assignmentId) => {
    if (!id) return;
    setWorking(true); setError(''); setNotice(''); setPreview(null);
    try {
      const response = await previewAssignmentArrears(id);
      setPreview(response.data);
    } catch (err: any) { setError(errorText(err)); }
    finally { setWorking(false); }
  };

  const generate = async () => {
    if (!assignmentId || !reason.trim()) return;
    setWorking(true); setError(''); setNotice('');
    try {
      const response = await generateAssignmentArrears(assignmentId, reason.trim());
      setPreview(response.data);
      setNotice('Arrears items have been generated and added to the available register.');
      setReason('');
      const register = await getArrears();
      setItems(register.data || []);
    } catch (err: any) { setError(errorText(err)); }
    finally { setWorking(false); }
  };

  const selected = assignments.find((item) => item.id === assignmentId);

  const selectCorrectionRun = async (runId: string) => {
    setCorrectionRunId(runId); setCorrectionEmployeeId(''); setRunEmployees([]);
    setCorrectionPreview(null); setError('');
    if (!runId) return;
    try {
      const response = await getRunEmployees(runId);
      setRunEmployees(response.data || []);
    } catch (err: any) { setError(errorText(err)); }
  };

  const previewCorrection = async () => {
    if (!correctionRunId || !correctionEmployeeId) return;
    setWorking(true); setError(''); setNotice(''); setCorrectionPreview(null);
    try {
      const response = await previewPaidPeriodArrears(correctionRunId, correctionEmployeeId, refreshAttendance);
      setCorrectionPreview(response.data);
    } catch (err: any) { setError(errorText(err)); }
    finally { setWorking(false); }
  };

  const generateCorrection = async () => {
    if (!correctionRunId || !correctionEmployeeId || !correctionReason.trim()) return;
    setWorking(true); setError(''); setNotice('');
    try {
      const response = await generatePaidPeriodArrears(
        correctionRunId, correctionEmployeeId, correctionReason.trim(), refreshAttendance,
      );
      setCorrectionPreview(response.data);
      setCorrectionReason('');
      setNotice('Paid-period correction items are generated and available for an arrears run.');
      const register = await getArrears();
      setItems(register.data || []);
    } catch (err: any) { setError(errorText(err)); }
    finally { setWorking(false); }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Salary arrears</h1>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-600">
          First save the retroactive salary assignment (for a salary increase, promotion, or allowance) or record the approved correction to attendance, leave, payroll calculation, or statutory rules. Then preview the affected paid period here. The reason and Generate button appear only when a new component difference is found. Existing paid runs are never changed; generated items go through a separate arrears settlement.
        </p>
      </header>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="mb-4 flex items-center gap-2">
          <CalculatorIcon className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Preview or generate arrears</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className="text-xs font-medium text-gray-600">Salary assignment
            <select value={assignmentId} onChange={(event) => { setAssignmentId(event.target.value); setPreview(null); setError(''); }} className="mt-1 block w-full rounded-xl border-0 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200">
              <option value="">Select assignment…</option>
              {assignments.map((item) => <option key={item.id} value={item.id}>
                {item.employee_name} ({item.employee_code}) · {item.structure_name} · {item.effective_from} · {money(item.ctc_monthly)}/month
              </option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button disabled={!assignmentId || working} onClick={() => void loadPreview()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <ArrowPathIcon className="h-4 w-4" /> {working ? 'Calculating…' : 'Preview difference'}
            </button>
          </div>
        </div>
        {selected && <p className="mt-3 text-xs text-gray-500">Selected for {selected.employee_name} ({selected.employee_code}); assignment effective {selected.effective_from}. Only paid regular periods after this effective date are considered.</p>}
        {preview && <>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
            <div>
              <p className="text-sm font-semibold text-blue-950">{preview.employee_name} · {preview.employee_code}</p>
              <p className="mt-1 text-xs text-blue-800">Effective {preview.effective_from} · {preview.periods.length} affected paid period(s)</p>
              <p className="mt-2 text-lg font-bold text-blue-950">Net arrears: {money(preview.total_arrears)}</p>
            </div>
            {preview.generated && <span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-800">Already generated</span>}
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-500">{preview.notice} Positive amounts are payable to the employee; negative amounts represent overpayment recovery. Mid-period assignment changes are prorated by the affected calendar days.</p>
          <div className="mt-4 space-y-4">
            {preview.periods.map((period: any) => <div key={`${period.period_start}-${period.period_end}`} className="overflow-hidden rounded-xl ring-1 ring-gray-200">
              <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">{period.period_start} to {period.period_end}</div>
              <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="px-4 py-2">Component</th><th className="px-4 py-2 text-right">Previously paid</th><th className="px-4 py-2 text-right">Now due</th><th className="px-4 py-2 text-right">Difference</th></tr></thead>
                <tbody className="divide-y divide-gray-100">{period.lines.map((line: any, index: number) => <tr key={`${line.component_code || line.component_label}-${index}`}>
                  <td className="px-4 py-2 font-medium text-gray-800">{line.component_code || line.component_label}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{money(line.old_amount)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{money(line.new_amount)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${Number(line.arrears_amount) < 0 ? 'text-red-700' : 'text-green-700'}`}>{money(line.arrears_amount)}</td>
                </tr>)}</tbody>
              </table></div>
            </div>)}
            {preview.periods.length === 0 && <p className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500">No differences were found in paid regular runs for this assignment.</p>}
          </div>
          {preview.can_generate && <div className="mt-5 border-t border-gray-100 pt-4">
            <label className="block text-xs font-medium text-gray-600">Generation reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1 block w-full rounded-xl border-0 bg-gray-50 px-3 py-2.5 text-sm ring-1 ring-inset ring-gray-200" placeholder="For example: approved backdated salary revision" />
            </label>
            <button disabled={!reason.trim() || working} onClick={() => void generate()} className="mt-3 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {working ? 'Generating…' : 'Generate arrears items'}
            </button>
          </div>}
        </>}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="mb-2 flex items-center gap-2">
          <CalculatorIcon className="h-5 w-5 text-amber-600" />
          <h2 className="font-semibold text-gray-900">Correct a paid payroll period</h2>
        </div>
        <p className="mb-4 max-w-4xl text-xs leading-5 text-gray-600">
          Use this for a paid month when an underlying payroll input or calculation has since been corrected. It does not create a salary increase. For a backdated salary assignment, use the section above. Choose corrected attendance only after the attendance or leave correction has been saved and approved. TDS is excluded from historical component comparison because it requires financial-year tax reconciliation.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-xs font-medium text-gray-600">Paid regular run
            <select value={correctionRunId} onChange={(event) => void selectCorrectionRun(event.target.value)} className="mt-1 block w-full rounded-xl border-0 bg-gray-50 px-3 py-2.5 text-sm ring-1 ring-inset ring-gray-200">
              <option value="">Select paid period…</option>
              {paidRuns.map((run) => <option key={run.id} value={run.id}>{run.pay_calendar_display} · {run.status}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">Employee
            <SearchableSelect
              value={correctionEmployeeId}
              options={runEmployees.map((employee) => ({
                value: employee.employee,
                label: `${employee.employee_code} — ${employee.employee_name}`,
              }))}
              placeholder={correctionRunId ? 'Search employee ID or name…' : 'Select a paid run first…'}
              disabled={!correctionRunId}
              className="mt-1 block w-full rounded-xl border-0 bg-gray-50 px-3 py-2.5 text-sm ring-1 ring-inset ring-gray-200 disabled:opacity-50"
              noOptionsMessage="No employees in this payroll run match your search."
              onChange={(employeeId) => { setCorrectionEmployeeId(employeeId); setCorrectionPreview(null); }}
            />
          </label>
          <div className="flex items-end">
            <button disabled={!correctionRunId || !correctionEmployeeId || working} onClick={() => void previewCorrection()} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {working ? 'Recalculating…' : 'Preview correction'}
            </button>
          </div>
        </div>
        <label className="mt-4 flex items-start gap-2 text-xs text-gray-700">
          <input type="checkbox" checked={refreshAttendance} onChange={(event) => { setRefreshAttendance(event.target.checked); setCorrectionPreview(null); }} className="mt-0.5 rounded border-gray-300 text-blue-600" />
          Reconcile current attendance and leave records instead of using the values frozen in the paid run.
        </label>
        {correctionPreview && <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-semibold text-amber-950">{correctionPreview.employee_name} · {correctionPreview.employee_code}</p>
              <p className="mt-1 text-xs text-amber-900">{correctionPreview.periods[0]?.period_start || 'Selected paid period'} to {correctionPreview.periods[0]?.period_end || ''}</p></div>
            <p className="text-lg font-bold text-amber-950">Net difference: {money(correctionPreview.total_arrears)}</p>
          </div>
          <p className="mt-2 text-xs text-amber-900">{correctionPreview.notice}</p>
          {correctionPreview.periods.map((period: any) => period.lines.length > 0 ? <div key={period.source_run_id} className="mt-3 overflow-x-auto rounded-lg bg-white ring-1 ring-amber-200">
            <table className="min-w-full divide-y divide-gray-100 text-sm"><thead><tr className="text-left text-xs uppercase text-gray-500"><th className="px-3 py-2">Component</th><th className="px-3 py-2 text-right">Paid / corrected</th><th className="px-3 py-2 text-right">Recalculated due</th><th className="px-3 py-2 text-right">Difference</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{period.lines.map((line: any, index: number) => <tr key={`${line.component_code || line.component_label}-${index}`}><td className="px-3 py-2">{line.component_code || line.component_label}</td><td className="px-3 py-2 text-right">{money(line.old_amount)}</td><td className="px-3 py-2 text-right">{money(line.new_amount)}</td><td className={`px-3 py-2 text-right font-semibold ${Number(line.arrears_amount) < 0 ? 'text-red-700' : 'text-green-700'}`}>{money(line.arrears_amount)}</td></tr>)}</tbody>
            </table>
          </div> : <p key={period.source_run_id} className="mt-3 rounded-lg bg-white p-4 text-center text-sm text-gray-700 ring-1 ring-amber-200">
            No new component difference was found for this employee and period. There is nothing to generate. If you expected a difference, save the corrected salary assignment or approved attendance, leave, payroll, or date-effective statutory data first, then preview again.
          </p>)}
          {correctionPreview.can_generate && <div className="mt-4">
            <label className="block text-xs font-medium text-gray-700">Correction reason<textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} rows={2} className="mt-1 block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-amber-200" placeholder="For example: approved attendance correction or payroll formula correction" /></label>
            <button disabled={!correctionReason.trim() || working} onClick={() => void generateCorrection()} className="mt-3 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{working ? 'Generating…' : 'Generate correction items'}</button>
          </div>}
        </div>}
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div><h2 className="font-semibold text-gray-900">Arrears register</h2><p className="mt-1 text-xs text-gray-500">Available items can be loaded into the next ARREARS run. Reserved items are in a run; settled items have completed payment.</p></div>
          <button onClick={() => void loadData()} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Refresh arrears register"><ArrowPathIcon className="h-4 w-4" /></button>
        </div>
        {loading ? <div className="p-10 text-center text-sm text-gray-500">Loading…</div> : items.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">No arrears items have been generated.</div> :
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50"><tr className="text-left text-xs uppercase text-gray-500"><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Component</th><th className="px-5 py-3">Period</th><th className="px-5 py-3 text-right">Previously paid</th><th className="px-5 py-3 text-right">Now due</th><th className="px-5 py-3 text-right">Difference</th><th className="px-5 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{items.map((item) => <tr key={item.id}>
              <td className="px-5 py-3"><div className="font-medium text-gray-900">{item.employee_name}</div><div className="text-xs text-gray-500">{item.employee_code}</div></td>
              <td className="px-5 py-3">{item.component_code || item.component}</td>
              <td className="px-5 py-3 whitespace-nowrap">{item.period_start} to {item.period_end}</td>
              <td className="px-5 py-3 text-right">{money(item.old_amount)}</td><td className="px-5 py-3 text-right">{money(item.new_amount)}</td>
              <td className={`px-5 py-3 text-right font-semibold ${Number(item.arrears_amount) < 0 ? 'text-red-700' : 'text-green-700'}`}>{money(item.arrears_amount)}</td>
              <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'SETTLED' ? 'bg-green-50 text-green-700' : item.status === 'RESERVED' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{item.status}</span></td>
            </tr>)}</tbody>
          </table></div>}
      </section>
    </div>
  );
}
