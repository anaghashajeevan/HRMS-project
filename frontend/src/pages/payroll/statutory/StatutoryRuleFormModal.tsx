import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { createStatutoryRule, updateStatutoryRule } from '../../../api/payrollApi';

const inputCls =
  'block w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500 transition';

const TYPES = ['PF', 'ESI', 'PT', 'TDS', 'GRATUITY'];
const REGIMES = ['ALL', 'OLD', 'NEW'];

interface Props {
  initial: any | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StatutoryRuleFormModal({ initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    statutory_type: initial?.statutory_type || 'PF',
    name: initial?.name || '',
    jurisdiction: initial?.jurisdiction || 'ALL',
    tax_regime: initial?.tax_regime || 'ALL',
    employee_rate: initial?.employee_rate || '',
    employer_rate: initial?.employer_rate || '',
    employer_pension_rate: initial?.employer_pension_rate ?? '8.33',
    wage_ceiling: initial?.wage_ceiling || '',
    threshold: initial?.threshold || '',
    slabs: initial?.slabs ? JSON.stringify(initial.slabs, null, 2) : '',
    effective_from: initial?.effective_from || '',
    effective_to: initial?.effective_to || '',
    is_active: initial?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        ...form,
        employee_rate: form.employee_rate || null,
        employer_rate: form.employer_rate || null,
        employer_pension_rate: form.employer_pension_rate || null,
        wage_ceiling: form.wage_ceiling || null,
        threshold: form.threshold || '0',
        effective_to: form.effective_to || null,
        slabs: form.slabs ? JSON.parse(form.slabs) : [],
      };
      if (initial) {
        await updateStatutoryRule(initial.id, payload);
      } else {
        await createStatutoryRule(payload);
      }
      onSaved();
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON in slabs field.');
      } else {
        setError(JSON.stringify(err?.response?.data) || 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{initial ? 'Edit Rule' : 'New Rule'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Type *</label>
              <select className={inputCls} value={form.statutory_type} onChange={(e) => set('statutory_type', e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Name *</label>
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="PF Standard FY2026" />
            </div>
          </div>

          {form.statutory_type === 'PF' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Employer EPS Share (%)</label>
              <input type="number" step="0.001" className={inputCls} value={form.employer_pension_rate} onChange={(e) => set('employer_pension_rate', e.target.value)} />
              <p className="mt-1 text-xs text-gray-500">The remaining employer PF contribution is allocated to EPF.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Jurisdiction</label>
              <input className={inputCls} value={form.jurisdiction} onChange={(e) => set('jurisdiction', e.target.value)} placeholder="ALL / KARNATAKA" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Tax Regime</label>
              <select className={inputCls} value={form.tax_regime} onChange={(e) => set('tax_regime', e.target.value)}>
                {REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Employee Rate (%)</label>
              <input type="number" step="0.01" className={inputCls} value={form.employee_rate} onChange={(e) => set('employee_rate', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Employer Rate (%)</label>
              <input type="number" step="0.01" className={inputCls} value={form.employer_rate} onChange={(e) => set('employer_rate', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Wage Ceiling</label>
              <input type="number" step="0.01" className={inputCls} value={form.wage_ceiling} onChange={(e) => set('wage_ceiling', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Threshold</label>
              <input type="number" step="0.01" className={inputCls} value={form.threshold} onChange={(e) => set('threshold', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Effective From *</label>
              <input type="date" className={inputCls} value={form.effective_from} onChange={(e) => set('effective_from', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Effective To</label>
              <input type="date" className={inputCls} value={form.effective_to} onChange={(e) => set('effective_to', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Slabs (JSON, for PT)</label>
            <textarea
              className={`${inputCls} h-24 font-mono text-xs`}
              value={form.slabs}
              onChange={(e) => set('slabs', e.target.value)}
              placeholder='[{"from": 0, "to": 15000, "amount": 0}, ...]'
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Active
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
