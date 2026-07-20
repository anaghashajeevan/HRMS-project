import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Plus, Trash2, Edit, Loader2, Info, X, Save,
  Filter, Play, Lock, Search, Sparkles, Users,
  CheckCircle2, Clock, AlertCircle,Award,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { employeeScorecardsApi, performanceCyclesApi } from '../../api/performance';
import { structuresApi } from '../../api/masterData';
import type {
  PerformanceCycle,
  PerformanceCycleCreatePayload,
  CycleType,
  CycleStatus,
  CyclePhase,
} from '../../types/performance';
import type { CompanyStructure } from '../../types/masterData';
import toast from 'react-hot-toast';

// ==============================================================================
// CONFIGS
// ==============================================================================

const CYCLE_TYPE_OPTIONS: { value: CycleType; label: string; days: number }[] = [
  { value: 'MONTHLY', label: 'Monthly', days: 30 },
  { value: 'QUARTERLY', label: 'Quarterly', days: 90 },
  { value: 'HALF_YEARLY', label: 'Half-Yearly', days: 180 },
  { value: 'YEARLY', label: 'Yearly', days: 365 },
];

const STATUS_CONFIG: Record<CycleStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-700' },
  CLOSED: { label: 'Closed', className: 'bg-blue-100 text-blue-700' },
  ARCHIVED: { label: 'Archived', className: 'bg-purple-100 text-purple-700' },
};

const PHASE_CONFIG: Record<CyclePhase, { label: string; color: string }> = {
  NOT_STARTED: { label: 'Not Started', color: 'bg-gray-100 text-gray-600' },
  GOAL_SETTING: { label: '🎯 Goal Setting', color: 'bg-blue-100 text-blue-700' },
  MANAGER_REVIEW: { label: '👔 Manager Review', color: 'bg-indigo-100 text-indigo-700' },
  WORKING: { label: '💼 Working Phase', color: 'bg-amber-100 text-amber-700' },
  PEER_RATING: { label: '👥 Peer Rating', color: 'bg-pink-100 text-pink-700' },
  SELF_REVIEW: { label: '✍️ Self Review', color: 'bg-purple-100 text-purple-700' },
  FINAL_REVIEW: { label: '📋 Final Review', color: 'bg-orange-100 text-orange-700' },
  FINALIZATION: { label: '🔒 Finalization', color: 'bg-red-100 text-red-700' },
  COMPLETED: { label: '✅ Completed', color: 'bg-green-100 text-green-700' },
  UNKNOWN: { label: 'Unknown', color: 'bg-gray-100 text-gray-600' },
};

// Auto-fill date helper — distributes phase dates based on cycle type
function autoFillDates(
  cycleType: CycleType,
  startDate: string
): Partial<PerformanceCycleCreatePayload> {
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return {};

  const addDays = (days: number): string => {
    const d = new Date(start);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Phase distribution (% of total cycle length)
  const distribution = {
    MONTHLY: {
      total: 30,
      goal: [0, 3],
      mgrReview: [4, 6],
      working: [7, 22],
      peer: [23, 25],
      self: [26, 27],
      final: [28, 29],
      finalize: [30, 30],
    },
    QUARTERLY: {
      total: 90,
      goal: [0, 7],
      mgrReview: [8, 14],
      working: [15, 70],
      peer: [71, 76],
      self: [77, 82],
      final: [83, 88],
      finalize: [89, 90],
    },
    HALF_YEARLY: {
      total: 180,
      goal: [0, 15],
      mgrReview: [16, 25],
      working: [26, 140],
      peer: [141, 150],
      self: [151, 160],
      final: [161, 175],
      finalize: [176, 180],
    },
    YEARLY: {
      total: 365,
      goal: [0, 20],
      mgrReview: [21, 30],
      working: [31, 300],
      peer: [301, 320],
      self: [321, 340],
      final: [341, 355],
      finalize: [356, 365],
    },
  };

  const d = distribution[cycleType];

  return {
    period_start: startDate,
    period_end: addDays(d.total),
    goal_setting_start: addDays(d.goal[0]),
    goal_setting_end: addDays(d.goal[1]),
    manager_review_start: addDays(d.mgrReview[0]),
    manager_review_end: addDays(d.mgrReview[1]),
    working_start: addDays(d.working[0]),
    working_end: addDays(d.working[1]),
    peer_rating_start: addDays(d.peer[0]),
    peer_rating_end: addDays(d.peer[1]),
    self_review_start: addDays(d.self[0]),
    self_review_end: addDays(d.self[1]),
    final_review_start: addDays(d.final[0]),
    final_review_end: addDays(d.final[1]),
    finalization_start: addDays(d.finalize[0]),
    finalization_end: addDays(d.finalize[1]),
  };
}

function generateFYOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  for (let i = -2; i <= 2; i++) {
    const y = currentYear + i;
    options.push(`FY ${y}-${(y + 1).toString().slice(-2)}`);
  }
  return options;
}

// ==============================================================================
// MAIN PAGE
// ==============================================================================

export default function PerformanceCyclesPage() {
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [departments, setDepartments] = useState<CompanyStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PerformanceCycle | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cyclesData, deptsData] = await Promise.all([
        performanceCyclesApi.list(),
        structuresApi.list({ type: 'DEPARTMENT' }),
      ]);
      setCycles(cyclesData);
      setDepartments(deptsData.results || []);
    } catch (err) {
      toast.error('Failed to load cycles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    let list = [...cycles];
    if (typeFilter) list = list.filter((c) => c.cycle_type === typeFilter);
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.financial_year.toLowerCase().includes(q)
      );
    }
    return list;
  }, [cycles, search, typeFilter, statusFilter]);

  const groupedByFY = useMemo(() => {
    const grouped: Record<string, PerformanceCycle[]> = {};
    filtered.forEach((c) => {
      if (!grouped[c.financial_year]) grouped[c.financial_year] = [];
      grouped[c.financial_year].push(c);
    });
    return grouped;
  }, [filtered]);

  const handleActivate = async (cycle: PerformanceCycle) => {
    if (
      !confirm(
        `Activate "${cycle.name}"? This will create scorecards for all applicable employees.`
      )
    )
      return;
    try {
      const result = await performanceCyclesApi.activate(cycle.id);
      toast.success(result.message);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to activate');
    }
  };
  const handleBulkFinalize = async (cycle: PerformanceCycle) => {
  if (
    !confirm(
      `Finalize ALL reviewed scorecards for "${cycle.name}"? This will generate rating letters for everyone.`
    )
  )
    return;
  try {
    const result = await employeeScorecardsApi.bulkFinalize(cycle.id);
    toast.success(result.message);
    fetchAll();
  } catch (err: any) {
    toast.error(err?.response?.data?.detail || 'Bulk finalize failed');
  }
};
  const handleClose = async (cycle: PerformanceCycle) => {
    if (!confirm(`Close "${cycle.name}"? Scorecards will be locked.`)) return;
    try {
      await performanceCyclesApi.close(cycle.id);
      toast.success('Cycle closed');
      fetchAll();
    } catch (err) {
      toast.error('Failed to close cycle');
    }
  };

  const handleDelete = async (cycle: PerformanceCycle) => {
    if (cycle.scorecard_count > 0) {
      alert(
        `Cannot delete: ${cycle.scorecard_count} scorecard(s) exist for this cycle.`
      );
      return;
    }
    if (!confirm(`Delete cycle "${cycle.name}"?`)) return;
    try {
      await performanceCyclesApi.delete(cycle.id);
      toast.success('Cycle deleted');
      fetchAll();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (c: PerformanceCycle) => {
    setEditing(c);
    setShowModal(true);
  };

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
                <Calendar className="h-6 w-6 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">
                  Performance Cycles
                </h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Monthly, quarterly, or yearly review cycles with configurable phase dates
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              New Cycle
            </button>
          </div>

          {/* Info banner */}
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">How Cycles Work</p>
              <p className="mt-1 text-blue-700">
                Create a cycle → set phase dates → <strong>Activate</strong> to auto-create
                scorecards for all applicable employees. Each cycle has 7 phases (goal setting,
                manager review, working, peer rating, self review, final review, finalization).
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cycles..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              {CYCLE_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
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
              {filtered.length} of {cycles.length}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onNew={openCreate} />
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByFY).map(([fy, fyCycles]) => (
                <div key={fy}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">
                      {fy}
                    </h2>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {fyCycles.length} cycle{fyCycles.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {fyCycles.map((cycle) => (
                      <CycleCard
                        key={cycle.id}
                        cycle={cycle}
                        onEdit={() => openEdit(cycle)}
                        onDelete={() => handleDelete(cycle)}
                        onActivate={() => handleActivate(cycle)}
                        onClose={() => handleClose(cycle)}
                        onBulkFinalize={() => handleBulkFinalize(cycle)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showModal && (
            <CycleModal
              cycle={editing}
              departments={departments}
              onClose={() => setShowModal(false)}
              onSuccess={() => {
                setShowModal(false);
                fetchAll();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// EMPTY STATE
// ==============================================================================

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
      <Calendar className="mx-auto h-12 w-12 text-gray-300" />
      <h3 className="mt-4 text-base font-semibold text-gray-900">
        No performance cycles yet
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Create a cycle to begin performance reviews for the organization.
      </p>
      <button
        onClick={onNew}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        <Plus className="h-4 w-4" />
        Create First Cycle
      </button>
    </div>
  );
}

// ==============================================================================
// CYCLE CARD
// ==============================================================================

function CycleCard({
  cycle,
  onEdit,
  onDelete,
  onActivate,
  onClose,
  onBulkFinalize,
}: {
  cycle: PerformanceCycle;
  onEdit: () => void;
  onDelete: () => void;
  onActivate: () => void;
  onClose: () => void;
  onBulkFinalize: () => void;
}) {
  const statusConfig = STATUS_CONFIG[cycle.status];
  const phaseConfig = PHASE_CONFIG[cycle.current_phase];

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.className}`}
            >
              {statusConfig.label}
            </span>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
              {cycle.cycle_type_display}
            </span>
            {cycle.status === 'ACTIVE' && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${phaseConfig.color}`}
              >
                {phaseConfig.label}
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold text-gray-900">{cycle.name}</h3>
          <p className="mt-1 text-xs text-gray-600">
            {formatDate(cycle.period_start)} → {formatDate(cycle.period_end)}
          </p>

          {/* Meta */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {cycle.scorecard_count} scorecard{cycle.scorecard_count !== 1 ? 's' : ''}
            </span>
            {cycle.applicable_department_names.length > 0 ? (
              <span>
                Depts: {cycle.applicable_department_names.map((d) => d.name).join(', ')}
              </span>
            ) : (
              <span className="italic text-gray-500">All departments</span>
            )}
          </div>

          {/* Timeline Preview */}
          <TimelinePreview cycle={cycle} />
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2">
          {cycle.status === 'DRAFT' && (
            <button
              onClick={onActivate}
              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              <Play className="h-3 w-3" />
              Activate
            </button>
          )}
          {cycle.status === 'ACTIVE' && (
  <>
    <button
      onClick={onBulkFinalize}
      className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
      title="Finalize all reviewed scorecards"
    >
      <Award className="h-3 w-3" />
      Finalize All
    </button>
    <button
      onClick={onClose}
      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
    >
      <Lock className="h-3 w-3" />
      Close
    </button>
  </>
)}
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={onEdit}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// TIMELINE PREVIEW (mini Gantt)
// ==============================================================================

function TimelinePreview({ cycle }: { cycle: PerformanceCycle }) {
  const phases = [
    { label: '🎯', name: 'Goal Setting', start: cycle.goal_setting_start, end: cycle.goal_setting_end, color: 'bg-blue-400' },
    { label: '👔', name: 'Mgr Review', start: cycle.manager_review_start, end: cycle.manager_review_end, color: 'bg-indigo-400' },
    { label: '💼', name: 'Working', start: cycle.working_start, end: cycle.working_end, color: 'bg-amber-400' },
    { label: '👥', name: 'Peer Rating', start: cycle.peer_rating_start, end: cycle.peer_rating_end, color: 'bg-pink-400' },
    { label: '✍️', name: 'Self Review', start: cycle.self_review_start, end: cycle.self_review_end, color: 'bg-purple-400' },
    { label: '📋', name: 'Final Review', start: cycle.final_review_start, end: cycle.final_review_end, color: 'bg-orange-400' },
    { label: '🔒', name: 'Finalize', start: cycle.finalization_start, end: cycle.finalization_end, color: 'bg-red-400' },
  ];

  const totalStart = new Date(cycle.period_start).getTime();
  const totalEnd = new Date(cycle.period_end).getTime();
  const totalDuration = totalEnd - totalStart;

  const today = Date.now();
  const todayPct = Math.max(
    0,
    Math.min(100, ((today - totalStart) / totalDuration) * 100)
  );

  const showTodayMarker = today >= totalStart && today <= totalEnd;

  return (
    <div className="mt-3 rounded-lg bg-gray-50 p-3">
      <p className="mb-2 text-xs font-medium text-gray-600">Timeline</p>
      <div className="relative flex h-8 w-full overflow-hidden rounded-md bg-gray-200">
        {phases.map((phase, idx) => {
          const start = new Date(phase.start).getTime();
          const end = new Date(phase.end).getTime();
          const startPct = ((start - totalStart) / totalDuration) * 100;
          const widthPct = ((end - start) / totalDuration) * 100;

          return (
            <div
              key={idx}
              className={`${phase.color} group/phase relative flex items-center justify-center overflow-hidden text-xs text-white`}
              style={{ width: `${widthPct}%` }}
              title={`${phase.name}: ${phase.start} → ${phase.end}`}
            >
              <span className="text-[10px] opacity-90">{phase.label}</span>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover/phase:block">
                {phase.name}
                <br />
                {phase.start} → {phase.end}
              </div>
            </div>
          );
        })}

        {/* Today marker */}
        {showTodayMarker && (
          <div
            className="absolute top-0 h-full w-0.5 bg-red-600"
            style={{ left: `${todayPct}%` }}
            title="Today"
          >
            <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-red-600" />
          </div>
        )}
      </div>
    </div>
  );
}

// ==============================================================================
// CREATE / EDIT MODAL
// ==============================================================================

function CycleModal({
  cycle,
  departments,
  onClose,
  onSuccess,
}: {
  cycle: PerformanceCycle | null;
  departments: CompanyStructure[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!cycle;
  const fyOptions = useMemo(() => generateFYOptions(), []);
  const defaultFY = useMemo(() => {
    const y = new Date().getFullYear();
    return `FY ${y}-${(y + 1).toString().slice(-2)}`;
  }, []);

  const [form, setForm] = useState<PerformanceCycleCreatePayload>({
    name: cycle?.name ?? '',
    cycle_type: cycle?.cycle_type ?? 'QUARTERLY',
    financial_year: cycle?.financial_year ?? defaultFY,
    period_start: cycle?.period_start ?? '',
    period_end: cycle?.period_end ?? '',
    goal_setting_start: cycle?.goal_setting_start ?? '',
    goal_setting_end: cycle?.goal_setting_end ?? '',
    manager_review_start: cycle?.manager_review_start ?? '',
    manager_review_end: cycle?.manager_review_end ?? '',
    working_start: cycle?.working_start ?? '',
    working_end: cycle?.working_end ?? '',
    peer_rating_start: cycle?.peer_rating_start ?? '',
    peer_rating_end: cycle?.peer_rating_end ?? '',
    self_review_start: cycle?.self_review_start ?? '',
    self_review_end: cycle?.self_review_end ?? '',
    final_review_start: cycle?.final_review_start ?? '',
    final_review_end: cycle?.final_review_end ?? '',
    finalization_start: cycle?.finalization_start ?? '',
    finalization_end: cycle?.finalization_end ?? '',
    status: cycle?.status ?? 'DRAFT',
    applicable_departments: cycle?.applicable_departments ?? [],
    description: cycle?.description ?? '',
  });

  const [saving, setSaving] = useState(false);

  const update = <K extends keyof PerformanceCycleCreatePayload>(
    field: K,
    value: PerformanceCycleCreatePayload[K]
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleAutoFill = () => {
    if (!form.period_start) {
      toast.error('Set the cycle start date first');
      return;
    }
    const dates = autoFillDates(form.cycle_type, form.period_start);
    setForm((prev) => ({ ...prev, ...dates }));
    toast.success('Phase dates auto-filled');
  };

  const toggleDepartment = (deptId: string) => {
    const current = form.applicable_departments ?? [];
    update(
      'applicable_departments',
      current.includes(deptId) ? current.filter((d) => d !== deptId) : [...current, deptId]
    );
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.period_start || !form.period_end) return toast.error('Period dates required');
    if (!form.goal_setting_start) return toast.error('Please set all phase dates');

    setSaving(true);
    try {
      if (isEdit) {
        await performanceCyclesApi.update(cycle!.id, form);
        toast.success('Cycle updated');
      } else {
        await performanceCyclesApi.create(form);
        toast.success('Cycle created');
      }
      onSuccess();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        Object.values(err?.response?.data || {})?.[0] ||
        'Save failed';
      toast.error(typeof detail === 'string' ? detail : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-xl max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100">
              <Calendar className="h-4 w-4 text-primary-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              {isEdit ? 'Edit Cycle' : 'New Performance Cycle'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4">
            {/* Basic Info */}
            <div className="rounded-xl bg-gray-50 p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase text-gray-600">
                Basic Information
              </h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Cycle Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="e.g. FY 2026 Q1 Review"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Financial Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.financial_year}
                    onChange={(e) => update('financial_year', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {fyOptions.map((fy) => (
                      <option key={fy} value={fy}>
                        {fy}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Cycle Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CYCLE_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update('cycle_type', opt.value)}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                          form.cycle_type === opt.value
                            ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-500'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Optional description"
                  />
                </div>
              </div>
            </div>

            {/* Cycle Period + Auto-fill */}
            <div className="rounded-xl bg-primary-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase text-primary-700">
                  Cycle Period
                </h4>
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                >
                  <Sparkles className="h-3 w-3" />
                  Auto-Fill Phase Dates
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-primary-700">
                    Period Start <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.period_start}
                    onChange={(e) => update('period_start', e.target.value)}
                    className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-primary-700">
                    Period End <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.period_end}
                    onChange={(e) => update('period_end', e.target.value)}
                    className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Phase Dates */}
            <div className="rounded-xl border border-gray-200 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-gray-600">
                <Clock className="h-3 w-3" />
                Phase Dates (7 phases)
              </h4>
              <div className="space-y-3">
                <PhaseDateRow
                  label="🎯 Goal Setting"
                  startValue={form.goal_setting_start}
                  endValue={form.goal_setting_end}
                  onStartChange={(v) => update('goal_setting_start', v)}
                  onEndChange={(v) => update('goal_setting_end', v)}
                />
                <PhaseDateRow
                  label="👔 Manager Review"
                  startValue={form.manager_review_start}
                  endValue={form.manager_review_end}
                  onStartChange={(v) => update('manager_review_start', v)}
                  onEndChange={(v) => update('manager_review_end', v)}
                />
                <PhaseDateRow
                  label="💼 Working"
                  startValue={form.working_start}
                  endValue={form.working_end}
                  onStartChange={(v) => update('working_start', v)}
                  onEndChange={(v) => update('working_end', v)}
                />
                <PhaseDateRow
                  label="👥 Peer Rating"
                  startValue={form.peer_rating_start}
                  endValue={form.peer_rating_end}
                  onStartChange={(v) => update('peer_rating_start', v)}
                  onEndChange={(v) => update('peer_rating_end', v)}
                />
                <PhaseDateRow
                  label="✍️ Self Review"
                  startValue={form.self_review_start}
                  endValue={form.self_review_end}
                  onStartChange={(v) => update('self_review_start', v)}
                  onEndChange={(v) => update('self_review_end', v)}
                />
                <PhaseDateRow
                  label="📋 Final Review"
                  startValue={form.final_review_start}
                  endValue={form.final_review_end}
                  onStartChange={(v) => update('final_review_start', v)}
                  onEndChange={(v) => update('final_review_end', v)}
                />
                <PhaseDateRow
                  label="🔒 Finalization"
                  startValue={form.finalization_start}
                  endValue={form.finalization_end}
                  onStartChange={(v) => update('finalization_start', v)}
                  onEndChange={(v) => update('finalization_end', v)}
                />
              </div>
            </div>

            {/* Applicable Departments */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Applicable Departments
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Leave empty to apply to all departments
              </p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {departments.length === 0 ? (
                  <p className="p-2 text-xs text-gray-500">No departments</p>
                ) : (
                  departments.map((dept) => (
                    <label
                      key={dept.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={form.applicable_departments?.includes(dept.id) ?? false}
                        onChange={() => toggleDepartment(dept.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-gray-700">{dept.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

// ==============================================================================
// PHASE DATE ROW
// ==============================================================================

function PhaseDateRow({
  label,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}: {
  label: string;
  startValue: string;
  endValue: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 items-center gap-2">
      <div className="col-span-1">
        <span className="text-xs font-medium text-gray-700">{label}</span>
      </div>
      <div className="col-span-2">
        <input
          type="date"
          value={startValue}
          onChange={(e) => onStartChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div className="col-span-2">
        <input
          type="date"
          value={endValue}
          onChange={(e) => onEndChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>
  );
}