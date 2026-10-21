import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getAssignmentHistory } from '../../../api/payrollApi';

const fmt = (v: number | string) =>
  Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  employeeId: string;
  onClose: () => void;
}

export default function AssignmentHistoryModal({ employeeId, onClose }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAssignmentHistory(employeeId)
      .then((r) => setItems(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employeeId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Assignment History</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No assignment history found.</p>
        ) : (
          <div className="relative border-l-2 border-gray-200 ml-4 space-y-6">
            {items.map((a: any, i: number) => (
              <div key={a.id} className="relative pl-8">
                <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white ${i === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
                <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900">{a.structure_name || 'Structure'}</span>
                    <span className="text-xs text-gray-400">
                      {a.effective_from}{a.effective_to ? ` → ${a.effective_to}` : ' → present'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><span className="text-gray-500">Annual CTC:</span> <span className="font-medium">₹{fmt(a.ctc_annual)}</span></div>
                    <div><span className="text-gray-500">Monthly:</span> <span className="font-medium">₹{fmt(a.ctc_monthly)}</span></div>
                    <div><span className="text-gray-500">Fixed gross:</span> <span className="font-medium">{a.fixed_salary_monthly != null ? `₹${fmt(a.fixed_salary_monthly)}` : '—'}</span></div>
                  </div>
                  {a.reason && <p className="mt-2 text-xs text-gray-500 italic">{a.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Close</button>
        </div>
      </div>
    </div>
  );
}
