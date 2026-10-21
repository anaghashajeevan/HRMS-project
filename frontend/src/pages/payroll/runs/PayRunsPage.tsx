import { useEffect, useState, useCallback } from 'react';
import { PlusIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { getPayRuns } from '../../../api/payrollApi';
import CreateRunModal from './CreateRunModal';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  LOCKED: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  CALCULATED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  UNDER_REVIEW: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  APPROVED: 'bg-green-50 text-green-700 ring-green-600/20',
  FINALIZED: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  REVERSED: 'bg-red-50 text-red-700 ring-red-600/20',
};

const fmt = (v: number | string | null) =>
  v ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

export default function PayRunsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPayRuns();
      setItems(res.data.results || res.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pay Runs</h2>
          <p className="text-sm text-gray-500">Monthly payroll processing lifecycle.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
        >
          <PlusIcon className="h-4 w-4" /> New Run
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No pay runs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Net</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Employees</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Prepared By</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => navigate(`/payroll/runs/${r.id}`)}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {r.pay_calendar_display || `${r.pay_calendar?.year}-${String(r.pay_calendar?.month).padStart(2, '0')}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.run_type}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_COLORS[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">₹{fmt(r.totals?.total_net_pay)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{r.employee_count || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.prepared_by_name || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition">
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <CreateRunModal
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}