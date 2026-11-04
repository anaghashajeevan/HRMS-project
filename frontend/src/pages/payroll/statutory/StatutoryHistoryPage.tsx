import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Sidebar from '../../../components/Sidebar';
import Topbar from '../../../components/Topbar';
import { downloadStatutoryHistory, getStatutoryHistory } from '../../../api/payrollApi';

type HistoryData = {
  pf_headers: string[];
  pf_monthly: any[][];
  pf_totals: any[][];
  esi_headers: string[];
  esi_monthly: any[][];
  esi_totals: any[][];
};

function HistoryTable({ title, headers, rows }: { title: string; headers: string[]; rows: any[][] }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-xs text-gray-500">{rows.length} month{rows.length === 1 ? '' : 's'}</p>
      </div>
      {rows.length ? (
        <div className="max-h-[32rem] overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
              <tr>{headers.map((header, index) => <th key={`${header}-${index}`} className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-semibold">{header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, rowIndex) => (
                <tr key={`${row[0]}-${row[3]}-${rowIndex}`} className="hover:bg-slate-50">
                  {headers.map((_, columnIndex) => {
                    const value = row[columnIndex];
                    const shown = typeof value === 'number'
                      ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : value ?? '—';
                    return <td key={columnIndex} className="whitespace-nowrap px-3 py-2.5 text-gray-700">{shown}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-5 py-8 text-sm text-gray-500">No contribution history is available for this section yet.</p>}
    </section>
  );
}

export default function StatutoryHistoryPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.role_codes?.some((role: string) => ['HR_ADMIN', 'SYSTEM_ADMIN'].includes(role)));
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [downloadWorking, setDownloadWorking] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getStatutoryHistory(scope)
      .then((response) => { if (active) setData(response.data); })
      .catch((requestError: any) => {
        if (active) setError(requestError?.response?.data?.detail || 'Could not load statutory contribution history.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope]);

  const visible = useMemo(() => {
    if (!data || scope !== 'all' || !employeeSearch.trim()) return data;
    const needle = employeeSearch.trim().toLowerCase();
    const matches = (row: any[]) => `${row[0] || ''} ${row[1] || ''}`.toLowerCase().includes(needle);
    return {
      ...data,
      pf_monthly: data.pf_monthly.filter(matches),
      pf_totals: data.pf_totals.filter(matches),
      esi_monthly: data.esi_monthly.filter(matches),
      esi_totals: data.esi_totals.filter(matches),
    };
  }, [data, employeeSearch, scope]);

  const downloadAllEmployees = async () => {
    setDownloadWorking(true);
    setDownloadMessage('');
    try {
      await downloadStatutoryHistory(undefined, 'all');
      setDownloadMessage('All employee contribution history downloaded.');
    } catch (requestError: any) {
      let detail = requestError?.response?.data?.detail;
      if (requestError?.response?.data instanceof Blob) {
        try { detail = JSON.parse(await requestError.response.data.text()).detail; } catch { /* use fallback */ }
      }
      setDownloadMessage(detail || 'Could not download the employee history workbook.');
    } finally {
      setDownloadWorking(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">PF, EPS &amp; ESI Contributions</h1>
        <p className="mt-1 text-sm text-gray-600">Monthly payroll contributions and running totals from date of joining through the latest available period.</p>
      </header>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Contribution data scope">
          <button role="tab" aria-selected={scope === 'mine'} onClick={() => setScope('mine')} className={`rounded-lg px-4 py-2 text-sm font-medium ${scope === 'mine' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}>My Data</button>
          <button role="tab" aria-selected={scope === 'all'} onClick={() => setScope('all')} className={`rounded-lg px-4 py-2 text-sm font-medium ${scope === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}>All Employees</button>
          {scope === 'all' && <>
            <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search employee ID or name" className="ml-auto w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
            <button onClick={() => void downloadAllEmployees()} disabled={downloadWorking} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {downloadWorking ? 'Preparing Excel…' : 'Download All Employees Excel'}
            </button>
          </>}
        </div>
      )}

      {downloadMessage && <p role="status" className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">{downloadMessage}</p>}

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Cumulative values include finalized or paid regular payroll contribution lines. Months without finalized payroll are shown with blank contribution amounts. These are payroll totals and may differ from balances posted by EPFO or ESIC.
      </div>

      {loading ? <p className="py-12 text-center text-sm text-gray-500">Loading contribution history…</p> : error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : visible && (
        <div className="space-y-6">
          <HistoryTable title="PF / EPS monthly history" headers={visible.pf_headers} rows={visible.pf_monthly} />
          <HistoryTable title="PF / EPS cumulative totals by employee" headers={['Employee ID', 'Employee Name', 'DOJ', 'DOE', 'Last Reported Wage Month', 'Employee Contributions (₹)', 'Employer Contributions (₹)', 'Total Contributions (₹)']} rows={visible.pf_totals} />
          <HistoryTable title="ESI monthly history" headers={visible.esi_headers} rows={visible.esi_monthly} />
          <HistoryTable title="ESI cumulative totals by employee" headers={['Employee ID', 'Employee Name', 'DOJ', 'DOE', 'Last Reported Wage Month', 'Employee Contributions (₹)', 'Employer Contributions (₹)', 'Total Contributions (₹)']} rows={visible.esi_totals} />
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
