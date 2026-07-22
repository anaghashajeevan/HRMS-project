import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, AlertCircle,
  FileText, Image, Sparkles, Send, Ban, RefreshCw, Download,
  Edit, Save, X, Check, FolderArchive, Eye, Info,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { quickClaimApi } from '../../api/reimbursement';
import type {
  SmartReimbursementUpload,
  SmartUploadStatus,
  DraftExtractedExpense,
  BillFileStatus,
  ExpenseCategory,
} from '../../types/reimbursement';
import toast from 'react-hot-toast';

// ==============================================================================
// STATUS CONFIGS
// ==============================================================================

const UPLOAD_STATUS_CONFIG: Record<
  SmartUploadStatus,
  { label: string; className: string; icon: any }
> = {
  UPLOADING: { label: 'Uploading', className: 'bg-blue-100 text-blue-700', icon: Loader2 },
  QUEUED: { label: 'Queued', className: 'bg-gray-100 text-gray-700', icon: Clock },
  PROCESSING: { label: 'Processing OCR', className: 'bg-indigo-100 text-indigo-700', icon: Loader2 },
  NEEDS_REVIEW: { label: 'Needs Review', className: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  READY_TO_CONFIRM: { label: 'Ready to Send', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  CONFIRMING: { label: 'Sending...', className: 'bg-blue-100 text-blue-700', icon: Loader2 },
  SENT: { label: 'Sent ✓', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600', icon: Ban },
};

const FILE_STATUS_CONFIG: Record<BillFileStatus, { label: string; className: string }> = {
  QUEUED: { label: 'Queued', className: 'bg-gray-100 text-gray-700' },
  PROCESSING: { label: 'Processing', className: 'bg-blue-100 text-blue-700' },
  PROCESSED: { label: 'Processed', className: 'bg-green-100 text-green-700' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600' },
};

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'MEAL', label: 'Meal' },
  { value: 'TELEPHONE', label: 'Telephone' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'OTHERS', label: 'Others' },
];

// ==============================================================================
// MAIN PAGE
// ==============================================================================

export default function UploadStatusPage() {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();

  const [upload, setUpload] = useState<SmartReimbursementUpload | null>(null);
  const [drafts, setDrafts] = useState<DraftExtractedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [polling, setPolling] = useState(false);

  // Fetch upload status + drafts
  const fetchData = useCallback(async () => {
    if (!uploadId) return;
    try {
      const [statusData, draftsData] = await Promise.all([
        quickClaimApi.getStatus(Number(uploadId)),
        quickClaimApi.getDraftExpenses(Number(uploadId)).catch(() => []),
      ]);
      setUpload(statusData);
      setDrafts(draftsData);
    } catch (err) {
      toast.error('Failed to load upload status');
      navigate('/reimbursements/smart-upload');
    } finally {
      setLoading(false);
    }
  }, [uploadId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-poll while processing
  useEffect(() => {
    if (!upload) return;
    const isProcessing = ['UPLOADING', 'QUEUED', 'PROCESSING', 'CONFIRMING'].includes(upload.status);
    if (!isProcessing) return;

    setPolling(true);
    const interval = setInterval(fetchData, 3000);
    return () => {
      clearInterval(interval);
      setPolling(false);
    };
  }, [upload?.status, fetchData]);

  const handleConfirmAndSend = async () => {
    if (!uploadId) return;
    if (!confirm('Confirm and send this reimbursement report to finance?')) return;

    setConfirming(true);
    try {
      await quickClaimApi.confirmAndSend(Number(uploadId));
      toast.success('Report sent to finance!');
      fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.items || 'Send failed';
      toast.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!uploadId) return;
    if (!confirm('Cancel this upload? This cannot be undone.')) return;

    setCancelling(true);
    try {
      await quickClaimApi.cancel(Number(uploadId));
      toast.success('Upload cancelled');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  if (loading || !upload) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-600" />
              <p className="mt-3 text-sm text-gray-500">Loading upload status...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusCfg = UPLOAD_STATUS_CONFIG[upload.status];
  const StatusIcon = statusCfg.icon;
  const isEditable = ['NEEDS_REVIEW', 'READY_TO_CONFIRM'].includes(upload.status);
  const canSend = upload.status === 'READY_TO_CONFIRM';
  const canCancel = !['SENT', 'CANCELLED'].includes(upload.status);
  const isSent = upload.status === 'SENT';
  const needsReview = drafts.some((d) => d.requires_manual_review);
  const totalAmount = drafts.reduce(
    (sum, d) => sum + (parseFloat(d.amount || '0') || 0), 0
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Back + Header */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => navigate('/reimbursements/smart-upload')}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  Upload #{upload.id}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.className}`}
                >
                  <StatusIcon className={`h-3 w-3 ${
                    ['UPLOADING', 'PROCESSING', 'CONFIRMING'].includes(upload.status)
                      ? 'animate-spin'
                      : ''
                  }`} />
                  {statusCfg.label}
                </span>
                {polling && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Auto-refreshing
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {upload.employee_name} • {upload.month}/{upload.year}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Stats Cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Total Files" value={upload.total_files} color="bg-primary-50 text-primary-700" />
            <StatCard label="Processed" value={upload.processed_files} color="bg-green-50 text-green-700" />
            <StatCard label="Failed" value={upload.failed_files} color="bg-red-50 text-red-700" />
            <StatCard
              label="Needs Review"
              value={drafts.filter((d) => d.requires_manual_review).length}
              color="bg-amber-50 text-amber-700"
            />
            <StatCard
              label="Total Amount"
              value={`₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              color="bg-blue-50 text-blue-700"
            />
          </div>

          {/* Bill Files Progress */}
          {upload.files.length > 0 && (
            <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Uploaded Files ({upload.files.length})
              </h3>
              <div className="space-y-2">
                {upload.files.map((file) => {
                  const fileCfg = FILE_STATUS_CONFIG[file.status];
                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2"
                    >
                      {file.detected_mime_type.startsWith('image/') ? (
                        <Image className="h-4 w-4 text-gray-400" />
                      ) : (
                        <FileText className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="flex-1 truncate text-sm text-gray-900">
                        {file.original_filename}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(file.file_size / 1024).toFixed(0)} KB
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${fileCfg.className}`}
                      >
                        {fileCfg.label}
                      </span>
                      {file.error_message && (
                        <span className="text-xs text-red-600" title={file.error_message}>
                          ⚠
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Draft Expenses Table */}
          {drafts.length > 0 && (
            <div className="mb-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Extracted Expenses ({drafts.length})
                  </h3>
                  <p className="text-xs text-gray-500">
                    Review and edit any incorrect data before sending
                  </p>
                </div>
                {needsReview && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                    <AlertCircle className="h-3 w-3" />
                    {drafts.filter((d) => d.requires_manual_review).length} item(s) need review
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">File</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Vendor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Purpose</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {drafts.map((draft) => (
                      <DraftExpenseRow
                        key={draft.id}
                        draft={draft}
                        uploadId={Number(uploadId)}
                        isEditable={isEditable}
                        onUpdate={fetchData}
                      />
                    ))}
                  </tbody>
                  <tfoot className="bg-green-50">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-green-900">
                        Total:
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-900">
                        ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Reports (if sent) */}
          {isSent && (upload.excel_report_url || upload.pdf_report_url) && (
            <div className="mb-6 rounded-2xl bg-green-50 p-5 ring-1 ring-green-200">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-900">
                <CheckCircle2 className="h-4 w-4" />
                Reports Generated & Sent
              </h3>
              <div className="flex gap-3">
                {upload.excel_report_url && (
                  <a
                    href={upload.excel_report_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-green-700 ring-1 ring-green-200 hover:bg-green-50"
                  >
                    <Download className="h-4 w-4" />
                    Excel Report
                  </a>
                )}
                {upload.pdf_report_url && (
                  <a
                    href={upload.pdf_report_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-green-700 ring-1 ring-green-200 hover:bg-green-50"
                  >
                    <Download className="h-4 w-4" />
                    PDF Report
                  </a>
                )}
              </div>
              {upload.latest_email_status && (
                <p className="mt-3 text-xs text-green-700">
                  Email: {upload.latest_email_status.status}
                  {upload.latest_email_status.sent_at &&
                    ` • Sent ${new Date(upload.latest_email_status.sent_at).toLocaleString()}`}
                </p>
              )}
            </div>
          )}

          {/* Error Message */}
          {upload.error_message && (
            <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Error</p>
                <p className="mt-1 text-red-700">{upload.error_message}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                Cancel Upload
              </button>
            )}
            {canSend && (
              <button
                onClick={handleConfirmAndSend}
                disabled={confirming || needsReview}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                title={needsReview ? 'Fix all review items first' : 'Confirm and send to finance'}
              >
                {confirming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Confirm & Send to Finance
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// STAT CARD
// ==============================================================================

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}

// ==============================================================================
// DRAFT EXPENSE ROW (with inline editing)
// ==============================================================================

function DraftExpenseRow({
  draft,
  uploadId,
  isEditable,
  onUpdate,
}: {
  draft: DraftExtractedExpense;
  uploadId: number;
  isEditable: boolean;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    expense_date: draft.expense_date || '',
    vendor_name: draft.vendor_name || '',
    purpose: draft.purpose || '',
    category: draft.category || 'OTHERS',
    amount: draft.amount || '',
    remarks: draft.remarks || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await quickClaimApi.updateDraftExpense(uploadId, draft.id, form);
      toast.success('Updated');
      setEditing(false);
      onUpdate();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const needsReview = draft.requires_manual_review;
  const isVerified = !needsReview && (draft.manually_reviewed || draft.category_confidence >= 0.6);

  const confidenceColor = () => {
    if (draft.category_confidence >= 0.8) return 'text-green-600';
    if (draft.category_confidence >= 0.5) return 'text-amber-600';
    return 'text-red-600';
  };

  if (editing) {
    return (
      <tr className="bg-primary-50/30">
        <td className="px-4 py-2">
          <span className="text-xs text-gray-600">{draft.bill_filename}</span>
        </td>
        <td className="px-4 py-2">
          <input
            type="date"
            value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </td>
        <td className="px-4 py-2">
          <input
            type="text"
            value={form.vendor_name}
            onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            placeholder="Vendor name"
          />
        </td>
        <td className="px-4 py-2">
          <input
            type="text"
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            placeholder="Purpose"
          />
        </td>
        <td className="px-4 py-2">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </td>
        <td className="px-4 py-2" />
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => setEditing(false)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`hover:bg-gray-50 ${needsReview ? 'bg-amber-50/30' : ''}`}>
      <td className="px-4 py-3">
        <span className="text-xs text-gray-700">{draft.bill_filename}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-900">
        {draft.expense_date || <span className="text-red-500">Missing</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900">
        {draft.vendor_name || <span className="text-red-500">Missing</span>}
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-900 line-clamp-1">{draft.purpose || '—'}</span>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {draft.category}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {draft.amount ? `₹${parseFloat(draft.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : (
          <span className="text-red-500">₹0.00</span>
        )}
      </td>
      <td className="px-4 py-3">
        {needsReview ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <AlertCircle className="h-3 w-3" />
            Review
          </span>
        ) : isVerified ? (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3 w-3" />
            {draft.manually_reviewed ? 'Manually Verified' : 'Verified'}
          </span>
        ) : (
          <span className={`text-xs ${confidenceColor()}`}>
            {Math.round(draft.category_confidence * 100)}% confident
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {isEditable && (
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1.5 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
            title="Edit this item"
          >
            <Edit className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}