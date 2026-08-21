import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Package, Edit, Trash2, Loader2, Calendar,
  User, DollarSign, ShieldCheck, ShieldAlert, RotateCcw,
  Building2, FileText, History, CheckCircle2, XCircle,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { assetsApi, assetAllocationsApi } from '../../api/assets';
import type { AssetDetail, AssetAllocation } from '../../types/asset';
import toast from 'react-hot-toast';
import ReturnAssetModal from '../../components/assets/ReturnAssetModal';
import AllocateAssetModal from '../../components/assets/AllocateAssetModal';

const statusColors: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  ALLOCATED: 'bg-blue-100 text-blue-700 ring-blue-200',
  MAINTENANCE: 'bg-amber-100 text-amber-700 ring-amber-200',
  DISPOSED: 'bg-red-100 text-red-700 ring-red-200',
};

const allocStatusColors: Record<string, string> = {
  ALLOCATED: 'bg-blue-100 text-blue-700',
  RETURNED: 'bg-emerald-100 text-emerald-700',
  DAMAGED: 'bg-amber-100 text-amber-700',
  LOST: 'bg-red-100 text-red-700',
};

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [history, setHistory] = useState<AssetAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [assetData, allocData] = await Promise.all([
        assetsApi.getById(id),
        assetAllocationsApi.list({ asset: id }),
      ]);
      setAsset(assetData);
      setHistory(allocData);
    } catch {
      toast.error('Failed to load asset details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!asset) return;
    if (!confirm(`Delete asset "${asset.asset_tag}"? This cannot be undone.`)) return;
    try {
      await assetsApi.delete(asset.id);
      toast.success('Asset deleted');
      navigate('/assets');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  if (loading || !asset) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex flex-1 items-center justify-center">
            <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
          </main>
        </div>
      </div>
    );
  }

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
                <p className="text-xs font-mono font-medium text-indigo-600">
                  {asset.asset_tag}
                </p>
                <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/assets/${asset.id}/edit`)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" /> Edit
              </button>
              {asset.status !== 'ALLOCATED' && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          </div>

          {/* Status Banner */}
          <div className="mb-6 flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-3 text-white shadow-md">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Status</p>
                <span
                  className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ${
                    statusColors[asset.status]
                  }`}
                >
                  {asset.status_display}
                </span>
              </div>
            </div>
            {asset.status === 'AVAILABLE' && (
              <button
                onClick={() => setShowAllocateModal(true)}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4" /> Allocate Asset
              </button>
            )}
            {asset.status === 'ALLOCATED' && (
              <button
                onClick={() => setShowReturnModal(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <RotateCcw className="h-4 w-4" /> Process Return
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Asset Details */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FileText className="h-4 w-4 text-indigo-500" /> Asset Details
              </h3>
              <dl className="space-y-3 text-sm">
                <DetailRow label="Category" value={asset.category_detail.name} />
                <DetailRow label="Brand" value={asset.brand || '—'} />
                <DetailRow label="Model" value={asset.model_number || '—'} />
                <DetailRow label="Serial Number" value={asset.serial_number} mono />
                <DetailRow label="Condition" value={asset.condition_display} />
                {asset.condition_notes && (
                  <DetailRow label="Condition Notes" value={asset.condition_notes} />
                )}
              </dl>
            </div>

            {/* Financial Details */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <DollarSign className="h-4 w-4 text-emerald-500" /> Purchase & Warranty
              </h3>
              <dl className="space-y-3 text-sm">
                <DetailRow
                  label="Purchase Date"
                  value={
                    asset.purchase_date
                      ? new Date(asset.purchase_date).toLocaleDateString('en-IN')
                      : '—'
                  }
                />
                <DetailRow
                  label="Purchase Cost"
                  value={
                    asset.purchase_cost
                      ? `₹${Number(asset.purchase_cost).toLocaleString('en-IN')}`
                      : '—'
                  }
                />
                <DetailRow label="Vendor" value={asset.vendor || '—'} />
                <DetailRow label="Invoice No." value={asset.invoice_number || '—'} />
                <DetailRow
                  label="Warranty Expiry"
                  value={
                    asset.warranty_expiry ? (
                      <span className="flex items-center gap-2">
                        {new Date(asset.warranty_expiry).toLocaleDateString('en-IN')}
                        {asset.is_warranty_valid ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                            <ShieldCheck className="h-3 w-3" /> Valid
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                            <ShieldAlert className="h-3 w-3" /> Expired
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
              </dl>
            </div>

            {/* Current Allocation */}
            {asset.current_allocation && (
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm ring-1 ring-blue-200 lg:col-span-2">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <User className="h-4 w-4 text-blue-600" /> Current Assignment
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-gray-500">Employee</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {asset.current_allocation.employee_name}
                    </p>
                    <p className="text-xs text-gray-600">
                      {asset.current_allocation.employee_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Allocated Date</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {new Date(
                        asset.current_allocation.allocated_date
                      ).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-gray-600">
                      {asset.current_allocation.duration_days} days ago
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Allocated By</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {asset.current_allocation.allocated_by_name}
                    </p>
                  </div>
                </div>
                {asset.current_allocation.handover_notes && (
                  <div className="mt-4 rounded-lg bg-white p-3 text-sm italic text-gray-700">
                    "{asset.current_allocation.handover_notes}"
                  </div>
                )}
              </div>
            )}

            {/* Allocation History */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 lg:col-span-2">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <History className="h-4 w-4 text-purple-500" /> Allocation History
              </h3>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">No allocation history yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <tr>
                        <th className="px-4 py-2">Employee</th>
                        <th className="px-4 py-2">Allocated</th>
                        <th className="px-4 py-2">Returned</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {history.map((alloc) => (
                        <tr key={alloc.id}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-gray-900">
                              {alloc.employee_detail.full_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {alloc.employee_detail.employee_id}
                            </p>
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {new Date(alloc.allocated_date).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {alloc.returned_date
                              ? new Date(alloc.returned_date).toLocaleDateString('en-IN')
                              : '—'}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                allocStatusColors[alloc.status]
                              }`}
                            >
                              {alloc.status_display}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">
                            {alloc.duration_days} days
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      {showAllocateModal && asset.status === 'AVAILABLE' && (
        <AllocateAssetModal
          asset={{
            id: asset.id,
            asset_tag: asset.asset_tag,
            name: asset.name,
            category_name: asset.category_detail.name,
          } as any}
          onClose={() => setShowAllocateModal(false)}
          onSuccess={() => {
            setShowAllocateModal(false);
            load();
          }}
        />
      )}
      {showReturnModal && asset.current_allocation && (
        <ReturnAssetModal
          allocation={{
            id: asset.current_allocation.id,
            asset_name: asset.name,
            asset_tag: asset.asset_tag,
            employee_name: asset.current_allocation.employee_name,
            allocated_date: asset.current_allocation.allocated_date,
          }}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => {
            setShowReturnModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: any) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-right font-medium text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}