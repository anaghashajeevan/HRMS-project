import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, CheckCircle2, XCircle, RotateCcw, Calendar as CalIcon, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { calendarApi } from '../../api/calendar';
import type { AnnualCalendarListItem } from '../../types/calendar';

export default function CalendarPendingApprovalsPage() {
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState<AnnualCalendarListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await calendarApi.pendingApprovals();
      setCalendars(data);
    } catch {
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (cal: AnnualCalendarListItem) => {
    const comments = window.prompt(`Approve calendar ${cal.year}?\nOptional comments:`);
    if (comments === null) return;

    setActionId(cal.id);
    try {
      await calendarApi.approve(cal.id, comments);
      toast.success('Approved!');
      load();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed');
    } finally {
      setActionId(null);
    }
  };

  const handleReturn = async (cal: AnnualCalendarListItem) => {
    const comments = window.prompt(
      `Return calendar ${cal.year} for changes?\nDescribe what needs to change (min 5 chars):`
    );
    if (!comments || comments.length < 5) {
      if (comments !== null) toast.error('Please provide detailed comments');
      return;
    }

    setActionId(cal.id);
    try {
      await calendarApi.returnForChanges(cal.id, comments);
      toast.success('Returned for changes');
      load();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (cal: AnnualCalendarListItem) => {
    const reason = window.prompt(`Reject calendar ${cal.year}?\nReason (required):`);
    if (!reason || reason.length < 3) {
      if (reason !== null) toast.error('Reason required');
      return;
    }

    setActionId(cal.id);
    try {
      await calendarApi.reject(cal.id, reason);
      toast.success('Rejected');
      load();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Calendar Pending Approvals
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {calendars.length} calendar{calendars.length !== 1 ? 's' : ''} awaiting your review
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : calendars.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">All Caught Up! 🎉</h3>
              <p className="mt-2 text-sm text-gray-500">No calendars pending your approval.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {calendars.map((cal) => (
                <div
                  key={cal.id}
                  className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-lg font-bold">
                        {String(cal.year).slice(2)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          Annual Calendar {cal.year}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {cal.holiday_count} holidays • Submitted by {cal.created_by_name}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      <Clock className="h-3 w-3" />
                      In Review
                    </span>
                  </div>

                  {cal.description && (
                    <p className="text-sm text-gray-600 mb-4">{cal.description}</p>
                  )}

                  <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                    <button
                      onClick={() => navigate(`/calendar/manage/${cal.id}`)}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <CalIcon className="h-4 w-4" />
                      Review Calendar
                    </button>
                    <button
                      onClick={() => handleApprove(cal)}
                      disabled={actionId === cal.id}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {actionId === cal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReturn(cal)}
                      disabled={actionId === cal.id}
                      className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Return
                    </button>
                    <button
                      onClick={() => handleReject(cal)}
                      disabled={actionId === cal.id}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}