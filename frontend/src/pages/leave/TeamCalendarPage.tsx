import { useEffect, useState } from 'react';
import {
  Loader2, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { leaveApplicationsApi } from '../../api/leave';
import type { TeamCalendarResponse } from '../../types/leave';

// 🆕 Helper — Format date as YYYY-MM-DD in LOCAL timezone (avoids UTC bug)
const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function TeamCalendarPage() {
  const [calendar, setCalendar] = useState<TeamCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadCalendar();
  }, [currentMonth]);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const data = await leaveApplicationsApi.teamCalendar(
        formatLocalDate(start),   // ✅ FIXED
        formatLocalDate(end)      // ✅ FIXED
      );
      setCalendar(data);
    } catch (error) {
      toast.error('Failed to load team calendar');
    } finally {
      setLoading(false);
    }
  };

  const goToMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
  };

  // Build calendar grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells: Array<{ date: Date | null; events: any[]; clash?: any }> = [];

  // Empty cells before month start
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ date: null, events: [] });
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = formatLocalDate(date);   // ✅ FIXED

    const events = (calendar?.events || []).filter((e: any) => {
      if (e.type === 'holiday') return e.date === dateStr;
      return e.start_date <= dateStr && e.end_date >= dateStr;
    });
    const clash = calendar?.clashes.find(c => c.date === dateStr);
    cells.push({ date, events, clash });
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Calendar</h1>
              <p className="mt-1 text-sm text-gray-600">
                {calendar?.team_size ? `${calendar.team_size} team member${calendar.team_size !== 1 ? 's' : ''}` : 'Loading...'} •
                View team leaves and detect clashes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToMonth('prev')}
                className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[180px] rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold shadow-sm ring-1 ring-gray-100">
                {monthName}
              </div>
              <button
                onClick={() => goToMonth('next')}
                className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              {/* Clash Warnings */}
              {/* Clash Warnings — Grouped by Severity */}
{calendar && calendar.clashes.length > 0 && (
  <div className="mb-4 space-y-3">
    {/* Critical clashes — entire team out */}
    {calendar.clashes.filter((c: any) => c.severity === 'critical').length > 0 && (
      <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 shadow-md">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">⛔</div>
          <div className="flex-1">
            <h3 className="font-bold text-red-900 text-base">
              CRITICAL: Entire Team on Leave
            </h3>
            <div className="mt-2 space-y-2">
              {calendar.clashes.filter((c: any) => c.severity === 'critical').map((clash: any, i: number) => (
                <div key={i} className="rounded-lg bg-white p-3 border border-red-200">
                  <div className="font-semibold text-red-900">
                    📅 {formatDate(clash.date)} — {clash.count} of {Math.round(clash.count/clash.percentage*100)} team members
                  </div>
                  <div className="mt-1 text-sm text-red-800">
                    Team members: {clash.employees.map((e: any) => e.employee_name).join(', ')}
                  </div>
                  <div className="mt-2 text-xs text-red-700 italic">
                    ⚠️ Recommendation: Approval requires override — reschedule at least one leave or arrange coverage.
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* High severity */}
    {calendar.clashes.filter((c: any) => c.severity === 'high').length > 0 && (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-xl">🔴</div>
          <div className="flex-1">
            <h3 className="font-bold text-red-900">HIGH: Most Team on Leave (75%+)</h3>
            <div className="mt-2 space-y-1">
              {calendar.clashes.filter((c: any) => c.severity === 'high').map((clash: any, i: number) => (
                <div key={i} className="text-sm text-red-800">
                  <strong>{formatDate(clash.date)}:</strong>{' '}
                  {clash.count} on leave ({clash.percentage}%) — {clash.employees.map((e: any) => e.employee_name).join(', ')}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Medium severity */}
    {calendar.clashes.filter((c: any) => c.severity === 'medium').length > 0 && (
      <div className="rounded-xl border border-orange-300 bg-orange-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-orange-600 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold text-orange-900">MEDIUM: Half Team on Leave (50%+)</h3>
            <div className="mt-2 space-y-1">
              {calendar.clashes.filter((c: any) => c.severity === 'medium').slice(0, 5).map((clash: any, i: number) => (
                <div key={i} className="text-sm text-orange-800">
                  <strong>{formatDate(clash.date)}:</strong>{' '}
                  {clash.count} on leave ({clash.percentage}%) — {clash.employees.map((e: any) => e.employee_name).join(', ')}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Low severity */}
    {calendar.clashes.filter((c: any) => c.severity === 'low').length > 0 && (
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600 flex-shrink-0" />
          <div className="flex-1 text-sm text-yellow-900">
            <strong>ℹ️ {calendar.clashes.filter((c: any) => c.severity === 'low').length} days</strong> have multiple team members out
            (see calendar below for details).
          </div>
        </div>
      </div>
    )}
  </div>
)}

              {/* Calendar Grid */}
              <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                  {weekDays.map((day) => (
                    <div key={day} className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Cells */}
                <div className="grid grid-cols-7">
                  {cells.map((cell, idx) => (
                    <div
                      key={idx}
                      className={`min-h-[100px] border-b border-r border-gray-100 p-2 ${
                        cell.date ? 'hover:bg-gray-50' : 'bg-gray-50'
                    } ${
  cell.clash?.severity === 'critical' ? 'bg-red-100 border-2 border-red-400' :
  cell.clash?.severity === 'high' ? 'bg-red-50' :
  cell.clash?.severity === 'medium' ? 'bg-orange-50' :
  cell.clash?.severity === 'low' ? 'bg-yellow-50' :
  ''
}`}
                    >
                      {cell.date && (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-semibold ${
                              cell.date.getDay() === 0 || cell.date.getDay() === 6
                                ? 'text-gray-400'
                                : 'text-gray-700'
                            }`}>
                              {cell.date.getDate()}
                            </span>
                            {cell.clash && (
  <span className="text-xs" title={cell.clash.severity_label || 'Clash warning'}>
    {cell.clash.severity === 'critical' ? '⛔' :
     cell.clash.severity === 'high' ? '🔴' :
     cell.clash.severity === 'medium' ? '🟠' :
     '🟡'}
  </span>
)}
                          </div>

                          <div className="space-y-1">
                            {cell.events.slice(0, 3).map((event: any, i: number) => {
  // Determine styling based on event type + status
  let bgColor = event.color;
  let borderStyle = '';
  let icon = '';
  let statusLabel = '';

  if (event.type === 'holiday') {
    bgColor = '#94A3B8';  // Gray for holidays
    icon = '🎉';
  } else if (event.status === 'PENDING') {
    bgColor = '#F59E0B';  // Amber for pending
    borderStyle = '2px dashed rgba(255,255,255,0.5)';
    icon = '⏳';
    statusLabel = ' (Pending)';
  } else if (event.status === 'APPROVED') {
    bgColor = event.color;  // Use leave type color for approved
    icon = '✅';
  }

  const tooltipText = event.type === 'holiday'
    ? event.title
    : `${event.employee_name} - ${event.leave_type_name}${statusLabel}`;

  return (
    <div
      key={i}
      className="truncate rounded px-1.5 py-0.5 text-xs font-medium text-white"
      style={{
        backgroundColor: bgColor,
        border: borderStyle || undefined,
      }}
      title={tooltipText}
    >
      {event.type === 'holiday'
        ? `${icon} ${event.title}`
        : `${icon} ${event.employee_name.split(' ')[0]}`}
    </div>
  );
})}
                            {cell.events.length > 3 && (
                              <div className="text-xs text-gray-500 pl-1">
                                +{cell.events.length - 3} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              {/* Legend */}
<div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
  <span className="font-semibold text-gray-600">Legend:</span>
  <span className="flex items-center gap-1.5">
    <div className="h-3 w-3 rounded bg-green-500" />
    <span>✅ Approved Leave (leave type color)</span>
  </span>
  <span className="flex items-center gap-1.5">
    <div className="h-3 w-3 rounded bg-amber-500 border-2 border-dashed border-amber-300" />
    <span>⏳ Pending Approval</span>
  </span>
  <span className="flex items-center gap-1.5">
    <div className="h-3 w-3 rounded bg-slate-400" />
    <span>🎉 Holiday</span>
  </span>
  <span className="flex items-center gap-1.5">
    <AlertTriangle className="h-3 w-3 text-amber-500" />
    <span>Team Clash Warning</span>
  </span>
</div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}