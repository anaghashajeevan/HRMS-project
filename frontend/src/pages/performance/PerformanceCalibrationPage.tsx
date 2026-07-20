import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Loader2, Filter, Search, Calendar, Users,
  ArrowRight, CheckCircle2, Clock, AlertCircle, Award,
  Building2, TrendingUp, Trophy, Lock, XCircle, Zap,
  Sparkles,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import {
  employeeScorecardsApi,
  performanceCyclesApi,
} from '../../api/performance';
import { structuresApi } from '../../api/masterData';
import type {
  EmployeeScorecardListItem,
  PerformanceCycle,
  ScorecardStatus,
} from '../../types/performance';
import type { CompanyStructure } from '../../types/masterData';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<
  ScorecardStatus,
  { label: string; className: string; icon: any }
> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700', icon: AlertCircle },
  SUBMITTED: { label: 'Submitted', className: 'bg-amber-100 text-amber-700', icon: Clock },
  MANAGER_REVIEWING: { label: 'Under Review', className: 'bg-indigo-100 text-indigo-700', icon: Clock },
  SENT_BACK: { label: 'Sent Back', className: 'bg-red-100 text-red-700', icon: XCircle },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  SIGNED_OFF: { label: 'Signed Off', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  SELF_REVIEW_PENDING: { label: 'Self Review Pending', className: 'bg-purple-100 text-purple-700', icon: Clock },
  SELF_REVIEWED: { label: 'Self Reviewed', className: 'bg-orange-100 text-orange-700', icon: CheckCircle2 },
  MANAGER_REVIEW_PENDING: { label: 'Final Review Pending', className: 'bg-orange-100 text-orange-700', icon: Clock },
  MANAGER_REVIEWED: { label: 'Ready to Finalize', className: 'bg-teal-100 text-teal-700', icon: Award },
  FINALIZED: { label: 'Finalized ✓', className: 'bg-green-100 text-green-700', icon: Trophy },
};

const RATING_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-blue-500',
  4: 'bg-green-500',
  5: 'bg-emerald-600',
};

const RATING_LABELS: Record<number, string> = {
  1: 'Unsatisfactory',
  2: 'Needs Improvement',
  3: 'Meets',
  4: 'Exceeds',
  5: 'Outstanding',
};

export default function PerformanceCalibrationPage() {
  const navigate = useNavigate();

  const [scorecards, setScorecards] = useState<EmployeeScorecardListItem[]>([]);
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [departments, setDepartments] = useState<CompanyStructure[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [bulkFinalizing, setBulkFinalizing] = useState(false);

  // Filters
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Load cycles + departments on mount
  useEffect(() => {
    Promise.all([
      performanceCyclesApi.list({ status: 'ACTIVE' }),
      structuresApi.list({ type: 'DEPARTMENT' }),
    ]).then(([c, d]) => {
      setCycles(c);
      setDepartments(d.results || []);
      // Auto-select first active cycle
      if (c.length > 0) setSelectedCycle(c[0].id);
    });
  }, []);

  // Fetch scorecards + stats when filters change
  useEffect(() => {
    if (!selectedCycle) {
      setLoading(false);
      return;
    }
    fetchAll();
  }, [selectedCycle, selectedDept, statusFilter, ratingFilter]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedCycle) params.cycle = selectedCycle;
      if (selectedDept) params.department = selectedDept;
      if (statusFilter) params.status = statusFilter;
      if (ratingFilter) params.rating = ratingFilter;

      const [scData, statsData] = await Promise.all([
        employeeScorecardsApi.allScorecards(params),
        selectedCycle
          ? employeeScorecardsApi.calibrationStats(selectedCycle)
          : null,
      ]);

      setScorecards(scData);
      setStats(statsData);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return scorecards;
    const q = search.toLowerCase();
    return scorecards.filter(
      (s) =>
        s.employee_name.toLowerCase().includes(q) ||
        s.employee_id_display.toLowerCase().includes(q)
    );
  }, [scorecards, search]);

  const readyToFinalize = useMemo(
    () => scorecards.filter((s) => s.status === 'MANAGER_REVIEWED'),
    [scorecards]
  );

  const finalized = useMemo(
    () => scorecards.filter((s) => s.status === 'FINALIZED'),
    [scorecards]
  );

  const handleFinalize = async (sc: EmployeeScorecardListItem) => {
    if (!confirm(`Finalize scorecard for ${sc.employee_name}? This will lock it and generate the rating letter.`)) return;
    setFinalizingId(sc.id);
    try {
      await employeeScorecardsApi.finalize(sc.id);
      toast.success(`Finalized. Letter being generated for ${sc.employee_name}`);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Finalization failed');
    } finally {
      setFinalizingId(null);
    }
  };

  const handleBulkFinalize = async () => {
    if (!selectedCycle) {
      toast.error('Select a cycle first');
      return;
    }
    if (readyToFinalize.length === 0) {
      toast.error('No scorecards ready to finalize');
      return;
    }
    if (
      !confirm(
        `Finalize ALL ${readyToFinalize.length} manager-reviewed scorecards? This will lock them and generate rating letters for everyone.`
      )
    )
      return;
    setBulkFinalizing(true);
    try {
      const result = await employeeScorecardsApi.bulkFinalize(selectedCycle);
      toast.success(result.message);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Bulk finalize failed');
    } finally {
      setBulkFinalizing(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">
                  Performance Calibration
                </h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                HR view — All employees across the organization. Finalize
                scorecards and generate rating letters.
              </p>
            </div>
            {readyToFinalize.length > 0 && (
              <button
                onClick={handleBulkFinalize}
                disabled={bulkFinalizing}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {bulkFinalizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Bulk Finalize All ({readyToFinalize.length})
              </button>
            )}
          </div>

          {/* Cycle Selector */}
          <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Calendar className="h-4 w-4 text-primary-600" />
              Select Performance Cycle
            </label>
            {cycles.length === 0 ? (
              <p className="text-sm text-gray-500">No active cycles found.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cycles.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCycle(c.id)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      selectedCycle === c.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-500'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {c.name}
                    <span className="ml-2 text-xs text-gray-500">
                      ({c.cycle_type_display})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedCycle && stats && (
            <>
              {/* Stats Cards */}
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatCard
                  label="Total"
                  value={stats.total}
                  color="bg-primary-50 text-primary-700"
                  icon={Users}
                />
                <StatCard
                  label="Ready to Finalize"
                  value={stats.by_status?.MANAGER_REVIEWED || 0}
                  color="bg-amber-50 text-amber-700"
                  icon={Award}
                  highlight={(stats.by_status?.MANAGER_REVIEWED || 0) > 0}
                />
                <StatCard
                  label="Finalized"
                  value={stats.by_status?.FINALIZED || 0}
                  color="bg-green-50 text-green-700"
                  icon={Trophy}
                />
                <StatCard
                  label="In Progress"
                  value={
                    (stats.by_status?.DRAFT || 0) +
                    (stats.by_status?.SUBMITTED || 0) +
                    (stats.by_status?.APPROVED || 0) +
                    (stats.by_status?.SIGNED_OFF || 0) +
                    (stats.by_status?.SELF_REVIEWED || 0)
                  }
                  color="bg-blue-50 text-blue-700"
                  icon={Clock}
                />
                <StatCard
                  label="Avg Score"
                  value={`${stats.avg_final_score || 0}%`}
                  color="bg-purple-50 text-purple-700"
                  icon={TrendingUp}
                />
              </div>

              {/* Bell Curve — Rating Distribution */}
              {Object.keys(stats.by_rating || {}).length > 0 && (
                <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <BarChart3 className="h-4 w-4 text-primary-600" />
                    Rating Distribution (Bell Curve)
                  </h3>
                  <div className="grid grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map((r) => {
                      const count = stats.by_rating[r] || 0;
                      const total = Object.values(stats.by_rating).reduce(
                        (s: number, c: any) => s + c,
                        0
                      ) as number;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <button
                          key={r}
                          onClick={() =>
                            setRatingFilter(ratingFilter === String(r) ? '' : String(r))
                          }
                          className={`flex flex-col items-center rounded-xl border-2 p-3 transition ${
                            ratingFilter === String(r)
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div
                            className={`mb-2 flex h-16 w-full items-end rounded-md ${RATING_COLORS[r]} bg-opacity-20 relative overflow-hidden`}
                          >
                            <div
                              className={`w-full ${RATING_COLORS[r]} transition-all`}
                              style={{ height: `${Math.max(pct, 5)}%` }}
                            />
                          </div>
                          <div className="text-xs font-bold text-gray-700">
                            Rating {r}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {RATING_LABELS[r]}
                          </div>
                          <div className="mt-1 text-lg font-bold text-gray-900">
                            {count}
                          </div>
                          <div className="text-xs text-gray-500">({pct}%)</div>
                        </button>
                      );
                    })}
                  </div>
                  {ratingFilter && (
                    <button
                      onClick={() => setRatingFilter('')}
                      className="mt-3 text-xs text-primary-600 hover:underline"
                    >
                      Clear rating filter
                    </button>
                  )}
                </div>
              )}

              {/* Department Breakdown */}
              {stats.department_breakdown?.length > 0 && (
                <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Building2 className="h-4 w-4 text-primary-600" />
                    By Department
                  </h3>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {stats.department_breakdown.map((d: any) => (
                      <div
                        key={d.id || 'no-dept'}
                        className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{d.name}</p>
                          <p className="text-xs text-gray-500">{d.count} scorecards</p>
                        </div>
                        {d.avg_score > 0 && (
                          <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700">
                            Avg: {d.avg_score}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ID..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Filter className="h-3 w-3" />
              Showing {filtered.length} of {scorecards.length}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : !selectedCycle ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                Select a cycle
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose a performance cycle above to view calibration data.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <Users className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                No scorecards match
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Adjust filters to see more scorecards.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Score
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Rating
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      KRAs
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((sc) => {
                    const statusCfg = STATUS_CONFIG[sc.status];
                    const StatusIcon = statusCfg.icon;
                    const canFinalize = sc.status === 'MANAGER_REVIEWED';
                    const isFinalized = sc.status === 'FINALIZED';

                    return (
                      <tr
                        key={sc.id}
                        className={`hover:bg-gray-50 ${
                          canFinalize ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                              {sc.employee_name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {sc.employee_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {sc.employee_id_display}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {sc.final_score != null ? (
                            <span className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
                              {sc.final_score}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sc.final_rating ? (
                            <div className="flex items-center gap-1">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                                  RATING_COLORS[sc.final_rating]
                                }`}
                              >
                                {sc.final_rating}
                              </span>
                              <span className="text-xs text-gray-600">
                                {RATING_LABELS[sc.final_rating]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {sc.kra_count}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() =>
                                navigate(
                                  sc.status === 'SELF_REVIEWED' || sc.status === 'MANAGER_REVIEWED'
                                    ? `/team-performance/${sc.id}/final-review`
                                    : `/team-performance/${sc.id}/review`
                                )
                              }
                              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                            >
                              View
                            </button>
                            {canFinalize && (
                              <button
                                onClick={() => handleFinalize(sc)}
                                disabled={finalizingId === sc.id}
                                className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                              >
                                {finalizingId === sc.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trophy className="h-3 w-3" />
                                )}
                                Finalize
                              </button>
                            )}
                            {isFinalized && (
                              <span className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700">
                                <Lock className="h-3 w-3" />
                                Locked
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// STAT CARD
// ==============================================================================

function StatCard({
  label,
  value,
  color,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: any;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl p-4 ${color} ${
        highlight ? 'ring-2 ring-amber-400' : ''
      }`}
    >
      <Icon className="h-8 w-8 opacity-80" />
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs font-medium opacity-80">{label}</div>
      </div>
    </div>
  );
}