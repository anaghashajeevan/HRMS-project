import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit, Trash2, X, Loader2, Package,
  Laptop, Monitor, Smartphone, IdCard, Key,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { assetCategoriesApi } from '../../api/assets';
import type { AssetCategory } from '../../types/asset';
import toast from 'react-hot-toast';

const ICON_OPTIONS = [
  { value: 'package', label: 'Package', Icon: Package },
  { value: 'laptop', label: 'Laptop', Icon: Laptop },
  { value: 'monitor', label: 'Monitor', Icon: Monitor },
  { value: 'smartphone', label: 'Phone', Icon: Smartphone },
  { value: 'id-card', label: 'ID Card', Icon: IdCard },
  { value: 'key', label: 'Key', Icon: Key },
];

export default function AssetCategoriesPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AssetCategory | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: 'package',
    is_active: true,
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await assetCategoriesApi.list();
      setCategories(data);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', icon: 'package', is_active: true });
    setShowModal(true);
  };

  const openEdit = (cat: AssetCategory) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      description: cat.description || '',
      icon: cat.icon || 'package',
      is_active: cat.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      if (editing) {
        await assetCategoriesApi.update(editing.id, form);
        toast.success('Category updated');
      } else {
        await assetCategoriesApi.create(form);
        toast.success('Category created');
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDelete = async (cat: AssetCategory) => {
    if (!confirm(`Delete "${cat.name}"?`)) return;
    try {
      await assetCategoriesApi.delete(cat.id);
      toast.success('Category deleted');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const getIconFor = (name: string) => {
    return ICON_OPTIONS.find((o) => o.value === name)?.Icon || Package;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/assets')}
                className="rounded-lg p-2 hover:bg-gray-200"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Asset Categories</h1>
                <p className="text-sm text-gray-500">
                  Manage asset types (Laptops, Monitors, etc.)
                </p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add Category
            </button>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">No categories yet.</p>
              <button
                onClick={openCreate}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
              >
                Create First Category
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => {
                const Icon = getIconFor(cat.icon);
                return (
                  <div
                    key={cat.id}
                    className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-3 text-white shadow-md">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                          {!cat.is_active && (
                            <span className="text-xs text-red-600">Inactive</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(cat)}
                          className="rounded-lg p-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {cat.description && (
                      <p className="mt-3 text-sm text-gray-600">{cat.description}</p>
                    )}

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center text-xs">
                      <div>
                        <div className="text-lg font-bold text-gray-900">{cat.asset_count}</div>
                        <div className="text-gray-500">Total</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-600">
                          {cat.allocated_count}
                        </div>
                        <div className="text-gray-500">Allocated</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-emerald-600">
                          {cat.available_count}
                        </div>
                        <div className="text-gray-500">Available</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Category' : 'New Category'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Laptops, Monitors, etc."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Optional description..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {ICON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, icon: opt.value })}
                      className={`flex items-center justify-center rounded-lg border-2 p-2 transition-all ${
                        form.icon === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                      title={opt.label}
                    >
                      <opt.Icon className="h-5 w-5" />
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600"
                />
                <span className="text-gray-700">Active</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}