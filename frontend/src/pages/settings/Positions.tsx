import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Loader2, Briefcase, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { positionsApi, structuresApi } from '../../api/masterData';
import type { JobPosition, CompanyStructure } from '../../types/masterData';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

export default function PositionsPage() {
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [departments, setDepartments] = useState<CompanyStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JobPosition | null>(null);
  const [form, setForm] = useState({
    title: '',
    grade_band: 'G1',
    department: '',
    budgeted_count: 1,
    salary_min: '',
    salary_max: '',
    is_active: true,
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [posData, deptData] = await Promise.all([
        positionsApi.list(),
        structuresApi.list({ type: 'DEPARTMENT' }),
      ]);
      setPositions(posData.results);
      setDepartments(deptData.results);
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      title: '', grade_band: 'G1',
      department: departments[0]?.id || '',
      budgeted_count: 1, salary_min: '', salary_max: '',
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (pos: JobPosition) => {
    setEditing(pos);
    setForm({
      title: pos.title, grade_band: pos.grade_band,
      department: pos.department,
      budgeted_count: pos.budgeted_count,
      salary_min: pos.salary_min || '',
      salary_max: pos.salary_max || '',
      is_active: pos.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.department) {
      toast.error('Title and department are required');
      return;
    }
    try {
      const payload = {
        ...form,
        salary_min: form.salary_min || null,
        salary_max: form.salary_max || null,
      };
      if (editing) {
        await positionsApi.update(editing.id, payload as never);
        toast.success('Updated');
      } else {
        await positionsApi.create(payload as never);
        toast.success('Created');
      }
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      toast.error(error.response?.data?.detail || 'Save failed');
    }
  };

  const handleDelete = async (pos: JobPosition) => {
    if (!confirm(`Delete "${pos.title}"?`)) return;
    try {
      await positionsApi.delete(pos.id);
      toast.success('Deleted');
      fetchAll();
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
              <h1 className="text-2xl font-bold">Job Positions</h1>
              <p className="mt-1 text-sm text-gray-600">Manage positions and headcount</p>
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
              <Plus className="h-4 w-4" /> Add Position
            </button>
          </div>

          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : positions.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-500">
                <Briefcase className="mb-3 h-12 w-12 text-gray-300" />
                <p>No positions yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Headcount</th>
                    <th className="px-4 py-3">Vacancies</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {positions.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.title}</td>
                      <td className="px-4 py-3"><span className="rounded bg-primary-50 px-2 py-0.5 text-xs text-primary-700">{p.grade_band}</span></td>
                      <td className="px-4 py-3 text-gray-600">{p.department_name}</td>
                      <td className="px-4 py-3">
                        <span className={p.is_full ? 'text-red-600' : 'text-gray-900'}>
                          {p.actual_count} / {p.budgeted_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${p.vacancy_count > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {p.vacancy_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(p)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(p)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? 'Edit' : 'Add'} Position</h2>
              <button onClick={() => setModalOpen(false)} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Grade Band *</label>
                <select value={form.grade_band} onChange={(e) => setForm({ ...form, grade_band: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
                  {['G1', 'G2', 'G3', 'G4', 'M1', 'M2', 'M3', 'D1', 'D2'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Department *</label>
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
                  <option value="">Select...</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Budgeted Headcount</label>
                <input type="number" min="1" value={form.budgeted_count} onChange={(e) => setForm({ ...form, budgeted_count: parseInt(e.target.value) || 1 })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <div />
              <div>
                <label className="mb-1 block text-sm font-medium">Salary Min</label>
                <input type="number" value={form.salary_min} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Salary Max</label>
                <input type="number" value={form.salary_max} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
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