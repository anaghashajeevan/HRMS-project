import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Loader2, Calendar as CalIcon, FileText, Clock,
  CheckCircle2, Archive, AlertCircle, Send, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { calendarApi } from '../../api/calendar';
import type { AnnualCalendarListItem, CalendarStatus } from '../../types/calendar';

const STATUS_CONFIG: Record<CalendarStatus, { label: string; color: string; icon: any }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  IN_REVIEW: { label: 'In Review', color: 'bg-blue-100 text-blue-700', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  PUBLISHED: { label: 'Published', color: 'bg-emerald-100 text-emerald-700', icon: Send },
  ARCHIVED: { label: 'Archived', color: 'bg-amber-100 text-amber-700', icon: Archive },
};

export default function CalendarManagePage() {
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState<AnnualCalendarListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear() + 1);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await calendarApi.list();
      setCalendars(data);
    } catch {
      toast.error('Failed to load calendars');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (calendars.some((c) => c.year === newYear)) {
      toast.error(`Calendar for ${newYear} already exists`);
      return;
    }

    setCreating(true);
    try {
      const calendar = await calendarApi.create({
        year: newYear,
        title: `Annual Calendar ${newYear}`,
        description: `Holiday calendar for ${newYear}`,
      });
      toast.success(`Calendar ${newYear} created!`);
      setShowCreate(false);
      navigate(`/calendar/manage/${calendar.id}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to create calendar');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Annual Calendars</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage yearly holiday calendars — {calendars.length} calendar
                {calendars.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              New Calendar
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : calendars.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <CalIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-3 text-lg font-semibold text-gray-900">
                No calendars yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Create your first annual calendar to get started.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                <Sparkles className="h-4 w-4" />
                Create First Calendar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {calendars.map((cal) => {
                const sc = STATUS_CONFIG[cal.status];
                const StatusIcon = sc.icon;
                return (
                  <div
                    key={cal.id}
                    onClick={() => navigate(`/calendar/manage/${cal.id}`)}
                    className="cursor-pointer rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:ring-primary-200"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-lg font-bold">
                        {String(cal.year).slice(2)}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${sc.color}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {sc.label}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900">{cal.year}</h3>
                    <p className="mt-0.5 text-sm text-gray-500 line-clamp-1">
                      {cal.title}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <CalIcon className="h-4 w-4" />
                        <span className="font-semibold">{cal.holiday_count}</span>
                        <span className="text-xs">holidays</span>
                      </div>
                      {cal.created_by_name && (
                        <span className="text-xs text-gray-400">
                          by {cal.created_by_name.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Create New Calendar</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter the year for which you want to create a holiday calendar.
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(parseInt(e.target.value) || 0)}
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 5}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Must be current year or later
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}