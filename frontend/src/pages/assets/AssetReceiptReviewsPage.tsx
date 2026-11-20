import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { assetAllocationsApi } from '../../api/assets';
import type { AssetAllocation } from '../../types/asset';
import toast from 'react-hot-toast';

export default function AssetReceiptReviewsPage() {
  const [items, setItems] = useState<AssetAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await assetAllocationsApi.receiptReviews());
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not load receipt flags.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const decide = async (item: AssetAllocation, decision: 'CONFIRM_NOT_RECEIVED' | 'CONFIRM_RECEIVED') => {
    const promptText = decision === 'CONFIRM_NOT_RECEIVED'
      ? 'Management note: confirm the asset was not received. It will be returned to Available inventory.'
      : 'Management note: confirm the asset was physically received.';
    const note = window.prompt(promptText);
    if (!note?.trim()) return;
    setSavingId(item.id);
    try {
      await assetAllocationsApi.reviewReceipt(item.id, decision, note.trim());
      toast.success('Receipt review decision saved and sent to the employee.');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not save the review decision.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Asset Receipt Reviews</h1>
              <p className="mt-1 text-sm text-gray-500">Review employee reports that an assigned asset was not physically handed over.</p>
            </div>
            <div className="flex gap-2">
              <Link to="/settings/approval-workflows" className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700">Approval settings</Link>
              <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700"><RefreshCw className="h-4 w-4" /> Refresh</button>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" /><p className="mt-3 font-semibold text-gray-900">No receipt flags to review</p></div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <article key={item.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /><h2 className="font-semibold text-gray-900">{item.asset_detail.name} ({item.asset_detail.asset_tag})</h2></div>
                      <p className="mt-1 text-sm text-gray-600">Assigned to {item.employee_detail.full_name} ({item.employee_detail.employee_id}) on {new Date(item.allocated_date).toLocaleDateString('en-IN')}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Needs management review</span>
                  </div>
                  <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-900"><strong>Employee report:</strong> {item.current_employee_flag_note || item.employee_response_note}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button disabled={savingId === item.id} onClick={() => void decide(item, 'CONFIRM_NOT_RECEIVED')} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Confirm not received</button>
                    <button disabled={savingId === item.id} onClick={() => void decide(item, 'CONFIRM_RECEIVED')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Confirm employee received it</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
