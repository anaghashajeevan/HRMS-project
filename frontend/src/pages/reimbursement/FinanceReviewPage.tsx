import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Loader2, Search, XCircle, Clock, AlertCircle,
  FileText, Image, Eye, Filter, Sparkles, Download,
  ChevronDown, ChevronRight, ExternalLink, Shield,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { financeReviewApi, expenseItemsApi, attachmentsApi } from '../../api/reimbursement';
import type {
  FinanceReviewSummary, FinanceReviewBucket,
  ExpenseItem, ExpenseStatus,
} from '../../types/reimbursement';
import toast from 'react-hot-toast';

const BUCKET_CONFIG: Record<
  FinanceReviewBucket,
  { label: string; icon: any; color: string; description: string }
> = {
  all: { label: 'All Items', icon: Eye, color: 'bg-gray-100 text-gray-700', description: 'View all expense items' },
  ready_to_approve: { label: 'Ready to Approve', icon: CheckCircle2, color: 'bg-green-100 text-green-700', description: 'Bill matched, ready for approval' },
  missing_bill: { label: 'Missing Bill', icon: AlertCircle, color: 'bg-red-100 text-red-700', description: 'No bill attached' },
  ocr_pending: { label: 'OCR Pending', icon: Clock, color: 'bg-blue-100 text-blue-700', description: 'Waiting for OCR processing' },
  ocr_failed: { label: 'OCR Failed', icon: XCircle, color: 'bg-red-100 text-red-700', description: 'OCR could not process bill' },
  amount_mismatch: { label: 'Amount Mismatch', icon: AlertCircle, color: 'bg-orange-100 text-orange-700', description: 'Claimed ≠ extracted amount' },
  date_mismatch: { label: 'Date Mismatch', icon: AlertCircle, color: 'bg-amber-100 text-amber-700', description: 'Claimed date ≠ bill date' },
  needs_review: { label: 'Needs Review', icon: Eye, color: 'bg-purple-100 text-purple-700', description: 'Low confidence OCR result' },
  approved: { label: 'Approved', icon: CheckCircle2, color: 'bg-green-100 text-green-700', description: 'Already approved' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-700', description: 'Already rejected' },
};

const EXPENSE_STATUS_CONFIG: Record<ExpenseStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  PENDING_REVIEW: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  MISMATCH: { label: 'Mismatch', className: 'bg-orange-100 text-orange-700' },
};

export default function FinanceReviewPage() {
  const [summary, setSummary] = useState<FinanceReviewSummary | null>(null);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [activeBucket, setActiveBucket] = useState<FinanceReviewBucket>('all');
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [search, setSearch] = useState('');

  // Approval modal state
  const [approveItem, setApproveItem] = useState<ExpenseItem | null>(null);
  const [rejectItem, setRejectItem] = useState<ExpenseItem | null>(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchSummary = async () => {
    try {
      const data = await financeReviewApi.summary();
      setSummary(data);
    } catch {
      toast.error('Failed to load review summary');
    }
  };

  const fetchItems = async (bucket: FinanceReviewBucket) => {
    setLoadingItems(true);
    try {
      const data = await financeReviewApi.items(bucket);
      setItems(data);
    } catch {
      toast.error('Failed to load items');
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSummary(), fetchItems('all')]).finally(() => setLoading(false));
  }, []);

  const handleBucketChange = (bucket: FinanceReviewBucket) => {
    setActiveBucket(bucket);
    fetchItems(bucket);
  };

  const handleApprove = async () => {
    if (!approveItem) return;
    setProcessing(true);
    try {
      await expenseItemsApi.approve(approveItem.id, {
        approved_amount: approvedAmount || approveItem.claimed_amount,
        review_notes: reviewNotes,
      });
      toast.success('Expense approved');
      setApproveItem(null);
      setApprovedAmount('');
      setReviewNotes('');
      fetchItems(activeBucket);
      fetchSummary();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Approve failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectItem || !reviewNotes.trim()) {
      toast.error('Review notes are required for rejection');
      return;
    }
    setProcessing(true);
    try {
      await expenseItemsApi.reject(rejectItem.id, { review_notes: reviewNotes });
      toast.success('Expense rejected');
      setRejectItem(null);
      setReviewNotes('');
      fetchItems(activeBucket);
      fetchSummary();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Reject failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleRunOcr = async (attachmentId: number) => {
    try {
      toast.loading('Running OCR...', { id: 'ocr' });
      await attachmentsApi.runOcr(attachmentId);
      toast.success('OCR completed', { id: 'ocr' });
      fetchItems(activeBucket);
      fetchSummary();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'OCR failed', { id: 'ocr' });
    }
  };

  const handleValidate = async (itemId: number) => {
    try {
      toast.loading('Validating...', { id: 'validate' });
      await expenseItemsApi.validate(itemId);
      toast.success('Validation complete', { id: 'validate' });
      fetchItems(activeBucket);
      fetchSummary();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Validation failed', { id: 'validate' });
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.vendor_name?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.employee_name?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const formatMoney = (val: string) =>
    `₹${(parseFloat(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">Finance Review</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Review and approve expense items by category
            </p>
          </div>

          {/* Summary Stats */}
          {summary && (
            <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-5">
              <MiniStat label="Total" value={summary.total_items} color="bg-gray-50" />
              <MiniStat
                label="Ready ✓"
                value={summary.ready_to_approve_count}
                color="bg-green-50 text-green-700"
                highlight={summary.ready_to_approve_count > 0}
              />
              <MiniStat label="Missing Bill" value={summary.missing_bill_count} color="bg-red-50 text-red-700" />
              <MiniStat label="Approved" value={summary.approved_count} color="bg-green-50" />
              <MiniStat label="Rejected" value={summary.rejected_count} color="bg-red-50" />
            </div>
          )}

          {/* Bucket Tabs */}
          <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl bg-white p-2 shadow-sm ring-1 ring-gray-100">
            {(Object.keys(BUCKET_CONFIG) as FinanceReviewBucket[]).map((bucket) => {
              const cfg = BUCKET_CONFIG[bucket];
              const BucketIcon = cfg.icon;
              const isActive = activeBucket === bucket;
              const count = bucket === 'all' ? summary?.total_items :
                bucket === 'ready_to_approve' ? summary?.ready_to_approve_count :
                bucket === 'missing_bill' ? summary?.missing_bill_count :
                bucket === 'ocr_pending' ? summary?.ocr_pending_count :
                bucket === 'ocr_failed' ? summary?.ocr_failed_count :
                bucket === 'amount_mismatch' ? summary?.amount_mismatch_count :
                bucket === 'date_mismatch' ? summary?.date_mismatch_count :
                bucket === 'needs_review' ? summary?.needs_review_count :
                bucket === 'approved' ? summary?.approved_count :
                summary?.rejected_count;

              return (
                <button
                  key={bucket}
                  onClick={() => handleBucketChange(bucket)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <BucketIcon className="h-3 w-3" />
                  {cfg.label}
                  {count !== undefined && count > 0 && (
                    <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                      isActive ? 'bg-white/20' : 'bg-gray-200'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor, description, employee..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <span className="text-xs text-gray-500">
              <Filter className="inline h-3 w-3" /> {filtered.length} items
            </span>
          </div>

          {/* Items Table */}
          {loadingItems ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <Shield className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-3 text-sm font-semibold text-gray-900">
                No items in this bucket
              </h3>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Vendor / Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Claimed</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Approved</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Bill</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">OCR</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Validation</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((item) => {
                      const statusCfg = EXPENSE_STATUS_CONFIG[item.status];
                      const hasAttachment = item.has_attachment;
                      const ocrStatus = item.attachments?.[0]?.extraction?.status;
                      const validationStatus = item.validation?.status;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{item.employee_name}</p>
                            <p className="text-xs text-gray-500">{item.employee_code}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-900">{item.vendor_name || '—'}</p>
                            <p className="text-xs text-gray-500 line-clamp-1">{item.description || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {formatMoney(item.claimed_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-green-700">
                            {formatMoney(item.approved_amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              hasAttachment ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {hasAttachment ? 'Attached' : 'Missing'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              ocrStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                              ocrStatus === 'PROCESSING' ? 'bg-blue-100 text-blue-700' :
                              ocrStatus === 'FAILED' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {ocrStatus || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              validationStatus === 'MATCHED' ? 'bg-green-100 text-green-700' :
                              validationStatus === 'MISSING_BILL' ? 'bg-red-100 text-red-700' :
                              validationStatus === 'AMOUNT_MISMATCH' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {validationStatus || 'PENDING'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}>
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {item.status === 'PENDING_REVIEW' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setApproveItem(item);
                                      setApprovedAmount(item.claimed_amount);
                                      setReviewNotes('');
                                    }}
                                    className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectItem(item);
                                      setReviewNotes('');
                                    }}
                                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {hasAttachment && !ocrStatus && (
                                <button
                                  onClick={() => {
                                    const att = item.attachments?.[0];
                                    if (att) handleRunOcr(att.id);
                                  }}
                                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                                >
                                  OCR
                                </button>
                              )}
                              {ocrStatus === 'COMPLETED' && (
                                <button
                                  onClick={() => handleValidate(item.id)}
                                  className="rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700"
                                >
                                  Validate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Approve Modal */}
          {approveItem && (
            <Modal onClose={() => setApproveItem(null)}>
              <div className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Approve Expense</h3>
                </div>
                <p className="mb-3 text-sm text-gray-600">
                  {approveItem.vendor_name || approveItem.description} — Claimed: {formatMoney(approveItem.claimed_amount)}
                </p>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                    Approved Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                    Review Notes (optional)
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setApproveItem(null)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleApprove} disabled={processing} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* Reject Modal */}
          {rejectItem && (
            <Modal onClose={() => setRejectItem(null)}>
              <div className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Reject Expense</h3>
                </div>
                <p className="mb-3 text-sm text-gray-600">
                  {rejectItem.vendor_name || rejectItem.description} — {formatMoney(rejectItem.claimed_amount)}
                </p>
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Required: explain why this expense is rejected"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setRejectItem(null)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleReject} disabled={processing || !reviewNotes.trim()} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Reject
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </main>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color, highlight }: any) {
  return (
    <div className={`rounded-xl p-3 ${color} ${highlight ? 'ring-2 ring-green-400' : ''}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}