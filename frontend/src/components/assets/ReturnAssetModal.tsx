import { useState, type FormEvent } from 'react';
import { X, Loader2, RotateCcw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { assetAllocationsApi } from '../../api/assets';
import toast from 'react-hot-toast';

interface Props {
  allocation: {
    id: string;
    asset_name: string;
    asset_tag: string;
    employee_name: string;
    allocated_date: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const RETURN_OPTIONS = [
  {
    value: 'RETURNED',
    label: 'Returned (Good Condition)',
    description: 'Asset returned in working order, ready for reuse',
    icon: CheckCircle2,
    color: 'green',
  },
  {
    value: 'DAMAGED',
    label: 'Damaged',
    description: 'Asset is damaged and needs repair',
    icon: AlertTriangle,
    color: 'amber',
  },
  {
    value: 'LOST',
    label: 'Lost / Stolen',
    description: 'Asset cannot be recovered — will be written off',
    icon: XCircle,
    color: 'red',
  },
];

export default function ReturnAssetModal({ allocation, onClose, onSuccess }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    status: 'RETURNED' | 'DAMAGED' | 'LOST';
    returned_date: string;
    return_notes: string;
    recovery_cost: string;
  }>({
    status: 'RETURNED',
    returned_date: new Date().toISOString().split('T')[0],
    return_notes: '',
    recovery_cost: '',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await assetAllocationsApi.returnAsset(allocation.id, {
        status: form.status,
        returned_date: form.returned_date,
        return_notes: form.return_notes || undefined,
        recovery_cost: form.recovery_cost ? parseFloat(form.recovery_cost) : 0,
      });
      toast.success(`Asset marked as ${form.status}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to process return');
    } finally {
      setSaving(false);
    }
  };

  const colorClasses: Record<string, string> = {
    green: 'border-green-500 bg-green-50 text-green-700',
    amber: 'border-amber-500 bg-amber-50 text-amber-700',
    red: 'border-red-500 bg-red-50 text-red-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-2 text-white">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Process Return</h2>
              <p className="text-xs text-gray-500">Record asset return details</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Allocation Info */}
        <div className="mb-4 rounded-xl bg-gray-50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-indigo-600">{allocation.asset_tag}</p>
              <p className="font-semibold text-gray-900">{allocation.asset_name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Assigned to</p>
              <p className="font-medium text-gray-700">{allocation.employee_name}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Return Condition */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Return Condition <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {RETURN_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, status: opt.value as any })}
                  className={`flex w-full items-start gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                    form.status === opt.value
                      ? colorClasses[opt.color]
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <opt.icon
                    className={`h-5 w-5 flex-shrink-0 ${
                      form.status === opt.value ? '' : 'text-gray-400'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs opacity-80">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Return Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Return Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.returned_date}
              onChange={(e) => setForm({ ...form, returned_date: e.target.value })}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Recovery Cost (only for damaged/lost) */}
          {(form.status === 'DAMAGED' || form.status === 'LOST') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Recovery Cost (₹)
              </label>
              <input
                type="number"
                value={form.recovery_cost}
                onChange={(e) => setForm({ ...form, recovery_cost: e.target.value })}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Amount to be recovered from employee (optional). Will be tracked for FnF settlement.
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Return Notes
            </label>
            <textarea
              value={form.return_notes}
              onChange={(e) => setForm({ ...form, return_notes: e.target.value })}
              rows={3}
              placeholder="e.g., Minor scratch on lid. All accessories returned."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {saving ? 'Processing...' : 'Process Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}