import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Trash2, Edit, Save, Send,
  CheckCircle2, AlertCircle, Info, ChevronDown, ChevronRight,
  TrendingUp, Zap, Star, Target, X, Sparkles,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import {
  employeeScorecardsApi,
  employeeKRAsApi,
  employeeKPIsApi,
  kraLibraryApi,
} from '../../api/performance';
import type {
  EmployeeScorecardDetail,
  EmployeeKRA,
  EmployeeKPI,
  EmployeeKPICreatePayload,
  KRALibrary,
  KPIType,
  IndicatorType,
} from '../../types/performance';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const KPI_TYPE_OPTIONS: { value: KPIType; label: string; icon: string }[] = [
  { value: 'NUMERIC_UP', label: 'Numeric ↑', icon: '📈' },
  { value: 'NUMERIC_DOWN', label: 'Numeric ↓', icon: '📉' },
  { value: 'PERCENTAGE', label: 'Percentage', icon: '%' },
  { value: 'RATING', label: 'Rating', icon: '⭐' },
  { value: 'BOOLEAN', label: 'Yes/No', icon: '✓' },
  { value: 'CURRENCY', label: 'Currency', icon: '💰' },
];

const INDICATOR_OPTIONS: { value: IndicatorType; label: string }[] = [
  { value: 'OUTPUT', label: 'Output' },
  { value: 'QUALITY', label: 'Quality' },
  { value: 'EFFICIENCY', label: 'Efficiency' },
  { value: 'TIMELINESS', label: 'Timeliness' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'CAPABILITY', label: 'Capability' },
];

export default function ScorecardBuilderPage() {
  const { scorecardId } = useParams<{ scorecardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [scorecard, setScorecard] = useState<EmployeeScorecardDetail | null>(null);
  const [availableKRAs, setAvailableKRAs] = useState<KRALibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modals
  const [showAddKRAModal, setShowAddKRAModal] = useState(false);
  const [showCustomKRAModal, setShowCustomKRAModal] = useState(false);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [editingKPI, setEditingKPI] = useState<EmployeeKPI | null>(null);
  const [kpiParentKRA, setKpiParentKRA] = useState<string | null>(null);

  const isOwner = user?.employee?.id === scorecard?.employee;
  const isEditable = scorecard?.status === 'DRAFT' || scorecard?.status === 'SENT_BACK';

  const fetchScorecard = async () => {
    if (!scorecardId) return;
    setLoading(true);
    try {
      const [scData, krasData] = await Promise.all([
        employeeScorecardsApi.getById(scorecardId),
        kraLibraryApi.list({ is_active: true }),
      ]);
      setScorecard(scData);
      setAvailableKRAs(krasData);

      // Auto-expand all KRAs
      const ids = new Set(scData.kras.map((k: EmployeeKRA) => k.id));
      setExpanded(ids);
    } catch (err) {
      toast.error('Failed to load scorecard');
      navigate('/my-performance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScorecard();
  }, [scorecardId]);

  const toggleExpand = (kraId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(kraId)) next.delete(kraId);
      else next.add(kraId);
      return next;
    });
  };

  // Already-selected KRA IDs (to prevent duplicates)
  const selectedKRAIds = new Set(
    scorecard?.kras
      .filter((k) => k.library_kra)
      .map((k) => k.library_kra!) ?? []
  );

  const availableToAdd = availableKRAs.filter(
    (k) => !selectedKRAIds.has(k.id)
  );

  const handleAddFromLibrary = async (libraryKRA: KRALibrary) => {
    if (!scorecardId) return;
    try {
      await employeeScorecardsApi.addLibraryKRA(scorecardId, {
        library_kra_id: libraryKRA.id,
        include_all_kpis: true,
      });
      toast.success(`Added "${libraryKRA.name}"`);
      setShowAddKRAModal(false);
      fetchScorecard();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add KRA');
    }
  };

  const handleDeleteKRA = async (kra: EmployeeKRA) => {
    if (kra.kra_source === 'MANDATORY') {
      toast.error('Cannot remove mandatory KRAs');
      return;
    }
    if (!confirm(`Remove "${kra.name}" from your scorecard?`)) return;
    try {
      await employeeKRAsApi.delete(kra.id);
      toast.success('KRA removed');
      fetchScorecard();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleUpdateKRAWeight = async (kraId: string, weight: number) => {
    try {
      await employeeKRAsApi.update(kraId, { weight });
      fetchScorecard();
    } catch {
      toast.error('Failed to update weight');
    }
  };

  const handleUpdateKRARationale = async (kraId: string, rationale: string) => {
    try {
      await employeeKRAsApi.update(kraId, { rationale });
    } catch {
      toast.error('Failed to save rationale');
    }
  };

  const handleDeleteKPI = async (kpi: EmployeeKPI) => {
    if (!confirm(`Remove KPI "${kpi.name}"?`)) return;
    try {
      await employeeKPIsApi.delete(kpi.id);
      toast.success('KPI removed');
      fetchScorecard();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleSubmit = async () => {
    if (!scorecardId) return;

    // Client-side validation
    const totalWeight = scorecard?.kras.reduce((sum, k) => sum + Number(k.weight), 0) ?? 0;
    if (Math.abs(totalWeight - 100) > 0.01) {
      toast.error(`Total KRA weight must be 100%. Currently ${totalWeight}%`);
      return;
    }

    if (!confirm('Submit scorecard for manager review? You won\'t be able to edit until manager responds.')) {
      return;
    }

    setSubmitting(true);
    try {
      await employeeScorecardsApi.submit(scorecardId);
      toast.success('Scorecard submitted for manager review');
      fetchScorecard();
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      if (errors) {
        errors.forEach((e: string) => toast.error(e));
      } else {
        toast.error(err?.response?.data?.detail || 'Submission failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOff = async () => {
    if (!scorecardId) return;
    if (!confirm('Sign off on this scorecard? This confirms your commitment to these goals.')) {
      return;
    }
    try {
      await employeeScorecardsApi.signOff(scorecardId);
      toast.success('Scorecard signed off!');
      fetchScorecard();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Sign-off failed');
    }
  };

  if (loading || !scorecard) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  const totalWeight = scorecard.kras.reduce((sum, k) => sum + Number(k.weight), 0);
  const weightValid = Math.abs(totalWeight - 100) < 0.01;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => navigate('/my-performance')}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">
                {scorecard.cycle.name}
              </h1>
              <p className="text-sm text-gray-500">
                {scorecard.employee_name} ({scorecard.employee_id_display})
                {scorecard.employee_position && ` • ${scorecard.employee_position}`}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                scorecard.status === 'DRAFT'
                  ? 'bg-gray-100 text-gray-700'
                  : scorecard.status === 'SENT_BACK'
                  ? 'bg-amber-100 text-amber-700'
                  : scorecard.status === 'APPROVED'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {scorecard.status_display}
            </span>
          </div>

          {/* Sent back warning */}
          {scorecard.status === 'SENT_BACK' && scorecard.sent_back_reason && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Sent back for revision</p>
                <p className="mt-1 text-amber-700">{scorecard.sent_back_reason}</p>
              </div>
            </div>
          )}

          {/* Weight progress bar */}
          <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                KRA Weight Allocation
              </h2>
              <span
                className={`text-sm font-bold ${
                  weightValid
                    ? 'text-green-600'
                    : totalWeight > 100
                    ? 'text-red-600'
                    : 'text-amber-600'
                }`}
              >
                {totalWeight.toFixed(1)}% / 100%
                {weightValid && ' ✓'}
              </span>
            </div>
            <div className="h-3 rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all ${
                  weightValid
                    ? 'bg-green-500'
                    : totalWeight > 100
                    ? 'bg-red-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {scorecard.kras.length} KRA{scorecard.kras.length !== 1 ? 's' : ''} •{' '}
              {!weightValid
                ? `${(100 - totalWeight).toFixed(1)}% remaining to allocate`
                : 'Perfectly balanced ✓'}
            </p>
          </div>

          {/* KRAs List */}
          <div className="space-y-3">
            {scorecard.kras.map((kra) => (
              <KRABlock
                key={kra.id}
                kra={kra}
                expanded={expanded.has(kra.id)}
                isEditable={isEditable}
                onToggleExpand={() => toggleExpand(kra.id)}
                onWeightChange={(w) => handleUpdateKRAWeight(kra.id, w)}
                onRationaleChange={(r) => handleUpdateKRARationale(kra.id, r)}
                onDelete={() => handleDeleteKRA(kra)}
                onAddKPI={() => {
                  setEditingKPI(null);
                  setKpiParentKRA(kra.id);
                  setShowKPIModal(true);
                }}
                onEditKPI={(kpi) => {
                  setEditingKPI(kpi);
                  setKpiParentKRA(kra.id);
                  setShowKPIModal(true);
                }}
                onDeleteKPI={handleDeleteKPI}
              />
            ))}
          </div>

          {/* Add KRA buttons */}
          {isEditable && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowAddKRAModal(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-300 py-4 text-sm font-medium text-primary-600 hover:border-primary-400 hover:bg-primary-50"
              >
                <TrendingUp className="h-4 w-4" />
                Add KRA from Library
              </button>
              <button
                onClick={() => setShowCustomKRAModal(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Add Custom KRA
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-end gap-3">
            {isEditable && isOwner && (
              <button
                onClick={handleSubmit}
                disabled={submitting || !weightValid}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit for Manager Review
              </button>
            )}
            {scorecard.status === 'APPROVED' && isOwner && (
              <button
                onClick={handleSignOff}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                I Commit & Sign Off
              </button>
            )}
          </div>

          {/* Add from Library Modal */}
          {showAddKRAModal && (
            <AddFromLibraryModal
              availableKRAs={availableToAdd}
              onAdd={handleAddFromLibrary}
              onClose={() => setShowAddKRAModal(false)}
            />
          )}

          {/* Custom KRA Modal */}
          {showCustomKRAModal && scorecardId && (
            <CustomKRAModal
              scorecardId={scorecardId}
              onClose={() => setShowCustomKRAModal(false)}
              onSuccess={() => {
                setShowCustomKRAModal(false);
                fetchScorecard();
              }}
            />
          )}

          {/* KPI Modal */}
          {showKPIModal && kpiParentKRA && (
            <KPIModal
              kpi={editingKPI}
              kraId={kpiParentKRA}
              onClose={() => setShowKPIModal(false)}
              onSuccess={() => {
                setShowKPIModal(false);
                fetchScorecard();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// KRA BLOCK
// ==============================================================================

function KRABlock({
  kra,
  expanded,
  isEditable,
  onToggleExpand,
  onWeightChange,
  onRationaleChange,
  onDelete,
  onAddKPI,
  onEditKPI,
  onDeleteKPI,
}: {
  kra: EmployeeKRA;
  expanded: boolean;
  isEditable: boolean;
  onToggleExpand: () => void;
  onWeightChange: (w: number) => void;
  onRationaleChange: (r: string) => void;
  onDelete: () => void;
  onAddKPI: () => void;
  onEditKPI: (kpi: EmployeeKPI) => void;
  onDeleteKPI: (kpi: EmployeeKPI) => void;
}) {
  const [localWeight, setLocalWeight] = useState(String(kra.weight));
  const [localRationale, setLocalRationale] = useState(kra.rationale);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      {/* KRA Header */}
      <div className="flex items-start gap-3 p-5">
        <button onClick={onToggleExpand} className="mt-1 rounded p-1 text-gray-400 hover:bg-gray-100">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{kra.name}</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {kra.kra_source_display}
            </span>
            {kra.peer_rating_required && (
              <span className="flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700">
                <Star className="h-3 w-3 fill-current" />
                Peer
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-600">{kra.description}</p>

          {/* Weight + KPI count */}
          <div className="mt-2 flex items-center gap-3">
            {isEditable ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.01"
                  value={localWeight}
                  onChange={(e) => setLocalWeight(e.target.value)}
                  onBlur={() => {
                    const w = parseFloat(localWeight) || 0;
                    setLocalWeight(String(w));
                    if (w !== Number(kra.weight)) onWeightChange(w);
                  }}
                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-xs text-center focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-xs text-gray-500">% weight</span>
              </div>
            ) : (
              <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
                {kra.weight}% weight
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Zap className="h-3 w-3" />
              {kra.kpis.length} KPI{kra.kpis.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Delete (if editable + not mandatory) */}
        {isEditable && kra.kra_source !== 'MANDATORY' && (
          <button
            onClick={onDelete}
            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Remove KRA"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-5">
          {/* Rationale */}
          {isEditable && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Why this KRA? (rationale)
              </label>
              <textarea
                value={localRationale}
                onChange={(e) => setLocalRationale(e.target.value)}
                onBlur={() => {
                  if (localRationale !== kra.rationale) onRationaleChange(localRationale);
                }}
                rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                placeholder="Explain why this KRA is relevant to your role..."
              />
            </div>
          )}
          {!isEditable && kra.rationale && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              <span className="font-medium">Rationale:</span> {kra.rationale}
            </div>
          )}

          {/* KPIs */}
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-gray-500">
              KPIs ({kra.kpis.length})
            </h4>
            {isEditable && (
              <button
                onClick={onAddKPI}
                className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700"
              >
                <Plus className="h-3 w-3" />
                Add KPI
              </button>
            )}
          </div>

          {kra.kpis.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
              <Zap className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-600">No KPIs</p>
              <p className="text-xs text-gray-500">
                Add at least 1 KPI with target and action plan
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {kra.kpis.map((kpi) => (
                <KPICard
                  key={kpi.id}
                  kpi={kpi}
                  isEditable={isEditable}
                  onEdit={() => onEditKPI(kpi)}
                  onDelete={() => onDeleteKPI(kpi)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// KPI CARD
// ==============================================================================

function KPICard({
  kpi,
  isEditable,
  onEdit,
  onDelete,
}: {
  kpi: EmployeeKPI;
  isEditable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeConfig = KPI_TYPE_OPTIONS.find((t) => t.value === kpi.kpi_type);

  return (
    <div className="group rounded-xl bg-white p-4 ring-1 ring-gray-100 transition hover:ring-primary-200">
      <div className="flex items-start gap-3">
        <span className="text-lg">{typeConfig?.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h5 className="text-sm font-medium text-gray-900">{kpi.name}</h5>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
              {kpi.weight_in_kra}% weight
            </span>
          </div>

          {/* Targets */}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {kpi.baseline && (
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700">
                Baseline: {kpi.baseline}
              </span>
            )}
            {kpi.target_minimum && (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800">
                Min: {kpi.target_minimum}
              </span>
            )}
            <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-800">
              Expected: {kpi.target_expected}
            </span>
            {kpi.target_exceptional && (
              <span className="rounded-md bg-green-50 px-2 py-0.5 text-green-800">
                Exceptional: {kpi.target_exceptional}
              </span>
            )}
          </div>

          {/* Action plan */}
          {kpi.action_plan && (
            <div className="mt-2 rounded-md bg-gray-50 p-2 text-xs text-gray-700">
              <span className="font-medium text-gray-500">Action Plan:</span>{' '}
              {kpi.action_plan}
            </div>
          )}

          {/* Meta */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{kpi.indicator_type_display}</span>
            {kpi.formula && <span>📊 {kpi.formula}</span>}
            {kpi.data_source && <span>Source: {kpi.data_source}</span>}
          </div>
        </div>

        {isEditable && (
          <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={onEdit}
              className="rounded p-1.5 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==============================================================================
// ADD FROM LIBRARY MODAL
// ==============================================================================

function AddFromLibraryModal({
  availableKRAs,
  onAdd,
  onClose,
}: {
  availableKRAs: KRALibrary[];
  onAdd: (kra: KRALibrary) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = availableKRAs.filter(
    (k) =>
      k.name.toLowerCase().includes(search.toLowerCase()) ||
      k.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-900">
            Add KRA from Library
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Target className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search KRAs..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No available KRAs to add
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((kra) => (
                <button
                  key={kra.id}
                  onClick={() => onAdd(kra)}
                  className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-primary-300 hover:bg-primary-50"
                >
                  <TrendingUp className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-500" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-900">{kra.name}</h4>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {kra.kra_source}
                      </span>
                      {kra.peer_rating_required && (
                        <span className="flex items-center gap-0.5 text-xs text-pink-600">
                          <Star className="h-3 w-3 fill-current" /> Peer
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">
                      {kra.description}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Weight: {kra.suggested_weight_min}%-{kra.suggested_weight_max}% •{' '}
                      {kra.kpi_count} KPI options
                    </p>
                  </div>
                  <Plus className="mt-1 h-5 w-5 text-primary-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

// ==============================================================================
// CUSTOM KRA MODAL
// ==============================================================================

function CustomKRAModal({
  scorecardId,
  onClose,
  onSuccess,
}: {
  scorecardId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('10');
  const [peerRequired, setPeerRequired] = useState(false);
  const [rationale, setRationale] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Name required');
    if (!description.trim()) return toast.error('Description required');

    setSaving(true);
    try {
      await employeeKRAsApi.create({
        scorecard: scorecardId,
        name: name.trim(),
        description: description.trim(),
        weight: parseFloat(weight) || 10,
        peer_rating_required: peerRequired,
        kra_source: 'CUSTOM',
        rationale: rationale.trim(),
      });
      toast.success('Custom KRA added');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add KRA');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-900">Add Custom KRA</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. Complete Redis Migration" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="What this KRA covers" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Weight (%)</label>
              <input type="number" min="1" max="100" value={weight} onChange={(e) => setWeight(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 py-2 text-sm">
                <input type="checkbox" checked={peerRequired} onChange={(e) => setPeerRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <Star className="h-3.5 w-3.5 text-pink-600" /> Peer rating
              </label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Rationale</label>
            <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Why is this KRA relevant to your role?" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Add KRA
          </button>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

// ==============================================================================
// KPI MODAL
// ==============================================================================

function KPIModal({
  kpi,
  kraId,
  onClose,
  onSuccess,
}: {
  kpi: EmployeeKPI | null;
  kraId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!kpi;
  const [form, setForm] = useState<EmployeeKPICreatePayload>({
    employee_kra: kpi?.employee_kra ?? kraId,
    name: kpi?.name ?? '',
    description: kpi?.description ?? '',
    indicator_type: kpi?.indicator_type ?? 'OUTPUT',
    kpi_type: kpi?.kpi_type ?? 'NUMERIC_UP',
    formula: kpi?.formula ?? '',
    baseline: kpi?.baseline ?? '',
    target_minimum: kpi?.target_minimum ?? '',
    target_expected: kpi?.target_expected ?? '',
    target_exceptional: kpi?.target_exceptional ?? '',
    data_source: kpi?.data_source ?? '',
    weight_in_kra: kpi ? Number(kpi.weight_in_kra) : 100,
    action_plan: kpi?.action_plan ?? '',
  });
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof EmployeeKPICreatePayload>(
    field: K, value: EmployeeKPICreatePayload[K]
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name required');
    if (!form.target_expected.trim()) return toast.error('Expected target required');

    setSaving(true);
    try {
      if (isEdit) {
        await employeeKPIsApi.update(kpi!.id, form);
        toast.success('KPI updated');
      } else {
        await employeeKPIsApi.create(form);
        toast.success('KPI added');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit KPI' : 'Add KPI'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Name *</label>
            <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. Code coverage" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Indicator Type</label>
              <select value={form.indicator_type} onChange={(e) => update('indicator_type', e.target.value as IndicatorType)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                {INDICATOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">KPI Type</label>
              <select value={form.kpi_type} onChange={(e) => update('kpi_type', e.target.value as KPIType)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                {KPI_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
              </select>
            </div>
          </div>

          {/* <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Formula</label>
            <input type="text" value={form.formula} onChange={(e) => update('formula', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. (Covered lines / Total lines) × 100" />
          </div> */}

          <div className="rounded-xl bg-gray-50 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase text-gray-600">Targets</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Baseline (Current)</label>
                <input type="text" value={form.baseline} onChange={(e) => update('baseline', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="e.g. 65%" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Minimum Acceptable</label>
                <input type="text" value={form.target_minimum} onChange={(e) => update('target_minimum', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="e.g. 75%" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Expected Target *</label>
                <input type="text" value={form.target_expected} onChange={(e) => update('target_expected', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="e.g. 80%" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Exceptional Target</label>
                <input type="text" value={form.target_exceptional} onChange={(e) => update('target_exceptional', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="e.g. 90%" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Data Source</label>
              <input type="text" value={form.data_source} onChange={(e) => update('data_source', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="e.g. SonarQube, Jira" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Weight in KRA (%)</label>
              <input type="number" min="1" max="100" value={form.weight_in_kra}
                onChange={(e) => update('weight_in_kra', parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
              Action Plan (How will you achieve this?)
            </label>
            <textarea value={form.action_plan} onChange={(e) => update('action_plan', e.target.value)} rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Describe your plan: what steps, resources, timeline..." />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Update' : 'Add KPI'}
          </button>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}