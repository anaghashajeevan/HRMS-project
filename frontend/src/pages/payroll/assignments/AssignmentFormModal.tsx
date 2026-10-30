import { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import SearchableSelect from '../../../components/SearchableSelect';
import { getPayrollEmployees, getStructures, createAssignment, previewStructure } from '../../../api/payrollApi';

const inputCls =
  'block w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500 transition';

const fmt = (v: number | string) =>
  Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function AssignmentFormModal({ onClose, onSaved }: Props) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [form, setForm] = useState({
    employee: '',
    structure: '',
    ctc_annual: '',
    fixed_salary_monthly: '',
    effective_from: '',
    reason: '',
  });
  const [preview, setPreview] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const previewRequestId = useRef(0);

  useEffect(() => {
    getPayrollEmployees()
      .then(setEmployees)
      .catch((err) => setError(JSON.stringify(err?.response?.data) || 'Could not load employees.'))
      .finally(() => setEmployeesLoading(false));
    getStructures({ is_active: 'true' } as any)
      .then((r) => setStructures(r.data.results || r.data))
      .catch(() => {});
  }, []);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const requestId = ++previewRequestId.current;
    const annualCtc = Number(form.ctc_annual);
    if (!form.structure || !Number.isFinite(annualCtc) || annualCtc <= 0 || !form.effective_from) {
      setPreview(null);
      setPreviewError('');
      setPreviewLoading(false);
      setForm((current) => ({ ...current, fixed_salary_monthly: '' }));
      return;
    }

    setPreview(null);
    setPreviewError('');
    setPreviewLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await previewStructure({
          structure_id: form.structure,
          ctc_annual: annualCtc,
          effective_from: form.effective_from,
        });
        if (requestId !== previewRequestId.current) return;
        setPreview(response.data);
        setForm((current) => ({
          ...current,
          fixed_salary_monthly: String(response.data.fixed_salary_monthly ?? response.data.gross ?? ''),
        }));
      } catch (err: any) {
        if (requestId !== previewRequestId.current) return;
        setPreview(null);
        setPreviewError(err?.response?.data?.detail || 'Could not calculate this structure preview.');
      } finally {
        if (requestId === previewRequestId.current) setPreviewLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [form.structure, form.ctc_annual, form.effective_from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee || !form.structure || !form.ctc_annual || !form.effective_from || !preview) {
      setError('All required fields must be filled.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createAssignment({
        employee: form.employee,
        structure: form.structure,
        ctc_annual: parseFloat(form.ctc_annual),
        effective_from: form.effective_from,
        reason: form.reason || null,
      });
      onSaved();
    } catch (err: any) {
      setError(JSON.stringify(err?.response?.data) || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Assign Salary</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Employee *</label>
            <SearchableSelect
              className={inputCls}
              value={form.employee}
              options={employees.map((emp: any) => ({
                value: emp.id,
                label: `${emp.employee_id} — ${emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()}`,
              }))}
              placeholder={employeesLoading ? 'Loading employees…' : 'Search employee ID or name…'}
              disabled={employeesLoading}
              required
              noOptionsMessage="No employees match your search."
              onChange={(employeeId) => {
                const selectedEmployee = employees.find((employee) => employee.id === employeeId);
                setForm((current) => ({
                  ...current,
                  employee: employeeId,
                  effective_from: selectedEmployee?.date_of_joining || '',
                  fixed_salary_monthly: '',
                }));
                setError('');
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Structure *</label>
            <select
              className={inputCls}
              value={form.structure}
              onChange={(e) => {
                setForm((current) => ({
                  ...current,
                  structure: e.target.value,
                  fixed_salary_monthly: '',
                }));
                setPreview(null);
                setPreviewError('');
                setError('');
              }}
            >
              <option value="">Select structure…</option>
              {structures.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} (v{s.version})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Annual CTC (₹) *</label>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={form.ctc_annual}
              onChange={(e) => {
                setForm((current) => ({
                  ...current,
                  ctc_annual: e.target.value,
                  fixed_salary_monthly: '',
                }));
                setPreview(null);
                setPreviewError('');
                setError('');
              }}
              placeholder="600000"
            />
            <p className="mt-1 text-xs text-gray-500">
              CTC is the employer’s total monthly cost annualized. Fixed monthly earnings are configured through the selected salary structure’s earning components.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Fixed Monthly Salary (Gross) *</label>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={preview?.fixed_salary_monthly ?? ''}
              readOnly
              placeholder={previewLoading ? 'Calculating from structure…' : 'Calculated from selected structure'}
            />
            {previewError && <p className="mt-1 text-xs text-red-600">{previewError}</p>}
            {previewLoading && <p className="mt-1 text-xs text-blue-600">Recalculating preview from the selected structure and effective date…</p>}
            <p className="mt-1 text-xs text-gray-500">
              Preview fills this from the structure. It must match fixed earning components; monthly variable pay is entered separately in the payroll run.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Effective From *</label>
            <input type="date" className={inputCls} value={form.effective_from} onChange={(e) => {
              setForm((current) => ({ ...current, effective_from: e.target.value, fixed_salary_monthly: '' }));
              setPreview(null);
              setPreviewError('');
              setError('');
            }} />
            <p className="mt-1 text-xs text-gray-500">Defaults to the selected employee’s joining date. You can change it before saving.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Reason</label>
            <input className={inputCls} value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Annual increment / New joiner" />
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100 text-sm space-y-1">
              <div className="font-semibold text-blue-800 mb-2">Monthly Breakdown Preview</div>
              {preview.earnings?.map((e: any) => (
                <div key={e.code} className="flex justify-between text-gray-700">
                  <span>{e.name}</span>
                  <span>₹{fmt(e.amount)}</span>
                </div>
              ))}
              <div className="border-t border-blue-200 my-2" />
              <div className="flex justify-between font-semibold text-gray-900">
                <span>Calculated Fixed Monthly Salary (Gross)</span>
                <span>₹{fmt(preview.gross || 0)}</span>
              </div>
              <div className="flex justify-between font-semibold text-blue-900">
                <span>Net Pay (approx)</span>
                <span>₹{fmt(preview.net_monthly || 0)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>ESI wage base (fixed gross)</span>
                <span>₹{fmt(preview.esi_wage_base || preview.fixed_salary_monthly || 0)}</span>
              </div>
              <div className="flex justify-between text-purple-700">
                <span>Employer Contributions (included in CTC)</span>
                <span>₹{fmt(preview.total_employer_cost || 0)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Monthly CTC</span>
                <span>₹{fmt(preview.total_ctc || preview.ctc_monthly || 0)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
            <button type="submit" disabled={saving || previewLoading || !preview} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Saving…' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
