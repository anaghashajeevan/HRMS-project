import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCheck, Loader2, Filter, Search, Calendar,
  ArrowRight, CheckCircle2, Clock, AlertCircle,
  Edit, Eye, Award, Send, XCircle, TrendingUp,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { employeeScorecardsApi, performanceCyclesApi } from '../../api/performance';
import type {
  EmployeeScorecardListItem,
  ScorecardStatus,
  PerformanceCycle,
} from '../../types/performance';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<
  ScorecardStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700', icon: Edit },
  SUBMITTED: { label: 'Awaiting Review', className: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  MANAGER_REVIEWING: { label: 'Reviewing', className: 'bg-indigo-100 text-indigo-700', icon: Clock },
  SENT_BACK: { label: 'Sent Back', className: 'bg-red-100 text-red-700', icon: XCircle },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  SIGNED_OFF: { label: 'Signed Off', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  SELF_REVIEW_PENDING: { label: 'Self Review Pending', className: 'bg-purple-100 text-purple-700', icon: Edit },
  SELF_REVIEWED: { label: 'Ready for Final Review', className: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  MANAGER_REVIEW_PENDING: { label: 'Final Review Pending', className: 'bg-orange-100 text-orange-700', icon: Clock },
  MANAGER_REVIEWED: { label: 'Final Review Done', className: 'bg-teal-100 text-teal-700', icon: CheckCircle2 },
  FINALIZED: { label: 'Finalized', className: 'bg-green-100 text-green-700', icon: Award },
};

export default function TeamPerformancePage() {
  const navigate = useNavigate();
  const [scorecards, setScorecards] = useState<EmployeeScorecardListItem[]>([]);
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [scData, cyclesData] = await Promise.all([
        employeeScorecardsApi.teamScorecards(selectedCycle || undefined),
        performanceCyclesApi.list({ status: 'ACTIVE' }),
      ]);
      setScorecards(scData);
      setCycles(cyclesData);
    } catch (err) {
      toast.error('Failed to load team scorecards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [selectedCycle]);

  const filtered = useMemo(() => {
    let list = [...scorecards];
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.employee_name.toLowerCase().includes(q) ||
          s.employee_id_display.toLowerCase().includes(q)
      );
    }
    return list;
  }, [scorecards, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: scorecards.length,
      pending_review: scorecards.filter((s) =>
        ['SUBMITTED', 'SELF_REVIEWED'].includes(s.status)
      ).length,
      in_progress: scorecards.filter((s) => s.status === 'DRAFT').length,
      approved: scorecards.filter((s) =>
        ['APPROVED', 'SIGNED_OFF', 'FINALIZED'].includes(s.status)
      ).length,
    };
  }, [scorecards]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });

  const getActionLabel = (status: ScorecardStatus): string => {
    switch (status) {
      case 'SUBMITTED':
      case 'MANAGER_REVIEWING':
        return 'Review Now';
      case 'SELF_REVIEWED':
        return 'Do Final Review';
      case 'SENT_BACK':
        return 'Awaiting Employee';
      default:
        return 'View';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">Team Performance</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Review, approve, and manage your team's performance scorecards
            </p>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total Team" value={stats.total} color="bg-primary-50 text-primary-700" icon={UserCheck} />
            <StatCard
              label="Pending My Review"
              value={stats.pending_review}
              color="bg-amber-50 text-amber-700"
              icon={AlertCircle}
              highlight={stats.pending_review > 0}
            />
            <StatCard label="In Progress" value={stats.in_progress} color="bg-blue-50 text-blue-700" icon={Clock} />
            <StatCard label="Approved" value={stats.approved} color="bg-green-50 text-green-700" icon={CheckCircle2} />
          </div>

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
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Active Cycles</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
              {filtered.length} of {scorecards.length}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <UserCheck className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                No team scorecards
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {scorecards.length === 0
                  ? 'No team members have scorecards yet.'
                  : 'No scorecards match the current filters.'}
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
                      Cycle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      KRAs
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Weight
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Score
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Updated
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
                    const isPending =
                      sc.status === 'SUBMITTED' || sc.status === 'SELF_REVIEWED';

                    return (
                      <tr
                        key={sc.id}
                        className={`cursor-pointer hover:bg-gray-50 ${
                            isPending ? 'bg-amber-50/30' : ''
                        }`}
                        onClick={() =>
                            navigate(
                            sc.status === 'SELF_REVIEWED'
                                ? `/team-performance/${sc.id}/final-review`
                                : `/team-performance/${sc.id}/review`
                            )
                        }
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
                          <p className="text-sm font-medium text-gray-900">
                            {sc.cycle_name}
                          </p>
                          <p className="text-xs text-gray-500">{sc.cycle_type}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {sc.kra_count}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                              Math.abs(Number(sc.total_weight) - 100) < 0.01
                                ? 'bg-green-50 text-green-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {sc.total_weight}%
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
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatDate(sc.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                    sc.status === 'SELF_REVIEWED'
                                        ? `/team-performance/${sc.id}/final-review`
                                        : `/team-performance/${sc.id}/review`
                                    );
                                }}
                                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                    isPending
                                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                                >
                            {getActionLabel(sc.status)}
                            <ArrowRight className="h-3 w-3" />
                          </button>
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
  value: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
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