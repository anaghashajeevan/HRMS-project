import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Loader2, Building2, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { structuresApi } from '../../api/masterData';
import type { CompanyStructure } from '../../types/masterData';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

const TYPE_OPTIONS = [
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'BUSINESS_UNIT', label: 'Business Unit' },
  { value: 'LOCATION', label: 'Location' },
  { value: 'COST_CENTER', label: 'Cost Center' },
  { value: 'COMPANY', label: 'Company' },
];

export default function DepartmentsPage() {
  const [items, setItems] = useState<CompanyStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyStructure | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'DEPARTMENT',
    parent: '',
    cost_center_code: '',
    is_active: true,
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await structuresApi.list();
      setItems(data.results);
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', type: 'DEPARTMENT', parent: '', cost_center_code: '', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (item: CompanyStructure) => {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      parent: item.parent || '',
      cost_center_code: item.cost_center_code || '',
      is_active: item.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const payload = {
        ...form,
        parent: form.parent || null,
        cost_center_code: form.cost_center_code || null,
      };
      if (editing) {
        await structuresApi.update(editing.id, payload as never);
        toast.success('Updated');
      } else {
        await structuresApi.create(payload as never);
        toast.success('Created');
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      toast.error(error.response?.data?.detail || 'Save failed');
    }
  };

  const handleDelete = async (item: CompanyStructure) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await structuresApi.delete(item.id);
      toast.success('Deleted');
      fetchItems();
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Departments & Locations</h1>
              <p className="mt-1 text-sm text-gray-600">Manage company structure</p>
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-500">
                <Building2 className="mb-3 h-12 w-12 text-gray-300" />
                <p>No entries yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Parent</th>
                    <th className="px-4 py-3">Cost Center</th>
                    <th className="px-4 py-3">Employees</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{it.name}</td>
                      <td className="px-4 py-3"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{it.type}</span></td>
                      <td className="px-4 py-3 text-gray-600">{it.parent_name || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{it.cost_center_code || '—'}</td>
                      <td className="px-4 py-3">{it.employee_count}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${it.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {it.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(it)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(it)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? 'Edit' : 'Add'} Structure</h2>
              <button onClick={() => setModalOpen(false)} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Type *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
                  {TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Parent (optional)</label>
                <select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
                  <option value="">— None —</option>
                  {items.filter((i) => i.id !== editing?.id).map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Cost Center Code</label>
                <input type="text" value={form.cost_center_code} onChange={(e) => setForm({ ...form, cost_center_code: e.target.value })} placeholder="e.g., CC-IT-001" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded" />
                Active
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}