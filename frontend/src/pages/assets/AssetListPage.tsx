import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Plus, Search, Loader2, Filter, Eye,
  CheckCircle2, XCircle, AlertTriangle, Trash2,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { assetsApi, assetCategoriesApi } from '../../api/assets';
import type { AssetListItem, AssetCategory } from '../../types/asset';
import toast from 'react-hot-toast';
import AllocateAssetModal from '../../components/assets/AllocateAssetModal';

const statusColors: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  ALLOCATED: 'bg-blue-100 text-blue-700 ring-blue-200',
  MAINTENANCE: 'bg-amber-100 text-amber-700 ring-amber-200',
  DISPOSED: 'bg-red-100 text-red-700 ring-red-200',
};

export default function AssetListPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  // Allocation modal
  const [allocateAsset, setAllocateAsset] = useState<AssetListItem | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadAssets();
  }, [search, statusFilter, categoryFilter]);

  const loadCategories = async () => {
    try {
      const data = await assetCategoriesApi.list();
      setCategories(data);
    } catch {
      // ignore
    }
  };

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await assetsApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      });
      setAssets(data.results);
      setTotalCount(data.count);
    } catch {
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (asset: AssetListItem) => {
    if (!confirm(`Delete asset "${asset.asset_tag}"? This cannot be undone.`)) return;
    try {
      await assetsApi.delete(asset.id);
      toast.success('Asset deleted');
      loadAssets();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Asset Directory</h1>
              <p className="text-sm text-gray-500">
                {totalCount} total assets in inventory
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/assets/categories')}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Package className="h-4 w-4" /> Categories
              </button>
              <button
                onClick={() => navigate('/assets/new')}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> Add Asset
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by tag, name, serial..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="MAINTENANCE">Under Maintenance</option>
                <option value="DISPOSED">Disposed</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : assets.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-sm text-gray-500">
                  No assets found. Try adjusting filters or add a new asset.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    <tr>
                      <th className="px-4 py-3">Asset Tag</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Serial No.</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Assigned To</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {assets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-medium text-indigo-700">
                          {asset.asset_tag}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {asset.name}
                          {asset.brand && (
                            <div className="text-xs text-gray-500">
                              {asset.brand} {asset.model_number}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{asset.category_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          {asset.serial_number}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                              statusColors[asset.status] || 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {asset.status_display}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {asset.current_assignee ? (
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {asset.current_assignee.full_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {asset.current_assignee.employee_id}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/assets/${asset.id}`)}
                              className="rounded-lg p-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {asset.status === 'AVAILABLE' && (
                              <button
                                onClick={() => setAllocateAsset(asset)}
                                className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200"
                              >
                                Allocate
                              </button>
                            )}
                            {asset.status !== 'ALLOCATED' && (
                              <button
                                onClick={() => handleDelete(asset)}
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Allocation Modal */}
      {allocateAsset && (
        <AllocateAssetModal
          asset={allocateAsset}
          onClose={() => setAllocateAsset(null)}
          onSuccess={() => {
            setAllocateAsset(null);
            loadAssets();
          }}
        />
      )}
    </div>
  );
}