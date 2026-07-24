import { useEffect, useState } from 'react';
import {
  Users, Loader2, PlayCircle, CheckCircle2, AlertCircle,
  RefreshCw, Search, Calendar, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { leaveBalancesApi } from '../../api/leave';
import type { LeaveBalance, AllocateAllResult } from '../../types/leave';

interface GroupedBalances {
  employeeCode: string;
  employeeName: string;
  employeeDepartment: string | null;
  employeeId: string;
  balances: LeaveBalance[];
}

export default function LeaveBalancesPage() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [lastResult, setLastResult] = useState<AllocateAllResult | null>(null);

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

  // Group balances by employee
  const groupedByEmployee: GroupedBalances[] = Object.values(
    balances.reduce((acc, balance) => {
      const empId = balance.employee;
      if (!acc[empId]) {
        acc[empId] = {
          employeeCode: balance.employee_code,
          employeeName: balance.employee_name,
          employeeDepartment: balance.employee_department,
          employeeId: balance.employee,
          balances: [],
        };
      }
      acc[empId].balances.push(balance);
      return acc;
    }, {} as Record<string, GroupedBalances>)
  );

  // Sort by employee code
  groupedByEmployee.sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));

  // Filter by search
  const filteredEmployees = groupedByEmployee.filter((group) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      group.employeeCode.toLowerCase().includes(s) ||
      group.employeeName.toLowerCase().includes(s) ||
      (group.employeeDepartment || '').toLowerCase().includes(s)
    );
  });

  const totalEmployees = groupedByEmployee.length;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leave Balances</h1>
              <p className="mt-1 text-sm text-gray-600">
                {totalEmployees} employee{totalEmployees !== 1 ? 's' : ''} • {balances.length} balance record{balances.length !== 1 ? 's' : ''} • Year {year}
              </p>
            </div>
            <div className="flex gap-3">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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

          {/* Allocation Result Banner */}
          {lastResult && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900">Allocation Complete</h3>
                  <p className="mt-1 text-sm text-green-700">{lastResult.message}</p>
                  <div className="mt-2 grid grid-cols-4 gap-3 text-center">
                    <div className="rounded-lg bg-white p-2">
                      <div className="text-lg font-bold text-blue-600">
                        {lastResult.total_employees}
                      </div>
                      <div className="text-xs text-gray-600">Total Employees</div>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <div className="text-lg font-bold text-green-600">
                        {lastResult.newly_allocated}
                      </div>
                      <div className="text-xs text-gray-600">Newly Allocated</div>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <div className="text-lg font-bold text-amber-600">
                        {lastResult.skipped_existing}
                      </div>
                      <div className="text-xs text-gray-600">Already Had</div>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <div className="text-lg font-bold text-red-600">
                        {lastResult.errors.length}
                      </div>
                      <div className="text-xs text-gray-600">Errors</div>
                    </div>
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
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
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

          {/* Search */}
          {balances.length > 0 && (
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee code, name, or department..."
                className="w-full max-w-md rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
              {search && (
                <p className="mt-1 text-xs text-gray-500">
                  Showing {filteredEmployees.length} of {totalEmployees} employees
                </p>
              )}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filteredEmployees.length > 0 ? (
            /* Employee Cards */
            <div className="space-y-4">
              {filteredEmployees.map((group) => (
                <div
                  key={group.employeeId}
                  className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100"
                >
                  {/* Employee Header */}
                  <div className="flex items-center gap-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white px-5 py-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                      {group.employeeName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-500">{group.employeeCode}</span>
                        <span className="text-gray-300">•</span>
                        <h3 className="font-semibold text-gray-900">{group.employeeName}</h3>
                      </div>
                      {group.employeeDepartment && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                          <Building2 className="h-3 w-3" />
                          {group.employeeDepartment}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Balances Table */}
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-5 py-2">Leave Type</th>
                        <th className="px-4 py-2 text-center">Allocated</th>
                        <th className="px-4 py-2 text-center">Accrued</th>
                        <th className="px-4 py-2 text-center">Used</th>
                        <th className="px-4 py-2 text-center">Pending</th>
                        <th className="px-4 py-2 text-center">Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.balances.map((balance) => (
                        <tr key={balance.id} className="hover:bg-gray-50">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                                style={{ backgroundColor: balance.leave_type.color_code }}
                              >
                                {balance.leave_type.code}
                              </span>
                              <span className="text-gray-700">{balance.leave_type.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600">
                            {balance.allocated}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600">
                            {balance.accrued_till_date}
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold text-red-600">
                            {balance.used}
                          </td>
                          <td className="px-4 py-2.5 text-center text-amber-600">
                            {balance.pending}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold text-green-600">
                            {balance.available}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : search ? (
            /* No search results */
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