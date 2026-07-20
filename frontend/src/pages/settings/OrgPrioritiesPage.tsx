import { useEffect, useMemo, useState } from 'react';
import {
  Target, Plus, Trash2, Edit, Loader2, Info, X, Save,
  Calendar, User, TrendingUp, Filter,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { orgPrioritiesApi } from '../../api/performance';
import { employeesApi } from '../../api/employees';
import type {
  OrganizationalPriority,
  OrgPriorityCreatePayload,
  ReviewFrequency,
} from '../../types/performance';
import type { ManagerOption } from '../../api/employees';
import toast from 'react-hot-toast';

const REVIEW_FREQ_OPTIONS: { value: ReviewFrequency; label: string; color: string }[] = [
  { value: 'MONTHLY', label: 'Monthly', color: 'bg-blue-100 text-blue-700' },
  { value: 'QUARTERLY', label: 'Quarterly', color: 'bg-purple-100 text-purple-700' },
  { value: 'HALF_YEARLY', label: 'Half-Yearly', color: 'bg-amber-100 text-amber-700' },
  { value: 'YEARLY', label: 'Yearly', color: 'bg-green-100 text-green-700' },
];

// Generate current + past 2 + next 2 FY options
function generateFYOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  for (let i = -2; i <= 2; i++) {
    const y = currentYear + i;
    options.push(`FY ${y}-${(y + 1).toString().slice(-2)}`);
  }
  return options;
}

export default function OrgPrioritiesPage() {
  const [priorities, setPriorities] = useState<OrganizationalPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<OrganizationalPriority | null>(null);

  // Filters
  const fyOptions = useMemo(() => generateFYOptions(), []);
  const defaultFY = useMemo(() => {
    // Default to current FY (e.g., 2026-27)
    const now = new Date();
    const y = now.getFullYear();
    return `FY ${y}-${(y + 1).toString().slice(-2)}`;
  }, []);
  const [selectedFY, setSelectedFY] = useState<string>(defaultFY);
  const [showInactive, setShowInactive] = useState(false);

  const fetchPriorities = async () => {
    setLoading(true);
    try {
      const data = await orgPrioritiesApi.list({
        financial_year: selectedFY,
      });
      setPriorities(data);
    } catch (err) {
      toast.error('Failed to load priorities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPriorities();
  }, [selectedFY]);

  const filteredPriorities = useMemo(() => {
    let list = [...priorities];
    if (!showInactive) list = list.filter((p) => p.is_active);
    return list.sort((a, b) => a.priority_number - b.priority_number);
  }, [priorities, showInactive]);

  const handleDelete = async (priority: OrganizationalPriority) => {
    if (!confirm(`Delete priority "${priority.title}"?`)) return;
    try {
      await orgPrioritiesApi.delete(priority.id);
      toast.success('Priority deleted');
      fetchPriorities();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const nextPriorityNumber = useMemo(() => {
    const max = Math.max(0, ...priorities.map((p) => p.priority_number));
    return Math.min(max + 1, 8);
  }, [priorities]);

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (p: OrganizationalPriority) => {
    setEditing(p);
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
                <Target className="h-6 w-6 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">
                  Organizational Priorities
                </h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Strategic priorities set by top management for each financial year (5-8 per year)
              </p>
            </div>
            <button
              onClick={openCreate}
              disabled={priorities.filter((p) => p.is_active).length >= 8}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              title={
                priorities.filter((p) => p.is_active).length >= 8
                  ? 'Max 8 active priorities per FY'
                  : 'Add new priority'
              }
            >
              <Plus className="h-4 w-4" />
              New Priority
            </button>
          </div>

          {/* Info banner */}
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Strategic Cascade</p>
              <p className="mt-1 text-blue-700">
                Priorities cascade down: <strong>CEO → Departmental KRAs → Employee Scorecards</strong>.
                Each employee's KRAs should align with one of these priorities. Recommended: 5-8 
                priorities per year, each with a clear owner and review frequency.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {fyOptions.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </div>
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
              {filteredPriorities.length} of {priorities.length}
              {filteredPriorities.filter((p) => p.is_active).length > 0 && (
                <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-primary-700">
                  {filteredPriorities.filter((p) => p.is_active).length} active
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filteredPriorities.length === 0 ? (
            <EmptyState fy={selectedFY} onNew={openCreate} />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredPriorities.map((p) => (
                <PriorityCard
                  key={p.id}
                  priority={p}
                  onEdit={() => openEdit(p)}
                  onDelete={() => handleDelete(p)}
                />
              ))}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <PriorityModal
              priority={editing}
              defaultFY={selectedFY}
              nextPriorityNumber={nextPriorityNumber}
              onClose={() => setShowModal(false)}
              onSuccess={() => {
                setShowModal(false);
                fetchPriorities();
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

function EmptyState({ fy, onNew }: { fy: string; onNew: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
      <Target className="mx-auto h-12 w-12 text-gray-300" />
      <h3 className="mt-4 text-base font-semibold text-gray-900">
        No priorities for {fy}
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Set 5-8 strategic priorities to align the organization's goals for this year.
      </p>
      <button
        onClick={onNew}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        <Plus className="h-4 w-4" />
        Create First Priority
      </button>
    </div>
  );
}

// ==============================================================================
// PRIORITY CARD
// ==============================================================================

function PriorityCard({
  priority,
  onEdit,
  onDelete,
}: {
  priority: OrganizationalPriority;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const freqConfig = REVIEW_FREQ_OPTIONS.find((f) => f.value === priority.review_frequency);

  return (
    <div className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md">
      <div className="flex items-start gap-4">
        {/* Priority number badge */}
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-xl font-bold text-white shadow-sm">
          #{priority.priority_number}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900">{priority.title}</h3>
              <p className="mt-0.5 text-sm text-gray-600">{priority.description}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
              <button
                onClick={onEdit}
                className="rounded-lg p-2 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={onDelete}
                className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Target */}
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800">
            <TrendingUp className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Target:</span>
            <span>{priority.target}</span>
          </div>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            {/* Owner */}
            {priority.owner_name ? (
              <span className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-gray-700">
                <User className="h-3 w-3" />
                <span className="font-medium">Owner:</span> {priority.owner_name}
                <span className="text-gray-400">({priority.owner_employee_id})</span>
              </span>
            ) : (
              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs italic text-gray-500">
                No owner assigned
              </span>
            )}

            {/* Frequency */}
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                freqConfig?.color || 'bg-gray-100 text-gray-700'
              }`}
            >
              {freqConfig?.label} review
            </span>

            {/* Active */}
            {!priority.is_active && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                Inactive
              </span>
            )}

            {/* FY */}
            <span className="ml-auto flex items-center gap-1 text-gray-400">
              <Calendar className="h-3 w-3" />
              {priority.financial_year}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// CREATE / EDIT MODAL
// ==============================================================================

function PriorityModal({
  priority,
  defaultFY,
  nextPriorityNumber,
  onClose,
  onSuccess,
}: {
  priority: OrganizationalPriority | null;
  defaultFY: string;
  nextPriorityNumber: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!priority;

  const [form, setForm] = useState<OrgPriorityCreatePayload>({
    financial_year: priority?.financial_year ?? defaultFY,
    priority_number: priority?.priority_number ?? nextPriorityNumber,
    title: priority?.title ?? '',
    description: priority?.description ?? '',
    target: priority?.target ?? '',
    owner: priority?.owner ?? null,
    review_frequency: priority?.review_frequency ?? 'QUARTERLY',
    is_active: priority?.is_active ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState<ManagerOption[]>([]);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [loadingOwners, setLoadingOwners] = useState(false);

  const fyOptions = useMemo(() => generateFYOptions(), []);

  // Load owner options
  useEffect(() => {
    const loadOwners = async () => {
      setLoadingOwners(true);
      try {
        const data = await employeesApi.getManagers(ownerSearch);
        setOwnerOptions(data);
      } catch {
        // ignore
      } finally {
        setLoadingOwners(false);
      }
    };
    const timer = setTimeout(loadOwners, 300);
    return () => clearTimeout(timer);
  }, [ownerSearch]);

  const update = <K extends keyof OrgPriorityCreatePayload>(
    field: K,
    value: OrgPriorityCreatePayload[K]
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.description.trim()) return toast.error('Description is required');
    if (!form.target.trim()) return toast.error('Target is required');
    if (form.priority_number < 1 || form.priority_number > 8) {
      return toast.error('Priority number must be 1-8');
    }

    setSaving(true);
    try {
      if (isEdit) {
        await orgPrioritiesApi.update(priority!.id, form);
        toast.success('Priority updated');
      } else {
        await orgPrioritiesApi.create(form);
        toast.success('Priority created');
      }
      onSuccess();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        err?.response?.data?.priority_number?.[0] ||
        'Save failed';
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  const selectedOwner = ownerOptions.find((o) => o.id === form.owner);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white">
              #{form.priority_number}
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              {isEdit ? 'Edit Priority' : 'New Strategic Priority'}
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
            {/* FY + Priority # */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
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
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Priority # <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={form.priority_number}
                  onChange={(e) => update('priority_number', parseInt(e.target.value) || 1)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">1-8 rank</p>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="e.g. Grow Revenue by 20%"
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
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Detailed explanation of this strategic priority"
              />
            </div>

            {/* Target */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Target <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.target}
                onChange={(e) => update('target', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="e.g. ₹100 Cr in FY26, 4.5/5 CSAT, 500 new customers"
              />
              <p className="mt-1 text-xs text-gray-500">
                Concrete measurable outcome for this priority
              </p>
            </div>

            {/* Owner */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Executive Owner
              </label>
              <select
                value={form.owner || ''}
                onChange={(e) => update('owner', e.target.value || null)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">— No owner assigned —</option>
                {ownerOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.full_name} ({opt.employee_id})
                  </option>
                ))}
                {/* Include current owner if not in list */}
                {selectedOwner === undefined && priority?.owner && priority?.owner_name && (
                  <option value={priority.owner}>
                    {priority.owner_name} ({priority.owner_employee_id})
                  </option>
                )}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {loadingOwners ? 'Loading...' : 'CFO, CTO, COO, etc.'}
              </p>
            </div>

            {/* Review Frequency */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Review Frequency <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {REVIEW_FREQ_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update('review_frequency', opt.value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      form.review_frequency === opt.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-500'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active */}
            <label className="flex items-center gap-2 text-sm pt-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => update('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-gray-700">Active priority</span>
            </label>
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