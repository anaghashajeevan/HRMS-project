// import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import {
//   Loader2, ChevronLeft, ChevronRight, Calendar, CheckCircle2, Clock,
//   XCircle, Plus,
// } from 'lucide-react';
// import toast from 'react-hot-toast';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { leaveApplicationsApi, holidaysApi } from '../../api/leave';
// import type {
//   LeaveApplicationListItem, Holiday,
// } from '../../types/leave';

// // Format date as YYYY-MM-DD in LOCAL time (fixes timezone bug)
// const formatLocalDate = (d: Date): string => {
//   const year = d.getFullYear();
//   const month = String(d.getMonth() + 1).padStart(2, '0');
//   const day = String(d.getDate()).padStart(2, '0');
//   return `${year}-${month}-${day}`;
// };

// export default function MyLeaveCalendarPage() {
//   const navigate = useNavigate();
//   const [applications, setApplications] = useState<LeaveApplicationListItem[]>([]);
//   const [holidays, setHolidays] = useState<Holiday[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [currentMonth, setCurrentMonth] = useState(new Date());

//   useEffect(() => {
//     loadData();
//   }, [currentMonth]);

//   const loadData = async () => {
//     setLoading(true);
//     try {
//       const year = currentMonth.getFullYear();
//       const [apps, hols] = await Promise.all([
//         leaveApplicationsApi.myApplications(),
//         holidaysApi.byYear(year),
//       ]);
//       setApplications(apps);
//       setHolidays(hols);
//     } catch (error) {
//       toast.error('Failed to load calendar data');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const goToMonth = (direction: 'prev' | 'next') => {
//     const newMonth = new Date(currentMonth);
//     newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
//     setCurrentMonth(newMonth);
//   };

//   // Build calendar
//   const year = currentMonth.getFullYear();
//   const month = currentMonth.getMonth();
//   const firstDay = new Date(year, month, 1);
//   const lastDay = new Date(year, month + 1, 0);
//   const startDayOfWeek = firstDay.getDay();
//   const daysInMonth = lastDay.getDate();

//   const cells: Array<{
//     date: Date | null;
//     leaves: LeaveApplicationListItem[];
//     holiday?: Holiday;
//   }> = [];

//   // Empty cells before month start
//   for (let i = 0; i < startDayOfWeek; i++) {
//     cells.push({ date: null, leaves: [] });
//   }

//   // Days of the month
//   for (let day = 1; day <= daysInMonth; day++) {
//     const date = new Date(year, month, day);
//     const dateStr = formatLocalDate(date);

//     const dayLeaves = applications.filter(
//       (a) =>
//         a.start_date <= dateStr &&
//         a.end_date >= dateStr &&
//         (a.status === 'PENDING' || a.status === 'APPROVED')
//     );

//     const dayHoliday = holidays.find((h) => h.date === dateStr);

//     cells.push({ date, leaves: dayLeaves, holiday: dayHoliday });
//   }

//   const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
//   const monthName = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

//   // Stats for this month
//   const monthApps = applications.filter((a) => {
//     const startMonth = new Date(a.start_date).getMonth();
//     const startYear = new Date(a.start_date).getFullYear();
//     return startMonth === month && startYear === year;
//   });
//   const approvedCount = monthApps.filter((a) => a.status === 'APPROVED').length;
//   const pendingCount = monthApps.filter((a) => a.status === 'PENDING').length;
//   const totalDaysThisMonth = monthApps
//     .filter((a) => a.status === 'APPROVED')
//     .reduce((sum, a) => sum + parseFloat(a.total_days), 0);

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6 flex items-center justify-between">
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900">My Leave Calendar</h1>
//               <p className="mt-1 text-sm text-gray-600">
//                 View all your leaves in a calendar format
//               </p>
//             </div>
//             <div className="flex items-center gap-3">
//               <button
//                 onClick={() => navigate('/leave/apply')}
//                 className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
//               >
//                 <Plus className="h-4 w-4" />
//                 Apply Leave
//               </button>
//               <div className="flex items-center gap-2">
//                 <button
//                   onClick={() => goToMonth('prev')}
//                   className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
//                 >
//                   <ChevronLeft className="h-4 w-4" />
//                 </button>
//                 <div className="min-w-[180px] rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold shadow-sm ring-1 ring-gray-100">
//                   {monthName}
//                 </div>
//                 <button
//                   onClick={() => goToMonth('next')}
//                   className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
//                 >
//                   <ChevronRight className="h-4 w-4" />
//                 </button>
//               </div>
//             </div>
//           </div>

//           {/* Month stats */}
//           <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
//             <StatCard
//               icon={CheckCircle2}
//               label="Approved Leaves"
//               value={`${approvedCount} application${approvedCount !== 1 ? 's' : ''}`}
//               detail={`${totalDaysThisMonth} day${totalDaysThisMonth !== 1 ? 's' : ''} total`}
//               color="green"
//             />
//             <StatCard
//               icon={Clock}
//               label="Pending"
//               value={`${pendingCount} application${pendingCount !== 1 ? 's' : ''}`}
//               detail="Awaiting approval"
//               color="amber"
//             />
//             <StatCard
//               icon={Calendar}
//               label="Holidays This Month"
//               value={`${holidays.filter((h) => new Date(h.date).getMonth() === month).length}`}
//               detail="Company holidays"
//               color="blue"
//             />
//           </div>

//           {loading ? (
//             <div className="flex items-center justify-center py-16">
//               <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//             </div>
//           ) : (
//             <>
//               {/* Calendar Grid */}
//               <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
//                 {/* Day headers */}
//                 <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
//                   {weekDays.map((day) => (
//                     <div
//                       key={day}
//                       className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500"
//                     >
//                       {day}
//                     </div>
//                   ))}
//                 </div>

//                 {/* Cells */}
//                 <div className="grid grid-cols-7">
//                   {cells.map((cell, idx) => (
//                     <div
//                       key={idx}
//                       className={`min-h-[110px] border-b border-r border-gray-100 p-2 ${
//                         cell.date ? 'hover:bg-gray-50' : 'bg-gray-50'
//                       } ${
//                         cell.holiday
//                           ? 'bg-purple-50'
//                           : cell.leaves.some((l) => l.status === 'APPROVED')
//                           ? 'bg-green-50'
//                           : cell.leaves.some((l) => l.status === 'PENDING')
//                           ? 'bg-amber-50'
//                           : ''
//                       }`}
//                     >
//                       {cell.date && (
//                         <>
//                           <div className="flex items-center justify-between mb-1">
//                             <span
//                               className={`text-sm font-semibold ${
//                                 cell.date.getDay() === 0 || cell.date.getDay() === 6
//                                   ? 'text-gray-400'
//                                   : 'text-gray-700'
//                               }`}
//                             >
//                               {cell.date.getDate()}
//                             </span>
//                           </div>

//                           <div className="space-y-1">
//                             {/* Holiday */}
//                             {cell.holiday && (
//                               <div
//                                 className="truncate rounded bg-purple-500 px-1.5 py-0.5 text-xs font-medium text-white"
//                                 title={cell.holiday.name}
//                               >
//                                 🎉 {cell.holiday.name}
//                               </div>
//                             )}

//                             {/* Leaves */}
//                             {cell.leaves.map((leave, i) => (
//                               <div
//                                 key={i}
//                                 onClick={() => navigate('/leave/my-applications')}
//                                 className={`truncate rounded px-1.5 py-0.5 text-xs font-medium text-white cursor-pointer ${
//                                   leave.status === 'APPROVED'
//                                     ? ''
//                                     : 'border-2 border-dashed border-white/50'
//                                 }`}
//                                 style={{
//                                   backgroundColor:
//                                     leave.status === 'APPROVED'
//                                       ? leave.leave_type_color
//                                       : '#F59E0B',
//                                 }}
//                                 title={`${leave.leave_type_name} (${leave.status})`}
//                               >
//                                 {leave.status === 'APPROVED' ? '✅' : '⏳'}{' '}
//                                 {leave.leave_type_code}
//                                 {leave.is_half_day && ' (½)'}
//                               </div>
//                             ))}
//                           </div>
//                         </>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               {/* Legend */}
//               <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
//                 <span className="font-semibold text-gray-600">Legend:</span>
//                 <span className="flex items-center gap-1.5">
//                   <div className="h-3 w-3 rounded bg-green-500" />
//                   <span>✅ Approved Leave</span>
//                 </span>
//                 <span className="flex items-center gap-1.5">
//                   <div className="h-3 w-3 rounded bg-amber-500 border-2 border-dashed border-amber-300" />
//                   <span>⏳ Pending Approval</span>
//                 </span>
//                 <span className="flex items-center gap-1.5">
//                   <div className="h-3 w-3 rounded bg-purple-500" />
//                   <span>🎉 Holiday</span>
//                 </span>
//               </div>
//             </>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

// // Small stat card
// function StatCard({ icon: Icon, label, value, detail, color }: any) {
//   const colorMap: any = {
//     green: 'bg-green-100 text-green-700',
//     amber: 'bg-amber-100 text-amber-700',
//     blue: 'bg-blue-100 text-blue-700',
//   };
//   return (
//     <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
//       <div className="flex items-center justify-between">
//         <div>
//           <p className="text-xs text-gray-500 uppercase">{label}</p>
//           <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
//           <p className="text-xs text-gray-500">{detail}</p>
//         </div>
//         <div className={`rounded-lg p-2.5 ${colorMap[color]}`}>
//           <Icon className="h-5 w-5" />
//         </div>
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, ChevronLeft, ChevronRight, Calendar, CheckCircle2, Clock,
  XCircle, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { leaveApplicationsApi, holidaysApi } from '../../api/leave';
import type {
  LeaveApplicationListItem, Holiday,
} from '../../types/leave';

// Format date as YYYY-MM-DD in LOCAL time (fixes timezone bug)
const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function MyLeaveCalendarPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<LeaveApplicationListItem[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const [apps, hols] = await Promise.all([
        leaveApplicationsApi.myApplications(),
        holidaysApi.byYear(year),
      ]);
      setApplications(apps);
      setHolidays(hols);
    } catch (error) {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const goToMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
  };

  // Build calendar
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const todayStr = formatLocalDate(new Date());

  const cells: Array<{
    date: Date | null;
    leaves: LeaveApplicationListItem[];
    holiday?: Holiday;
  }> = [];

  // Empty cells before month start
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ date: null, leaves: [] });
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = formatLocalDate(date);

    const dayLeaves = applications.filter(
      (a) =>
        a.start_date <= dateStr &&
        a.end_date >= dateStr &&
        (a.status === 'PENDING' || a.status === 'APPROVED')
    );

    const dayHoliday = holidays.find((h) => h.date === dateStr);

    cells.push({ date, leaves: dayLeaves, holiday: dayHoliday });
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Stats for this month
  const monthApps = applications.filter((a) => {
    const startMonth = new Date(a.start_date).getMonth();
    const startYear = new Date(a.start_date).getFullYear();
    return startMonth === month && startYear === year;
  });
  const approvedCount = monthApps.filter((a) => a.status === 'APPROVED').length;
  const pendingCount = monthApps.filter((a) => a.status === 'PENDING').length;
  const totalDaysThisMonth = monthApps
    .filter((a) => a.status === 'APPROVED')
    .reduce((sum, a) => sum + parseFloat(a.total_days), 0);

  return (
    <div className="flex h-screen bg-slate-50">
      <style>{`
        @keyframes riseIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rise-in { animation: riseIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .rise-1 { animation-delay: 0.02s; }
        .rise-2 { animation-delay: 0.06s; }
        .rise-3 { animation-delay: 0.10s; }
        .rise-4 { animation-delay: 0.14s; }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        .pop-in { animation: popIn 0.25s ease-out both; }
        @keyframes todayPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(var(--primary-glow, 37 99 235) / 0.35); }
          50% { box-shadow: 0 0 0 4px rgba(var(--primary-glow, 37 99 235) / 0.15); }
        }
        .today-pulse { animation: todayPulse 2.4s ease-in-out infinite; }
      `}</style>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-4 lg:p-5">
          {/* Gradient header banner */}
          <div className="rise-in relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 px-4 py-4 shadow-lg sm:px-6 sm:py-5">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-12 right-20 h-24 w-24 rounded-full bg-white/5" />
            <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-lg font-bold text-white sm:text-2xl">My Leave Calendar</h1>
                <p className="text-xs text-primary-100 sm:text-sm">
                  View all your leaves in a calendar format
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  onClick={() => navigate('/leave/apply')}
                  className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm transition-all duration-200 hover:bg-primary-50 hover:shadow-md active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  Apply Leave
                </button>
                <div className="flex items-center gap-1.5 rounded-lg bg-white/15 p-1 backdrop-blur-sm">
                  <button
                    onClick={() => goToMonth('prev')}
                    className="rounded-md p-1.5 text-white transition-all duration-150 hover:bg-white/20 active:scale-90"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-[130px] px-2 text-center text-sm font-semibold text-white sm:min-w-[160px]">
                    {monthName}
                  </div>
                  <button
                    onClick={() => goToMonth('next')}
                    className="rounded-md p-1.5 text-white transition-all duration-150 hover:bg-white/20 active:scale-90"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Month stats */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icon={CheckCircle2}
              label="Approved Leaves"
              value={`${approvedCount} application${approvedCount !== 1 ? 's' : ''}`}
              detail={`${totalDaysThisMonth} day${totalDaysThisMonth !== 1 ? 's' : ''} total`}
              color="green"
              delay="rise-1"
            />
            <StatCard
              icon={Clock}
              label="Pending"
              value={`${pendingCount} application${pendingCount !== 1 ? 's' : ''}`}
              detail="Awaiting approval"
              color="amber"
              delay="rise-2"
            />
            <StatCard
              icon={Calendar}
              label="Holidays This Month"
              value={`${holidays.filter((h) => new Date(h.date).getMonth() === month).length}`}
              detail="Company holidays"
              color="primary"
              delay="rise-3"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="relative h-9 w-9">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary-400 opacity-30" />
                <Loader2 className="relative h-9 w-9 animate-spin text-primary-600" />
              </div>
            </div>
          ) : (
            <>
              {/* Calendar Grid */}
              <div className="rise-in rise-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100/60">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className={`px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide sm:text-xs ${
                        day === 'Sun' || day === 'Sat' ? 'text-primary-400' : 'text-primary-700'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Cells */}
                <div className="grid grid-cols-7">
                  {cells.map((cell, idx) => {
                    const dateStr = cell.date ? formatLocalDate(cell.date) : null;
                    const isToday = dateStr === todayStr;
                    const isWeekend = cell.date && (cell.date.getDay() === 0 || cell.date.getDay() === 6);

                    return (
                      <div
                        key={idx}
                        className={`min-h-[68px] border-b border-r border-gray-100 p-1 transition-colors duration-150 sm:min-h-[110px] sm:p-2 ${
                          cell.date ? 'hover:bg-primary-50/40' : 'bg-gray-50/60'
                        } ${
                          cell.holiday
                            ? 'bg-purple-50'
                            : cell.leaves.some((l) => l.status === 'APPROVED')
                            ? 'bg-green-50'
                            : cell.leaves.some((l) => l.status === 'PENDING')
                            ? 'bg-amber-50'
                            : ''
                        }`}
                      >
                        {cell.date && (
                          <>
                            <div className="mb-1 flex items-center justify-between">
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold sm:h-6 sm:w-6 sm:text-sm ${
                                  isToday
                                    ? 'today-pulse bg-primary-600 text-white'
                                    : isWeekend
                                    ? 'text-gray-400'
                                    : 'text-gray-700'
                                }`}
                              >
                                {cell.date.getDate()}
                              </span>
                            </div>

                            <div className="space-y-1">
                              {/* Holiday */}
                              {cell.holiday && (
                                <div
                                  className="pop-in truncate rounded-md bg-gradient-to-r from-purple-500 to-purple-600 px-1 py-0.5 text-[10px] font-medium text-white shadow-sm sm:px-1.5 sm:text-xs"
                                  title={cell.holiday.name}
                                >
                                  🎉 <span className="hidden sm:inline">{cell.holiday.name}</span>
                                </div>
                              )}

                              {/* Leaves */}
                              {cell.leaves.map((leave, i) => (
                                <div
                                  key={i}
                                  onClick={() => navigate('/leave/my-applications')}
                                  className={`pop-in cursor-pointer truncate rounded-md px-1 py-0.5 text-[10px] font-medium text-white shadow-sm transition-transform duration-150 hover:scale-[1.03] sm:px-1.5 sm:text-xs ${
                                    leave.status === 'APPROVED'
                                      ? ''
                                      : 'border-2 border-dashed border-white/50'
                                  }`}
                                  style={{
                                    backgroundColor:
                                      leave.status === 'APPROVED'
                                        ? leave.leave_type_color
                                        : '#F59E0B',
                                  }}
                                  title={`${leave.leave_type_name} (${leave.status})`}
                                >
                                  {leave.status === 'APPROVED' ? '✅' : '⏳'}{' '}
                                  {leave.leave_type_code}
                                  {leave.is_half_day && ' (½)'}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="rise-in mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100 sm:gap-4">
                <span className="text-xs font-semibold text-gray-600">Legend:</span>
                <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs text-green-800">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  ✅ Approved Leave
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
                  <div className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-amber-400 bg-amber-500" />
                  ⏳ Pending Approval
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs text-purple-800">
                  <div className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                  🎉 Holiday
                </span>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// Small stat card
function StatCard({ icon: Icon, label, value, detail, color, delay }: any) {
  const colorMap: any = {
    green: {
      icon: 'bg-gradient-to-br from-green-400 to-green-600 text-white',
      border: 'border-green-500',
    },
    amber: {
      icon: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
      border: 'border-amber-500',
    },
    primary: {
      icon: 'bg-gradient-to-br from-primary-400 to-primary-600 text-white',
      border: 'border-primary-500',
    },
  };
  const c = colorMap[color] ?? colorMap.primary;
  return (
    <div
      className={`rise-in ${delay ?? ''} group rounded-xl border-l-4 ${c.border} bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{detail}</p>
        </div>
        <div className={`rounded-xl p-2.5 shadow-sm transition-transform duration-300 group-hover:scale-110 ${c.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}