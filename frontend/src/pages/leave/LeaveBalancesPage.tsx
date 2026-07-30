// import { useEffect, useState } from 'react';
// import {
//   Users, Loader2, PlayCircle, CheckCircle2, AlertCircle,
//   RefreshCw, Search, Calendar, Building2,
// } from 'lucide-react';
// import toast from 'react-hot-toast';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { leaveBalancesApi } from '../../api/leave';
// import type { LeaveBalance, AllocateAllResult } from '../../types/leave';

// interface GroupedBalances {
//   employeeCode: string;
//   employeeName: string;
//   employeeDepartment: string | null;
//   employeeId: string;
//   balances: LeaveBalance[];
// }

// export default function LeaveBalancesPage() {
//   const [balances, setBalances] = useState<LeaveBalance[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [allocating, setAllocating] = useState(false);
//   const [search, setSearch] = useState('');
//   const [year, setYear] = useState(new Date().getFullYear());
//   const [lastResult, setLastResult] = useState<AllocateAllResult | null>(null);

//   useEffect(() => {
//     loadBalances();
//   }, [year]);

//   const loadBalances = async () => {
//     setLoading(true);
//     try {
//       const data = await leaveBalancesApi.list({ year });
//       setBalances(data);
//     } catch (error) {
//       toast.error('Failed to load leave balances');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleAllocateAll = async () => {
//     if (!window.confirm(
//       `Allocate leave balances for ALL active employees for ${year}?\n\n` +
//       `This will:\n` +
//       `• Create balance records for employees without them\n` +
//       `• Skip employees who already have balances\n` +
//       `• Prorate quotas based on join dates\n\n` +
//       `Continue?`
//     )) return;

//     setAllocating(true);
//     setLastResult(null);
//     try {
//       const result = await leaveBalancesApi.allocateAll(year);
//       setLastResult(result);
//       toast.success(result.message);
//       await loadBalances();
//     } catch (error: any) {
//       toast.error(error?.response?.data?.detail || 'Allocation failed');
//     } finally {
//       setAllocating(false);
//     }
//   };

//   // Group balances by employee
//   const groupedByEmployee: GroupedBalances[] = Object.values(
//     balances.reduce((acc, balance) => {
//       const empId = balance.employee;
//       if (!acc[empId]) {
//         acc[empId] = {
//           employeeCode: balance.employee_code,
//           employeeName: balance.employee_name,
//           employeeDepartment: balance.employee_department,
//           employeeId: balance.employee,
//           balances: [],
//         };
//       }
//       acc[empId].balances.push(balance);
//       return acc;
//     }, {} as Record<string, GroupedBalances>)
//   );

//   // Sort by employee code
//   groupedByEmployee.sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));

//   // Filter by search
//   const filteredEmployees = groupedByEmployee.filter((group) => {
//     if (!search) return true;
//     const s = search.toLowerCase();
//     return (
//       group.employeeCode.toLowerCase().includes(s) ||
//       group.employeeName.toLowerCase().includes(s) ||
//       (group.employeeDepartment || '').toLowerCase().includes(s)
//     );
//   });

//   const totalEmployees = groupedByEmployee.length;

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6 flex items-center justify-between">
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900">Leave Balances</h1>
//               <p className="mt-1 text-sm text-gray-600">
//                 {totalEmployees} employee{totalEmployees !== 1 ? 's' : ''} • {balances.length} balance record{balances.length !== 1 ? 's' : ''} • Year {year}
//               </p>
//             </div>
//             <div className="flex gap-3">
//               <select
//                 value={year}
//                 onChange={(e) => setYear(Number(e.target.value))}
//                 className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
//               >
//                 {[year - 1, year, year + 1].map((y) => (
//                   <option key={y} value={y}>{y}</option>
//                 ))}
//               </select>
//               <button
//                 onClick={loadBalances}
//                 disabled={loading}
//                 className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
//               >
//                 <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
//                 Refresh
//               </button>
//               <button
//                 onClick={handleAllocateAll}
//                 disabled={allocating}
//                 className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
//               >
//                 {allocating ? (
//                   <>
//                     <Loader2 className="h-4 w-4 animate-spin" />
//                     Allocating...
//                   </>
//                 ) : (
//                   <>
//                     <PlayCircle className="h-4 w-4" />
//                     Allocate Balances
//                   </>
//                 )}
//               </button>
//             </div>
//           </div>

//           {/* Allocation Result Banner */}
//           {lastResult && (
//             <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
//               <div className="flex items-start gap-3">
//                 <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
//                 <div className="flex-1">
//                   <h3 className="font-semibold text-green-900">Allocation Complete</h3>
//                   <p className="mt-1 text-sm text-green-700">{lastResult.message}</p>
//                   <div className="mt-2 grid grid-cols-4 gap-3 text-center">
//                     <div className="rounded-lg bg-white p-2">
//                       <div className="text-lg font-bold text-blue-600">
//                         {lastResult.total_employees}
//                       </div>
//                       <div className="text-xs text-gray-600">Total Employees</div>
//                     </div>
//                     <div className="rounded-lg bg-white p-2">
//                       <div className="text-lg font-bold text-green-600">
//                         {lastResult.newly_allocated}
//                       </div>
//                       <div className="text-xs text-gray-600">Newly Allocated</div>
//                     </div>
//                     <div className="rounded-lg bg-white p-2">
//                       <div className="text-lg font-bold text-amber-600">
//                         {lastResult.skipped_existing}
//                       </div>
//                       <div className="text-xs text-gray-600">Already Had</div>
//                     </div>
//                     <div className="rounded-lg bg-white p-2">
//                       <div className="text-lg font-bold text-red-600">
//                         {lastResult.errors.length}
//                       </div>
//                       <div className="text-xs text-gray-600">Errors</div>
//                     </div>
//                   </div>

//                   {lastResult.errors.length > 0 && (
//                     <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">
//                       <strong>Errors:</strong>
//                       <ul className="mt-1 space-y-1">
//                         {lastResult.errors.map((err, idx) => (
//                           <li key={idx}>• {err.employee_id}: {err.error}</li>
//                         ))}
//                       </ul>
//                     </div>
//                   )}

//                   <button
//                     onClick={() => setLastResult(null)}
//                     className="mt-2 text-xs font-semibold text-green-700 hover:text-green-900"
//                   >
//                     Dismiss
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Empty State */}
//           {!loading && balances.length === 0 && (
//             <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
//               <AlertCircle className="mx-auto h-12 w-12 text-blue-500" />
//               <h3 className="mt-3 text-lg font-semibold text-blue-900">
//                 No Leave Balances Yet
//               </h3>
//               <p className="mt-2 text-sm text-blue-700">
//                 Employees don't have leave balances for {year} yet.
//                 Click <strong>"Allocate Balances"</strong> above to create them.
//               </p>
//               <p className="mt-2 text-xs text-blue-600">
//                 💡 Make sure Leave Types are configured first (Leave → Leave Types)
//               </p>
//             </div>
//           )}

//           {/* Search */}
//           {balances.length > 0 && (
//             <div className="mb-4 relative">
//               <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
//               <input
//                 type="text"
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//                 placeholder="Search by employee code, name, or department..."
//                 className="w-full max-w-md rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//               />
//               {search && (
//                 <p className="mt-1 text-xs text-gray-500">
//                   Showing {filteredEmployees.length} of {totalEmployees} employees
//                 </p>
//               )}
//             </div>
//           )}

//           {/* Loading */}
//           {loading ? (
//             <div className="flex items-center justify-center py-16">
//               <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//             </div>
//           ) : filteredEmployees.length > 0 ? (
//             /* Employee Cards */
//             <div className="space-y-4">
//               {filteredEmployees.map((group) => (
//                 <div
//                   key={group.employeeId}
//                   className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100"
//                 >
//                   {/* Employee Header */}
//                   <div className="flex items-center gap-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white px-5 py-3">
//                     <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
//                       {group.employeeName
//                         .split(' ')
//                         .map((n) => n[0])
//                         .join('')
//                         .slice(0, 2)
//                         .toUpperCase()}
//                     </div>
//                     <div className="flex-1">
//                       <div className="flex items-center gap-2">
//                         <span className="text-sm font-mono text-gray-500">{group.employeeCode}</span>
//                         <span className="text-gray-300">•</span>
//                         <h3 className="font-semibold text-gray-900">{group.employeeName}</h3>
//                       </div>
//                       {group.employeeDepartment && (
//                         <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
//                           <Building2 className="h-3 w-3" />
//                           {group.employeeDepartment}
//                         </div>
//                       )}
//                     </div>
//                   </div>

//                   {/* Balances Table */}
//                   <table className="w-full text-sm">
//                     <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
//                       <tr>
//                         <th className="px-5 py-2">Leave Type</th>
//                         <th className="px-4 py-2 text-center">Allocated</th>
//                         <th className="px-4 py-2 text-center">Accrued</th>
//                         <th className="px-4 py-2 text-center">Used</th>
//                         <th className="px-4 py-2 text-center">Pending</th>
//                         <th className="px-4 py-2 text-center">Available</th>
//                       </tr>
//                     </thead>
//                     <tbody className="divide-y divide-gray-100">
//                       {group.balances.map((balance) => (
//                         <tr key={balance.id} className="hover:bg-gray-50">
//                           <td className="px-5 py-2.5">
//                             <div className="flex items-center gap-2">
//                               <span
//                                 className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold text-white"
//                                 style={{ backgroundColor: balance.leave_type.color_code }}
//                               >
//                                 {balance.leave_type.code}
//                               </span>
//                               <span className="text-gray-700">{balance.leave_type.name}</span>
//                             </div>
//                           </td>
//                           <td className="px-4 py-2.5 text-center text-gray-600">
//                             {balance.allocated}
//                           </td>
//                           <td className="px-4 py-2.5 text-center text-gray-600">
//                             {balance.accrued_till_date}
//                           </td>
//                           <td className="px-4 py-2.5 text-center font-semibold text-red-600">
//                             {balance.used}
//                           </td>
//                           <td className="px-4 py-2.5 text-center text-amber-600">
//                             {balance.pending}
//                           </td>
//                           <td className="px-4 py-2.5 text-center font-bold text-green-600">
//                             {balance.available}
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               ))}
//             </div>
//           ) : search ? (
//             /* No search results */
//             <div className="rounded-xl bg-white p-16 text-center shadow-sm ring-1 ring-gray-100">
//               <Search className="mx-auto h-12 w-12 text-gray-300" />
//               <p className="mt-3 text-gray-500">No employees match "{search}"</p>
//               <button
//                 onClick={() => setSearch('')}
//                 className="mt-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
//               >
//                 Clear search
//               </button>
//             </div>
//           ) : null}
//         </main>
//       </div>
//     </div>
//   );
// }



import { useEffect, useState, useMemo } from 'react';
import {
  Loader2, PlayCircle, CheckCircle2, AlertCircle,
  RefreshCw, Search, Building2, Users, TrendingUp, TrendingDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { leaveBalancesApi } from '../../api/leave';
import type { LeaveBalance, AllocateAllResult } from '../../types/leave';

interface LeaveTypeInfo {
  id: string;
  code: string;
  name: string;
  color_code: string;
}

interface EmployeeRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeDepartment: string | null;
  balancesByTypeId: Record<string, LeaveBalance>;
  totalAvailable: number;
  totalUsed: number;
  totalPending: number;
}

export default function LeaveBalancesPage() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [lastResult, setLastResult] = useState<AllocateAllResult | null>(null);
  const [viewMode, setViewMode] = useState<'available' | 'detailed'>('available');

  useEffect(() => {
    loadBalances();
  }, [year]);

  const loadBalances = async () => {
    setLoading(true);
    try {
      const data = await leaveBalancesApi.list({ year });
      setBalances(data);
    } catch (error) {
      toast.error('Failed to load leave balances');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateAll = async () => {
    if (!window.confirm(
      `Allocate leave balances for ALL active employees for ${year}?\n\n` +
      `This will:\n` +
      `• Create balance records for employees without them\n` +
      `• Skip employees who already have balances\n` +
      `• Prorate quotas based on join dates\n\n` +
      `Continue?`
    )) return;

    setAllocating(true);
    setLastResult(null);
    try {
      const result = await leaveBalancesApi.allocateAll(year);
      setLastResult(result);
      toast.success(result.message);
      await loadBalances();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Allocation failed');
    } finally {
      setAllocating(false);
    }
  };

  // 🔥 Extract unique leave types (columns) — sorted by display order
  const leaveTypes: LeaveTypeInfo[] = useMemo(() => {
    const seen = new Map<string, LeaveTypeInfo>();
    balances.forEach((bal) => {
      if (!seen.has(bal.leave_type.id)) {
        seen.set(bal.leave_type.id, {
          id: bal.leave_type.id,
          code: bal.leave_type.code,
          name: bal.leave_type.name,
          color_code: bal.leave_type.color_code,
        });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [balances]);

  // 🔥 Group balances by employee → row structure
  const employeeRows: EmployeeRow[] = useMemo(() => {
    const map = new Map<string, EmployeeRow>();

    balances.forEach((bal) => {
      const empId = bal.employee;
      if (!map.has(empId)) {
        map.set(empId, {
          employeeId: empId,
          employeeCode: bal.employee_code,
          employeeName: bal.employee_name,
          employeeDepartment: bal.employee_department,
          balancesByTypeId: {},
          totalAvailable: 0,
          totalUsed: 0,
          totalPending: 0,
        });
      }
      const row = map.get(empId)!;
      row.balancesByTypeId[bal.leave_type.id] = bal;
      row.totalAvailable += Number(bal.available);
      row.totalUsed += Number(bal.used);
      row.totalPending += Number(bal.pending);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.employeeCode.localeCompare(b.employeeCode)
    );
  }, [balances]);

  // Filter by search
  const filteredRows = useMemo(() => {
    if (!search) return employeeRows;
    const s = search.toLowerCase();
    return employeeRows.filter(
      (row) =>
        row.employeeCode.toLowerCase().includes(s) ||
        row.employeeName.toLowerCase().includes(s) ||
        (row.employeeDepartment || '').toLowerCase().includes(s)
    );
  }, [employeeRows, search]);

  const totalEmployees = employeeRows.length;
  const totalAvailable = employeeRows.reduce((sum, r) => sum + r.totalAvailable, 0);
  const totalUsed = employeeRows.reduce((sum, r) => sum + r.totalUsed, 0);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leave Balances</h1>
              <p className="mt-1 text-sm text-gray-600">
                {totalEmployees} employee{totalEmployees !== 1 ? 's' : ''} • {leaveTypes.length} leave type{leaveTypes.length !== 1 ? 's' : ''} • Year {year}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
              >
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={loadBalances}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleAllocateAll}
                disabled={allocating}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {allocating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Allocating...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    Allocate Balances
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {balances.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <SummaryCard
                label="Employees"
                value={totalEmployees}
                icon={Users}
                color="blue"
              />
              <SummaryCard
                label="Leave Types"
                value={leaveTypes.length}
                icon={CheckCircle2}
                color="purple"
              />
              <SummaryCard
                label="Total Available"
                value={totalAvailable.toFixed(1)}
                icon={TrendingUp}
                color="green"
                suffix="days"
              />
              <SummaryCard
                label="Total Used"
                value={totalUsed.toFixed(1)}
                icon={TrendingDown}
                color="red"
                suffix="days"
              />
            </div>
          )}

          {/* Allocation Result Banner */}
          {lastResult && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900">Allocation Complete</h3>
                  <p className="mt-1 text-sm text-green-700">{lastResult.message}</p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                    <MiniResult label="Total" value={lastResult.total_employees} color="blue" />
                    <MiniResult label="Allocated" value={lastResult.newly_allocated} color="green" />
                    <MiniResult label="Skipped" value={lastResult.skipped_existing} color="amber" />
                    <MiniResult label="Errors" value={lastResult.errors.length} color="red" />
                  </div>
                  {lastResult.errors.length > 0 && (
                    <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">
                      <strong>Errors:</strong>
                      <ul className="mt-1 space-y-1">
                        {lastResult.errors.map((err, idx) => (
                          <li key={idx}>• {err.employee_id}: {err.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={() => setLastResult(null)}
                    className="mt-2 text-xs font-semibold text-green-700 hover:text-green-900"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && balances.length === 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-8 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-blue-500" />
              <h3 className="mt-3 text-lg font-semibold text-blue-900">
                No Leave Balances Yet
              </h3>
              <p className="mt-2 text-sm text-blue-700">
                Employees don't have leave balances for {year} yet.
                Click <strong>"Allocate Balances"</strong> above to create them.
              </p>
              <p className="mt-2 text-xs text-blue-600">
                💡 Make sure Leave Types are configured first (Leave → Leave Types)
              </p>
            </div>
          )}

          {/* Filters Bar */}
          {balances.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by employee code, name, or department..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100"
                />
              </div>

              {/* View mode toggle */}
              <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-1">
                <button
                  onClick={() => setViewMode('available')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === 'available'
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Available Only
                </button>
                <button
                  onClick={() => setViewMode('detailed')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === 'detailed'
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Detailed View
                </button>
              </div>

              {search && (
                <span className="text-xs text-gray-500">
                  {filteredRows.length} of {totalEmployees}
                </span>
              )}
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filteredRows.length > 0 ? (
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    {/* Leave Type Codes Row */}
                    <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                      <th
                        className="sticky left-0 z-10 bg-gradient-to-r from-blue-50 to-blue-50 px-4 py-3 text-left text-xs font-bold uppercase text-gray-700"
                        style={{ minWidth: '260px' }}
                      >
                        Employee
                      </th>
                      {leaveTypes.map((lt) => (
                        <th
                          key={lt.id}
                          colSpan={viewMode === 'detailed' ? 3 : 1}
                          className="border-l border-gray-200 px-3 py-2 text-center"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold text-white shadow-sm"
                              style={{ backgroundColor: lt.color_code }}
                              title={lt.name}
                            >
                              {lt.code}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] font-medium text-gray-600 truncate">
                            {lt.name}
                          </div>
                        </th>
                      ))}
                      <th className="border-l border-gray-300 bg-green-50 px-3 py-3 text-center text-xs font-bold uppercase text-green-800">
                        Total
                      </th>
                    </tr>

                    {/* Sub-header (only for detailed mode) */}
                    {viewMode === 'detailed' && (
                      <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-semibold uppercase text-gray-500">
                        <th className="sticky left-0 z-10 bg-gray-50 px-4 py-1.5"></th>
                        {leaveTypes.map((lt) => (
                          <>
                            <th key={`${lt.id}-used`} className="border-l border-gray-200 px-2 py-1.5 text-center text-red-600">
                              Used
                            </th>
                            <th key={`${lt.id}-pending`} className="px-2 py-1.5 text-center text-amber-600">
                              Pending
                            </th>
                            <th key={`${lt.id}-avail`} className="px-2 py-1.5 text-center text-green-600">
                              Avail
                            </th>
                          </>
                        ))}
                        <th className="border-l border-gray-300 bg-green-50 px-3 py-1.5 text-center text-green-800">
                          Avail
                        </th>
                      </tr>
                    )}
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.map((row) => (
                      <tr
                        key={row.employeeId}
                        className="hover:bg-blue-50/40 transition-colors"
                      >
                        {/* Employee Column (sticky) */}
                        <td
                          className="sticky left-0 z-10 bg-white group-hover:bg-blue-50/40 px-4 py-3"
                          style={{ minWidth: '260px' }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
                              {row.employeeName
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">
                                {row.employeeName}
                              </p>
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <span className="font-mono">{row.employeeCode}</span>
                                {row.employeeDepartment && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-0.5 truncate">
                                      <Building2 className="h-3 w-3 shrink-0" />
                                      {row.employeeDepartment}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Leave Type Columns */}
                        {leaveTypes.map((lt) => {
                          const balance = row.balancesByTypeId[lt.id];

                          if (!balance) {
                            return viewMode === 'detailed' ? (
                              <>
                                <td key={`${lt.id}-u`} className="border-l border-gray-100 px-2 py-3 text-center text-xs text-gray-300">—</td>
                                <td key={`${lt.id}-p`} className="px-2 py-3 text-center text-xs text-gray-300">—</td>
                                <td key={`${lt.id}-a`} className="px-2 py-3 text-center text-xs text-gray-300">—</td>
                              </>
                            ) : (
                              <td
                                key={lt.id}
                                className="border-l border-gray-100 px-3 py-3 text-center text-xs text-gray-300"
                              >
                                —
                              </td>
                            );
                          }

                          if (viewMode === 'detailed') {
                            return (
                              <>
                                <td key={`${lt.id}-u`} className="border-l border-gray-100 px-2 py-3 text-center">
                                  {Number(balance.used) > 0 ? (
                                    <span className="font-semibold text-red-600">
                                      {Number(balance.used).toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">0</span>
                                  )}
                                </td>
                                <td key={`${lt.id}-p`} className="px-2 py-3 text-center">
                                  {Number(balance.pending) > 0 ? (
                                    <span className="font-semibold text-amber-600">
                                      {Number(balance.pending).toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">0</span>
                                  )}
                                </td>
                                <td key={`${lt.id}-a`} className="px-2 py-3 text-center">
                                  <span
                                    className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                      Number(balance.available) > 5
                                        ? 'bg-green-100 text-green-800'
                                        : Number(balance.available) > 0
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {Number(balance.available).toFixed(1)}
                                  </span>
                                </td>
                              </>
                            );
                          }

                          // Simple/available view
                          return (
                            <td
                              key={lt.id}
                              className="border-l border-gray-100 px-3 py-3 text-center"
                              title={`Used: ${balance.used} • Pending: ${balance.pending} • Available: ${balance.available}`}
                            >
                              <span
                                className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-sm font-bold ${
                                  Number(balance.available) > 5
                                    ? 'bg-green-100 text-green-800'
                                    : Number(balance.available) > 0
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {Number(balance.available).toFixed(1)}
                              </span>
                              {Number(balance.pending) > 0 && (
                                <div className="mt-0.5 text-[10px] text-amber-600">
                                  {balance.pending} pending
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Total Column */}
                        <td className="border-l border-gray-300 bg-green-50/50 px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold ${
                              row.totalAvailable > 10
                                ? 'bg-green-600 text-white'
                                : row.totalAvailable > 0
                                ? 'bg-amber-500 text-white'
                                : 'bg-gray-400 text-white'
                            }`}
                          >
                            {row.totalAvailable.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Footer with totals */}
                  <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                    <tr>
                      <td
                        className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-xs uppercase text-gray-700"
                        style={{ minWidth: '260px' }}
                      >
                        Company Totals
                      </td>
                      {leaveTypes.map((lt) => {
                        const totals = filteredRows.reduce(
                          (acc, row) => {
                            const b = row.balancesByTypeId[lt.id];
                            if (b) {
                              acc.available += Number(b.available);
                              acc.used += Number(b.used);
                              acc.pending += Number(b.pending);
                            }
                            return acc;
                          },
                          { available: 0, used: 0, pending: 0 }
                        );

                        if (viewMode === 'detailed') {
                          return (
                            <>
                              <td key={`${lt.id}-tu`} className="border-l border-gray-200 px-2 py-3 text-center text-xs text-red-700">
                                {totals.used.toFixed(1)}
                              </td>
                              <td key={`${lt.id}-tp`} className="px-2 py-3 text-center text-xs text-amber-700">
                                {totals.pending.toFixed(1)}
                              </td>
                              <td key={`${lt.id}-ta`} className="px-2 py-3 text-center text-xs text-green-700">
                                {totals.available.toFixed(1)}
                              </td>
                            </>
                          );
                        }

                        return (
                          <td
                            key={lt.id}
                            className="border-l border-gray-200 px-3 py-3 text-center text-xs text-gray-700"
                          >
                            {totals.available.toFixed(1)}
                          </td>
                        );
                      })}
                      <td className="border-l border-gray-300 bg-green-100 px-3 py-3 text-center text-sm font-bold text-green-900">
                        {filteredRows
                          .reduce((sum, r) => sum + r.totalAvailable, 0)
                          .toFixed(1)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : search ? (
            <div className="rounded-xl bg-white p-16 text-center shadow-sm ring-1 ring-gray-100">
              <Search className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-3 text-gray-500">No employees match "{search}"</p>
              <button
                onClick={() => setSearch('')}
                className="mt-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                Clear search
              </button>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// SUMMARY CARDS
// ============================================================================

function SummaryCard({
  label, value, icon: Icon, color, suffix,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: 'blue' | 'green' | 'red' | 'purple';
  suffix?: string;
}) {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {value}
            {suffix && <span className="ml-1 text-xs font-normal text-gray-500">{suffix}</span>}
          </p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function MiniResult({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: any = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };
  return (
    <div className="rounded-lg bg-white p-2">
      <div className={`text-lg font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}