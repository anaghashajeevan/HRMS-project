import { useEffect, useState, useCallback } from 'react';
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getStatutoryRules, deleteStatutoryRule } from '../../../api/payrollApi';
import StatutoryRuleFormModal from './StatutoryRuleFormModal';

const TYPE_COLORS: Record<string, string> = {
  PF: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  ESI: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  PT: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  TDS: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  GRATUITY: 'bg-pink-50 text-pink-700 ring-pink-600/20',
};

export default function StatutoryRulesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStatutoryRules();
      setItems(res.data.results || res.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    await deleteStatutoryRule(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Statutory Rules</h2>
          <p className="text-sm text-gray-500">PF, ESI, PT, TDS rules with effective dates and slabs.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
        >
          <PlusIcon className="h-4 w-4" /> Add Rule
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No statutory rules found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Jurisdiction</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Emp Rate</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Er Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Effective</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${TYPE_COLORS[r.statutory_type] || 'bg-gray-50 text-gray-600'}`}>
                        {r.statutory_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.jurisdiction}</td>
                    <td className="px-4 py-3 text-center text-sm">{r.employee_rate ? `${r.employee_rate}%` : '—'}</td>
                    <td className="px-4 py-3 text-center text-sm">{r.employer_rate ? `${r.employer_rate}%` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.effective_from}{r.effective_to ? ` → ${r.effective_to}` : '+'}</td>
                    <td className="px-4 py-3 text-center text-sm">{r.is_active ? '✓' : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(r); setModalOpen(true); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <StatutoryRuleFormModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}