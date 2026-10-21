import { useEffect, useState, useCallback } from 'react';
import { PlusIcon, PencilSquareIcon, TrashIcon, SparklesIcon } from '@heroicons/react/24/outline';
import {
  getPayCalendars,
  createPayCalendar,
  updatePayCalendar,
  deletePayCalendar,
  autoCreateCalendar,
  autoCreateYear,
} from '../../../api/payrollApi';
import CalendarFormModal from './CalendarFormModal';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-600 ring-gray-300/50',
  OPEN: 'bg-green-50 text-green-700 ring-green-600/20',
  LOCKED: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  CLOSED: 'bg-red-50 text-red-700 ring-red-600/20',
};

export default function PayCalendarPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [yearInput, setYearInput] = useState(new Date().getFullYear().toString());
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPayCalendars();
      setItems(res.data.results || res.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: any) => {
    if (editing) {
      await updatePayCalendar(editing.id, data);
    } else {
      await createPayCalendar(data);
    }
    setModalOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this calendar entry?')) return;
    await deletePayCalendar(id);
    load();
  };

  const handleAutoYear = async () => {
    if (!yearInput) return;
    setGenerating(true);
    try {
      await autoCreateYear({ year: parseInt(yearInput) });
      load();
    } catch {} finally { setGenerating(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pay Calendar</h2>
          <p className="text-sm text-gray-500">Monthly periods, cutoff dates, pay dates, and the Saturday work schedule used for salary proration.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="w-24 rounded-xl border-0 bg-gray-50 px-3 py-2.5 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              min="2020"
              max="2099"
            />
            <button
              onClick={handleAutoYear}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition"
            >
              <SparklesIcon className="h-4 w-4" />
              {generating ? 'Creating…' : 'Auto-Create Year'}
            </button>
          </div>
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
          >
            <PlusIcon className="h-4 w-4" /> Add Month
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No calendar entries. Use Auto-Create Year to generate.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Start → End</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Days</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Saturday</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cutoff</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pay Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {MONTH_NAMES[c.month]} {c.year}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.period_start} → {c.period_end}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{c.days_in_month}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{c.saturday_is_working ? 'Working' : 'Off'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.cutoff_date || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.pay_date || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_COLORS[c.status] || ''}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(c); setModalOpen(true); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <CalendarFormModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
