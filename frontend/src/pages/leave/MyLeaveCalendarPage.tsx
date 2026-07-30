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
//   const todayStr = formatLocalDate(new Date());

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
//     <div className="flex h-screen bg-slate-50">
//       <style>{`
//         @keyframes riseIn {
//           from { opacity: 0; transform: translateY(10px); }
//           to { opacity: 1; transform: translateY(0); }
//         }
//         .rise-in { animation: riseIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
//         .rise-1 { animation-delay: 0.02s; }
//         .rise-2 { animation-delay: 0.06s; }
//         .rise-3 { animation-delay: 0.10s; }
//         .rise-4 { animation-delay: 0.14s; }
//         @keyframes popIn {
//           from { opacity: 0; transform: scale(0.85); }
//           to { opacity: 1; transform: scale(1); }
//         }
//         .pop-in { animation: popIn 0.25s ease-out both; }
//         @keyframes todayPulse {
//           0%, 100% { box-shadow: 0 0 0 0 rgba(var(--primary-glow, 37 99 235) / 0.35); }
//           50% { box-shadow: 0 0 0 4px rgba(var(--primary-glow, 37 99 235) / 0.15); }
//         }
//         .today-pulse { animation: todayPulse 2.4s ease-in-out infinite; }
//       `}</style>
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-4 lg:p-5">
//           {/* Gradient header banner */}
//           <div className="rise-in relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 px-4 py-4 shadow-lg sm:px-6 sm:py-5">
//             <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
//             <div className="pointer-events-none absolute -bottom-12 right-20 h-24 w-24 rounded-full bg-white/5" />
//             <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//               <div>
//                 <h1 className="text-lg font-bold text-white sm:text-2xl">My Leave Calendar</h1>
//                 <p className="text-xs text-primary-100 sm:text-sm">
//                   View all your leaves in a calendar format
//                 </p>
//               </div>
//               <div className="flex flex-wrap items-center gap-2 sm:gap-3">
//                 <button
//                   onClick={() => navigate('/leave/apply')}
//                   className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm transition-all duration-200 hover:bg-primary-50 hover:shadow-md active:scale-95"
//                 >
//                   <Plus className="h-4 w-4" />
//                   Apply Leave
//                 </button>
//                 <div className="flex items-center gap-1.5 rounded-lg bg-white/15 p-1 backdrop-blur-sm">
//                   <button
//                     onClick={() => goToMonth('prev')}
//                     className="rounded-md p-1.5 text-white transition-all duration-150 hover:bg-white/20 active:scale-90"
//                   >
//                     <ChevronLeft className="h-4 w-4" />
//                   </button>
//                   <div className="min-w-[130px] px-2 text-center text-sm font-semibold text-white sm:min-w-[160px]">
//                     {monthName}
//                   </div>
//                   <button
//                     onClick={() => goToMonth('next')}
//                     className="rounded-md p-1.5 text-white transition-all duration-150 hover:bg-white/20 active:scale-90"
//                   >
//                     <ChevronRight className="h-4 w-4" />
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Month stats */}
//           <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
//             <StatCard
//               icon={CheckCircle2}
//               label="Approved Leaves"
//               value={`${approvedCount} application${approvedCount !== 1 ? 's' : ''}`}
//               detail={`${totalDaysThisMonth} day${totalDaysThisMonth !== 1 ? 's' : ''} total`}
//               color="green"
//               delay="rise-1"
//             />
//             <StatCard
//               icon={Clock}
//               label="Pending"
//               value={`${pendingCount} application${pendingCount !== 1 ? 's' : ''}`}
//               detail="Awaiting approval"
//               color="amber"
//               delay="rise-2"
//             />
//             <StatCard
//               icon={Calendar}
//               label="Holidays This Month"
//               value={`${holidays.filter((h) => new Date(h.date).getMonth() === month).length}`}
//               detail="Company holidays"
//               color="primary"
//               delay="rise-3"
//             />
//           </div>

//           {loading ? (
//             <div className="flex items-center justify-center py-16">
//               <div className="relative h-9 w-9">
//                 <div className="absolute inset-0 animate-ping rounded-full bg-primary-400 opacity-30" />
//                 <Loader2 className="relative h-9 w-9 animate-spin text-primary-600" />
//               </div>
//             </div>
//           ) : (
//             <>
//               {/* Calendar Grid */}
//               <div className="rise-in rise-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
//                 {/* Day headers */}
//                 <div className="grid grid-cols-7 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100/60">
//                   {weekDays.map((day) => (
//                     <div
//                       key={day}
//                       className={`px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide sm:text-xs ${
//                         day === 'Sun' || day === 'Sat' ? 'text-primary-400' : 'text-primary-700'
//                       }`}
//                     >
//                       {day}
//                     </div>
//                   ))}
//                 </div>

//                 {/* Cells */}
//                 <div className="grid grid-cols-7">
//                   {cells.map((cell, idx) => {
//                     const dateStr = cell.date ? formatLocalDate(cell.date) : null;
//                     const isToday = dateStr === todayStr;
//                     const isWeekend = cell.date && (cell.date.getDay() === 0 || cell.date.getDay() === 6);

//                     return (
//                       <div
//                         key={idx}
//                         className={`min-h-[68px] border-b border-r border-gray-100 p-1 transition-colors duration-150 sm:min-h-[110px] sm:p-2 ${
//                           cell.date ? 'hover:bg-primary-50/40' : 'bg-gray-50/60'
//                         } ${
//                           cell.holiday
//                             ? 'bg-purple-50'
//                             : cell.leaves.some((l) => l.status === 'APPROVED')
//                             ? 'bg-green-50'
//                             : cell.leaves.some((l) => l.status === 'PENDING')
//                             ? 'bg-amber-50'
//                             : ''
//                         }`}
//                       >
//                         {cell.date && (
//                           <>
//                             <div className="mb-1 flex items-center justify-between">
//                               <span
//                                 className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold sm:h-6 sm:w-6 sm:text-sm ${
//                                   isToday
//                                     ? 'today-pulse bg-primary-600 text-white'
//                                     : isWeekend
//                                     ? 'text-gray-400'
//                                     : 'text-gray-700'
//                                 }`}
//                               >
//                                 {cell.date.getDate()}
//                               </span>
//                             </div>

//                             <div className="space-y-1">
//                               {/* Holiday */}
//                               {cell.holiday && (
//                                 <div
//                                   className="pop-in truncate rounded-md bg-gradient-to-r from-purple-500 to-purple-600 px-1 py-0.5 text-[10px] font-medium text-white shadow-sm sm:px-1.5 sm:text-xs"
//                                   title={cell.holiday.name}
//                                 >
//                                   🎉 <span className="hidden sm:inline">{cell.holiday.name}</span>
//                                 </div>
//                               )}

//                               {/* Leaves */}
//                               {cell.leaves.map((leave, i) => (
//                                 <div
//                                   key={i}
//                                   onClick={() => navigate('/leave/my-applications')}
//                                   className={`pop-in cursor-pointer truncate rounded-md px-1 py-0.5 text-[10px] font-medium text-white shadow-sm transition-transform duration-150 hover:scale-[1.03] sm:px-1.5 sm:text-xs ${
//                                     leave.status === 'APPROVED'
//                                       ? ''
//                                       : 'border-2 border-dashed border-white/50'
//                                   }`}
//                                   style={{
//                                     backgroundColor:
//                                       leave.status === 'APPROVED'
//                                         ? leave.leave_type_color
//                                         : '#F59E0B',
//                                   }}
//                                   title={`${leave.leave_type_name} (${leave.status})`}
//                                 >
//                                   {leave.status === 'APPROVED' ? '✅' : '⏳'}{' '}
//                                   {leave.leave_type_code}
//                                   {leave.is_half_day && ' (½)'}
//                                 </div>
//                               ))}
//                             </div>
//                           </>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>

//               {/* Legend */}
//               <div className="rise-in mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100 sm:gap-4">
//                 <span className="text-xs font-semibold text-gray-600">Legend:</span>
//                 <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs text-green-800">
//                   <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
//                   ✅ Approved Leave
//                 </span>
//                 <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
//                   <div className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-amber-400 bg-amber-500" />
//                   ⏳ Pending Approval
//                 </span>
//                 <span className="flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs text-purple-800">
//                   <div className="h-2.5 w-2.5 rounded-full bg-purple-500" />
//                   🎉 Holiday
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
// function StatCard({ icon: Icon, label, value, detail, color, delay }: any) {
//   const colorMap: any = {
//     green: {
//       icon: 'bg-gradient-to-br from-green-400 to-green-600 text-white',
//       border: 'border-green-500',
//     },
//     amber: {
//       icon: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
//       border: 'border-amber-500',
//     },
//     primary: {
//       icon: 'bg-gradient-to-br from-primary-400 to-primary-600 text-white',
//       border: 'border-primary-500',
//     },
//   };
//   const c = colorMap[color] ?? colorMap.primary;
//   return (
//     <div
//       className={`rise-in ${delay ?? ''} group rounded-xl border-l-4 ${c.border} bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
//     >
//       <div className="flex items-center justify-between">
//         <div>
//           <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
//           <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
//           <p className="text-xs text-gray-500">{detail}</p>
//         </div>
//         <div className={`rounded-xl p-2.5 shadow-sm transition-transform duration-300 group-hover:scale-110 ${c.icon}`}>
//           <Icon className="h-5 w-5" />
//         </div>
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  CheckCircle2, Clock, Plus, Wallet, TrendingDown, Briefcase,
  MinusCircle, AlertCircle, PartyPopper, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { leaveApplicationsApi, holidaysApi, leaveBalancesApi } from '../../api/leave';
import { personalAttendanceApi } from '../../api/attendance';
import type {
  LeaveApplicationListItem, Holiday, LeaveBalance,
} from '../../types/leave';
import type { MonthlyAttendanceData, DayEntry } from '../../types/attendance';

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================================================
// PRESENTATION-ONLY HELPERS (new — do not alter any data/business logic)
// These only reshape already-computed values for a nicer, more legible
// calendar visual (continuous multi-day leave bars, like a real HR calendar).
// ============================================================================

type CalCell = {
  date: Date | null;
  dateStr: string | null;
  leaves: LeaveApplicationListItem[];
  holiday?: Holiday;
  attendance?: DayEntry;
};

type BarSegment = {
  leave: any;
  start: number; // column index (0-6) within the week
  end: number; // column index (0-6) within the week
  lane: number; // vertical stacking lane, for overlapping leaves
  isRealStart: boolean;
  isRealEnd: boolean;
};

function chunkIntoWeeks(cells: CalCell[]): CalCell[][] {
  const padded = [...cells];
  while (padded.length % 7 !== 0) {
    padded.push({ date: null, dateStr: null, leaves: [] });
  }
  const weeks: CalCell[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }
  return weeks;
}

function computeWeekBars(week: CalCell[]): BarSegment[] {
  const map = new Map<string, { leave: any; start: number; end: number }>();

  week.forEach((cell, idx) => {
    if (!cell.date) return;
    cell.leaves.forEach((leave: any) => {
      const key = String(
        leave.id ?? `${leave.leave_type_code}-${leave.start_date}-${leave.end_date}`
      );
      const existing = map.get(key);
      if (existing) {
        existing.end = idx;
      } else {
        map.set(key, { leave, start: idx, end: idx });
      }
    });
  });

  const segments = Array.from(map.values()).sort(
    (a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start)
  );

  const laneEnds: number[] = [];
  const placed: BarSegment[] = segments.map((seg) => {
    let lane = laneEnds.findIndex((endIdx) => endIdx < seg.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.end);
    } else {
      laneEnds[lane] = seg.end;
    }
    const startDateStr = week[seg.start]?.dateStr;
    const endDateStr = week[seg.end]?.dateStr;
    return {
      ...seg,
      lane,
      isRealStart: startDateStr === seg.leave.start_date,
      isRealEnd: endDateStr === seg.leave.end_date,
    };
  });

  return placed;
}

function initialsOf(code?: string, name?: string) {
  if (code && code.length > 0) return code.slice(0, 2).toUpperCase();
  if (name && name.length > 0) return name.slice(0, 2).toUpperCase();
  return '--';
}

function barPalette(status: string) {
  if (status === 'APPROVED') {
    return {
      bar: 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white',
      avatar: 'bg-white/25 text-white',
      ring: 'ring-indigo-200',
    };
  }
  return {
    bar: 'border border-dashed border-amber-400 bg-amber-100 text-amber-800',
    avatar: 'bg-amber-200 text-amber-800',
    ring: 'ring-amber-200',
  };
}

const LANE_HEIGHT = 22;
const BARS_TOP_OFFSET = 34;

export default function MyLeaveCalendarPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<LeaveApplicationListItem[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [attendanceData, setAttendanceData] = useState<MonthlyAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;

      const [apps, hols, myBalances, attendance] = await Promise.all([
        leaveApplicationsApi.myApplications(),
        holidaysApi.byYear(year),
        leaveBalancesApi.myBalance(year).catch(() => []),
        personalAttendanceApi.getMyMonth(year, month).catch(() => null),
      ]);

      setApplications(apps);
      setHolidays(hols);
      setBalances(Array.isArray(myBalances) ? myBalances : []);
      setAttendanceData(attendance);
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

  const attendanceByDate: Record<string, DayEntry> = {};
  attendanceData?.days.forEach((day) => {
    attendanceByDate[day.date] = day;
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const todayStr = formatLocalDate(new Date());

  const cells: Array<{
    date: Date | null;
    dateStr: string | null;
    leaves: LeaveApplicationListItem[];
    holiday?: Holiday;
    attendance?: DayEntry;
  }> = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ date: null, dateStr: null, leaves: [] });
  }

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
    const attendance = attendanceByDate[dateStr];

    cells.push({ date, dateStr, leaves: dayLeaves, holiday: dayHoliday, attendance });
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const monthApps = applications.filter((a) => {
    const startMonth = new Date(a.start_date).getMonth();
    const startYear = new Date(a.start_date).getFullYear();
    return startMonth === month && startYear === year;
  });
  const approvedCount = monthApps.filter((a) => a.status === 'APPROVED').length;
  const pendingCount = monthApps.filter((a) => a.status === 'PENDING').length;

  // Next upcoming holiday from today onward, used by the banner
  const upcomingHoliday = holidays
    .filter((h) => h.date >= todayStr)
    .sort((a, b) => (a.date > b.date ? 1 : -1))[0];

  // Presentation-only derived data for the spanning leave bars
  const weeks = chunkIntoWeeks(cells);

  return (
    <div className="flex h-screen bg-indigo-50/40">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes barSlideIn {
          from { opacity: 0; transform: translateX(-8px) scaleX(0.96); }
          to { opacity: 1; transform: translateX(0) scaleX(1); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes ringPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.35); }
          50% { box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12); }
        }
        .cal-fade-in { animation: fadeSlideIn 0.35s ease-out both; }
        .cal-bar-in { animation: barSlideIn 0.3s ease-out both; }
        .cal-pop-in { animation: popIn 0.25s ease-out both; }
        .cal-today-ring { animation: ringPulse 2.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cal-fade-in, .cal-bar-in, .cal-pop-in, .cal-today-ring { animation: none !important; }
        }
      `}</style>

      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-indigo-50/50 to-white p-3 sm:p-6">

          {/* Header */}
          <div className="mb-4 overflow-hidden rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="bg-gradient-to-r from-indigo-900 to-indigo-500 bg-clip-text text-xl font-bold text-transparent sm:text-2xl">
                  My Calendar
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  View your leaves, attendance and holidays
                </p>
              </div>
              <button
                onClick={() => navigate('/leave/apply')}
                className="group flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md active:translate-y-0 sm:w-auto"
              >
                <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
                Apply Leave
              </button>
            </div>
          </div>

          {/* Info Banner */}
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-indigo-400/40 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 p-4 text-white shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              {pendingCount > 0 ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold sm:text-base">
                {pendingCount > 0
                  ? `${pendingCount} leave request${pendingCount > 1 ? 's' : ''} awaiting approval this month`
                  : 'All caught up — no pending approvals this month'}
              </p>
              <p className="mt-0.5 text-xs text-indigo-100 sm:text-sm">
                {upcomingHoliday
                  ? `Next holiday: ${upcomingHoliday.name} on ${new Date(upcomingHoliday.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : 'Track balances, attendance and holidays all in one place.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/leave')}
              className="shrink-0 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-white/20 sm:text-sm"
            >
              View Applications
            </button>
          </div>

          {/* Month Navigation */}
          <div className="mb-4 flex items-center justify-between rounded-xl border border-indigo-100 bg-white px-3 py-3 shadow-sm sm:px-4">
            <button
              onClick={() => goToMonth('prev')}
              className="rounded-full p-2 text-indigo-500 transition-all duration-150 hover:scale-105 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 key={monthName} className="cal-fade-in text-base font-semibold tracking-wide text-gray-800 sm:text-lg">
              {monthName}
            </h2>
            <button
              onClick={() => goToMonth('next')}
              className="rounded-full p-2 text-indigo-500 transition-all duration-150 hover:scale-105 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Leave Balances Section */}
          {balances.length > 0 && (
            <div className="mb-4 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                  <Wallet className="h-4 w-4 text-indigo-600" />
                </span>
                <h3 className="text-sm font-semibold text-gray-800">
                  Leave Balances
                </h3>
                <span className="text-xs text-gray-500">for {year}</span>
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6">
                {balances.map((balance) => (
                  <BalanceChip key={balance.id} balance={balance} />
                ))}
              </div>
            </div>
          )}

          {/* Attendance Summary */}
          {attendanceData && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                icon={CheckCircle2}
                label="Present"
                value={attendanceData.stats.present_days}
                accent="indigo"
              />
              <StatCard
                icon={Briefcase}
                label="On Leave"
                value={attendanceData.stats.on_leave_days}
                accent="violet"
              />
              <StatCard
                icon={Clock}
                label="Worked"
                value={attendanceData.stats.total_worked_hours}
                accent="indigo"
              />
              <StatCard
                icon={TrendingDown}
                label="Shortage"
                value={
                  attendanceData.stats.shortage_hours > 0
                    ? `${attendanceData.stats.shortage_hours}h`
                    : 'None'
                }
                valueColor={attendanceData.stats.shortage_hours > 0 ? 'text-red-600' : 'text-green-600'}
                accent={attendanceData.stats.shortage_hours > 0 ? 'rose' : 'emerald'}
              />
            </div>
          )}

          {/* Leave Applications Summary */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={CheckCircle2}
              label="Approved Leaves"
              value={approvedCount}
              detail="applications"
              accent="indigo"
            />
            <SummaryCard
              icon={Clock}
              label="Pending"
              value={pendingCount}
              detail="awaiting approval"
              accent="amber"
            />
            <SummaryCard
              icon={CalendarIcon}
              label="Holidays"
              value={holidays.filter((h) => new Date(h.date).getMonth() === month).length}
              detail="this month"
              accent="violet"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-indigo-100 bg-white py-16 shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            </div>
          ) : (
            <>
              {/* Calendar Grid */}
              <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-indigo-50">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className={`px-1 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide sm:px-2 sm:py-3 sm:text-xs ${
                        day === 'Sun' || day === 'Sat' ? 'text-indigo-300' : 'text-indigo-700'
                      }`}
                    >
                      <span className="sm:hidden">{day.slice(0, 1)}</span>
                      <span className="hidden sm:inline">{day}</span>
                    </div>
                  ))}
                </div>

                {/* Weeks */}
                <div key={monthName} className="cal-fade-in overflow-x-auto">
                  <div className="min-w-[560px]">
                    {weeks.map((week, wIdx) => {
                      const bars = computeWeekBars(week);
                      const laneCount = bars.reduce((m, b) => Math.max(m, b.lane + 1), 0);
                      const rowMinHeight = 88 + laneCount * LANE_HEIGHT;

                      return (
                        <div
                          key={wIdx}
                          className="relative grid grid-cols-7 border-b border-indigo-50 last:border-b-0"
                          style={{ minHeight: `${rowMinHeight}px` }}
                        >
                          {week.map((cell, idx) => (
                            <CalendarCell
                              key={idx}
                              cell={cell}
                              todayStr={todayStr}
                              barLaneCount={laneCount}
                              onClickLeave={() => navigate('/leave/my-applications')}
                            />
                          ))}

                          {/* Spanning leave bars overlay */}
                          {bars.length > 0 && (
                            <div
                              className="pointer-events-none absolute inset-x-0 grid grid-cols-7"
                              style={{ top: `${BARS_TOP_OFFSET}px` }}
                            >
                              {bars.map((seg, i) => {
                                const palette = barPalette(seg.leave.status);
                                return (
                                  <div
                                    key={i}
                                    onClick={() => navigate('/leave/my-applications')}
                                    title={`${seg.leave.leave_type_name} (${seg.leave.status})`}
                                    className={`cal-bar-in pointer-events-auto mx-0.5 flex min-w-0 cursor-pointer items-center gap-1 truncate rounded-full px-2 py-1 text-[10px] font-semibold shadow-sm ring-1 transition-transform duration-150 hover:z-10 hover:scale-[1.03] hover:shadow-md sm:text-[11px] ${palette.bar} ${palette.ring}`}
                                    style={{
                                      gridColumn: `${seg.start + 1} / span ${seg.end - seg.start + 1}`,
                                      marginTop: `${seg.lane * LANE_HEIGHT}px`,
                                      animationDelay: `${i * 45}ms`,
                                    }}
                                  >
                                    <span
                                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ${palette.avatar}`}
                                    >
                                      {initialsOf(seg.leave.leave_type_code, seg.leave.leave_type_name)}
                                    </span>
                                    <span className="truncate">
                                      {seg.leave.leave_type_name}
                                      {seg.leave.is_half_day ? ' ½' : ''}
                                    </span>
                                    {seg.isRealEnd && (
                                      <span className="ml-auto shrink-0 truncate text-[9px] font-medium opacity-80">
                                        Leave End
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Compact Legend */}
              <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <span className="font-semibold text-gray-600">Legend:</span>
                  <LegendItem color="bg-indigo-500" label="Approved" />
                  <LegendItem color="bg-amber-500" label="Pending" />
                  <LegendItem color="bg-violet-500" label="Holiday" />
                  <LegendItem color="bg-sky-500" label="Present" />
                  <LegendItem color="bg-rose-500" label="Absent" />
                  <LegendItem color="bg-yellow-500" label="Missing Punch" />
                  <LegendItem color="bg-indigo-400" label="Weekend Work" />
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
// CALENDAR CELL
// ============================================================================

function CalendarCell({
  cell, todayStr, onClickLeave, barLaneCount = 0,
}: {
  cell: any;
  todayStr: string;
  onClickLeave: () => void;
  barLaneCount?: number;
}) {
  if (!cell.date) {
    return <div className="min-h-[88px] border-r border-indigo-50 bg-indigo-50/30 sm:min-h-[110px]" />;
  }

  const isToday = cell.dateStr === todayStr;
  const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
  const attendance = cell.attendance;
  const isFuture = attendance?.is_future;

  // Subtle background based on primary status
  let cellBg = 'bg-white';
  if (cell.holiday) {
    cellBg = 'bg-violet-50/60';
  } else if (attendance?.status === 'leave_but_present') {
    cellBg = 'bg-lime-50/60';
  } else if (attendance?.status === 'weekend_present') {
    cellBg = 'bg-indigo-50/60';
  } else if (cell.leaves.some((l: any) => l.status === 'APPROVED')) {
    cellBg = 'bg-indigo-50/40';
  } else if (cell.leaves.some((l: any) => l.status === 'PENDING')) {
    cellBg = 'bg-amber-50/40';
  } else if (attendance?.status === 'absent') {
    cellBg = 'bg-rose-50/60';
  } else if (attendance?.status === 'missing_punch') {
    cellBg = 'bg-yellow-50/60';
  }

  return (
    <div
      className={`min-h-[88px] border-r border-b border-indigo-50 p-1.5 transition-colors duration-150 last:border-r-0 hover:bg-indigo-50/50 sm:min-h-[110px] sm:p-2 ${cellBg}`}
    >
      {/* Date + Status Indicator */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-all duration-150 ${
            isToday
              ? 'cal-today-ring bg-indigo-600 text-white'
              : isWeekend
              ? 'text-indigo-300'
              : 'text-gray-700'
          }`}
        >
          {cell.date.getDate()}
        </span>

        {attendance && !isFuture && (
          <AttendanceStatusDot status={attendance.status} />
        )}
      </div>

      {/* Reserved space so per-day content never collides with the
          spanning leave bars drawn above this row */}
      {barLaneCount > 0 && <div style={{ height: `${barLaneCount * LANE_HEIGHT}px` }} />}

      <div className="space-y-1">
        {/* Holiday */}
        {cell.holiday && (
          <div
            className="cal-pop-in flex items-center gap-1.5 truncate rounded-lg border border-violet-200 bg-gradient-to-r from-violet-100 to-fuchsia-100 px-1.5 py-1 text-[10px] font-medium text-violet-700 shadow-sm"
            title={cell.holiday.name}
          >
            <PartyPopper className="h-3 w-3 shrink-0 text-violet-500" />
            <span className="truncate">{cell.holiday.name}</span>
          </div>
        )}

        {/* Worked Hours */}
        {attendance && !isFuture && attendance.worked_hours !== '00:00' && (
          <div className="flex items-center gap-1 text-[10px] text-gray-600">
            <Clock className="h-2.5 w-2.5" />
            <span className="font-medium">{attendance.worked_hours}</span>
          </div>
        )}

        {/* Special Status Labels */}
        {attendance && !isFuture && (
          <AttendanceLabel status={attendance.status} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ATTENDANCE STATUS DOT (top-right)
// ============================================================================

function AttendanceStatusDot({ status }: { status: string }) {
  const dotColors: any = {
    present: 'bg-sky-500',
    absent: 'bg-rose-500',
    missing_punch: 'bg-yellow-500',
    weekend: 'bg-gray-300',
    weekend_present: 'bg-indigo-500',
    holiday: 'bg-violet-500',
    on_leave: 'bg-cyan-500',
    on_half_leave: 'bg-teal-500',
    leave_but_present: 'bg-lime-500',
    leave_but_partial: 'bg-orange-500',
    half_leave_present: 'bg-emerald-500',
    will_be_on_leave: 'bg-cyan-300',
    future: '',
  };

  const color = dotColors[status];
  if (!color) return null;

  return <span className={`h-2 w-2 rounded-full shadow-sm ring-2 ring-white ${color}`} />;
}

// ============================================================================
// ATTENDANCE LABEL — Only for notable statuses
// ============================================================================

function AttendanceLabel({ status }: { status: string }) {
  if (status === 'absent') {
    return (
      <div className="truncate rounded-lg border border-rose-200 bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
        Absent
      </div>
    );
  }
  if (status === 'weekend_present') {
    return (
      <div className="truncate rounded-lg border border-indigo-200 bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
        Weekend Work
      </div>
    );
  }
  if (status === 'leave_but_present') {
    return (
      <div className="truncate rounded-lg border border-lime-200 bg-lime-100 px-1.5 py-0.5 text-[10px] font-medium text-lime-800">
        Present on Leave
      </div>
    );
  }
  if (status === 'missing_punch') {
    return (
      <div className="truncate rounded-lg border border-yellow-200 bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800">
        Missing Punch
      </div>
    );
  }
  return null;
}

// ============================================================================
// BALANCE CHIP — Clean, minimal, visibly outlined
// ============================================================================

function BalanceChip({ balance }: { balance: LeaveBalance }) {
  const available = Number(balance.available);
  const isLow = available < 3 && available > 0;
  const isZero = available === 0;

  return (
    <div
      className="flex w-[128px] shrink-0 items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/30 px-3 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm sm:w-auto"
      title={`${balance.leave_type.name} • Used: ${balance.used} • Pending: ${balance.pending}`}
    >
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white shadow-sm"
        style={{ backgroundColor: balance.leave_type.color_code }}
      >
        {balance.leave_type.code}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1">
          <span
            className={`text-base font-semibold leading-none ${
              isZero
                ? 'text-gray-400'
                : isLow
                ? 'text-amber-600'
                : 'text-indigo-900'
            }`}
          >
            {available.toFixed(1)}
          </span>
          <span className="text-[10px] text-gray-500">days</span>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-gray-500">
          {balance.leave_type.name}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// STAT CARD — Clean summary, visibly outlined
// ============================================================================

const ACCENT_ICON_BG: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  sky: 'bg-sky-50 text-sky-500',
  violet: 'bg-violet-50 text-violet-500',
  gray: 'bg-gray-100 text-gray-500',
  rose: 'bg-rose-50 text-rose-500',
  emerald: 'bg-emerald-50 text-emerald-500',
  amber: 'bg-amber-50 text-amber-500',
};

const ACCENT_BORDER: Record<string, string> = {
  indigo: 'border-indigo-100 hover:border-indigo-300',
  sky: 'border-sky-100 hover:border-sky-300',
  violet: 'border-violet-100 hover:border-violet-300',
  gray: 'border-gray-200 hover:border-gray-300',
  rose: 'border-rose-100 hover:border-rose-300',
  emerald: 'border-emerald-100 hover:border-emerald-300',
  amber: 'border-amber-100 hover:border-amber-300',
};

function StatCard({
  icon: Icon, label, value, valueColor = 'text-gray-900', accent = 'indigo',
}: {
  icon: any;
  label: string;
  value: any;
  valueColor?: string;
  accent?: string;
}) {
  return (
    <div className={`rounded-xl border bg-white p-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${ACCENT_BORDER[accent] ?? ACCENT_BORDER.indigo}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className={`mt-0.5 text-lg font-semibold ${valueColor}`}>{value}</p>
        </div>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ACCENT_ICON_BG[accent] ?? ACCENT_ICON_BG.indigo}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SUMMARY CARD — Larger, for month overview, visibly outlined
// ============================================================================

function SummaryCard({
  icon: Icon, label, value, detail, accent = 'indigo',
}: {
  icon: any;
  label: string;
  value: number;
  detail: string;
  accent?: string;
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${ACCENT_BORDER[accent] ?? ACCENT_BORDER.indigo}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{detail}</p>
        </div>
        <span className={`rounded-lg p-2 ${ACCENT_ICON_BG[accent] ?? ACCENT_ICON_BG.indigo}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// LEGEND ITEM
// ============================================================================

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-gray-600">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}