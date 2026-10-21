import { useEffect, useState, useCallback } from 'react';
import { PlusIcon, PencilSquareIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import { getStructure, getStructures, deleteStructure } from '../../../api/payrollApi';
import StructureFormModal from './StructureFormModal';
import StructurePreviewModal from './StructurePreviewModal';

interface Structure {
  id: string;
  name: string;
  version: string;
  is_active: boolean;
  components?: any[];
  component_count?: number;
  created_at: string;
}

export default function SalaryStructuresPage() {
  const [items, setItems] = useState<Structure[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Structure | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStructures();
      setItems(res.data.results || res.data);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this structure?')) return;
    await deleteStructure(id);
    load();
  };

  const handleEdit = async (structure: Structure) => {
    try {
      const response = await getStructure(structure.id);
      setEditing(response.data);
      setModalOpen(true);
    } catch {
      alert('Could not load the structure components. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Salary Structures</h2>
          <p className="text-sm text-gray-500">Group salary components into reusable structures.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
        >
          <PlusIcon className="h-4 w-4" /> New Structure
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No structures yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Version</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Components</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{s.version}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{s.component_count ?? s.components?.length ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        s.is_active
                          ? 'bg-green-50 text-green-700 ring-green-600/20'
                          : 'bg-gray-50 text-gray-500 ring-gray-300/50'
                      }`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setPreviewId(s.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition"
                          title="Preview with CTC"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(s)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
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
        <StructureFormModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); load(); }}
        />
      )}

      {previewId && (
        <StructurePreviewModal
          structureId={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}
