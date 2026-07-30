import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Loader2, Send, CheckCircle2,
  XCircle, RotateCcw, MapPin, AlertCircle, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { calendarApi } from '../../api/calendar';
import { structuresApi } from '../../api/masterData';
import { useAuth } from '../../context/AuthContext';
import type { AnnualCalendarDetail, Holiday } from '../../types/calendar';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HOLIDAY_TYPES = [
  { value: 'NATIONAL', label: 'National Holiday', color: 'bg-red-100 text-red-700' },
  { value: 'REGIONAL', label: 'Regional Holiday', color: 'bg-blue-100 text-blue-700' },
  { value: 'COMPANY', label: 'Company Holiday', color: 'bg-purple-100 text-purple-700' },
  { value: 'OPTIONAL', label: 'Optional Holiday', color: 'bg-amber-100 text-amber-700' },
  { value: 'RESTRICTED', label: 'Restricted Holiday', color: 'bg-gray-100 text-gray-700' },
];

export default function CalendarBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isHR = user?.role_codes?.includes('HR_ADMIN') || user?.role_codes?.includes('SYSTEM_ADMIN');

  const [calendar, setCalendar] = useState<AnnualCalendarDetail | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showAddHoliday, setShowAddHoliday] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cal, locData] = await Promise.all([
        calendarApi.getById(id!),
        structuresApi.list({ type: 'LOCATION' }),
      ]);
      setCalendar(cal);
      const locList = locData?.results || locData || [];
      setLocations(Array.isArray(locList) ? locList : []);
    } catch {
      toast.error('Failed to load calendar');
      navigate('/calendar/manage');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveHoliday = async (holidayId: string, holidayName: string) => {
  if (canAmend) {
    // Amendment flow — requires reason
    const reason = window.prompt(
      `Remove "${holidayName}" from published calendar?\n\n` +
      `Reason (min 5 chars — will be sent to all employees):`
    );
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) toast.error('Reason required (min 5 characters)');
      return;
    }
    try {
      await calendarApi.amendRemoveHoliday(id!, holidayId, reason);
      toast.success('Holiday removed. All employees notified.');
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to remove');
    }
  } else {
    // Draft flow — simple remove
    if (!window.confirm('Remove this holiday?')) return;
    try {
      await calendarApi.removeHoliday(id!, holidayId);
      toast.success('Holiday removed');
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to remove');
    }
  }
};

  const handleAction = async (action: string) => {
    if (!id) return;
    setActionLoading(action);
    try {
      let result;
      switch (action) {
        case 'submit':
          if (!window.confirm('Submit this calendar for approval? You cannot edit after submitting.')) {
            setActionLoading('');
            return;
          }
          result = await calendarApi.submitForReview(id);
          break;
        case 'approve':
          const approveComments = window.prompt('Comments (optional):');
          if (approveComments === null) { setActionLoading(''); return; }
          result = await calendarApi.approve(id, approveComments);
          break;
        case 'reject':
          const reason = window.prompt('Rejection reason (required):');
          if (!reason || reason.length < 3) {
            if (reason !== null) toast.error('Reason required');
            setActionLoading('');
            return;
          }
          result = await calendarApi.reject(id, reason);
          break;
        case 'return':
          const returnComments = window.prompt('What changes are needed? (min 5 chars):');
          if (!returnComments || returnComments.length < 5) {
            if (returnComments !== null) toast.error('Please provide detailed comments');
            setActionLoading('');
            return;
          }
          result = await calendarApi.returnForChanges(id, returnComments);
          break;
        case 'publish':
          if (!window.confirm(`Publish calendar ${calendar?.year} and notify all employees?`)) {
            setActionLoading('');
            return;
          }
          result = await calendarApi.publish(id);
          break;
      }
      if (result) toast.success(result.message);
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setActionLoading('');
    }
  };

  // Check if current user is the pending approver
  const isPendingApprover =
    calendar?.status === 'IN_REVIEW' &&
    calendar.approvals.some(
      (a) => a.status === 'PENDING' && a.approver === user?.employee?.id
    );

  if (loading || !calendar) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  // Group holidays by month
  const holidaysByMonth = (calendar.holidays || []).reduce((acc, h) => {
    const month = new Date(h.date).getMonth();
    if (!acc[month]) acc[month] = [];
    acc[month].push(h);
    return acc;
  }, {} as Record<number, Holiday[]>);

  Object.keys(holidaysByMonth).forEach((k) => {
    holidaysByMonth[+k].sort((a, b) => a.date.localeCompare(b.date));
  });

 const canEdit = calendar.status === 'DRAFT' && isHR;
const canAmend = calendar.status === 'PUBLISHED' && isHR;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">

          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate('/calendar/manage')}
              className="mb-3 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Calendars
            </button>

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-lg font-bold">
                    {String(calendar.year).slice(2)}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {calendar.title}
                    </h1>
                    <p className="text-sm text-gray-500">
                      {calendar.holiday_count} holidays • Status: <strong>{calendar.status_display}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {isHR && calendar.status === 'DRAFT' && (
                  <button
                    onClick={() => handleAction('submit')}
                    disabled={actionLoading === 'submit' || calendar.holiday_count === 0}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {calendar.returned_at ? 'Resubmit' : 'Submit for Review'}
                  </button>
                )}

                {isPendingApprover && (
                  <>
                    <button
                      onClick={() => handleAction('approve')}
                      disabled={!!actionLoading}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction('return')}
                      disabled={!!actionLoading}
                      className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Return
                    </button>
                    <button
                      onClick={() => handleAction('reject')}
                      disabled={!!actionLoading}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </>
                )}

                {isHR && calendar.status === 'APPROVED' && (
                  <button
                    onClick={() => handleAction('publish')}
                    disabled={actionLoading === 'publish'}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actionLoading === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Publish & Notify Employees
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Return Comments Banner */}
          {calendar.status === 'DRAFT' && calendar.return_comments && (
            <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200">
                  <RotateCcw className="h-5 w-5 text-amber-800" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-amber-900">🔄 Changes Requested</h3>
                  <p className="mt-1 text-sm text-amber-800">
                    Returned by <strong>{calendar.returned_by_name}</strong> on{' '}
                    {calendar.returned_at && new Date(calendar.returned_at).toLocaleDateString('en-IN')}
                  </p>
                  <div className="mt-3 rounded-lg bg-white border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-amber-900 mb-1">Comments:</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {calendar.return_comments}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rejection Banner */}
          {calendar.status === 'DRAFT' && calendar.rejection_reason && (
            <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <XCircle className="h-6 w-6 text-red-700 shrink-0" />
                <div>
                  <h3 className="font-bold text-red-900">❌ Rejected</h3>
                  <p className="mt-1 text-sm text-red-800 whitespace-pre-wrap">
                    {calendar.rejection_reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* LEFT: Holidays list */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <div className="flex items-center justify-between border-b border-gray-100 p-4">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Holidays ({calendar.holiday_count})
                  </h2>
                  {(canEdit || canAmend) && (
  <button
    onClick={() => setShowAddHoliday(true)}
    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
      canAmend ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'
    }`}
  >
    <Plus className="h-3 w-3" />
    {canAmend ? 'Amend — Add Holiday' : 'Add Holiday'}
  </button>
)}
                </div>

                {calendar.holiday_count === 0 ? (
                  <div className="p-12 text-center">
                    <AlertCircle className="mx-auto h-10 w-10 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No holidays added yet</p>
                    {canEdit && (
                      <button
                        onClick={() => setShowAddHoliday(true)}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                      >
                        <Plus className="h-3 w-3" />
                        Add First Holiday
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {MONTHS.map((month, monthIdx) => {
                      const monthHolidays = holidaysByMonth[monthIdx];
                      if (!monthHolidays?.length) return null;

                      return (
                        <div key={month}>
                          <div className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase text-gray-500">
                            {month} — {monthHolidays.length} holiday{monthHolidays.length > 1 ? 's' : ''}
                          </div>
                          {monthHolidays.map((h) => {
                            const typeConfig = HOLIDAY_TYPES.find((t) => t.value === h.holiday_type);
                            const date = new Date(h.date);
                            return (
                              <div
                                key={h.id}
                                className="flex items-start gap-3 p-4 hover:bg-gray-50"
                              >
                                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-red-50">
                                  <span className="text-[10px] font-semibold uppercase text-red-600">
                                    {MONTHS[date.getMonth()].slice(0, 3)}
                                  </span>
                                  <span className="text-base font-bold text-red-700">
                                    {date.getDate()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {h.name}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeConfig?.color || 'bg-gray-100'}`}>
                                      {h.holiday_type_display}
                                    </span>
                                    {!h.applicable_to_all_locations && h.location_names.length > 0 && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                        <MapPin className="h-2.5 w-2.5" />
                                        {h.location_names.map((l) => l.name).join(', ')}
                                      </span>
                                    )}
                                    {h.is_optional && (
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                        Optional
                                      </span>
                                    )}
                                  </div>
                                  {h.description && (
                                    <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                                      {h.description}
                                    </p>
                                  )}
                                </div>
                                {canEdit && (
                                  <button
                                    onClick={() => handleRemoveHoliday(h.id, h.name)}
                                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Approval history */}
            <div className="space-y-4">
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Details</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Year</dt>
                    <dd className="font-semibold">{calendar.year}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Status</dt>
                    <dd className="font-semibold">{calendar.status_display}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Holidays</dt>
                    <dd className="font-semibold">{calendar.holiday_count}</dd>
                  </div>
                  {calendar.created_by_name && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Created By</dt>
                      <dd className="text-xs">{calendar.created_by_name}</dd>
                    </div>
                  )}
                  {calendar.published_at && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Published</dt>
                      <dd className="text-xs">
                        {new Date(calendar.published_at).toLocaleDateString('en-IN')}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Approval Trail */}
              {calendar.approvals.length > 0 && (
                <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">
                    Approval Trail
                  </h3>
                  <div className="space-y-3">
                    {calendar.approvals.map((a) => (
                      <div key={a.id} className="border-l-2 border-gray-200 pl-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-700">
                            Step {a.step_number}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              a.status === 'APPROVED'
                                ? 'bg-green-100 text-green-700'
                                : a.status === 'REJECTED'
                                ? 'bg-red-100 text-red-700'
                                : a.status === 'RETURNED'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {a.status_display}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-700">
                          {a.step_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {a.approver_name}
                        </p>
                        {a.acted_at && (
                          <p className="mt-0.5 text-[10px] text-gray-400">
                            {new Date(a.acted_at).toLocaleString('en-IN')}
                          </p>
                        )}
                        {a.comments && (
                          <p className="mt-1 text-xs text-gray-600 italic">
                            "{a.comments}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Add Holiday Modal */}
      {showAddHoliday && (
        <AddHolidayModal
          calendarId={id!}
          year={calendar.year}
          locations={locations}
          isAmendment={canAmend}
          onClose={() => setShowAddHoliday(false)}
          onAdded={() => {
            setShowAddHoliday(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// ==============================================================================
// ADD HOLIDAY MODAL
// ==============================================================================

function AddHolidayModal({
  calendarId,
  year,
  locations,
  isAmendment,           // ← NEW PROP
  onClose,
  onAdded,
}: {
  calendarId: string;
  year: number;
  locations: any[];
  isAmendment?: boolean;    // ← NEW
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(`${year}-01-01`);
  const [holidayType, setHolidayType] = useState('NATIONAL');
  const [description, setDescription] = useState('');
  const [appliesToAll, setAppliesToAll] = useState(true);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isOptional, setIsOptional] = useState(false);
  const [reason, setReason] = useState('');           // ← NEW
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Holiday name required');
    if (!date) return toast.error('Date required');
    if (!appliesToAll && selectedLocations.length === 0) {
      return toast.error('Select at least one location or apply to all');
    }
    if (isAmendment && reason.trim().length < 5) {
      return toast.error('Please provide a reason for this amendment (min 5 chars)');
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        date,
        holiday_type: holidayType,
        description: description.trim(),
        applicable_to_all_locations: appliesToAll,
        applicable_locations: appliesToAll ? [] : selectedLocations,
        is_optional: isOptional,
      };

      if (isAmendment) {
        await calendarApi.amendAddHoliday(calendarId, {
          ...payload,
          reason: reason.trim(),
        });
        toast.success('Holiday added. All employees notified.');
      } else {
        await calendarApi.addHoliday(calendarId, payload);
        toast.success('Holiday added');
      }
      onAdded();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900">
            {isAmendment ? '🔄 Amend — Add Holiday' : 'Add Holiday'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          {isAmendment && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">
                ⚠️ Amending Published Calendar
              </p>
              <p className="text-xs text-amber-800 mt-1">
                All employees will be notified via email and in-app about this addition.
              </p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Holiday Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Independence Day"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={`${year}-01-01`}
                max={`${year}-12-31`}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={holidayType}
                onChange={(e) => setHolidayType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {HOLIDAY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
          {isAmendment && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Reason for Amendment <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g., Government announced surprise holiday for state elections"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                This reason will be sent to all employees.
              </p>
            </div>
          )}
          </div>
          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={appliesToAll}
                onChange={(e) => {
                  setAppliesToAll(e.target.checked);
                  if (e.target.checked) setSelectedLocations([]);
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Applies to all locations
                </span>
                <p className="text-xs text-gray-500">
                  Uncheck to make this a regional holiday
                </p>
              </div>
            </label>

            {!appliesToAll && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-600">
                  Select locations <span className="text-red-500">*</span>
                </p>
                {locations.length === 0 ? (
                  <p className="text-xs text-amber-600">
                    No locations found. Add locations in Settings first.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-2 space-y-1">
                    {locations.map((loc: any) => (
                      <label
                        key={loc.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLocations.includes(loc.id)}
                          onChange={(e) => {
                            setSelectedLocations(
                              e.target.checked
                                ? [...selectedLocations, loc.id]
                                : selectedLocations.filter((l) => l !== loc.id)
                            );
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600"
                        />
                        <span className="text-sm text-gray-700">{loc.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isOptional}
              onChange={(e) => setIsOptional(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm text-gray-700">Optional holiday</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 p-5">
          <button onClick={onClose} className="...">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              isAmendment
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isAmendment ? 'Amend Calendar' : 'Add Holiday'}
          </button>
        </div>
      </div>
    </div>
  );
}