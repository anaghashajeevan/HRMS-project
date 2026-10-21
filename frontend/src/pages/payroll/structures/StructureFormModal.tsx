import { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getComponentsMini, createStructure, updateStructure } from '../../../api/payrollApi';

const inputCls =
  'block w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 transition';

interface Props {
  initial: any | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StructureFormModal({ initial, onClose, onSaved }: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [version, setVersion] = useState(initial?.version || '1.0');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [rows, setRows] = useState<any[]>(
    initial?.components?.map((c: any) => ({
      component: c.component?.id || c.component,
      amount: c.amount || '',
      percentage_of_basic: c.percentage_of_basic || '',
      is_enabled: c.is_enabled ?? true,
      display_order: c.display_order ?? 0,
    })) || []
  );
  const [compOptions, setCompOptions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getComponentsMini().then((res) => setCompOptions(res.data)).catch(() => {});
  }, []);

  const addRow = () =>
    setRows((r) => [...r, { component: '', amount: '', percentage_of_basic: '', is_enabled: true, display_order: r.length }]);

  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const updateRow = (i: number, field: string, val: any) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name,
      version,
      is_active: isActive,
      components: rows.map((r) => ({
        component: r.component,
        amount: r.amount || null,
        percentage_of_basic: r.percentage_of_basic || null,
        is_enabled: r.is_enabled,
        display_order: r.display_order,
      })),
    };
    try {
      if (initial) {
        await updateStructure(initial.id, payload);
      } else {
        await createStructure(payload);
      }
      onSaved();
    } catch (err: any) {
      setError(JSON.stringify(err?.response?.data) || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Structure' : 'New Structure'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Structure Name *</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard CTC" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Version</label>
              <input className={inputCls} value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Active
          </label>

          {/* Component Rows */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Components</h4>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition"
              >
                <PlusIcon className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <p className="mb-2 text-xs text-gray-500">
              Enter a fixed monthly amount or a percentage of Basic (enter 40 for 40%; 0.40 means 0.40%). If both are entered, the fixed amount is used; leave both blank when this component should calculate as zero.
            </p>

            {rows.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No components added yet.</p>
            )}

            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                  <select
                    className="flex-1 rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500"
                    value={row.component}
                    onChange={(e) => updateRow(i, 'component', e.target.value)}
                  >
                    <option value="">Select component…</option>
                    {compOptions.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name} ({c.component_type})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    className="w-28 rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500"
                    value={row.amount}
                    onChange={(e) => updateRow(i, 'amount', e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="% (e.g. 40)"
                    className="w-28 rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500"
                    value={row.percentage_of_basic}
                    onChange={(e) => updateRow(i, 'percentage_of_basic', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="#"
                    className="w-14 rounded-lg border-0 bg-white px-3 py-2 text-sm text-center ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500"
                    value={row.display_order}
                    onChange={(e) => updateRow(i, 'display_order', parseInt(e.target.value) || 0)}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
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
