// import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import {
//   ChevronLeft, ChevronRight, Loader2, Users, TrendingDown,
//   Calendar as CalIcon, ChevronRight as ArrowRight, Search,
//   Building2, Filter, Download,
// } from 'lucide-react';
// import toast from 'react-hot-toast';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { personalAttendanceApi } from '../../api/attendance';
// import { structuresApi } from '../../api/masterData';
// import type { AllEmployeesAttendanceData } from '../../types/attendance';

// export default function AllEmployeesAttendancePage() {
//   const navigate = useNavigate();
//   const today = new Date();
//   const [year, setYear] = useState(today.getFullYear());
//   const [month, setMonth] = useState(today.getMonth() + 1);
//   const [data, setData] = useState<AllEmployeesAttendanceData | null>(null);
//   const [departments, setDepartments] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   // Filters
//   const [searchQuery, setSearchQuery] = useState('');
//   const [debouncedSearch, setDebouncedSearch] = useState('');
//   const [selectedDept, setSelectedDept] = useState('');

//   // Debounce search
//   useEffect(() => {
//     const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
//     return () => clearTimeout(timer);
//   }, [searchQuery]);

//   // Load departments once
//   useEffect(() => {
//     loadDepartments();
//   }, []);

//   // Reload when filters or month changes
//   useEffect(() => {
//     loadData();
//   }, [year, month, debouncedSearch, selectedDept]);

//   const loadDepartments = async () => {
//     try {
//       const res = await structuresApi.list({ type: 'DEPARTMENT' });
//       setDepartments(Array.isArray(res) ? res : res?.results || []);
//     } catch {
//       // silent fail
//     }
//   };

//   const loadData = async () => {
//     setLoading(true);
//     try {
//       const res = await personalAttendanceApi.getAllEmployees(year, month, {
//         department_id: selectedDept || undefined,
//         search: debouncedSearch || undefined,
//       });
//       setData(res);
//     } catch (error: any) {
//       toast.error(error?.response?.data?.detail || 'Failed to load data');
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
//   };

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6 flex items-center gap-3">
//             <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
//               <Users className="h-5 w-5" />
//             </div>
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900">All Employees Attendance</h1>
//               <p className="mt-0.5 text-sm text-gray-500">
//                 Company-wide monthly attendance overview
//               </p>
//             </div>
//           </div>

//           {/* Month Navigation */}
//           <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
//             <button
//               onClick={() => navigateMonth(-1)}
//               className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
//             >
//               <ChevronLeft className="h-5 w-5" />
//             </button>
//             <h2 className="text-lg font-bold text-gray-900">
//               {data?.month_label || `${today.toLocaleString('en-US', { month: 'long' })} ${year}`}
//             </h2>
//             <button
//               onClick={() => navigateMonth(1)}
//               className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
//             >
//               <ChevronRight className="h-5 w-5" />
//             </button>
//           </div>

//           {/* Filters */}
//           <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
//             <div className="relative flex-1 min-w-[240px]">
//               <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
//               <input
//                 type="text"
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 placeholder="Search by employee ID or name..."
//                 className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
//               />
//             </div>
//             <div className="flex items-center gap-2">
//               <Building2 className="h-4 w-4 text-gray-400" />
//               <select
//                 value={selectedDept}
//                 onChange={(e) => setSelectedDept(e.target.value)}
//                 className="rounded-lg border border-gray-300 py-2 px-3 text-sm outline-none focus:border-blue-500"
//               >
//                 <option value="">All Departments</option>
//                 {departments.map((d: any) => (
//                   <option key={d.id} value={d.id}>{d.name}</option>
//                 ))}
//               </select>
//             </div>
//             {(searchQuery || selectedDept) && (
//               <button
//                 onClick={() => {
//                   setSearchQuery('');
//                   setSelectedDept('');
//                 }}
//                 className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
//               >
//                 Clear Filters
//               </button>
//             )}
//           </div>

//           {loading || !data ? (
//             <div className="flex items-center justify-center py-16">
//               <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
//             </div>
//           ) : (
//             <>
//               {/* Company Stats */}
//               <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
//                 <StatCard
//                   label="Total Employees"
//                   value={String(data.total_employees)}
//                   helper="Active in company"
//                   icon={Users}
//                   color="blue"
//                 />
//                 <StatCard
//                   label="Avg Attendance"
//                   value={`${data.avg_attendance}%`}
//                   helper="Company-wide average"
//                   icon={CalIcon}
//                   color={data.avg_attendance >= 85 ? 'green' : 'amber'}
//                 />
//                 <StatCard
//                   label="Total Shortage"
//                   value={`${data.total_shortage}h`}
//                   helper="Combined hours"
//                   icon={TrendingDown}
//                   color={data.total_shortage > 0 ? 'red' : 'green'}
//                 />
//                 <StatCard label="Total On Leave" value={String(data.total_on_leave)} helper="Combined leave days" icon={CalIcon} color="cyan" />
//               </div>

//               {/* Department Breakdown */}
//               {data.departments.length > 0 && (
//                 <div className="mb-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                   <h3 className="mb-3 text-sm font-semibold text-gray-900">
//                     Department Breakdown
//                   </h3>
//                   <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
//                     {data.departments.map((dept) => (
//                       <div
//                         key={dept.name}
//                         className="rounded-lg border border-gray-100 bg-gray-50 p-3"
//                       >
//                         <div className="flex items-center justify-between">
//                           <p className="text-sm font-semibold text-gray-900">
//                             {dept.name}
//                           </p>
//                           <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600">
//                             {dept.employee_count}
//                           </span>
//                         </div>
//                         <div className="mt-2 flex items-center justify-between text-xs">
//                           <span className="text-gray-600">
//                             Avg: <strong className={
//                               dept.avg_attendance >= 85 ? 'text-green-700' :
//                               dept.avg_attendance >= 75 ? 'text-amber-700' :
//                               'text-red-700'
//                             }>{dept.avg_attendance}%</strong>
//                           </span>
//                           {dept.total_shortage > 0 && (
//                             <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">
//                               -{dept.total_shortage}h
//                             </span>
//                           )}
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}

//               {/* Employees Table */}
//               <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
//                 <div className="flex items-center justify-between border-b border-gray-100 p-4">
//                   <h3 className="font-semibold text-gray-900">
//                     Employees ({data.employees.length})
//                   </h3>
//                 </div>

//                 {data.employees.length === 0 ? (
//                   <div className="p-12 text-center">
//                     <Users className="mx-auto h-12 w-12 text-gray-300" />
//                     <p className="mt-3 text-sm text-gray-500">
//                       No employees found matching filters
//                     </p>
//                   </div>
//                 ) : (
//                   <div className="overflow-x-auto">
//                     <table className="w-full text-sm">
//                       <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
//                         <tr>
//                           <th className="px-4 py-3">Employee</th>
//                           <th className="px-4 py-3">Department</th>
//                           <th className="px-4 py-3">Manager</th>
//                           <th className="px-4 py-3 text-center">Present</th>
//                           <th className="px-4 py-3 text-center">Absent</th>
//                           <th className="px-4 py-3 text-center">Missing</th>
//                           <th className="px-4 py-3 text-center">On Leave</th> 
//                           <th className="px-4 py-3 text-center">Worked</th>
//                           <th className="px-4 py-3 text-center">Shortage</th>
//                           <th className="px-4 py-3 text-center">%</th>
//                           <th className="px-4 py-3"></th>
//                         </tr>
//                       </thead>
//                       <tbody className="divide-y divide-gray-100">
//                         {data.employees.map((member) => (
//                           <tr
//                             key={member.employee.id}
//                             onClick={() =>
//                               navigate(
//                                 `/all-attendance/${member.employee.id}?year=${year}&month=${month}`
//                               )
//                             }
//                             className="cursor-pointer hover:bg-gray-50"
//                           >
//                             <td className="px-4 py-3">
//                               <div className="font-medium text-gray-900">
//                                 {member.employee.full_name}
//                               </div>
//                               <div className="text-xs text-gray-500">
//                                 {member.employee.employee_id}
//                               </div>
//                             </td>
//                             <td className="px-4 py-3 text-gray-600">
//                               {member.employee.department || '—'}
//                             </td>
//                             <td className="px-4 py-3 text-gray-600 text-xs">
//                               {member.manager_name || '—'}
//                             </td>
//                             <td className="px-4 py-3 text-center font-semibold text-green-700">
//                               {member.stats.present_days}
//                             </td>
//                             <td className="px-4 py-3 text-center font-semibold text-red-700">
//                               {member.stats.absent_days}
//                             </td>
//                             <td className="px-4 py-3 text-center font-semibold text-amber-700">
//                               {member.stats.missing_punch_days}
//                             </td>
//                             <td className="px-4 py-3 text-center font-semibold text-cyan-700">
//   {member.stats.on_leave_days}
//   {member.stats.on_half_leave_days > 0 && (
//     <span className="text-xs text-teal-600 ml-1">
//       (+{member.stats.on_half_leave_days} half)
//     </span>
//   )}
// </td>
//                             <td className="px-4 py-3 text-center text-gray-700">
//                               {member.stats.total_worked_hours}
//                             </td>
//                             <td className="px-4 py-3 text-center">
//                               {member.stats.shortage_hours > 0 ? (
//                                 <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
//                                   {member.stats.shortage_hours}h
//                                 </span>
//                               ) : (
//                                 <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
//                                   ✓
//                                 </span>
//                               )}
//                             </td>
//                             <td className="px-4 py-3 text-center">
//                               <span
//                                 className={`font-bold ${
//                                   member.stats.attendance_percent >= 90
//                                     ? 'text-green-700'
//                                     : member.stats.attendance_percent >= 75
//                                     ? 'text-amber-700'
//                                     : 'text-red-700'
//                                 }`}
//                               >
//                                 {member.stats.attendance_percent}%
//                               </span>
//                             </td>
//                             <td className="px-4 py-3">
//                               <ArrowRight className="h-4 w-4 text-gray-400" />
//                             </td>
//                           </tr>
//                         ))}
//                       </tbody>
//                     </table>
//                   </div>
//                 )}
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
//     cyan: 'bg-cyan-100 text-cyan-700',
//   };
//   return (
//     <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//       <div className="flex items-start justify-between">
//         <div>
//           <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
//           <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
//           <p className="mt-1 text-xs text-gray-400">{helper}</p>
//         </div>
//         <div
//           className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}
//         >
//           <Icon className="h-5 w-5" />
//         </div>
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Loader2, Users, TrendingDown,
  Calendar as CalIcon, ChevronRight as ArrowRight, Search,
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { personalAttendanceApi } from '../../api/attendance';
import { structuresApi } from '../../api/masterData';
import type { AllEmployeesAttendanceData } from '../../types/attendance';

export default function AllEmployeesAttendancePage() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<AllEmployeesAttendanceData | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load departments once
  useEffect(() => {
    loadDepartments();
  }, []);

  // Reload when filters or month changes
  useEffect(() => {
    loadData();
  }, [year, month, debouncedSearch, selectedDept]);

  const loadDepartments = async () => {
    try {
      const res = await structuresApi.list({ type: 'DEPARTMENT' });
      setDepartments(Array.isArray(res) ? res : res?.results || []);
    } catch {
      // silent fail
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await personalAttendanceApi.getAllEmployees(year, month, {
        department_id: selectedDept || undefined,
        search: debouncedSearch || undefined,
      });
      setData(res);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to load data');
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

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">All Employees Attendance</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Company-wide monthly attendance overview
              </p>
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
              {data?.month_label || `${today.toLocaleString('en-US', { month: 'long' })} ${year}`}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by employee ID or name..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="rounded-lg border border-gray-300 py-2 px-3 text-sm outline-none focus:border-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            {(searchQuery || selectedDept) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDept('');
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Clear Filters
              </button>
            )}
          </div>

          {loading || !data ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Company Stats — Now 4 cards including "Total On Leave" */}
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Employees"
                  value={String(data.total_employees)}
                  helper="Active in company"
                  icon={Users}
                  color="blue"
                />
                <StatCard
                  label="Avg Attendance"
                  value={`${data.avg_attendance}%`}
                  helper="Company-wide average"
                  icon={CalIcon}
                  color={data.avg_attendance >= 85 ? 'green' : 'amber'}
                />
                <StatCard
                  label="Total Shortage"
                  value={`${data.total_shortage}h`}
                  helper="Combined hours"
                  icon={TrendingDown}
                  color={data.total_shortage > 0 ? 'red' : 'green'}
                />
                <StatCard
                  label="Total On Leave"
                  value={String(data.total_on_leave)}
                  helper="Combined leave days"
                  icon={CalIcon}
                  color="cyan"
                />
              </div>

              {/* Department Breakdown */}
              {data.departments.length > 0 && (
                <div className="mb-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">
                    Department Breakdown
                  </h3>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {data.departments.map((dept) => (
                      <div
                        key={dept.name}
                        className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900">
                            {dept.name}
                          </p>
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600">
                            {dept.employee_count}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-gray-600">
                            Avg:{' '}
                            <strong
                              className={
                                dept.avg_attendance >= 85
                                  ? 'text-green-700'
                                  : dept.avg_attendance >= 75
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                              }
                            >
                              {dept.avg_attendance}%
                            </strong>
                          </span>
                          {dept.total_shortage > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">
                              -{dept.total_shortage}h
                            </span>
                          )}
                          {dept.total_on_leave > 0 && (
                            <span className="rounded-full bg-cyan-100 px-2 py-0.5 font-semibold text-cyan-700">
                              {dept.total_on_leave} leave
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Employees Table */}
              <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <div className="flex items-center justify-between border-b border-gray-100 p-4">
                  <h3 className="font-semibold text-gray-900">
                    Employees ({data.employees.length})
                  </h3>
                </div>

                {data.employees.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-3 text-sm text-gray-500">
                      No employees found matching filters
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Employee</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3">Manager</th>
                          <th className="px-4 py-3 text-center">Present</th>
                          <th className="px-4 py-3 text-center">Absent</th>
                          <th className="px-4 py-3 text-center">Missing</th>
                          <th className="px-4 py-3 text-center">On Leave</th>
                          <th className="px-4 py-3 text-center">Worked</th>
                          <th className="px-4 py-3 text-center">Shortage</th>
                          <th className="px-4 py-3 text-center">%</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.employees.map((member) => (
                          <tr
                            key={member.employee.id}
                            onClick={() =>
                              navigate(
                                `/all-attendance/${member.employee.id}?year=${year}&month=${month}`
                              )
                            }
                            className="cursor-pointer hover:bg-gray-50"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                {member.employee.full_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {member.employee.employee_id}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {member.employee.department || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {member.manager_name || '—'}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-green-700">
                              {member.stats.present_days}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-red-700">
                              {member.stats.absent_days}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-amber-700">
                              {member.stats.missing_punch_days}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center">
                                <span className="font-semibold text-cyan-700">
                                  {member.stats.on_leave_days}
                                </span>
                                {member.stats.on_half_leave_days > 0 && (
                                  <span className="text-[10px] text-teal-600">
                                    +{member.stats.on_half_leave_days} half
                                  </span>
                                )}
                                {member.stats.lop_days > 0 && (
                                  <span className="mt-0.5 rounded-full bg-red-100 px-1.5 py-0 text-[9px] font-semibold text-red-700">
                                    {member.stats.lop_days} LOP
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {member.stats.total_worked_hours}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {member.stats.shortage_hours > 0 ? (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                  {member.stats.shortage_hours}h
                                </span>
                              ) : (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                  ✓
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`font-bold ${
                                  member.stats.attendance_percent >= 90
                                    ? 'text-green-700'
                                    : member.stats.attendance_percent >= 75
                                    ? 'text-amber-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {member.stats.attendance_percent}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <ArrowRight className="h-4 w-4 text-gray-400" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// STAT CARD COMPONENT
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
  color: 'blue' | 'green' | 'red' | 'amber' | 'cyan';
}) {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    cyan: 'bg-cyan-100 text-cyan-700',
  };
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-400">{helper}</p>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}