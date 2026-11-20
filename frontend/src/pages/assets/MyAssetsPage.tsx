import { useEffect, useState } from 'react';
import {
  Package, Laptop, Monitor, Smartphone, IdCard,
  Key, Loader2, Calendar, User, Info, ArrowLeft, CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { assetsApi, assetAllocationsApi } from '../../api/assets';
import type { AssetAllocation } from '../../types/asset';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// Icon mapping based on category icon name
const iconMap: Record<string, any> = {
  laptop: Laptop,
  monitor: Monitor,
  phone: Smartphone,
  smartphone: Smartphone,
  'id-card': IdCard,
  idcard: IdCard,
  key: Key,
  package: Package,
};

function getCategoryIcon(iconName: string) {
  return iconMap[iconName?.toLowerCase()] || Package;
}

export default function MyAssetsPage() {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState<AssetAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyAssets();
  }, []);

  const loadMyAssets = async () => {
    setLoading(true);
    try {
      const data = await assetsApi.getMyAssets();
      setAllocations(data);
    } catch {
      toast.error('Failed to load your assets');
    } finally {
      setLoading(false);
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="rounded-lg p-2 hover:bg-gray-200"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Assets</h1>
                <p className="text-sm text-gray-500">
                  Company property currently allocated to you
                </p>
              </div>
            </div>
            <div className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700">
              {allocations.length} {allocations.length === 1 ? 'item' : 'items'}
            </div>
          </div>

          {/* Info Banner */}
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Confirm physical handover</p>
              <p className="mt-1">
                Confirm each asset only after you physically receive it. If it was not handed over, raise a flag here for management review.
              </p>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
              <p className="text-sm text-gray-400">Loading your assets…</p>
            </div>
          ) : allocations.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-semibold text-gray-700">
                No Assets Allocated
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                You don't have any company assets assigned to you at the moment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allocations.map((alloc) => {
                const Icon = getCategoryIcon(alloc.asset_detail.category_icon);
                return (
                  <div
                    key={alloc.id}
                    className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-3 text-white shadow-md">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate font-semibold text-gray-900">
                          {alloc.asset_detail.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {alloc.asset_detail.category_name}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Asset Tag</span>
                        <span className="font-mono font-medium text-gray-900">
                          {alloc.asset_detail.asset_tag}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Serial No.</span>
                        <span className="font-mono text-xs text-gray-700">
                          {alloc.asset_detail.serial_number}
                        </span>
                      </div>
                      {alloc.asset_detail.brand && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Brand</span>
                          <span className="text-gray-700">{alloc.asset_detail.brand}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                        <span className="flex items-center gap-1 text-gray-500">
                          <Calendar className="h-3.5 w-3.5" /> Allocated
                        </span>
                        <span className="font-medium text-gray-900">
                          {new Date(alloc.allocated_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-gray-500">
                          <User className="h-3.5 w-3.5" /> By
                        </span>
                        <span className="text-xs text-gray-700">
                          {alloc.allocated_by_name || 'System'}
                        </span>
                      </div>
                    </div>

                    {alloc.handover_notes && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-2 text-xs italic text-gray-600">
                        "{alloc.handover_notes}"
                      </div>
                    )}
                    <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-gray-700">Receipt status</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${['PENDING', 'AWAITING_EMPLOYEE_CONFIRMATION'].includes(alloc.receipt_status) ? 'bg-amber-100 text-amber-800' : alloc.receipt_status === 'FLAGGED' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {alloc.receipt_status.replaceAll('_', ' ')}
                        </span>
                      </div>
                      {alloc.receipt_status === 'PENDING' && alloc.response_due_at && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3.5 w-3.5" /> Respond by {new Date(alloc.response_due_at).toLocaleDateString('en-IN')}</p>
                      )}
                      {alloc.receipt_status === 'FLAGGED' && alloc.current_employee_flag_note && <p className="mt-2 text-xs text-red-700">Your latest flag: {alloc.current_employee_flag_note}</p>}
                      {alloc.receipt_status === 'AWAITING_EMPLOYEE_CONFIRMATION' && alloc.employee_response_note && <p className="mt-2 text-xs text-gray-600">Your original flag: {alloc.employee_response_note}</p>}
                      {alloc.review_note && <p className="mt-2 text-xs text-indigo-700">Management decision: {alloc.review_note}</p>}
                      {alloc.receipt_status === 'AWAITING_EMPLOYEE_CONFIRMATION' && <p className="mt-2 text-xs font-medium text-amber-800">Management confirmed the handover. Please make your final receipt confirmation.</p>}
                      {alloc.receipt_status === 'PENDING' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={async () => { try { await assetAllocationsApi.confirmReceipt(alloc.id, 'ACCEPT'); toast.success('Receipt confirmed'); await loadMyAssets(); } catch (err: any) { toast.error(err.response?.data?.detail || 'Could not confirm receipt'); } }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" /> I received this</button>
                          <button onClick={async () => { const note = window.prompt('Tell management why you did not receive this asset:'); if (!note?.trim()) return; try { await assetAllocationsApi.confirmReceipt(alloc.id, 'FLAG', note.trim()); toast.success('Flag sent to management for review'); await loadMyAssets(); } catch (err: any) { toast.error(err.response?.data?.detail || 'Could not raise flag'); } }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> I did not receive this</button>
                        </div>
                      )}
                      {alloc.receipt_status === 'AWAITING_EMPLOYEE_CONFIRMATION' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={async () => { try { await assetAllocationsApi.confirmReceipt(alloc.id, 'ACCEPT'); toast.success('Final receipt confirmed; this asset is now confirmed as received'); await loadMyAssets(); } catch (err: any) { toast.error(err.response?.data?.detail || 'Could not confirm receipt'); } }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" /> Yes, I received it</button>
                          <button onClick={async () => { const note = window.prompt('Tell management why you still did not receive this asset:'); if (!note?.trim()) return; try { await assetAllocationsApi.confirmReceipt(alloc.id, 'FLAG', note.trim()); toast.success('Flag sent back to management for another review'); await loadMyAssets(); } catch (err: any) { toast.error(err.response?.data?.detail || 'Could not raise flag'); } }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> I still did not receive it</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
