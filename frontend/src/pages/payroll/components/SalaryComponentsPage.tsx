import { useEffect, useState, useCallback } from 'react';
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getComponents, createComponent, updateComponent, deleteComponent } from '../../../api/payrollApi';
import ComponentFormModal from './ComponentFormModal';

const TYPE_LABELS: Record<string, string> = {
  EARNING: 'Earning',
  DEDUCTION: 'Deduction',
  EMPLOYER_COST: 'Employer Cost',
  REIMBURSEMENT: 'Reimbursement',
  ONE_TIME: 'One-Time',
};

const TYPE_COLORS: Record<string, string> = {
  EARNING: 'bg-green-50 text-green-700 ring-green-600/20',
  DEDUCTION: 'bg-red-50 text-red-700 ring-red-600/20',
  EMPLOYER_COST: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  REIMBURSEMENT: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  ONE_TIME: 'bg-blue-50 text-blue-700 ring-blue-600/20',
};

interface Component {
  id: string;
  code: string;
  name: string;
  component_type: string;
  is_taxable: boolean;
  is_fixed: boolean;
  formula: string | null;
  display_order: number;
  is_active: boolean;
}

export default function SalaryComponentsPage() {
  const [items, setItems] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getComponents();
      setItems(res.data.results || res.data);
    } catch {
      /* handled globally */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: any) => {
    if (editing) {
      await updateComponent(editing.id, data);
    } else {
      await createComponent(data);
    }
    setModalOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this component?')) return;
    await deleteComponent(id);
    load();
  };

  const filtered = items.filter(
    (c) =>
      (!filter || c.component_type === filter) &&
      true
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Salary Components</h2>
          <p className="text-sm text-gray-500">
            Define individual pay components used in salary structures.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
        >
          <PlusIcon className="h-4 w-4" /> Add Component
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            !filter ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No components found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Taxable</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Fixed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Formula</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{c.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${TYPE_COLORS[c.component_type] || ''}`}>
                        {TYPE_LABELS[c.component_type] || c.component_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">{c.is_taxable ? '✓' : '—'}</td>
                    <td className="px-4 py-3 text-center text-sm">{c.is_fixed ? '✓' : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono truncate max-w-[200px]">
                      {c.formula || '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{c.display_order}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setEditing(c); setModalOpen(true); }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
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
        <ComponentFormModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}