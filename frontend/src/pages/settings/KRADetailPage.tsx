import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit, Trash2, Loader2, X, Save,
  Zap, TrendingUp, Star, Sparkles, Info, Users, Briefcase, Building2,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { kraLibraryApi, kpiLibraryApi } from '../../api/performance';
import type {
  KRALibrary, KPILibraryItem, KPILibraryCreatePayload,
  KPIType, IndicatorType, MeasurementFrequency,
} from '../../types/performance';
import toast from 'react-hot-toast';

const KPI_TYPE_OPTIONS: { value: KPIType; label: string; icon: string }[] = [
  { value: 'NUMERIC_UP', label: 'Numeric ↑', icon: '📈' },
  { value: 'NUMERIC_DOWN', label: 'Numeric ↓', icon: '📉' },
  { value: 'PERCENTAGE', label: 'Percentage', icon: '%' },
  { value: 'RATING', label: 'Rating', icon: '⭐' },
  { value: 'BOOLEAN', label: 'Yes/No', icon: '✓' },
  { value: 'CURRENCY', label: 'Currency', icon: '💰' },
];

const INDICATOR_TYPE_OPTIONS: { value: IndicatorType; label: string }[] = [
  { value: 'OUTPUT', label: 'Output (Revenue, Volume)' },
  { value: 'QUALITY', label: 'Quality (Defects, Complaints)' },
  { value: 'EFFICIENCY', label: 'Efficiency (Cost, Time)' },
  { value: 'TIMELINESS', label: 'Timeliness (On-time delivery)' },
  { value: 'COMPLIANCE', label: 'Compliance (Audits)' },
  { value: 'CAPABILITY', label: 'Capability (Skills, Training)' },
];

const FREQUENCY_OPTIONS: { value: MeasurementFrequency; label: string }[] = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half-Yearly' },
  { value: 'YEARLY', label: 'Yearly' },
];

export default function KRADetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [kra, setKra] = useState<KRALibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingKPI, setEditingKPI] = useState<KPILibraryItem | null>(null);

  const fetchKRA = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await kraLibraryApi.getById(id);
      setKra(data);
    } catch {
      toast.error('Failed to load KRA');
      navigate('/settings/kra-library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKRA();
  }, [id]);

  const handleDeleteKPI = async (kpi: KPILibraryItem) => {
    if (!confirm(`Delete KPI option "${kpi.name}"?`)) return;
    try {
      await kpiLibraryApi.delete(kpi.id);
      toast.success('KPI deleted');
      fetchKRA();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const openCreate = () => {
    setEditingKPI(null);
    setShowModal(true);
  };

  const openEdit = (kpi: KPILibraryItem) => {
    setEditingKPI(kpi);
    setShowModal(true);
  };

  if (loading || !kra) {
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

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Back button */}
          <button
            onClick={() => navigate('/settings/kra-library')}
            className="mb-4 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to KRA Library
          </button>

          {/* KRA Header Card */}
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                    {kra.kra_source_display}
                  </span>
                  {kra.peer_rating_required && (
                    <span className="flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700">
                      <Star className="h-3 w-3 fill-current" />
                      Peer Rating Required
                    </span>
                  )}
                  {kra.is_mandatory && (
                    <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      <Sparkles className="h-3 w-3" />
                      Mandatory
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-gray-900">{kra.name}</h1>
                <p className="mt-1 text-sm text-gray-600">{kra.description}</p>
                <p className="mt-2 text-xs text-gray-500">
                  Suggested weight: {kra.suggested_weight_min}% — {kra.suggested_weight_max}%
                </p>
              </div>
              <TrendingUp className="h-10 w-10 text-primary-200" />
            </div>

            {/* Applicability */}
            {kra.kra_source === 'ROLE' && kra.applicable_position_titles.length > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs">
                <Briefcase className="mt-0.5 h-3.5 w-3.5 text-blue-600" />
                <div>
                  <span className="font-medium text-blue-900">Applicable Positions: </span>
                  <span className="text-blue-800">
                    {kra.applicable_position_titles.map((p) => p.title).join(', ')}
                  </span>
                </div>
              </div>
            )}
            {kra.kra_source === 'DEPARTMENTAL' && kra.applicable_department_names.length > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs">
                <Building2 className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
                <div>
                  <span className="font-medium text-amber-900">Applicable Departments: </span>
                  <span className="text-amber-800">
                    {kra.applicable_department_names.map((d) => d.name).join(', ')}
                  </span>
                </div>
              </div>
            )}
            {kra.kra_source === 'COMMON' && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-purple-50 p-3 text-xs text-purple-800">
                <Users className="h-3.5 w-3.5" />
                <span>Applies to all employees</span>
              </div>
            )}
          </div>

          {/* KPI Options Section */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <Zap className="h-4 w-4 text-primary-600" />
                  KPI Options ({kra.kpi_options.length})
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Measurement options employees can pick from for this KRA
                </p>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                Add KPI Option
              </button>
            </div>

            {kra.kpi_options.length === 0 ? (
              <div className="p-12 text-center">
                <Zap className="mx-auto h-10 w-10 text-gray-300" />
                <h3 className="mt-3 text-sm font-semibold text-gray-900">No KPI options yet</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Add measurable KPIs employees can pick when using this KRA
                </p>
                <button
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" />
                  Add First KPI Option
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {kra.kpi_options.map((kpi) => (
                  <KPIRow
                    key={kpi.id}
                    kpi={kpi}
                    onEdit={() => openEdit(kpi)}
                    onDelete={() => handleDeleteKPI(kpi)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Modal */}
          {showModal && (
            <KPIModal
              kpi={editingKPI}
              kraId={kra.id}
              onClose={() => setShowModal(false)}
              onSuccess={() => {
                setShowModal(false);
                fetchKRA();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// KPI ROW
// ==============================================================================

function KPIRow({
  kpi,
  onEdit,
  onDelete,
}: {
  kpi: KPILibraryItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeConfig = KPI_TYPE_OPTIONS.find((t) => t.value === kpi.kpi_type);

  return (
    <div className="group flex items-start gap-3 p-5 transition hover:bg-gray-50">
      <span className="text-2xl" title={typeConfig?.label}>
        {typeConfig?.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-gray-900">{kpi.name}</h4>
          {!kpi.is_active && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              Inactive
            </span>
          )}
        </div>
        {kpi.description && (
          <p className="mt-0.5 text-xs text-gray-600">{kpi.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
            {kpi.indicator_type_display}
          </span>
          <span className="rounded-md bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
            {kpi.kpi_type_display}
          </span>
          <span className="rounded-md bg-green-50 px-2 py-0.5 font-medium text-green-700">
            {kpi.measurement_frequency_display}
          </span>
          {kpi.default_data_source && (
            <span className="text-gray-500">Source: {kpi.default_data_source}</span>
          )}
        </div>
        {kpi.default_formula && (
          <p className="mt-1 text-xs italic text-gray-500">
            📊 Formula: {kpi.default_formula}
          </p>
        )}
        {(kpi.suggested_target_minimum ||
          kpi.suggested_target_expected ||
          kpi.suggested_target_exceptional) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {kpi.suggested_baseline && (
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700">
                Baseline: {kpi.suggested_baseline}
              </span>
            )}
            {kpi.suggested_target_minimum && (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800">
                Min: {kpi.suggested_target_minimum}
              </span>
            )}
            {kpi.suggested_target_expected && (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-800">
                Expected: {kpi.suggested_target_expected}
              </span>
            )}
            {kpi.suggested_target_exceptional && (
              <span className="rounded-md bg-green-50 px-2 py-0.5 text-green-800">
                Exceptional: {kpi.suggested_target_exceptional}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={onEdit}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
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
  kpi: KPILibraryItem | null;
  kraId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!kpi;

  const [form, setForm] = useState<KPILibraryCreatePayload>({
    kra: kpi?.kra ?? kraId,
    name: kpi?.name ?? '',
    description: kpi?.description ?? '',
    indicator_type: kpi?.indicator_type ?? 'OUTPUT',
    kpi_type: kpi?.kpi_type ?? 'NUMERIC_UP',
    default_formula: kpi?.default_formula ?? '',
    default_data_source: kpi?.default_data_source ?? '',
    measurement_frequency: kpi?.measurement_frequency ?? 'QUARTERLY',
    suggested_baseline: kpi?.suggested_baseline ?? '',
    suggested_target_minimum: kpi?.suggested_target_minimum ?? '',
    suggested_target_expected: kpi?.suggested_target_expected ?? '',
    suggested_target_exceptional: kpi?.suggested_target_exceptional ?? '',
    is_active: kpi?.is_active ?? true,
  });

  const [saving, setSaving] = useState(false);

  const update = <K extends keyof KPILibraryCreatePayload>(
    field: K,
    value: KPILibraryCreatePayload[K]
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');

    setSaving(true);
    try {
      if (isEdit) {
        await kpiLibraryApi.update(kpi!.id, form);
        toast.success('KPI option updated');
      } else {
        await kpiLibraryApi.create(form);
        toast.success('KPI option created');
      }
      onSuccess();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Save failed';
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100">
              <Zap className="h-4 w-4 text-primary-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              {isEdit ? 'Edit KPI Option' : 'New KPI Option'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4">
            {/* Name */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="e.g. Code coverage"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="What this KPI measures"
              />
            </div>

            {/* Types */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Indicator Type
                </label>
                <select
                  value={form.indicator_type}
                  onChange={(e) => update('indicator_type', e.target.value as IndicatorType)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {INDICATOR_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Measurement Frequency
                </label>
                <select
                  value={form.measurement_frequency}
                  onChange={(e) =>
                    update('measurement_frequency', e.target.value as MeasurementFrequency)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* KPI Type */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                KPI Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {KPI_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update('kpi_type', opt.value)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      form.kpi_type === opt.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-500'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Formula + Source */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Default Formula
                </label>
                <input
                  type="text"
                  value={form.default_formula}
                  onChange={(e) => update('default_formula', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="e.g. (Covered / Total) × 100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Default Data Source
                </label>
                <input
                  type="text"
                  value={form.default_data_source}
                  onChange={(e) => update('default_data_source', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="e.g. SonarQube, Jira"
                />
              </div>
            </div>

            {/* Suggested Values Section */}
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-gray-500" />
                <h4 className="text-xs font-semibold uppercase text-gray-600">
                  Suggested Values (Guides Employees)
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Baseline (Current)</label>
                  <input
                    type="text"
                    value={form.suggested_baseline}
                    onChange={(e) => update('suggested_baseline', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="e.g. 65%"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Min Acceptable</label>
                  <input
                    type="text"
                    value={form.suggested_target_minimum}
                    onChange={(e) => update('suggested_target_minimum', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="e.g. 75%"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Expected</label>
                  <input
                    type="text"
                    value={form.suggested_target_expected}
                    onChange={(e) => update('suggested_target_expected', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="e.g. 80%"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Exceptional</label>
                  <input
                    type="text"
                    value={form.suggested_target_exceptional}
                    onChange={(e) => update('suggested_target_exceptional', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="e.g. 90%"
                  />
                </div>
              </div>
            </div>

            {/* Active */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => update('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-gray-700">Active</span>
            </label>
          </div>
        </div>

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