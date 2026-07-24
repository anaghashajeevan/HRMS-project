import { useEffect, useState } from 'react';
import {
  Plus, Edit2, Trash2, Loader2, X, Save, Palette,
  CheckCircle2, AlertCircle, Info, Calendar, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { leaveTypesApi } from '../../api/leave';
import type { LeaveType, AccrualType, GenderApplicability } from '../../types/leave';

// Default leave type templates
const DEFAULT_TEMPLATES: Array<Partial<LeaveType>> = [
  {
    code: 'CL', name: 'Casual Leave',
    description: 'For personal/family reasons (short notice OK)',
    is_paid: true, accrual_type: 'YEARLY', yearly_quota: 12,
    max_consecutive_days: 3, allowed_during_probation: true,
    color_code: '#3B82F6', display_order: 1, is_active: true,
    can_apply_half_day: true, requires_manager_approval: true,
  },
  {
    code: 'SL', name: 'Sick Leave',
    description: 'For medical reasons (may need certificate)',
    is_paid: true, accrual_type: 'YEARLY', yearly_quota: 10,
    requires_document: true, max_consecutive_days: 5,
    allowed_during_probation: true,
    color_code: '#EF4444', display_order: 2, is_active: true,
    can_apply_half_day: true, requires_manager_approval: true,
  },
  {
    code: 'EL', name: 'Earned Leave',
    description: 'Planned/vacation leave (accrues monthly)',
    is_paid: true, accrual_type: 'MONTHLY', yearly_quota: 15,
    accrual_per_period: 1.25, can_carry_forward: true,
    max_carry_forward: 30, can_encash: true, max_encashment_days: 15,
    min_days_before_apply: 3, max_consecutive_days: 15,
    min_service_months: 6,
    color_code: '#10B981', display_order: 3, is_active: true,
    can_apply_half_day: true, requires_manager_approval: true,
  },
  {
    code: 'COMP_OFF', name: 'Compensatory Off',
    description: 'Earned by working on weekend/holiday',
    is_paid: true, accrual_type: 'ON_DEMAND', yearly_quota: 0,
    min_days_before_apply: 1,
    color_code: '#F59E0B', display_order: 4, is_active: true,
    can_apply_half_day: true, requires_manager_approval: true,
  },
  {
    code: 'LOP', name: 'Loss of Pay',
    description: 'Unpaid leave (when no other balance available)',
    is_paid: false, accrual_type: 'ON_DEMAND', yearly_quota: 0,
    allowed_during_probation: true,
    color_code: '#6B7280', display_order: 99, is_active: true,
    can_apply_half_day: true, requires_manager_approval: true,
  },
];

const COLOR_PRESETS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6B7280',
];

export default function LeaveTypesPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<Partial<LeaveType> | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadLeaveTypes();
  }, []);

  const loadLeaveTypes = async () => {
    setLoading(true);
    try {
      const data = await leaveTypesApi.list();
      setLeaveTypes(data);
    } catch (error) {
      toast.error('Failed to load leave types');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!window.confirm(
      'This will create 5 default leave types:\n' +
      '• Casual Leave (12 days/year)\n' +
      '• Sick Leave (10 days/year)\n' +
      '• Earned Leave (15 days/year, monthly accrual)\n' +
      '• Compensatory Off\n' +
      '• Loss of Pay\n\n' +
      'Continue?'
    )) return;

    setSeeding(true);
    try {
      const result = await leaveTypesApi.seedDefaults();
      toast.success(result.message);
      await loadLeaveTypes();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to seed defaults');
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateNew = () => {
    setEditingType({
      code: '',
      name: '',
      description: '',
      is_paid: true,
      accrual_type: 'YEARLY',
      yearly_quota: 12,
      accrual_per_period: 0,
      can_carry_forward: false,
      max_carry_forward: 0,
      carry_forward_expiry_months: 12,
      can_encash: false,
      max_encashment_days: 0,
      encashment_basis: 'BASIC',
      requires_document: false,
      min_days_before_apply: 0,
      max_consecutive_days: 0,
      can_apply_half_day: true,
      allowed_during_probation: false,
      requires_manager_approval: true,
      requires_hr_approval: false,
      hr_approval_threshold_days: 5,
      auto_approve: false,
      min_service_months: 0,
      applicable_gender: 'ALL',
      color_code: '#3B82F6',
      display_order: 0,
      is_active: true,
    });
    setShowModal(true);
  };

  const handleUseTemplate = (template: Partial<LeaveType>) => {
    setEditingType({ ...template });
    setShowModal(true);
  };

  const handleEdit = (leaveType: LeaveType) => {
    setEditingType({ ...leaveType });
    setShowModal(true);
  };

  const handleDelete = async (leaveType: LeaveType) => {
    if (!window.confirm(`Delete "${leaveType.code} - ${leaveType.name}"?\n\nThis cannot be undone.`)) return;

    try {
      await leaveTypesApi.delete(leaveType.id);
      toast.success(`Deleted ${leaveType.code}`);
      await loadLeaveTypes();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleSave = async () => {
    if (!editingType) return;

    // Validation
    if (!editingType.code?.trim()) {
      toast.error('Code is required');
      return;
    }
    if (!editingType.name?.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingType.id) {
        // Update
        await leaveTypesApi.update(editingType.id, editingType);
        toast.success(`Updated ${editingType.code}`);
      } else {
        // Create
        await leaveTypesApi.create(editingType);
        toast.success(`Created ${editingType.code}`);
      }
      setShowModal(false);
      setEditingType(null);
      await loadLeaveTypes();
    } catch (error: any) {
      const errMsg = error?.response?.data?.detail
        || error?.response?.data?.code?.[0]
        || 'Failed to save';
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof LeaveType>(key: K, value: LeaveType[K]) => {
    if (!editingType) return;
    setEditingType({ ...editingType, [key]: value });
  };

  const hasNoTypes = !loading && leaveTypes.length === 0;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leave Types</h1>
              <p className="mt-1 text-sm text-gray-600">
                Configure leave types, accrual rules, and policies
              </p>
            </div>
            <div className="flex gap-3">
              {hasNoTypes && (
                <button
                  onClick={handleSeedDefaults}
                  disabled={seeding}
                  className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                >
                  {seeding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Load Defaults
                </button>
              )}
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                Add Leave Type
              </button>
            </div>
          </div>

          {/* Empty state with templates */}
          {hasNoTypes && (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">
                    No Leave Types Configured Yet
                  </h3>
                  <p className="mt-1 text-sm text-blue-700">
                    Start by clicking <strong>"Load Defaults"</strong> to create 5 standard leave types (CL, SL, EL, COMP_OFF, LOP), or add custom types individually.
                  </p>
                  <p className="mt-2 text-xs text-blue-600">
                    ⚠️ Leave types must exist before you can allocate balances to employees.
                  </p>
                </div>
              </div>

              {/* Template Quick Add */}
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-blue-900">Or add individually:</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {DEFAULT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.code}
                      onClick={() => handleUseTemplate(tpl)}
                      className="rounded-lg border border-blue-200 bg-white p-3 text-center hover:border-blue-400 hover:shadow-sm transition"
                    >
                      <div
                        className="mx-auto mb-1 h-3 w-3 rounded-full"
                        style={{ backgroundColor: tpl.color_code }}
                      />
                      <div className="text-xs font-semibold text-gray-900">{tpl.code}</div>
                      <div className="text-xs text-gray-500">{tpl.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Leave Types Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : leaveTypes.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {leaveTypes.map((lt) => (
                <div
                  key={lt.id}
                  className={`rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md ${
                    !lt.is_active ? 'opacity-60' : ''
                  }`}
                >
                  {/* Header with color + code */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold text-xs"
                        style={{ backgroundColor: lt.color_code }}
                      >
                        {lt.code}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{lt.name}</h3>
                        <p className="text-xs text-gray-500">
                          {lt.is_paid ? '💰 Paid' : '⚠️ Unpaid'} • {lt.accrual_type_display}
                        </p>
                      </div>
                    </div>
                    {!lt.is_active && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {lt.description && (
                    <p className="mb-3 text-sm text-gray-600">{lt.description}</p>
                  )}

                  {/* Stats grid */}
                  <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 p-2">
                      <div className="text-gray-500">Yearly Quota</div>
                      <div className="font-bold text-gray-900">{lt.yearly_quota} days</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2">
                      <div className="text-gray-500">Max Consecutive</div>
                      <div className="font-bold text-gray-900">
                        {lt.max_consecutive_days || '∞'} days
                      </div>
                    </div>
                    {lt.accrual_type === 'MONTHLY' && (
                      <div className="col-span-2 rounded-lg bg-green-50 p-2">
                        <div className="text-green-600">Monthly Accrual</div>
                        <div className="font-bold text-green-900">
                          +{lt.accrual_per_period} days/month
                        </div>
                      </div>
                    )}
                    {lt.can_carry_forward && (
                      <div className="col-span-2 rounded-lg bg-blue-50 p-2">
                        <div className="text-blue-600">Carry Forward</div>
                        <div className="font-bold text-blue-900">
                          Up to {lt.max_carry_forward} days
                        </div>
                      </div>
                    )}
                    {lt.can_encash && (
                      <div className="col-span-2 rounded-lg bg-amber-50 p-2">
                        <div className="text-amber-600">Encashment</div>
                        <div className="font-bold text-amber-900">
                          Up to {lt.max_encashment_days} days/year
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Flags */}
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {lt.requires_document && (
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                        📎 Doc required
                      </span>
                    )}
                    {lt.can_apply_half_day && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        Half-day OK
                      </span>
                    )}
                    {lt.allowed_during_probation && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                        Probation OK
                      </span>
                    )}
                    {lt.min_service_months > 0 && (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                        Min {lt.min_service_months}mo service
                      </span>
                    )}
                    {lt.applicable_gender !== 'ALL' && (
                      <span className="rounded-full bg-pink-50 px-2 py-0.5 text-xs text-pink-700">
                        {lt.applicable_gender} only
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 border-t border-gray-100 pt-3">
                    <button
                      onClick={() => handleEdit(lt)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(lt)}
                      className="flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Next steps banner (when types exist) */}
          {leaveTypes.length > 0 && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900">
                    Leave Types Configured ({leaveTypes.length})
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    Now go to <strong>Leave → Leave Balances</strong> and click "Allocate Balances" to create balances for all employees.
                  </p>
                </div>
                <a
                  href="/leave/balances"
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <Calendar className="h-4 w-4" />
                  Go to Balances
                </a>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Modal */}
      {showModal && editingType && (
        <LeaveTypeModal
          leaveType={editingType}
          onChange={updateField}
          onClose={() => {
            setShowModal(false);
            setEditingType(null);
          }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

// ==============================================================================
// MODAL COMPONENT
// ==============================================================================

interface LeaveTypeModalProps {
  leaveType: Partial<LeaveType>;
  onChange: <K extends keyof LeaveType>(key: K, value: LeaveType[K]) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}

function LeaveTypeModal({ leaveType, onChange, onClose, onSave, saving }: LeaveTypeModalProps) {
  const isEditing = !!leaveType.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? `Edit ${leaveType.code}` : 'Add Leave Type'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <Section title="Basic Information">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Code *" hint="Short code like CL, SL, EL">
                <input
                  type="text"
                  value={leaveType.code || ''}
                  onChange={(e) => onChange('code', e.target.value.toUpperCase() as any)}
                  className="input"
                  placeholder="e.g. CL"
                  maxLength={20}
                />
              </Field>
              <Field label="Name *">
                <input
                  type="text"
                  value={leaveType.name || ''}
                  onChange={(e) => onChange('name', e.target.value as any)}
                  className="input"
                  placeholder="e.g. Casual Leave"
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                value={leaveType.description || ''}
                onChange={(e) => onChange('description', e.target.value as any)}
                className="input"
                rows={2}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={leaveType.color_code || '#3B82F6'}
                    onChange={(e) => onChange('color_code', e.target.value as any)}
                    className="h-10 w-16 rounded border border-gray-300"
                  />
                  <div className="flex flex-wrap gap-1">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onChange('color_code', c as any)}
                        className="h-6 w-6 rounded-full border-2 border-white ring-1 ring-gray-300"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </Field>
              <Field label="Display Order">
                <input
                  type="number"
                  value={leaveType.display_order || 0}
                  onChange={(e) => onChange('display_order', Number(e.target.value) as any)}
                  className="input"
                />
              </Field>
            </div>
            <div className="flex gap-4">
              <Toggle
                label="Paid Leave"
                helper="Uncheck for LOP (unpaid)"
                checked={leaveType.is_paid ?? true}
                onChange={(v) => onChange('is_paid', v as any)}
              />
              <Toggle
                label="Active"
                helper="Show in leave application forms"
                checked={leaveType.is_active ?? true}
                onChange={(v) => onChange('is_active', v as any)}
              />
            </div>
          </Section>

          {/* Accrual Rules */}
          <Section title="Accrual Rules">
            <Field label="Accrual Type">
              <select
                value={leaveType.accrual_type || 'YEARLY'}
                onChange={(e) => onChange('accrual_type', e.target.value as AccrualType)}
                className="input"
              >
                <option value="YEARLY">Yearly (all at once)</option>
                <option value="MONTHLY">Monthly accrual</option>
                <option value="QUARTERLY">Quarterly accrual</option>
                <option value="ON_DEMAND">On demand only</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Yearly Quota" hint="Total days per year">
                <input
                  type="number"
                  step="0.5"
                  value={leaveType.yearly_quota || 0}
                  onChange={(e) => onChange('yearly_quota', Number(e.target.value) as any)}
                  className="input"
                />
              </Field>
              {leaveType.accrual_type === 'MONTHLY' && (
                <Field label="Accrual per Month" hint="e.g., 1.25 for 15/year">
                  <input
                    type="number"
                    step="0.01"
                    value={leaveType.accrual_per_period || 0}
                    onChange={(e) => onChange('accrual_per_period', Number(e.target.value) as any)}
                    className="input"
                  />
                </Field>
              )}
              {leaveType.accrual_type === 'QUARTERLY' && (
                <Field label="Accrual per Quarter">
                  <input
                    type="number"
                    step="0.01"
                    value={leaveType.accrual_per_period || 0}
                    onChange={(e) => onChange('accrual_per_period', Number(e.target.value) as any)}
                    className="input"
                  />
                </Field>
              )}
            </div>
          </Section>

          {/* Carry Forward */}
          <Section title="Carry Forward Rules">
            <Toggle
              label="Allow Carry Forward"
              helper="Unused days roll to next year"
              checked={leaveType.can_carry_forward ?? false}
              onChange={(v) => onChange('can_carry_forward', v as any)}
            />
            {leaveType.can_carry_forward && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Max Carry Forward (days)">
                  <input
                    type="number"
                    step="0.5"
                    value={leaveType.max_carry_forward || 0}
                    onChange={(e) => onChange('max_carry_forward', Number(e.target.value) as any)}
                    className="input"
                  />
                </Field>
                <Field label="Expiry (months)">
                  <input
                    type="number"
                    value={leaveType.carry_forward_expiry_months || 12}
                    onChange={(e) => onChange('carry_forward_expiry_months', Number(e.target.value) as any)}
                    className="input"
                  />
                </Field>
              </div>
            )}
          </Section>

          {/* Encashment */}
          <Section title="Encashment Rules">
            <Toggle
              label="Allow Encashment"
              helper="Convert unused leaves to money"
              checked={leaveType.can_encash ?? false}
              onChange={(v) => onChange('can_encash', v as any)}
            />
            {leaveType.can_encash && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Max Encashment (days/year)">
                  <input
                    type="number"
                    step="0.5"
                    value={leaveType.max_encashment_days || 0}
                    onChange={(e) => onChange('max_encashment_days', Number(e.target.value) as any)}
                    className="input"
                  />
                </Field>
                <Field label="Basis">
                  <select
                    value={leaveType.encashment_basis || 'BASIC'}
                    onChange={(e) => onChange('encashment_basis', e.target.value as any)}
                    className="input"
                  >
                    <option value="BASIC">Basic Salary</option>
                    <option value="GROSS">Gross Salary</option>
                    <option value="CTC">CTC</option>
                  </select>
                </Field>
              </div>
            )}
          </Section>

          {/* Application Rules */}
          <Section title="Application Rules">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Notice Period (days)" hint="Days advance notice required">
                <input
                  type="number"
                  value={leaveType.min_days_before_apply || 0}
                  onChange={(e) => onChange('min_days_before_apply', Number(e.target.value) as any)}
                  className="input"
                />
              </Field>
              <Field label="Max Consecutive Days" hint="0 = unlimited">
                <input
                  type="number"
                  value={leaveType.max_consecutive_days || 0}
                  onChange={(e) => onChange('max_consecutive_days', Number(e.target.value) as any)}
                  className="input"
                />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <Toggle
                label="Half-Day Allowed"
                helper="Can apply for half-day leave"
                checked={leaveType.can_apply_half_day ?? true}
                onChange={(v) => onChange('can_apply_half_day', v as any)}
              />
              <Toggle
                label="Requires Document"
                helper="Upload medical cert, etc."
                checked={leaveType.requires_document ?? false}
                onChange={(v) => onChange('requires_document', v as any)}
              />
              <Toggle
                label="Allowed During Probation"
                helper="Uncheck to restrict to confirmed employees"
                checked={leaveType.allowed_during_probation ?? false}
                onChange={(v) => onChange('allowed_during_probation', v as any)}
              />
            </div>
          </Section>

          {/* Eligibility */}
          <Section title="Eligibility">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Min Service (months)" hint="Minimum tenure required">
                <input
                  type="number"
                  value={leaveType.min_service_months || 0}
                  onChange={(e) => onChange('min_service_months', Number(e.target.value) as any)}
                  className="input"
                />
              </Field>
              <Field label="Applicable Gender">
                <select
                  value={leaveType.applicable_gender || 'ALL'}
                  onChange={(e) => onChange('applicable_gender', e.target.value as GenderApplicability)}
                  className="input"
                >
                  <option value="ALL">All Employees</option>
                  <option value="MALE">Male Only (e.g., Paternity)</option>
                  <option value="FEMALE">Female Only (e.g., Maternity)</option>
                </select>
              </Field>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>

      {/* Inline styles for reusable classes */}
      <style>{`
        .input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
      `}</style>
    </div>
  );
}

// ==============================================================================
// Small Components
// ==============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 border-b border-gray-200 pb-2 text-sm font-bold text-gray-700 uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Toggle({
  label, helper, checked, onChange,
}: { label: string; helper?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {helper && <div className="text-xs text-gray-500">{helper}</div>}
      </div>
    </label>
  );
}