import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Loader2, Clock, TrendingDown,
  TrendingUp, Calendar as CalIcon, AlertCircle, CheckCircle2,
  Coffee, MinusCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { personalAttendanceApi } from '../../api/attendance';
import type { MonthlyAttendanceData, DayEntry, DayStatus } from '../../types/attendance';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_STYLES: Record<DayStatus, { bg: string; text: string; label: string; dot: string }> = {
  present: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: 'Present', dot: 'bg-green-500' },
  absent: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Absent', dot: 'bg-red-500' },
  missing_punch: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Missing Punch', dot: 'bg-amber-500' },
  weekend: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', label: 'Weekend', dot: 'bg-gray-400' },
  weekend_present: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', label: 'Weekend Work', dot: 'bg-purple-500' },
  holiday: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Holiday', dot: 'bg-blue-500' },
  future: { bg: 'bg-white border-gray-100', text: 'text-gray-300', label: '-', dot: 'bg-gray-200' },
  on_leave: { bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700', label: 'On Leave', dot: 'bg-cyan-500' },
  on_half_leave: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', label: 'Half Leave', dot: 'bg-teal-500'},
  will_be_on_leave: { bg: 'bg-cyan-50/50 border-cyan-200 border-dashed', text: 'text-cyan-600', label: 'Will Be on Leave', dot: 'bg-cyan-300' },
  will_be_on_half_leave: { bg: 'bg-teal-50/50 border-teal-200 border-dashed', text: 'text-teal-600', label: 'Will Be on Half Leave', dot: 'bg-teal-300' },
  leave_but_present: { bg: 'bg-lime-50 border-lime-300', text: 'text-lime-800', label: 'Leave but Present', dot: 'bg-lime-500' },
  leave_but_partial: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', label: 'Leave (Partial)', dot: 'bg-orange-500' },
  half_leave_present: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Half Leave + Present', dot: 'bg-emerald-500' },
  wfh: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', label: 'WFH', dot: 'bg-indigo-500' },
  site_visit: { bg: 'bg-fuchsia-50 border-fuchsia-200', text: 'text-fuchsia-700', label: 'Site Visit', dot: 'bg-fuchsia-500' },
  manual_present: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Manual Present', dot: 'bg-emerald-500' },
   before_joining: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-400', label: 'Not joined', dot: 'bg-slate-300' },
  before_system_start: { bg: 'bg-slate-50 border-slate-100', text: 'text-slate-300', label: 'No data', dot: 'bg-slate-200' },
};

export default function MyAttendancePage() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<MonthlyAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await personalAttendanceApi.getMyMonth(year, month);
      setData(res);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: number) => {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth === 0) { newMonth = 12; newYear -= 1; }
    else if (newMonth === 13) { newMonth = 1; newYear += 1; }
    setMonth(newMonth);
    setYear(newYear);
  };
  function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: any = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <p className="text-xs font-semibold uppercase opacity-80">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
  const firstDay = data ? new Date(year, month - 1, 1).getDay() : 0;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                <CalIcon className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  Track your work hours, attendance, and shortage
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
  <button
    onClick={() => navigateMonth(-1)}
    className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
  >
    <ChevronLeft className="h-5 w-5" />
  </button>
  <h2 className="text-lg font-bold text-gray-900">
    {data?.month_label || 'Loading...'}
  </h2>
  <button
    onClick={() => navigateMonth(1)}
    className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
  >
    <ChevronRight className="h-5 w-5" />
  </button>
</div>

{loading || !data ? (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
) : data.no_attendance_data ? (
  /* Month before system start — NOT full of Absents */
  <div className="rounded-xl bg-white p-16 text-center shadow-sm ring-1 ring-gray-100">
    <CalIcon className="mx-auto h-12 w-12 text-gray-300" />
    <h2 className="mt-4 text-lg font-bold text-gray-900">No Attendance Data</h2>
    <p className="mt-2 text-sm text-gray-500">
      {data.message || `No attendance records for ${data.month_label}.`}
    </p>
  </div>
) : (
  <>

              {/* Stats Cards */}
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  label="Total Worked"
                  value={data.stats.total_worked_hours}
                  helper={`${data.stats.total_worked_hours_decimal}h total`}
                  icon={Clock}
                  color="blue"
                />
                <StatCard
  label="Expected"
  value={`${data.stats.expected_hours}h`}
  helper={
    data.stats.on_leave_days > 0
      ? `${data.stats.effective_working_days} days × ${data.stats.full_day_hours}h (excl. ${data.stats.on_leave_days} leave)`
      : `${data.stats.working_days_elapsed} days × ${data.stats.full_day_hours}h`
  }
  icon={TrendingUp}
  color="green"
/>
                <StatCard
                  label="Shortage"
                  value={
                    data.stats.shortage_hours > 0
                      ? `${data.stats.shortage_hours}h`
                      : '✅ None'
                  }
                  helper={
                    data.stats.shortage_hours > 0
                      ? 'Hours below expected'
                      : 'On track!'
                  }
                  icon={TrendingDown}
                  color={data.stats.shortage_hours > 0 ? 'red' : 'green'}
                />
                <StatCard
                  label="Attendance %"
                  value={`${data.stats.attendance_percent}%`}
                  helper={`${data.stats.present_days} of ${data.stats.working_days_elapsed} days`}
                  icon={CheckCircle2}
                  color={data.stats.attendance_percent >= 90 ? 'green' : 'amber'}
                />
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
  <MiniStat label="Present" value={data.stats.present_days} color="green" />
  <MiniStat label="Absent" value={data.stats.absent_days} color="red" />
  <MiniStat label="Missing Punch" value={data.stats.missing_punch_days} color="amber" />
  <MiniStat label="On Leave" value={data.stats.on_leave_days} color="cyan" />
  <MiniStat label="Half Leave" value={data.stats.on_half_leave_days} color="teal" />
</div>
              {/* Shortage Progress Bar */}
              {data.stats.expected_hours > 0 && (
                <div className="mb-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">
                      Monthly Progress
                    </p>
                    <p className="text-xs text-gray-500">
                      {data.stats.total_worked_hours_decimal}h / {data.stats.expected_hours}h
                    </p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full transition-all ${
                        data.stats.total_worked_hours_decimal >= data.stats.expected_hours
                          ? 'bg-green-500'
                          : data.stats.total_worked_hours_decimal / data.stats.expected_hours >= 0.9
                          ? 'bg-blue-500'
                          : data.stats.total_worked_hours_decimal / data.stats.expected_hours >= 0.7
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (data.stats.total_worked_hours_decimal / data.stats.expected_hours) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  {data.stats.shortage_hours > 0 && (
                    <p className="mt-2 text-xs text-red-600">
                      ⚠️ You need <strong>{data.stats.shortage_hours}h</strong> more to meet expected hours
                    </p>
                  )}
                </div>
              )}

              {/* Calendar */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                {/* Day Headers */}
                <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-gray-500">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-2">{d}</div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {data.days.map((day) => (
                    <DayCard
                      key={day.date}
                      day={day}
                      onClick={() => {
                        if (!day.is_future && day.status !== 'weekend' && day.status !== 'holiday') {
                          navigate(`/my-attendance/day/${day.date}`);
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Legend */}
                {/* Legend */}
{/* Legend */}
<div className="mt-6 border-t border-gray-100 pt-4">
  <p className="mb-3 text-xs font-semibold uppercase text-gray-500">Legend</p>
  
  {/* Actual Attendance */}
  <div className="mb-2">
    <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Actual Attendance</p>
    <div className="flex flex-wrap gap-3">
      {(['present', 'absent', 'missing_punch', 'weekend', 'holiday'] as DayStatus[]).map((key) => {
        const style = STATUS_STYLES[key];
        return (
          <div key={key} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${style.dot}`} />
            <span className="text-xs text-gray-600">{style.label}</span>
          </div>
        );
      })}
    </div>
  </div>

  {/* Leave-related */}
  <div className="mt-3">
    <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Leave Status</p>
    <div className="flex flex-wrap gap-3">
      {(['on_leave', 'on_half_leave', 'will_be_on_leave', 'leave_but_present', 'half_leave_present'] as DayStatus[]).map((key) => {
        const style = STATUS_STYLES[key];
        return (
          <div key={key} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${style.dot}`} />
            <span className="text-xs text-gray-600">{style.label}</span>
          </div>
        );
      })}
    </div>
  </div>
</div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({
  label, value, helper, icon: Icon, color,
}: {
  label: string;
  value: string;
  helper: string;
  icon: any;
  color: 'blue' | 'green' | 'red' | 'amber';
}) {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-400">{helper}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
function DayCard({ day, onClick }: { day: DayEntry; onClick?: () => void }) {
  const style = STATUS_STYLES[day.status] || STATUS_STYLES.future;
  const isBlocked = day.status === 'before_joining' || day.status === 'before_system_start' || day.status === 'future' || day.status === 'weekend' || day.status === 'holiday';
  const clickable = !isBlocked && Boolean(onClick);

  return (
    <div 
      onClick={clickable ? onClick : undefined} 
      // 👇 ADDED 'group' class here for the hover effect
      className={`group relative aspect-square rounded-lg border p-2 ${style.bg} ${clickable ? 'cursor-pointer hover:shadow-md transition' : ''} ${day.is_today ? 'ring-2 ring-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between">
        <span className={`text-sm font-bold ${style.text}`}>{day.day_number}</span>
        {!isBlocked && <span className={`h-2 w-2 rounded-full ${style.dot}`} />}
      </div>
      
      {day.worked_hours !== '00:00' && !isBlocked && day.status !== 'on_leave' && day.status !== 'will_be_on_leave' && (
        <div className="mt-1 flex flex-col">
          <span className="text-[10px] font-bold">{day.worked_hours}</span>
        </div>
      )}
      
      {(day.status === 'before_joining' || day.status === 'before_system_start') && (
        <div className="mt-1 text-[8px] text-slate-400">{day.status === 'before_joining' ? 'Not joined' : 'No data'}</div>
      )}

      {/* ================= NEW: HOVER TOOLTIP ================= */}
      {!isBlocked && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-44 -translate-x-1/2 flex-col rounded-lg bg-gray-900 p-3 text-xs text-white shadow-xl opacity-0 transition-opacity group-hover:flex group-hover:opacity-100">
          <div className="mb-2 border-b border-gray-700 pb-1 text-center font-bold text-gray-100">
            {day.date}
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-400">Status:</span>
            <span className={`font-semibold ${style.text.replace('text-', 'text-').replace('-700', '-400')}`}>{style.label}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-400">Punch In:</span>
            <span className="font-medium">{day.punch_in || '--:--'}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-400">Punch Out:</span>
            <span className="font-medium">{day.punch_out || '--:--'}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-400">Break:</span>
            <span className="font-medium">{day.break_time || '00:00'}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-gray-700 pt-1">
            <span className="font-bold text-gray-300">Net Hrs:</span>
            <span className="font-bold text-blue-400">{day.worked_hours || '00:00'}</span>
          </div>
          {/* Tooltip bottom arrow triangle */}
          <div className="absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-gray-900"></div>
        </div>
      )}
      {/* ======================================================== */}
    </div>
  );
}