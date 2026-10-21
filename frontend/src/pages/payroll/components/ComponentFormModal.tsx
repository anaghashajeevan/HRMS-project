import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const inputCls =
  'block w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 transition';

const TYPES = [
  { value: 'EARNING', label: 'Earning' },
  { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'EMPLOYER_COST', label: 'Employer Cost' },
  { value: 'REIMBURSEMENT', label: 'Reimbursement' },
  { value: 'ONE_TIME', label: 'One-Time' },
];

interface Props {
  initial: any | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export default function ComponentFormModal({ initial, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    code: initial?.code || '',
    name: initial?.name || '',
    component_type: initial?.component_type || 'EARNING',
    is_taxable: initial?.is_taxable ?? true,
    is_fixed: initial?.is_fixed ?? true,
    formula: initial?.formula || '',
    display_order: initial?.display_order ?? 0,
    is_active: initial?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setError('Code and Name are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, formula: form.formula.trim() });
    } catch (err: any) {
      const msg = err?.response?.data;
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg) || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Component' : 'New Component'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Code *</label>
              <input
                className={inputCls}
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="BASIC"
                disabled={!!initial}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Name *</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Basic Salary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
              <select className={inputCls} value={form.component_type} onChange={(e) => set('component_type', e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Display Order</label>
              <input
                type="number"
                className={inputCls}
                value={form.display_order}
                onChange={(e) => set('display_order', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Formula (optional)</label>
            <input
              className={inputCls}
              value={form.formula}
              onChange={(e) => set('formula', e.target.value)}
              placeholder="e.g. BASIC * 0.4"
            />
            <p className="mt-1 text-xs text-gray-400">
              Variables: BASIC, CTC, GROSS, HRA. Operators: + - * / min() max()
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_taxable}
                onChange={(e) => set('is_taxable', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Taxable
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_fixed}
                onChange={(e) => set('is_fixed', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Fixed Amount
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
