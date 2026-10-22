import { useEffect, useMemo, useState } from 'react';
import { ArrowDownTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { downloadStatutoryReturn, getPayRuns } from '../../../api/payrollApi';

type PayrollRunOption = {
  id: string;
  status: string;
  run_type: string;
  pay_calendar_display: string;
  employee_count?: number;
  totals?: { total_gross_pay?: string };
};

async function errorMessage(error: any) {
  const payload = error?.response?.data;
  if (payload instanceof Blob) {
    try {
      const parsed = JSON.parse(await payload.text());
      return [parsed.detail, ...(parsed.errors || [])].filter(Boolean).join('\n');
    } catch { return 'Could not generate the return export.'; }
  }
  return payload?.detail || 'Could not generate the return export.';
}

export default function StatutoryExportsPage() {
  const [runs, setRuns] = useState<PayrollRunOption[]>([]);
  const [selectedRun, setSelectedRun] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<'pf' | 'esi' | null>(null);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState(false);

  useEffect(() => {
    getPayRuns()
      .then((response) => {
        const payload = response.data;
        const items = (Array.isArray(payload) ? payload : payload?.results || []) as PayrollRunOption[];
        const eligible = items.filter((run) => run.run_type === 'REGULAR' && ['FINALIZED', 'PAID'].includes(run.status));
        setRuns(eligible);
        if (eligible.length) setSelectedRun(eligible[0].id);
      })
      .catch(() => { setProblem(true); setMessage('Could not load payroll runs.'); })
      .finally(() => setLoading(false));
  }, []);

  const activeRun = useMemo(() => runs.find((run) => run.id === selectedRun), [runs, selectedRun]);

  const download = async (type: 'pf' | 'esi') => {
    if (!selectedRun) return;
    setWorking(type);
    setProblem(false);
    setMessage('');
    try {
      await downloadStatutoryReturn(selectedRun, type);
      setMessage(type === 'pf'
        ? 'EPFO ECR text file downloaded. Its rows intentionally contain no month field; choose the same payroll month and year in the EPFO portal before upload.'
        : 'Formatted ESIC payroll review workbook downloaded. Transfer validated values into the current ESIC portal workbook/form.');
    } catch (error: any) {
      setProblem(true);
      setMessage(await errorMessage(error));
    } finally { setWorking(null); }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">PF &amp; ESI Return Exports</h2>
        <p className="mt-1 text-sm text-gray-600">Prepare monthly statutory files from approved payroll calculations.</p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <label htmlFor="statutory-run" className="block text-sm font-medium text-gray-800">Finalized regular payroll month</label>
        <select
          id="statutory-run"
          value={selectedRun}
          onChange={(event) => { setSelectedRun(event.target.value); setMessage(''); }}
          disabled={loading || !runs.length}
          className="mt-2 block w-full max-w-xl rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {loading && <option value="">Loading payroll runs…</option>}
          {!loading && !runs.length && <option value="">No finalized or paid regular runs</option>}
          {runs.map((run) => (
            <option key={run.id} value={run.id}>{run.pay_calendar_display} · {run.status} · {run.employee_count || 0} employees</option>
          ))}
        </select>
        {activeRun && <p className="mt-2 text-xs text-gray-500">Run gross: ₹{Number(activeRun.totals?.total_gross_pay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-start gap-3">
            <DocumentTextIcon className="mt-0.5 h-6 w-6 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">EPFO ECR 2.0</h3>
              <p className="mt-1 text-sm text-gray-600">Downloads the official 11-field, UAN-based text layout. The ECR data rows do not contain a month field; the selected period is in the filename and must also be selected in the EPFO portal. Employees missing a UAN, PF rule, or valid whole-day NCP value block file generation.</p>
            </div>
          </div>
          <button disabled={!selectedRun || Boolean(working)} onClick={() => void download('pf')} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <ArrowDownTrayIcon className="h-4 w-4" />{working === 'pf' ? 'Preparing…' : 'Download EPFO ECR'}
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-start gap-3">
            <DocumentTextIcon className="mt-0.5 h-6 w-6 text-emerald-600" />
            <div>
              <h3 className="font-semibold text-gray-900">ESIC contribution review</h3>
              <p className="mt-1 text-sm text-gray-600">Downloads a formatted Excel workbook with an ESI return detail tab and a payroll gross-to-net reconciliation tab. The reconciliation explains why prorated ESI wages before employee deductions can differ from Gross Pay in the pay-run detail. It is an internal review report, not an ESIC portal upload workbook.</p>
            </div>
          </div>
          <button disabled={!selectedRun || Boolean(working)} onClick={() => void download('esi')} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            <ArrowDownTrayIcon className="h-4 w-4" />{working === 'esi' ? 'Preparing…' : 'Download ESI Excel Report'}
          </button>
        </section>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Exports use finalized payroll snapshots only. Check the employee IDs and contribution totals against the official portal before submission. A successful download does not file or pay the statutory return.
      </div>
      {message && <div role="status" className={`whitespace-pre-line rounded-xl p-4 text-sm ${problem ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-green-200 bg-green-50 text-green-800'}`}>{message}</div>}
    </div>
  );
}
