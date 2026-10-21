import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getPayCalendars, createPayRun } from '../../../api/payrollApi';

const inputCls =
  'block w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500 transition';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RUN_TYPES = ['REGULAR', 'OFF_CYCLE', 'FNF', 'ARREARS'];

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateRunModal({ onClose, onCreated }: Props) {
  const [calendars, setCalendars] = useState<any[]>([]);
  const [form, setForm] = useState({ pay_calendar: '', run_type: 'REGULAR' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getPayCalendars({ status: 'OPEN' } as any)
      .then((r) => setCalendars(r.data.results || r.data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pay_calendar) { setError('Select a pay calendar.'); return; }
    setSaving(true);
    setError('');
    try {
      await createPayRun(form);
      onCreated();
    } catch (err: any) {
      setError(JSON.stringify(err?.response?.data) || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">New Pay Run</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Pay Calendar *</label>
            <select className={inputCls} value={form.pay_calendar} onChange={(e) => setForm((f) => ({ ...f, pay_calendar: e.target.value }))}>
              <option value="">Select period…</option>
              {calendars.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {MONTHS[c.month]} {c.year} ({c.period_start} → {c.period_end})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Run Type</label>
            <select className={inputCls} value={form.run_type} onChange={(e) => setForm((f) => ({ ...f, run_type: e.target.value }))}>
              {RUN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Creating…' : 'Create Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}