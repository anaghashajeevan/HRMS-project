import { useEffect, useState } from 'react';
import {
  Award, Plus, Trash2, Edit, Loader2, Sparkles,
  AlertCircle, X, Save, Info,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { ratingScalesApi } from '../../api/performance';
import type { RatingScale, RatingScaleCreatePayload } from '../../types/performance';
import toast from 'react-hot-toast';

const DEFAULT_COLORS = [
  '#EF4444', // Red (1)
  '#F59E0B', // Amber (2)
  '#3B82F6', // Blue (3)
  '#22C55E', // Green (4)
  '#16A34A', // Dark Green (5)
];

export default function RatingScalePage() {
  const [scales, setScales] = useState<RatingScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingScale, setEditingScale] = useState<RatingScale | null>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchScales = async () => {
    setLoading(true);
    try {
      const data = await ratingScalesApi.list();
      setScales(data);
    } catch (err) {
      toast.error('Failed to load rating scales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScales();
  }, []);

  const handleSeedDefaults = async () => {
    if (scales.length > 0) {
      if (!confirm('Rating scales already exist. Seed will only add missing ones. Continue?')) {
        return;
      }
    }
    setSeeding(true);
    try {
      const result = await ratingScalesApi.seedDefaults();
      toast.success(result.message);
      fetchScales();
    } catch (err) {
      toast.error('Failed to seed default rating scales');
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (scale: RatingScale) => {
    if (!confirm(`Delete rating band "${scale.rating} - ${scale.label}"?`)) return;
    try {
      await ratingScalesApi.delete(scale.id);
      toast.success('Rating band deleted');
      fetchScales();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const openCreateModal = () => {
    setEditingScale(null);
    setShowModal(true);
  };

  const openEditModal = (scale: RatingScale) => {
    setEditingScale(scale);
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
                <Award className="h-6 w-6 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">Rating Scale</h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Company-wide performance rating bands (1-5) with score thresholds
              </p>
            </div>
            <div className="flex items-center gap-2">
              {scales.length === 0 && (
                <button
                  onClick={handleSeedDefaults}
                  disabled={seeding}
                  className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                >
                  {seeding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Seed 5-Band Defaults
                </button>
              )}
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                New Band
              </button>
            </div>
          </div>

          {/* Info banner */}
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">How Rating Scale Works</p>
              <p className="mt-1 text-blue-700">
                Employee performance scores (%) are mapped to rating bands. Higher rating (5) = 
                better performance. Bands trigger different outcomes (promotions, PIP, increments). 
                Each band has min/max % range and a color for dashboards.
              </p>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : scales.length === 0 ? (
            <EmptyState onSeed={handleSeedDefaults} seeding={seeding} />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {scales.map((scale) => (
                <RatingScaleCard
                  key={scale.id}
                  scale={scale}
                  onEdit={() => openEditModal(scale)}
                  onDelete={() => handleDelete(scale)}
                />
              ))}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <RatingScaleModal
              scale={editingScale}
              onClose={() => setShowModal(false)}
              onSuccess={() => {
                setShowModal(false);
                fetchScales();
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

function EmptyState({ onSeed, seeding }: { onSeed: () => void; seeding: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
      <Award className="mx-auto h-12 w-12 text-gray-300" />
      <h3 className="mt-4 text-base font-semibold text-gray-900">
        No rating scale configured
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Set up your rating bands to enable performance scoring across the company.
      </p>
      <button
        onClick={onSeed}
        disabled={seeding}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {seeding ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Auto-Create 5-Band Rating Scale
      </button>
      <p className="mt-3 text-xs text-gray-500">
        Creates: Outstanding, Exceeds, Meets, Needs Improvement, Unsatisfactory
      </p>
    </div>
  );
}

// ==============================================================================
// RATING SCALE CARD
// ==============================================================================

function RatingScaleCard({
  scale,
  onEdit,
  onDelete,
}: {
  scale: RatingScale;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md"
      style={{ borderLeft: `6px solid ${scale.color_code}` }}
    >
      {/* Rating badge */}
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
        style={{ backgroundColor: scale.color_code }}
      >
        {scale.rating}
      </div>

      {/* Details */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900">{scale.label}</h3>
          {scale.triggers_pip && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              <AlertCircle className="h-3 w-3" />
              Triggers PIP
            </span>
          )}
          {!scale.is_active && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              Inactive
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">{scale.description || 'No description'}</p>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-gray-700">
            {scale.min_percent}% — {scale.max_percent}%
          </span>
        </div>
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
  );
}

// ==============================================================================
// CREATE / EDIT MODAL
// ==============================================================================

function RatingScaleModal({
  scale,
  onClose,
  onSuccess,
}: {
  scale: RatingScale | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!scale;

  const [form, setForm] = useState<RatingScaleCreatePayload>({
    rating: scale?.rating ?? 3,
    label: scale?.label ?? '',
    description: scale?.description ?? '',
    min_percent: scale ? Number(scale.min_percent) : 90,
    max_percent: scale ? Number(scale.max_percent) : 105,
    color_code: scale?.color_code ?? '#3B82F6',
    triggers_pip: scale?.triggers_pip ?? false,
    is_active: scale?.is_active ?? true,
  });

  const [saving, setSaving] = useState(false);

  const update = <K extends keyof RatingScaleCreatePayload>(
    field: K,
    value: RatingScaleCreatePayload[K]
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.label.trim()) {
      toast.error('Label is required');
      return;
    }
    if (form.rating < 1 || form.rating > 10) {
      toast.error('Rating must be between 1-10');
      return;
    }
    if (Number(form.min_percent) > Number(form.max_percent)) {
      toast.error('Min % must be less than or equal to Max %');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await ratingScalesApi.update(scale!.id, form);
        toast.success('Rating band updated');
      } else {
        await ratingScalesApi.create(form);
        toast.success('Rating band created');
      }
      onSuccess();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.rating?.[0] ||
        err?.response?.data?.non_field_errors?.[0] ||
        'Save failed';
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: form.color_code }}
            >
              <Award className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              {isEdit ? 'Edit Rating Band' : 'New Rating Band'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4">
            {/* Rating + Label */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Rating <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.rating}
                  onChange={(e) => update('rating', parseInt(e.target.value) || 1)}
                  disabled={isEdit}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50"
                />
              </div>
              <div className="col-span-3">
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => update('label', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="e.g. Outstanding"
                />
              </div>
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
                placeholder="e.g. Exceptional performance, far exceeds expectations"
              />
            </div>

            {/* Percent Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Min % <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.min_percent}
                  onChange={(e) => update('min_percent', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Max % <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.max_percent}
                  onChange={(e) => update('max_percent', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">Use 999 for open-ended top band</p>
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color_code}
                  onChange={(e) => update('color_code', e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded-lg border border-gray-300"
                />
                <input
                  type="text"
                  value={form.color_code}
                  onChange={(e) => update('color_code', e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <div className="flex gap-1">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => update('color_code', c)}
                      className="h-8 w-8 rounded-lg border-2 border-white shadow-sm ring-1 ring-gray-200 hover:scale-110"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => update('is_active', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-700">Active</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.triggers_pip}
                  onChange={(e) => update('triggers_pip', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-700">
                  Triggers Performance Improvement Plan (PIP)
                </span>
              </label>
            </div>

            {/* Preview */}
            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">Preview</p>
              <div
                className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm"
                style={{ borderLeft: `6px solid ${form.color_code}` }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white font-bold"
                  style={{ backgroundColor: form.color_code }}
                >
                  {form.rating}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {form.label || 'Label'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {form.min_percent}% — {form.max_percent}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
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