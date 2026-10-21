import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const inputCls =
  'block w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500 transition';

interface Props {
  initial: any | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export default function CalendarFormModal({ initial, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    year: initial?.year || new Date().getFullYear(),
    month: initial?.month || new Date().getMonth() + 1,
    period_start: initial?.period_start || '',
    period_end: initial?.period_end || '',
    days_in_month: initial?.days_in_month || '',
    saturday_is_working: initial?.saturday_is_working ?? false,
    cutoff_date: initial?.cutoff_date || '',
    pay_date: initial?.pay_date || '',
    status: initial?.status || 'DRAFT',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        cutoff_date: form.cutoff_date || null,
        pay_date: form.pay_date || null,
      });
    } catch (err: any) {
      setError(JSON.stringify(err?.response?.data) || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{initial ? 'Edit Calendar' : 'New Calendar'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Year</label>
              <input type="number" className={inputCls} value={form.year} onChange={(e) => set('year', parseInt(e.target.value))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Month</label>
              <input type="number" min="1" max="12" className={inputCls} value={form.month} onChange={(e) => set('month', parseInt(e.target.value))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Days in Month</label>
              <input type="number" className={inputCls} value={form.days_in_month} onChange={(e) => set('days_in_month', parseInt(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Period Start</label>
              <input type="date" className={inputCls} value={form.period_start} onChange={(e) => set('period_start', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Period End</label>
              <input type="date" className={inputCls} value={form.period_end} onChange={(e) => set('period_end', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Cutoff Date</label>
              <input type="date" className={inputCls} value={form.cutoff_date} onChange={(e) => set('cutoff_date', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Pay Date</label>
              <input type="date" className={inputCls} value={form.pay_date} onChange={(e) => set('pay_date', e.target.value)} />
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={form.saturday_is_working}
              onChange={(e) => set('saturday_is_working', e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-gray-800">Saturday is a scheduled workday</span>
              <span className="block text-xs text-gray-500">When off, only recorded attendance on Saturday adds pay. Sundays are always off unless attendance is recorded.</span>
            </span>
          </label>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
            <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="LOCKED">Locked</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
