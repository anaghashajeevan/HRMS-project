import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Plus, Trash2, Edit, Loader2, Info, X, Save,
  Search, Filter, Users, Star, Zap, Building2, Briefcase,
  CheckCircle, Sparkles, ArrowRight,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { kraLibraryApi } from '../../api/performance';
import { structuresApi, positionsApi } from '../../api/masterData';
import type {
  KRALibrary, KRALibraryCreatePayload, KRASource,
} from '../../types/performance';
import type { CompanyStructure, JobPosition } from '../../types/masterData';
import toast from 'react-hot-toast';

const KRA_SOURCE_CONFIG: Record<
  KRASource,
  { label: string; icon: string; color: string; bgColor: string; description: string }
> = {
  ROLE: {
    label: 'Role-Based',
    icon: '💼',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    description: 'Applies to specific job positions',
  },
  COMMON: {
    label: 'Common',
    icon: '🤝',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
    description: 'Applies to all employees',
  },
  DEPARTMENTAL: {
    label: 'Departmental',
    icon: '🏢',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    description: 'Applies to specific departments',
  },
};

export default function KRALibraryPage() {
  const navigate = useNavigate();
  const [kras, setKras] = useState<KRALibrary[]>([]);
  const [departments, setDepartments] = useState<CompanyStructure[]>([]);
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<KRALibrary | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [peerFilter, setPeerFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [krasData, deptsData, posData] = await Promise.all([
        kraLibraryApi.list(),
        structuresApi.list({ type: 'DEPARTMENT' }),
        positionsApi.list(),
      ]);
      setKras(krasData);
      setDepartments(deptsData.results || []);
      setPositions(posData.results || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    let list = [...kras];
    if (!showInactive) list = list.filter((k) => k.is_active);
    if (sourceFilter) list = list.filter((k) => k.kra_source === sourceFilter);
    if (peerFilter === 'yes') list = list.filter((k) => k.peer_rating_required);
    if (peerFilter === 'no') list = list.filter((k) => !k.peer_rating_required);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (k) =>
          k.name.toLowerCase().includes(q) ||
          k.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [kras, search, sourceFilter, peerFilter, showInactive]);

  const stats = useMemo(() => {
    return {
      total: kras.filter((k) => k.is_active).length,
      role: kras.filter((k) => k.is_active && k.kra_source === 'ROLE').length,
      common: kras.filter((k) => k.is_active && k.kra_source === 'COMMON').length,
      dept: kras.filter((k) => k.is_active && k.kra_source === 'DEPARTMENTAL').length,
      peer: kras.filter((k) => k.is_active && k.peer_rating_required).length,
      mandatory: kras.filter((k) => k.is_active && k.is_mandatory).length,
    };
  }, [kras]);

  const handleDelete = async (kra: KRALibrary) => {
    if (!confirm(`Delete KRA "${kra.name}"?`)) return;
    try {
      await kraLibraryApi.delete(kra.id);
      toast.success('KRA deleted');
      fetchAll();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (kra: KRALibrary) => {
    setEditing(kra);
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
                <TrendingUp className="h-6 w-6 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">KRA Library</h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Master pool of KRAs that employees pick from when building their scorecard
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              New KRA
            </button>
          </div>

          {/* Stats bar */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
            <StatCard label="Total Active" value={stats.total} color="bg-primary-50 text-primary-700" />
            <StatCard label="💼 Role" value={stats.role} color="bg-blue-50 text-blue-700" />
            <StatCard label="🤝 Common" value={stats.common} color="bg-purple-50 text-purple-700" />
            <StatCard label="🏢 Department" value={stats.dept} color="bg-amber-50 text-amber-700" />
            <StatCard label="🌟 Peer Rated" value={stats.peer} color="bg-pink-50 text-pink-700" />
            <StatCard label="⚡ Mandatory" value={stats.mandatory} color="bg-red-50 text-red-700" />
          </div>

          {/* Info banner */}
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">How the KRA Library works</p>
              <p className="mt-1 text-blue-700">
                Create KRAs employees can pick from. Mark <strong>Common</strong> to apply to everyone,
                <strong> Role-based</strong> for specific positions, or <strong>Departmental</strong> for
                specific departments. Mark <strong>Peer Rating Required</strong> for KRAs like Team
                Collaboration. Mark <strong>Mandatory</strong> if it must be auto-added to every employee.
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
                placeholder="Search KRAs..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Sources</option>
              <option value="ROLE">💼 Role-Based</option>
              <option value="COMMON">🤝 Common</option>
              <option value="DEPARTMENTAL">🏢 Departmental</option>
            </select>
            <select
              value={peerFilter}
              onChange={(e) => setPeerFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All KRAs</option>
              <option value="yes">🌟 Peer-Rated Only</option>
              <option value="no">Self+Manager Only</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Show inactive
            </label>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Filter className="h-3 w-3" />
              {filtered.length} of {kras.length}
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtered.map((kra) => (
                <KRACard
                  key={kra.id}
                  kra={kra}
                  onEdit={() => openEdit(kra)}
                  onDelete={() => handleDelete(kra)}
                  onOpen={() => navigate(`/settings/kra-library/${kra.id}`)}
                />
              ))}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <KRAModal
              kra={editing}
              departments={departments}
              positions={positions}
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
// STAT CARD
// ==============================================================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}

// ==============================================================================
// EMPTY STATE
// ==============================================================================

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
      <TrendingUp className="mx-auto h-12 w-12 text-gray-300" />
      <h3 className="mt-4 text-base font-semibold text-gray-900">
        No KRAs in library yet
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Create your first KRA — employees will pick from these when building scorecards.
      </p>
      <button
        onClick={onNew}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        <Plus className="h-4 w-4" />
        Create First KRA
      </button>
    </div>
  );
}

// ==============================================================================
// KRA CARD
// ==============================================================================

function KRACard({
  kra,
  onEdit,
  onDelete,
  onOpen,
}: {
  kra: KRALibrary;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const sourceConfig = KRA_SOURCE_CONFIG[kra.kra_source];

  return (
    <div className="group flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md">
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${sourceConfig.bgColor} ${sourceConfig.color}`}
            >
              {sourceConfig.icon} {sourceConfig.label}
            </span>
            {kra.peer_rating_required && (
              <span className="flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700 ring-1 ring-pink-200">
                <Star className="h-3 w-3 fill-current" />
                Peer Rating
              </span>
            )}
            {kra.is_mandatory && (
              <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                <Sparkles className="h-3 w-3" />
                Mandatory
              </span>
            )}
            {!kra.is_active && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                Inactive
              </span>
            )}
          </div>
          <h3 className="mt-2 text-base font-semibold text-gray-900">{kra.name}</h3>
          <p className="mt-1 text-xs text-gray-600 line-clamp-2">{kra.description}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-1 opacity-0 transition group-hover:opacity-100">
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

      {/* Applicability */}
      {kra.kra_source === 'ROLE' && kra.applicable_position_titles.length > 0 && (
        <div className="mb-2 flex items-start gap-1 text-xs">
          <Briefcase className="mt-0.5 h-3 w-3 text-gray-400" />
          <div className="flex flex-wrap gap-1">
            {kra.applicable_position_titles.slice(0, 3).map((p) => (
              <span key={p.id} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-700">
                {p.title}
              </span>
            ))}
            {kra.applicable_position_titles.length > 3 && (
              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-500">
                +{kra.applicable_position_titles.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {kra.kra_source === 'DEPARTMENTAL' && kra.applicable_department_names.length > 0 && (
        <div className="mb-2 flex items-start gap-1 text-xs">
          <Building2 className="mt-0.5 h-3 w-3 text-gray-400" />
          <div className="flex flex-wrap gap-1">
            {kra.applicable_department_names.slice(0, 3).map((d) => (
              <span key={d.id} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-700">
                {d.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {kra.kra_source === 'COMMON' && (
        <div className="mb-2 flex items-center gap-1 text-xs text-purple-600">
          <Users className="h-3 w-3" />
          <span>Applies to all employees</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span className="font-medium">{kra.kpi_count}</span> KPI{kra.kpi_count !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">•</span>
          <span>Weight: {kra.suggested_weight_min}%-{kra.suggested_weight_max}%</span>
        </div>
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          Manage KPIs
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ==============================================================================
// CREATE / EDIT MODAL
// ==============================================================================

function KRAModal({
  kra,
  departments,
  positions,
  onClose,
  onSuccess,
}: {
  kra: KRALibrary | null;
  departments: CompanyStructure[];
  positions: JobPosition[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!kra;

  const [form, setForm] = useState<KRALibraryCreatePayload>({
    name: kra?.name ?? '',
    description: kra?.description ?? '',
    kra_source: kra?.kra_source ?? 'ROLE',
    applicable_positions: kra?.applicable_positions ?? [],
    applicable_departments: kra?.applicable_departments ?? [],
    peer_rating_required: kra?.peer_rating_required ?? false,
    is_mandatory: kra?.is_mandatory ?? false,
    suggested_weight_min: kra ? Number(kra.suggested_weight_min) : 5,
    suggested_weight_max: kra ? Number(kra.suggested_weight_max) : 30,
    is_active: kra?.is_active ?? true,
  });

  const [saving, setSaving] = useState(false);

  const update = <K extends keyof KRALibraryCreatePayload>(
    field: K,
    value: KRALibraryCreatePayload[K]
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const togglePosition = (posId: string) => {
    const current = form.applicable_positions ?? [];
    update(
      'applicable_positions',
      current.includes(posId) ? current.filter((p) => p !== posId) : [...current, posId]
    );
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
    if (!form.description.trim()) return toast.error('Description is required');
    if (
      form.suggested_weight_min !== undefined &&
      form.suggested_weight_max !== undefined &&
      form.suggested_weight_min > form.suggested_weight_max
    ) {
      return toast.error('Min weight must be less than max weight');
    }

    setSaving(true);
    try {
      if (isEdit) {
        await kraLibraryApi.update(kra!.id, form);
        toast.success('KRA updated');
      } else {
        await kraLibraryApi.create(form);
        toast.success('KRA created');
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100">
              <TrendingUp className="h-4 w-4 text-primary-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              {isEdit ? 'Edit KRA' : 'New Library KRA'}
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
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4">
            {/* KRA Source */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase text-gray-500">
                Source Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['ROLE', 'COMMON', 'DEPARTMENTAL'] as KRASource[]).map((src) => {
                  const cfg = KRA_SOURCE_CONFIG[src];
                  const selected = form.kra_source === src;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => update('kra_source', src)}
                      className={`rounded-lg border p-3 text-left transition ${
                        selected
                          ? `${cfg.bgColor} ring-2 ring-primary-500`
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className={`text-lg ${selected ? cfg.color : ''}`}>{cfg.icon}</div>
                      <div className={`mt-1 text-sm font-medium ${selected ? cfg.color : 'text-gray-900'}`}>
                        {cfg.label}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">{cfg.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

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
                placeholder="e.g. Code Quality & Delivery"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="What responsibility does this KRA represent?"
              />
            </div>

            {/* Applicable positions (only if ROLE) */}
            {form.kra_source === 'ROLE' && (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Applicable Positions
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Leave empty to apply to all positions
                </p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-2">
                  {positions.length === 0 ? (
                    <p className="p-2 text-xs text-gray-500">No positions available</p>
                  ) : (
                    positions.map((pos) => (
                      <label
                        key={pos.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.applicable_positions?.includes(pos.id) ?? false}
                          onChange={() => togglePosition(pos.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-gray-700">
                          {pos.title}{' '}
                          <span className="text-xs text-gray-400">({pos.grade_band})</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Applicable departments (only if DEPARTMENTAL) */}
            {form.kra_source === 'DEPARTMENTAL' && (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Applicable Departments
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Leave empty to apply to all departments
                </p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-2">
                  {departments.length === 0 ? (
                    <p className="p-2 text-xs text-gray-500">No departments available</p>
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
            )}

            {/* Weight Range */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Suggested Weight Range (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.suggested_weight_min}
                  onChange={(e) =>
                    update('suggested_weight_min', parseFloat(e.target.value) || 0)
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-500">to</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.suggested_weight_max}
                  onChange={(e) =>
                    update('suggested_weight_max', parseFloat(e.target.value) || 0)
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Guides employees when assigning weight to this KRA
              </p>
            </div>

            {/* Toggles */}
            <div className="space-y-2 rounded-xl bg-gray-50 p-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.peer_rating_required}
                  onChange={(e) => update('peer_rating_required', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <div className="flex items-center gap-1 font-medium text-gray-900">
                    <Star className="h-3.5 w-3.5 text-pink-600" />
                    Peer Rating Required
                  </div>
                  <p className="text-xs text-gray-500">
                    Peers must rate this KRA (for Team Collaboration, Communication, etc.)
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_mandatory}
                  onChange={(e) => update('is_mandatory', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <div className="flex items-center gap-1 font-medium text-gray-900">
                    <Sparkles className="h-3.5 w-3.5 text-red-600" />
                    Mandatory
                  </div>
                  <p className="text-xs text-gray-500">
                    Auto-added to every applicable employee's scorecard (e.g., Compliance)
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => update('is_active', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <div className="flex items-center gap-1 font-medium text-gray-900">
                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    Active
                  </div>
                  <p className="text-xs text-gray-500">Available for employees to pick</p>
                </div>
              </label>
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