// import { useEffect, useState } from 'react';
// import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
// import {
//   ChevronLeft, ChevronRight, Loader2, ArrowLeft, Clock,
//   TrendingDown, TrendingUp, Calendar as CalIcon, CheckCircle2,
//   User, Briefcase, Building2,
// } from 'lucide-react';
// import toast from 'react-hot-toast';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { personalAttendanceApi } from '../../api/attendance';
// import type { MonthlyAttendanceData, DayEntry, DayStatus } from '../../types/attendance';

// const STATUS_STYLES: Record<DayStatus, { bg: string; text: string; label: string; dot: string }> = {
//   present: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: 'Present', dot: 'bg-green-500' },
//   absent: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Absent', dot: 'bg-red-500' },
//   missing_punch: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Missing Punch', dot: 'bg-amber-500' },
//   weekend: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', label: 'Weekend', dot: 'bg-gray-400' },
//   weekend_present: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', label: 'Weekend Work', dot: 'bg-purple-500' },
//   holiday: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Holiday', dot: 'bg-blue-500' },
//   future: { bg: 'bg-white border-gray-100', text: 'text-gray-300', label: '-', dot: 'bg-gray-200' },
// };

// export default function EmployeeAttendanceDetailPage() {
//   const { employeeId } = useParams<{ employeeId: string }>();
//   const [searchParams, setSearchParams] = useSearchParams();
//   const navigate = useNavigate();
//   const today = new Date();

//   const [year, setYear] = useState(
//     parseInt(searchParams.get('year') || String(today.getFullYear()))
//   );
//   const [month, setMonth] = useState(
//     parseInt(searchParams.get('month') || String(today.getMonth() + 1))
//   );
//   const [data, setData] = useState<MonthlyAttendanceData | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     if (employeeId) loadData();
//   }, [employeeId, year, month]);

//   const loadData = async () => {
//     setLoading(true);
//     try {
//       const res = await personalAttendanceApi.getEmployeeMonth(
//         employeeId!,
//         year,
//         month
//       );
//       setData(res);
//     } catch (error: any) {
//       const msg =
//         error?.response?.status === 403
//           ? "You don't have permission to view this employee's attendance"
//           : error?.response?.data?.detail || 'Failed to load attendance';
//       toast.error(msg);
//       if (error?.response?.status === 403) {
//         navigate('/team-attendance');
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const navigateMonth = (direction: number) => {
//     let newMonth = month + direction;
//     let newYear = year;
//     if (newMonth === 0) { newMonth = 12; newYear -= 1; }
//     else if (newMonth === 13) { newMonth = 1; newYear += 1; }
//     setMonth(newMonth);
//     setYear(newYear);
//     setSearchParams({ year: String(newYear), month: String(newMonth) });
//   };

//   const firstDay = data ? new Date(year, month - 1, 1).getDay() : 0;
//   const location = useLocation();  // add to imports: import { useLocation } from 'react-router-dom';

// const isFromAllView = location.pathname.startsWith('/all-attendance');
// const backUrl = isFromAllView ? '/all-attendance' : '/team-attendance';
// const backLabel = isFromAllView ? 'Back to All Employees' : 'Back to Team Attendance';
//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">

//           {/* Back button */}
//           <button
//   onClick={() => navigate(`${backUrl}?year=${year}&month=${month}`)}
//   className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
// >
//   <ArrowLeft className="h-4 w-4" />
//   {backLabel}
// </button>

//           {loading || !data ? (
//             <div className="flex items-center justify-center py-16">
//               <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
//             </div>
//           ) : (
//             <>
//               {/* Employee Header */}
//               <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <div className="flex items-start gap-4">
//                   <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-bold text-white">
//                     {data.employee.full_name
//                       .split(' ')
//                       .map((n) => n[0])
//                       .slice(0, 2)
//                       .join('')
//                       .toUpperCase()}
//                   </div>
//                   <div className="flex-1">
//                     <h1 className="text-xl font-bold text-gray-900">
//                       {data.employee.full_name}
//                     </h1>
//                     <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
//                       <span className="flex items-center gap-1">
//                         <User className="h-3.5 w-3.5" />
//                         {data.employee.employee_id}
//                       </span>
//                       {data.employee.position && (
//                         <span className="flex items-center gap-1">
//                           <Briefcase className="h-3.5 w-3.5" />
//                           {data.employee.position}
//                         </span>
//                       )}
//                       {data.employee.department && (
//                         <span className="flex items-center gap-1">
//                           <Building2 className="h-3.5 w-3.5" />
//                           {data.employee.department}
//                         </span>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* Month Navigation */}
//               <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
//                 <button
//                   onClick={() => navigateMonth(-1)}
//                   className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
//                 >
//                   <ChevronLeft className="h-5 w-5" />
//                 </button>
//                 <h2 className="text-lg font-bold text-gray-900">
//                   {data.month_label}
//                 </h2>
//                 <button
//                   onClick={() => navigateMonth(1)}
//                   className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
//                 >
//                   <ChevronRight className="h-5 w-5" />
//                 </button>
//               </div>

//               {/* Stats Cards */}
//               <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
//                 <StatCard
//                   label="Total Worked"
//                   value={data.stats.total_worked_hours}
//                   helper={`${data.stats.total_worked_hours_decimal}h total`}
//                   icon={Clock}
//                   color="blue"
//                 />
//                 <StatCard
//                   label="Expected"
//                   value={`${data.stats.expected_hours}h`}
//                   helper={`${data.stats.working_days_elapsed} days × ${data.stats.full_day_hours}h`}
//                   icon={TrendingUp}
//                   color="green"
//                 />
//                 <StatCard
//                   label="Shortage"
//                   value={
//                     data.stats.shortage_hours > 0
//                       ? `${data.stats.shortage_hours}h`
//                       : '✅ None'
//                   }
//                   helper={
//                     data.stats.shortage_hours > 0
//                       ? 'Hours below expected'
//                       : 'On track!'
//                   }
//                   icon={TrendingDown}
//                   color={data.stats.shortage_hours > 0 ? 'red' : 'green'}
//                 />
//                 <StatCard
//                   label="Attendance %"
//                   value={`${data.stats.attendance_percent}%`}
//                   helper={`${data.stats.present_days} of ${data.stats.working_days_elapsed} days`}
//                   icon={CheckCircle2}
//                   color={data.stats.attendance_percent >= 90 ? 'green' : 'amber'}
//                 />
//               </div>

//               {/* Detailed breakdown */}
//               <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
//                 <MiniStat label="Present" value={data.stats.present_days} color="green" />
//                 <MiniStat label="Absent" value={data.stats.absent_days} color="red" />
//                 <MiniStat label="Missing Punch" value={data.stats.missing_punch_days} color="amber" />
//                 <MiniStat label="Weekend Work" value={data.stats.weekend_worked_days} color="purple" />
//               </div>

//               {/* Progress Bar */}
//               {data.stats.expected_hours > 0 && (
//                 <div className="mb-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                   <div className="mb-2 flex items-center justify-between">
//                     <p className="text-sm font-semibold text-gray-900">
//                       Monthly Progress
//                     </p>
//                     <p className="text-xs text-gray-500">
//                       {data.stats.total_worked_hours_decimal}h / {data.stats.expected_hours}h
//                     </p>
//                   </div>
//                   <div className="h-3 overflow-hidden rounded-full bg-gray-100">
//                     <div
//                       className={`h-full transition-all ${
//                         data.stats.total_worked_hours_decimal >= data.stats.expected_hours
//                           ? 'bg-green-500'
//                           : data.stats.total_worked_hours_decimal / data.stats.expected_hours >= 0.9
//                           ? 'bg-blue-500'
//                           : data.stats.total_worked_hours_decimal / data.stats.expected_hours >= 0.7
//                           ? 'bg-amber-500'
//                           : 'bg-red-500'
//                       }`}
//                       style={{
//                         width: `${Math.min(
//                           100,
//                           (data.stats.total_worked_hours_decimal / data.stats.expected_hours) * 100
//                         )}%`,
//                       }}
//                     />
//                   </div>
//                 </div>
//               )}

//               {/* Calendar */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-gray-500">
//                   {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
//                     <div key={d} className="py-2">{d}</div>
//                   ))}
//                 </div>

//                 <div className="grid grid-cols-7 gap-2">
//                   {Array.from({ length: firstDay }).map((_, i) => (
//                     <div key={`empty-${i}`} className="aspect-square" />
//                   ))}
//                   {data.days.map((day) => (
//                     <DayCard key={day.date} day={day} />
//                   ))}
//                 </div>

//                 {/* Legend */}
//                 <div className="mt-6 border-t border-gray-100 pt-4">
//                   <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Legend</p>
//                   <div className="flex flex-wrap gap-3">
//                     {Object.entries(STATUS_STYLES).slice(0, 6).map(([key, style]) => (
//                       <div key={key} className="flex items-center gap-2">
//                         <span className={`h-3 w-3 rounded-full ${style.dot}`} />
//                         <span className="text-xs text-gray-600">{style.label}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

// function StatCard({ label, value, helper, icon: Icon, color }: any) {
//   const colorMap: any = {
//     blue: 'bg-blue-100 text-blue-700',
//     green: 'bg-green-100 text-green-700',
//     red: 'bg-red-100 text-red-700',
//     amber: 'bg-amber-100 text-amber-700',
//   };
//   return (
//     <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
//       <div className="flex items-start justify-between">
//         <div>
//           <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
//           <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
//           <p className="mt-1 text-xs text-gray-400">{helper}</p>
//         </div>
//         <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorMap[color]}`}>
//           <Icon className="h-4 w-4" />
//         </div>
//       </div>
//     </div>
//   );
// }

// function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
//   const colorMap: any = {
//     green: 'bg-green-50 text-green-700 border-green-200',
//     red: 'bg-red-50 text-red-700 border-red-200',
//     amber: 'bg-amber-50 text-amber-700 border-amber-200',
//     purple: 'bg-purple-50 text-purple-700 border-purple-200',
//   };
//   return (
//     <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
//       <p className="text-xs font-semibold uppercase opacity-80">{label}</p>
//       <p className="mt-1 text-lg font-bold">{value}</p>
//     </div>
//   );
// }

// function DayCard({ day }: { day: DayEntry }) {
//   const style = STATUS_STYLES[day.status];

//   return (
//     <div
//       className={`
//         relative aspect-square rounded-lg border p-2
//         ${style.bg}
//         ${day.is_today ? 'ring-2 ring-blue-500' : ''}
//       `}
//     >
//       <div className="flex items-start justify-between">
//         <span className={`text-sm font-bold ${style.text}`}>
//           {day.day_number}
//         </span>
//         {day.status !== 'future' && day.status !== 'weekend' && day.status !== 'holiday' && (
//           <span className={`h-2 w-2 rounded-full ${style.dot}`} />
//         )}
//       </div>

//       {day.worked_hours !== '00:00' && !day.is_future && (
//         <div className="mt-1 flex flex-col">
//           <span className="text-[10px] font-bold text-gray-900">
//             {day.worked_hours}
//           </span>
//           {day.punch_in && day.punch_out && (
//             <span className="text-[9px] text-gray-500">
//               {day.punch_in}-{day.punch_out}
//             </span>
//           )}
//         </div>
//       )}

//       {day.is_late && (
//         <span className="absolute bottom-1 right-1 text-[8px] font-bold text-red-600">L</span>
//       )}
//     </div>
//   );
// }

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Loader2, ArrowLeft, Clock,
  TrendingDown, TrendingUp, Calendar as CalIcon, CheckCircle2,
  User, Briefcase, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { personalAttendanceApi } from '../../api/attendance';
import type { MonthlyAttendanceData, DayEntry, DayStatus } from '../../types/attendance';

const STATUS_STYLES: Record<DayStatus, { bg: string; text: string; label: string; dot: string }> = {
  present: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: 'Present', dot: 'bg-green-500' },
  absent: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Absent', dot: 'bg-red-500' },
  missing_punch: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Missing Punch', dot: 'bg-amber-500' },
  weekend: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', label: 'Weekend', dot: 'bg-gray-400' },
  weekend_present: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', label: 'Weekend Work', dot: 'bg-purple-500' },
  holiday: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Holiday', dot: 'bg-blue-500' },
  future: { bg: 'bg-white border-gray-100', text: 'text-gray-300', label: '-', dot: 'bg-gray-200' },
  on_leave: { bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700', label: 'On Leave', dot: 'bg-cyan-500' },
  on_half_leave: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', label: 'Half Leave', dot: 'bg-teal-500' },
};

export default function EmployeeAttendanceDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const today = new Date();

  // Smart back button — detect where user came from
  const isFromAllView = location.pathname.startsWith('/all-attendance');
  const backUrl = isFromAllView ? '/all-attendance' : '/team-attendance';
  const backLabel = isFromAllView ? 'Back to All Employees' : 'Back to Team Attendance';

  const [year, setYear] = useState(
    parseInt(searchParams.get('year') || String(today.getFullYear()))
  );
  const [month, setMonth] = useState(
    parseInt(searchParams.get('month') || String(today.getMonth() + 1))
  );
  const [data, setData] = useState<MonthlyAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (employeeId) loadData();
  }, [employeeId, year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await personalAttendanceApi.getEmployeeMonth(
        employeeId!,
        year,
        month
      );
      setData(res);
    } catch (error: any) {
      const msg =
        error?.response?.status === 403
          ? "You don't have permission to view this employee's attendance"
          : error?.response?.data?.detail || 'Failed to load attendance';
      toast.error(msg);
      if (error?.response?.status === 403) {
        navigate(backUrl);
      }
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
    setSearchParams({ year: String(newYear), month: String(newMonth) });
  };

  const firstDay = data ? new Date(year, month - 1, 1).getDay() : 0;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">

          {/* Back button */}
          <button
            onClick={() => navigate(`${backUrl}?year=${year}&month=${month}`)}
            className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>

          {loading || !data ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Employee Header */}
              <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-bold text-white">
                    {data.employee.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900">
                      {data.employee.full_name}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {data.employee.employee_id}
                      </span>
                      {data.employee.position && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5" />
                          {data.employee.position}
                        </span>
                      )}
                      {data.employee.department && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {data.employee.department}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Month Navigation */}
              <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">
                  {data.month_label}
                </h2>
                <button
                  onClick={() => navigateMonth(1)}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Main Stats Cards */}
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
                  helper={`${data.stats.present_days} of ${data.stats.effective_working_days} days`}
                  icon={CheckCircle2}
                  color={data.stats.attendance_percent >= 90 ? 'green' : 'amber'}
                />
              </div>

              {/* Detailed Breakdown */}
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <MiniStat label="Present" value={data.stats.present_days} color="green" />
                <MiniStat label="Absent" value={data.stats.absent_days} color="red" />
                <MiniStat label="Missing" value={data.stats.missing_punch_days} color="amber" />
                <MiniStat label="On Leave" value={data.stats.on_leave_days} color="cyan" />
                <MiniStat label="Half Leave" value={data.stats.on_half_leave_days} color="teal" />
              </div>

              {/* Progress Bar */}
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
                      ⚠️ Needs <strong>{data.stats.shortage_hours}h</strong> more to meet expected hours
                    </p>
                  )}
                </div>
              )}

              {/* Leave Summary Card — shows if employee took any leaves */}
              {(data.stats.on_leave_days > 0 || data.stats.on_half_leave_days > 0) && (
                <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                      <CalIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-cyan-900">
                        Leave Summary
                      </h3>
                      <p className="mt-1 text-xs text-cyan-800">
                        {data.stats.on_leave_days > 0 && (
                          <>Took <strong>{data.stats.on_leave_days}</strong> full-day leave{data.stats.on_leave_days > 1 ? 's' : ''}</>
                        )}
                        {data.stats.on_leave_days > 0 && data.stats.on_half_leave_days > 0 && ' and '}
                        {data.stats.on_half_leave_days > 0 && (
                          <>{data.stats.on_half_leave_days} half-day leave{data.stats.on_half_leave_days > 1 ? 's' : ''}</>
                        )}
                        {data.stats.lop_days > 0 && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                            {data.stats.lop_days} LOP day{data.stats.lop_days > 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
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
                    <DayCard key={day.date} day={day} />
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-6 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Legend</p>
                  <div className="flex flex-wrap gap-3">
                    {(['present', 'absent', 'missing_punch', 'on_leave', 'on_half_leave', 'weekend', 'holiday'] as DayStatus[]).map((key) => {
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  color,
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
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-400 line-clamp-2">{helper}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: any = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
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

function DayCard({ day }: { day: DayEntry }) {
  const style = STATUS_STYLES[day.status];

  return (
    <div
      className={`
        relative aspect-square rounded-lg border p-2
        ${style.bg}
        ${day.is_today ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      <div className="flex items-start justify-between">
        <span className={`text-sm font-bold ${style.text}`}>
          {day.day_number}
        </span>
        {day.status !== 'future' && day.status !== 'weekend' && day.status !== 'holiday' && (
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        )}
      </div>

      {/* Leave badge */}
      {day.leave_info && (day.status === 'on_leave' || day.status === 'on_half_leave') && (
        <div className="mt-1">
          <span
            className="inline-block rounded px-1 py-0.5 text-[9px] font-bold text-white"
            style={{ backgroundColor: day.leave_info.leave_type_color }}
          >
            {day.leave_info.leave_type_code}
            {day.leave_info.is_half_day && ` (${day.leave_info.half_day_period})`}
          </span>
        </div>
      )}

      {/* Show worked hours only if actually worked (not for full-day leave) */}
      {day.worked_hours !== '00:00' && !day.is_future && day.status !== 'on_leave' && (
        <div className="mt-1 flex flex-col">
          <span className="text-[10px] font-bold text-gray-900">
            {day.worked_hours}
          </span>
          {day.punch_in && day.punch_out && (
            <span className="text-[9px] text-gray-500">
              {day.punch_in}-{day.punch_out}
            </span>
          )}
        </div>
      )}

      {day.is_late && (
        <span className="absolute bottom-1 right-1 text-[8px] font-bold text-red-600">L</span>
      )}
    </div>
  );
}