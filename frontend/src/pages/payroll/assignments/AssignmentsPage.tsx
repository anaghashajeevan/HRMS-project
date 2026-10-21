import { useEffect, useState, useCallback } from 'react';
import { PlusIcon, ClockIcon } from '@heroicons/react/24/outline';
import { getCurrentAssignments, getLatestAssignments } from '../../../api/payrollApi';
import AssignmentFormModal from './AssignmentFormModal';
import AssignmentHistoryModal from './AssignmentHistoryModal';

const fmt = (v: number | string) =>
  Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AssignmentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCurrent, setShowCurrent] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [historyEmpId, setHistoryEmpId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = showCurrent ? await getCurrentAssignments() : await getLatestAssignments();
      setItems(res.data.results || res.data);
    } catch {} finally { setLoading(false); }
  }, [showCurrent]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Salary Assignments</h2>
          <p className="text-sm text-gray-500">Assign salary structures & CTC to employees. Immutable after creation.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-gray-100 p-1">
            <button
              onClick={() => setShowCurrent(true)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${showCurrent ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              Current
            </button>
            <button
              onClick={() => setShowCurrent(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${!showCurrent ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              All Employees
            </button>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
          >
            <PlusIcon className="h-4 w-4" /> Assign
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No assignments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Structure</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Annual CTC</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monthly CTC</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Fixed Gross / Month</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Effective</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">
                        {a.employee_name || a.employee?.first_name || a.employee}
                      </div>
                      <div className="text-xs text-gray-400">{a.employee_code || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{a.structure_name || a.structure?.name || '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">₹{fmt(a.ctc_annual)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">₹{fmt(a.ctc_monthly)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {a.fixed_salary_monthly != null ? `₹${fmt(a.fixed_salary_monthly)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {a.effective_from}{a.effective_to ? ` → ${a.effective_to}` : ' → present'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate">{a.reason || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setHistoryEmpId(a.employee?.id || a.employee)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition"
                        title="View history"
                      >
                        <ClockIcon className="h-4 w-4" />
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
        <AssignmentFormModal
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}

      {historyEmpId && (
        <AssignmentHistoryModal
          employeeId={historyEmpId}
          onClose={() => setHistoryEmpId(null)}
        />
      )}
    </div>
  );
}
