// import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import {
//   Users, UserPlus, Calendar, TrendingUp, Loader2, Bell,
//   CheckSquare, Workflow, ClipboardCheck, Trophy, Award,
//   FileText, Building2, Target, AlertCircle, ArrowRight,
//   UserCheck, ChevronRight,
// } from 'lucide-react';
// import Sidebar from '../components/Sidebar';
// import Topbar from '../components/Topbar';
// import { useAuth } from '../context/AuthContext';
// import { dashboardApi } from '../api/performance';
// import toast from 'react-hot-toast';

// export default function Dashboard() {
//   const navigate = useNavigate();
//   const { user } = useAuth();
//   const [stats, setStats] = useState<any>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     dashboardApi
//       .getStats()
//       .then(setStats)
//       .catch(() => toast.error('Failed to load dashboard stats'))
//       .finally(() => setLoading(false));
//   }, []);

//   const userRole = stats?.user_role || 'EMPLOYEE';
//   const isHR = userRole === 'HR';
//   const isManager = userRole === 'MANAGER';

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Welcome Banner */}
//           <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 p-6 text-white shadow-lg">
//             <h1 className="text-2xl font-bold">
//               Hello, {user?.employee?.first_name || user?.username}! 👋
//             </h1>
//             <p className="mt-1 text-primary-100">
//               {isHR && "Here's a snapshot of the organization"}
//               {isManager && "Here's your team's activity today"}
//               {!isHR && !isManager && "Here's your personal dashboard"}
//             </p>
//             <div className="mt-4 flex flex-wrap gap-2">
//               {user?.role_codes?.map((role) => (
//                 <span
//                   key={role}
//                   className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur"
//                 >
//                   {role}
//                 </span>
//               ))}
//             </div>
//           </div>

//           {loading ? (
//             <div className="flex justify-center py-16">
//               <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//             </div>
//           ) : (
//             <>
//               {/* HR DASHBOARD */}
//               {isHR && stats && (
//                 <>
//                   {/* Main Stats */}
//                   <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
//                     <StatCard
//                       label="Total Employees"
//                       value={stats.total_employees}
//                       subtext={`${stats.active_employees} active`}
//                       icon={Users}
//                       color="blue"
//                     />
//                     <StatCard
//                       label="New Hires (Month)"
//                       value={stats.new_hires_month}
//                       subtext={
//                         stats.new_hires_change >= 0
//                           ? `+${stats.new_hires_change} vs last month`
//                           : `${stats.new_hires_change} vs last month`
//                       }
//                       subtextColor={stats.new_hires_change >= 0 ? 'text-green-600' : 'text-red-600'}
//                       icon={UserPlus}
//                       color="green"
//                     />
//                     <StatCard
//                       label="Attrition (Month)"
//                       value={stats.attrition_count}
//                       subtext={`${stats.attrition_rate}% rate`}
//                       icon={TrendingUp}
//                       color="red"
//                     />
//                     <StatCard
//                       label="Doc Expiry Alerts"
//                       value={stats.document_expiry_alerts}
//                       subtext="Next 90 days"
//                       icon={AlertCircle}
//                       color="amber"
//                     />
//                   </div>

//                   {/* Performance Overview */}
//                   {stats.performance?.cycle_name && (
//                     <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
//                       <div className="mb-4 flex items-center justify-between">
//                         <div>
//                           <h3 className="text-lg font-semibold text-gray-900">
//                             🎯 Active Performance Cycle
//                           </h3>
//                           <p className="text-sm text-gray-500">{stats.performance.cycle_name}</p>
//                         </div>
//                         <button
//                           onClick={() => navigate('/performance-reports')}
//                           className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
//                         >
//                           View Reports <ArrowRight className="h-3 w-3" />
//                         </button>
//                       </div>
//                       <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
//                         <MiniStat label="Total" value={stats.performance.total_scorecards} color="bg-primary-50 text-primary-700" />
//                         <MiniStat label="In Progress" value={stats.performance.in_progress} color="bg-blue-50 text-blue-700" />
//                         <MiniStat
//                           label="⚡ Awaiting Finalize"
//                           value={stats.performance.awaiting_finalization}
//                           color="bg-amber-50 text-amber-700"
//                           highlight={stats.performance.awaiting_finalization > 0}
//                           onClick={() => navigate('/hr/calibration')}
//                         />
//                         <MiniStat label="Finalized" value={stats.performance.finalized} color="bg-green-50 text-green-700" />
//                       </div>
//                       {stats.performance.avg_score > 0 && (
//                         <div className="mt-3 text-sm text-gray-600">
//                           Company Average Score:{' '}
//                           <span className="font-bold text-primary-700">
//                             {stats.performance.avg_score}%
//                           </span>
//                         </div>
//                       )}
//                     </div>
//                   )}

//                   {/* Quick Actions */}
//                   <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
//                     <QuickAction
//                       icon={Workflow}
//                       label="Lifecycle Requests"
//                       count={stats.pending_lifecycle_requests}
//                       color="bg-purple-50 text-purple-700"
//                       onClick={() => navigate('/lifecycle-requests')}
//                     />
//                     <QuickAction
//                       icon={CheckSquare}
//                       label="Performance Calibration"
//                       color="bg-indigo-50 text-indigo-700"
//                       onClick={() => navigate('/hr/calibration')}
//                     />
//                     <QuickAction
//                       icon={Target}
//                       label={`Active KRAs: ${stats.active_kra_count}`}
//                       color="bg-teal-50 text-teal-700"
//                       onClick={() => navigate('/settings/kra-library')}
//                     />
//                     <QuickAction
//                       icon={FileText}
//                       label="Letter Templates"
//                       color="bg-pink-50 text-pink-700"
//                       onClick={() => navigate('/settings/letter-templates')}
//                     />
//                   </div>

//                   {/* Department Distribution + Recent Hires */}
//                   <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
//                     {stats.department_distribution?.length > 0 && (
//                       <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
//                         <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
//                           <Building2 className="h-4 w-4" />
//                           Department Distribution
//                         </h3>
//                         <div className="space-y-2">
//                           {stats.department_distribution.map((d: any) => {
//                             const maxCount = Math.max(
//                               ...stats.department_distribution.map((x: any) => x.count)
//                             );
//                             const pct = (d.count / maxCount) * 100;
//                             return (
//                               <div key={d.structure_location__name || 'no-dept'}>
//                                 <div className="mb-1 flex items-center justify-between text-xs">
//                                   <span className="font-medium text-gray-700">
//                                     {d.structure_location__name || 'Unassigned'}
//                                   </span>
//                                   <span className="font-bold text-gray-900">{d.count}</span>
//                                 </div>
//                                 <div className="h-2 rounded-full bg-gray-200">
//                                   <div
//                                     className="h-full rounded-full bg-primary-600"
//                                     style={{ width: `${pct}%` }}
//                                   />
//                                 </div>
//                               </div>
//                             );
//                           })}
//                         </div>
//                       </div>
//                     )}

//                     {stats.recent_hires?.length > 0 && (
//                       <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
//                         <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
//                           <UserPlus className="h-4 w-4" />
//                           Recent Hires
//                         </h3>
//                         <div className="space-y-2">
//                           {stats.recent_hires.map((h: any) => (
//                             <div
//                               key={h.id}
//                               className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-50 cursor-pointer"
//                               onClick={() => navigate(`/employees/${h.id}`)}
//                             >
//                               <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
//                                 {`${h.first_name[0]}${h.last_name[0]}`.toUpperCase()}
//                               </div>
//                               <div className="flex-1">
//                                 <p className="text-sm font-medium text-gray-900">
//                                   {h.first_name} {h.last_name}
//                                 </p>
//                                 <p className="text-xs text-gray-500">
//                                   {h.employee_id} • Joined {new Date(h.date_of_joining).toLocaleDateString('en-IN')}
//                                 </p>
//                               </div>
//                               <ChevronRight className="h-4 w-4 text-gray-400" />
//                             </div>
//                           ))}
//                         </div>
//                       </div>
//                     )}
//                   </div>
//                 </>
//               )}

//               {/* MANAGER DASHBOARD */}
//               {isManager && stats && (
//                 <>
//                   <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
//                     <StatCard
//                       label="Team Size"
//                       value={stats.team_size}
//                       subtext={`${stats.team_active} active`}
//                       icon={Users}
//                       color="blue"
//                     />
//                     <StatCard
//                       label="Pending Approvals"
//                       value={stats.pending_approvals}
//                       subtext="Lifecycle requests"
//                       icon={CheckSquare}
//                       color={stats.pending_approvals > 0 ? 'amber' : 'green'}
//                     />
//                     {stats.team_performance?.cycle_name && (
//                       <>
//                         <StatCard
//                           label="Team Avg Score"
//                           value={`${stats.team_performance.avg_score || 0}%`}
//                           subtext={stats.team_performance.cycle_name}
//                           icon={Trophy}
//                           color="green"
//                         />
//                         <StatCard
//                           label="Team Reviews Pending"
//                           value={stats.team_performance.pending_review || 0}
//                           subtext={`${stats.team_performance.approved || 0} approved`}
//                           icon={UserCheck}
//                           color={stats.team_performance.pending_review > 0 ? 'amber' : 'green'}
//                         />
//                       </>
//                     )}
//                   </div>

//                   {stats.team_roster?.length > 0 && (
//                     <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
//                       <div className="mb-4 flex items-center justify-between">
//                         <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
//                           <Users className="h-4 w-4" />
//                           My Team
//                         </h3>
//                         <button
//                           onClick={() => navigate('/team-performance')}
//                           className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
//                         >
//                           Team Performance <ArrowRight className="h-3 w-3" />
//                         </button>
//                       </div>
//                       <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
//                         {stats.team_roster.map((m: any) => (
//                           <div
//                             key={m.id}
//                             className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50 cursor-pointer"
//                             onClick={() => navigate(`/employees/${m.id}`)}
//                           >
//                             <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
//                               {`${m.first_name[0]}${m.last_name[0]}`.toUpperCase()}
//                             </div>
//                             <div className="flex-1">
//                               <p className="text-sm font-medium text-gray-900">
//                                 {m.first_name} {m.last_name}
//                               </p>
//                               <p className="text-xs text-gray-500">
//                                 {m.employee_id} • {m.position__title || '-'}
//                               </p>
//                             </div>
//                             <span
//                               className={`rounded-full px-2 py-0.5 text-xs font-medium ${
//                                 m.status === 'ACTIVE'
//                                   ? 'bg-green-100 text-green-700'
//                                   : 'bg-amber-100 text-amber-700'
//                               }`}
//                             >
//                               {m.status}
//                             </span>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   )}
//                 </>
//               )}

//               {/* EMPLOYEE PERSONAL SECTION (always shown) */}
//               {stats?.my_scorecard && (
//                 <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary-50 to-blue-50 p-6 ring-1 ring-primary-100">
//                   <div className="mb-3 flex items-center justify-between">
//                     <div>
//                       <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
//                         <ClipboardCheck className="h-4 w-4 text-primary-600" />
//                         My Current Scorecard
//                       </h3>
//                       <p className="text-xs text-gray-500">{stats.my_scorecard.cycle_name}</p>
//                     </div>
//                     <span className="rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white">
//                       {stats.my_scorecard.status_display}
//                     </span>
//                   </div>
//                   <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
//                     <div className="rounded-lg bg-white p-3 text-center">
//                       <div className="text-lg font-bold text-primary-700">
//                         {stats.my_scorecard.kra_count}
//                       </div>
//                       <div className="text-xs text-gray-500">KRAs</div>
//                     </div>
//                     <div className="rounded-lg bg-white p-3 text-center">
//                       <div className="text-lg font-bold text-primary-700">
//                         {stats.my_scorecard.total_weight}%
//                       </div>
//                       <div className="text-xs text-gray-500">Weight</div>
//                     </div>
//                     <div className="rounded-lg bg-white p-3 text-center">
//                       <div className="text-lg font-bold text-primary-700">
//                         {stats.my_scorecard.final_score !== null ? `${stats.my_scorecard.final_score}%` : '—'}
//                       </div>
//                       <div className="text-xs text-gray-500">Score</div>
//                     </div>
//                     <div className="rounded-lg bg-white p-3 text-center">
//                       <div className="text-lg font-bold text-primary-700">
//                         {stats.my_scorecard.final_rating || '—'}
//                       </div>
//                       <div className="text-xs text-gray-500">Rating</div>
//                     </div>
//                   </div>
//                   <button
//                     onClick={() => navigate('/my-performance')}
//                     className="mt-3 flex items-center gap-1 text-sm text-primary-600 hover:underline"
//                   >
//                     View Details <ArrowRight className="h-3 w-3" />
//                   </button>
//                 </div>
//               )}

//               {/* Recent Notifications */}
//               {stats?.recent_notifications?.length > 0 && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
//                   <div className="mb-4 flex items-center justify-between">
//                     <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
//                       <Bell className="h-4 w-4" />
//                       Recent Notifications
//                       {stats.my_unread_notifications > 0 && (
//                         <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
//                           {stats.my_unread_notifications} new
//                         </span>
//                       )}
//                     </h3>
//                   </div>
//                   <div className="space-y-2">
//                     {stats.recent_notifications.map((n: any) => (
//                       <div
//                         key={n.id}
//                         className={`flex items-start gap-3 rounded-lg p-3 transition ${
//                           n.is_read ? 'hover:bg-gray-50' : 'bg-primary-50/50 hover:bg-primary-50'
//                         }`}
//                       >
//                         <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
//                           n.is_read ? 'bg-gray-100 text-gray-600' : 'bg-primary-600 text-white'
//                         }`}>
//                           <Bell className="h-4 w-4" />
//                         </div>
//                         <div className="flex-1">
//                           <p className="text-sm font-medium text-gray-900">{n.title}</p>
//                           <p className="text-xs text-gray-500">{n.message}</p>
//                           <p className="mt-1 text-xs text-gray-400">
//                             {new Date(n.created_at).toLocaleString('en-IN')}
//                           </p>
//                         </div>
//                         {!n.is_read && (
//                           <span className="h-2 w-2 rounded-full bg-primary-600" />
//                         )}
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}
//             </>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

// // ==============================================================================
// // COMPONENTS
// // ==============================================================================

// function StatCard({ label, value, subtext, subtextColor, icon: Icon, color }: any) {
//   const colorMap: any = {
//     blue: 'bg-blue-50 text-blue-600',
//     green: 'bg-green-50 text-green-600',
//     amber: 'bg-amber-50 text-amber-600',
//     red: 'bg-red-50 text-red-600',
//   };
//   return (
//     <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//       <div className="flex items-start justify-between">
//         <div>
//           <p className="text-sm text-gray-600">{label}</p>
//           <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
//           {subtext && (
//             <p className={`mt-1 text-xs font-medium ${subtextColor || 'text-gray-500'}`}>
//               {subtext}
//             </p>
//           )}
//         </div>
//         <div className={`rounded-lg p-2.5 ${colorMap[color] || 'bg-gray-50 text-gray-600'}`}>
//           <Icon className="h-5 w-5" />
//         </div>
//       </div>
//     </div>
//   );
// }

// function MiniStat({ label, value, color, highlight, onClick }: any) {
//   return (
//     <div
//       className={`rounded-xl p-3 ${color} ${highlight ? 'ring-2 ring-amber-400' : ''} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
//       onClick={onClick}
//     >
//       <div className="text-xl font-bold">{value}</div>
//       <div className="text-xs font-medium opacity-80">{label}</div>
//     </div>
//   );
// }

// function QuickAction({ icon: Icon, label, count, color, onClick }: any) {
//   return (
//     <button
//       onClick={onClick}
//       className={`flex items-center gap-3 rounded-xl p-4 text-left transition hover:shadow-md ${color}`}
//     >
//       <Icon className="h-6 w-6 flex-shrink-0" />
//       <div className="flex-1">
//         <div className="text-sm font-medium">{label}</div>
//         {count !== undefined && (
//           <div className="text-xs opacity-80">
//             {count > 0 ? `${count} pending` : 'All caught up'}
//           </div>
//         )}
//       </div>
//       <ArrowRight className="h-4 w-4 opacity-60" />
//     </button>
//   );
// }


import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Calendar, TrendingUp, Loader2, Bell,
  CheckSquare, Workflow, ClipboardCheck, Trophy, Award,
  FileText, Building2, Target, AlertCircle, ArrowRight,
  UserCheck, ChevronRight,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useAuth } from '../context/AuthContext';
import { dashboardApi } from '../api/performance';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi
      .getStats()
      .then(setStats)
      .catch(() => toast.error('Failed to load dashboard stats'))
      .finally(() => setLoading(false));
  }, []);

  const userRole = stats?.user_role || 'EMPLOYEE';
  const isHR = userRole === 'HR';
  const isManager = userRole === 'MANAGER';

  return (
    <div className="flex h-screen bg-gray-50" style={{ fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap');

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes waveHand {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(14deg); }
          40% { transform: rotate(-8deg); }
          60% { transform: rotate(14deg); }
        }
        @keyframes softFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hrms-dashboard * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="hrms-dashboard flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
          {/* Welcome Banner */}
          <div
            className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 text-white shadow-lg shadow-indigo-200 sm:p-8"
            style={{ animation: 'fadeInUp 0.5s ease-out both' }}
          >
            {/* decorative glow blobs */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" style={{ animation: 'softFloat 6s ease-in-out infinite' }} />
            <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl" style={{ animation: 'softFloat 7s ease-in-out infinite' }} />

            <div className="relative">
              <h1
                className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"
                style={{ fontFamily: "'Sora', 'Segoe UI', sans-serif" }}
              >
                Hello, {user?.employee?.first_name || user?.username}!
                <span className="inline-block origin-[70%_70%]" style={{ animation: 'waveHand 1.6s ease-in-out infinite' }}>
                  👋
                </span>
              </h1>
              <p className="mt-1.5 text-indigo-100">
                {isHR && "Here's a snapshot of the organization"}
                {isManager && "Here's your team's activity today"}
                {!isHR && !isManager && "Here's your personal dashboard"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {user?.role_codes?.map((role) => (
                  <span
                    key={role}
                    className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium tracking-wide backdrop-blur transition-colors duration-300 hover:bg-white/25"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
              <p className="text-sm text-gray-400">Loading your dashboard…</p>
            </div>
          ) : (
            <>
              {/* HR DASHBOARD */}
              {isHR && stats && (
                <>
                  {/* Main Stats */}
                  <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      label="Total Employees"
                      value={stats.total_employees}
                      subtext={`${stats.active_employees} active`}
                      icon={Users}
                      color="blue"
                      delay={0}
                    />
                    <StatCard
                      label="New Hires (Month)"
                      value={stats.new_hires_month}
                      subtext={
                        stats.new_hires_change >= 0
                          ? `+${stats.new_hires_change} vs last month`
                          : `${stats.new_hires_change} vs last month`
                      }
                      subtextColor={stats.new_hires_change >= 0 ? 'text-emerald-600' : 'text-red-600'}
                      icon={UserPlus}
                      color="green"
                      delay={80}
                    />
                    <StatCard
                      label="Attrition (Month)"
                      value={stats.attrition_count}
                      subtext={`${stats.attrition_rate}% rate`}
                      icon={TrendingUp}
                      color="red"
                      delay={160}
                    />
                    <StatCard
                      label="Doc Expiry Alerts"
                      value={stats.document_expiry_alerts}
                      subtext="Next 90 days"
                      icon={AlertCircle}
                      color="amber"
                      delay={240}
                    />
                  </div>

                  {/* Performance Overview */}
                  {stats.performance?.cycle_name && (
                    <div
                      className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-shadow duration-300 hover:shadow-md"
                      style={{ animation: 'fadeInUp 0.5s ease-out 0.1s both' }}
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                            <span>🎯</span> Active Performance Cycle
                          </h3>
                          <p className="text-sm text-gray-500">{stats.performance.cycle_name}</p>
                        </div>
                        <button
                          onClick={() => navigate('/performance-reports')}
                          className="group flex items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                        >
                          View Reports <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <MiniStat label="Total" value={stats.performance.total_scorecards} variant="indigo" />
                        <MiniStat label="In Progress" value={stats.performance.in_progress} variant="blue" />
                        <MiniStat
                          label="⚡ Awaiting Finalize"
                          value={stats.performance.awaiting_finalization}
                          variant="amber"
                          highlight={stats.performance.awaiting_finalization > 0}
                          onClick={() => navigate('/hr/calibration')}
                        />
                        <MiniStat label="Finalized" value={stats.performance.finalized} variant="green" />
                      </div>
                      {stats.performance.avg_score > 0 && (
                        <div className="mt-3 text-sm text-gray-600">
                          Company Average Score:{' '}
                          <span className="font-bold text-indigo-700">
                            {stats.performance.avg_score}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <QuickAction
                      icon={Workflow}
                      label="Lifecycle Requests"
                      count={stats.pending_lifecycle_requests}
                      variant="purple"
                      onClick={() => navigate('/lifecycle-requests')}
                      delay={0}
                    />
                    <QuickAction
                      icon={CheckSquare}
                      label="Performance Calibration"
                      variant="indigo"
                      onClick={() => navigate('/hr/calibration')}
                      delay={60}
                    />
                    <QuickAction
                      icon={Target}
                      label={`Active KRAs: ${stats.active_kra_count}`}
                      variant="teal"
                      onClick={() => navigate('/settings/kra-library')}
                      delay={120}
                    />
                    <QuickAction
                      icon={FileText}
                      label="Letter Templates"
                      variant="pink"
                      onClick={() => navigate('/settings/letter-templates')}
                      delay={180}
                    />
                  </div>

                  {/* Department Distribution + Recent Hires */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {stats.department_distribution?.length > 0 && (
                      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-shadow duration-300 hover:shadow-md">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                          <Building2 className="h-4 w-4 text-indigo-500" />
                          Department Distribution
                        </h3>
                        <div className="space-y-3">
                          {stats.department_distribution.map((d: any) => {
                            const maxCount = Math.max(
                              ...stats.department_distribution.map((x: any) => x.count)
                            );
                            const pct = (d.count / maxCount) * 100;
                            return (
                              <div key={d.structure_location__name || 'no-dept'}>
                                <div className="mb-1 flex items-center justify-between text-xs">
                                  <span className="font-medium text-gray-700">
                                    {d.structure_location__name || 'Unassigned'}
                                  </span>
                                  <span className="font-bold text-gray-900">{d.count}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700 ease-out"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {stats.recent_hires?.length > 0 && (
                      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-shadow duration-300 hover:shadow-md">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                          <UserPlus className="h-4 w-4 text-emerald-500" />
                          Recent Hires
                        </h3>
                        <div className="space-y-1">
                          {stats.recent_hires.map((h: any) => (
                            <div
                              key={h.id}
                              className="flex items-center gap-3 rounded-xl p-2 transition-all duration-200 hover:bg-indigo-50/60 hover:translate-x-0.5 cursor-pointer"
                              onClick={() => navigate(`/employees/${h.id}`)}
                            >
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-sm">
                                {`${h.first_name[0]}${h.last_name[0]}`.toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {h.first_name} {h.last_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {h.employee_id} • Joined {new Date(h.date_of_joining).toLocaleDateString('en-IN')}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-gray-300 transition-transform duration-200 group-hover:translate-x-1" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* MANAGER DASHBOARD */}
              {isManager && stats && (
                <>
                  <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      label="Team Size"
                      value={stats.team_size}
                      subtext={`${stats.team_active} active`}
                      icon={Users}
                      color="blue"
                      delay={0}
                    />
                    <StatCard
                      label="Pending Approvals"
                      value={stats.pending_approvals}
                      subtext="Lifecycle requests"
                      icon={CheckSquare}
                      color={stats.pending_approvals > 0 ? 'amber' : 'green'}
                      delay={80}
                    />
                    {stats.team_performance?.cycle_name && (
                      <>
                        <StatCard
                          label="Team Avg Score"
                          value={`${stats.team_performance.avg_score || 0}%`}
                          subtext={stats.team_performance.cycle_name}
                          icon={Trophy}
                          color="green"
                          delay={160}
                        />
                        <StatCard
                          label="Team Reviews Pending"
                          value={stats.team_performance.pending_review || 0}
                          subtext={`${stats.team_performance.approved || 0} approved`}
                          icon={UserCheck}
                          color={stats.team_performance.pending_review > 0 ? 'amber' : 'green'}
                          delay={240}
                        />
                      </>
                    )}
                  </div>

                  {stats.team_roster?.length > 0 && (
                    <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-shadow duration-300 hover:shadow-md">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          <Users className="h-4 w-4 text-indigo-500" />
                          My Team
                        </h3>
                        <button
                          onClick={() => navigate('/team-performance')}
                          className="group flex items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                        >
                          Team Performance <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {stats.team_roster.map((m: any) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-3 rounded-xl p-2 transition-all duration-200 hover:bg-indigo-50/60 hover:translate-x-0.5 cursor-pointer"
                            onClick={() => navigate(`/employees/${m.id}`)}
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-sm">
                              {`${m.first_name[0]}${m.last_name[0]}`.toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {m.first_name} {m.last_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {m.employee_id} • {m.position__title || '-'}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                m.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* EMPLOYEE PERSONAL SECTION (always shown) */}
              {stats?.my_scorecard && (
                <div
                  className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-fuchsia-50 p-6 ring-1 ring-indigo-100 transition-shadow duration-300 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                        <ClipboardCheck className="h-4 w-4 text-indigo-600" />
                        My Current Scorecard
                      </h3>
                      <p className="text-xs text-gray-500">{stats.my_scorecard.cycle_name}</p>
                    </div>
                    <span className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
                      {stats.my_scorecard.status_display}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-xl bg-white/80 p-3 text-center shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
                      <div className="text-lg font-bold text-indigo-700">
                        {stats.my_scorecard.kra_count}
                      </div>
                      <div className="text-xs text-gray-500">KRAs</div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 text-center shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
                      <div className="text-lg font-bold text-indigo-700">
                        {stats.my_scorecard.total_weight}%
                      </div>
                      <div className="text-xs text-gray-500">Weight</div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 text-center shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
                      <div className="text-lg font-bold text-indigo-700">
                        {stats.my_scorecard.final_score !== null ? `${stats.my_scorecard.final_score}%` : '—'}
                      </div>
                      <div className="text-xs text-gray-500">Score</div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 text-center shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
                      <div className="text-lg font-bold text-indigo-700">
                        {stats.my_scorecard.final_rating || '—'}
                      </div>
                      <div className="text-xs text-gray-500">Rating</div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/my-performance')}
                    className="group mt-3 flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    View Details <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </div>
              )}

              {/* Recent Notifications */}
              {stats?.recent_notifications?.length > 0 && (
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-shadow duration-300 hover:shadow-md">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Bell className="h-4 w-4 text-amber-500" />
                      Recent Notifications
                      {stats.my_unread_notifications > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                          {stats.my_unread_notifications} new
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {stats.recent_notifications.map((n: any) => (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 rounded-xl p-3 transition-all duration-200 ${
                          n.is_read ? 'hover:bg-gray-50' : 'bg-indigo-50/60 hover:bg-indigo-50'
                        }`}
                      >
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                          n.is_read ? 'bg-gray-100 text-gray-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm'
                        }`}>
                          <Bell className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-500">{n.message}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(n.created_at).toLocaleString('en-IN')}
                          </p>
                        </div>
                        {!n.is_read && (
                          <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
        <Footer />
      </div>
    </div>
    
  );
}

// ==============================================================================
// COMPONENTS
// ==============================================================================

function StatCard({ label, value, subtext, subtextColor, icon: Icon, color, delay = 0 }: any) {
  const colorMap: any = {
    blue: {
      card: 'from-blue-50 to-white ring-blue-100',
      badge: 'from-blue-500 to-cyan-500',
    },
    green: {
      card: 'from-emerald-50 to-white ring-emerald-100',
      badge: 'from-emerald-500 to-teal-500',
    },
    amber: {
      card: 'from-amber-50 to-white ring-amber-100',
      badge: 'from-amber-500 to-orange-500',
    },
    red: {
      card: 'from-rose-50 to-white ring-rose-100',
      badge: 'from-rose-500 to-red-500',
    },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div
      className={`group rounded-2xl bg-gradient-to-br p-5 shadow-sm ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${c.card}`}
      style={{ animation: `fadeInUp 0.5s ease-out ${delay}ms both` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {subtext && (
            <p className={`mt-1 text-xs font-medium ${subtextColor || 'text-gray-500'}`}>
              {subtext}
            </p>
          )}
        </div>
        <div
          className={`rounded-xl bg-gradient-to-br p-2.5 text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${c.badge}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, variant, highlight, onClick }: any) {
  const variantMap: any = {
    indigo: 'bg-indigo-50 text-indigo-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div
      className={`rounded-xl p-3 transition-all duration-200 ${variantMap[variant] || variantMap.indigo} ${
        highlight ? 'ring-2 ring-amber-400' : ''
      } ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs font-medium opacity-80">{label}</div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, count, variant, onClick, delay = 0 }: any) {
  const variantMap: any = {
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    indigo: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    teal: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
    pink: 'bg-pink-50 text-pink-700 hover:bg-pink-100',
  };
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-xl p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${variantMap[variant] || variantMap.indigo}`}
      style={{ animation: `fadeInUp 0.5s ease-out ${delay}ms both` }}
    >
      <Icon className="h-6 w-6 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        {count !== undefined && (
          <div className="text-xs opacity-80">
            {count > 0 ? `${count} pending` : 'All caught up'}
          </div>
        )}
      </div>
      <ArrowRight className="h-4 w-4 opacity-60 transition-transform duration-300 group-hover:translate-x-1" />
    </button>
  );
}
