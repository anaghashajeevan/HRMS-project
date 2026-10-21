import { useState, useEffect } from 'react';
import { calculatePreview, getPayrollEmployees } from '../../../api/payrollApi';

const inputCls =
  'block w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500 transition';

const fmt = (v: number | string | null) =>
  v != null ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

export default function CalculatePreviewPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({ employee_id: '', period_start: '', period_end: '' });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getPayrollEmployees()
      .then(setEmployees)
      .catch(() => {});
  }, []);

  const handleCalc = async () => {
    if (!form.employee_id || !form.period_start || !form.period_end) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await calculatePreview(form);
      setResult(res.data);
    } catch (err: any) {
      setError(JSON.stringify(err?.response?.data) || 'Calculation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Salary Calculation Preview</h2>
        <p className="text-sm text-gray-500">Preview an employee's pay calculation without saving.</p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Employee</label>
            <select className={inputCls} value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}>
              <option value="">Select employee…</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>{emp.employee_id} — {emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Period Start</label>
            <input type="date" className={inputCls} value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Period End</label>
            <input type="date" className={inputCls} value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleCalc}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'Calculating…' : 'Preview Calculation'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-5">
          {/* Day Summary */}
          <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100">
            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Day Reconciliation</h4>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              <div><span className="text-gray-500">Days in Month:</span> <span className="font-medium">{result.days_in_month}</span></div>
              <div><span className="text-gray-500">Eligible:</span> <span className="font-medium">{result.eligible_calendar_days}</span></div>
              <div><span className="text-gray-500">Payable:</span> <span className="font-medium">{result.payable_days}</span></div>
              <div><span className="text-gray-500">LOP:</span> <span className="font-medium text-red-600">{result.lop_days}</span></div>
              <div><span className="text-gray-500">Paid Leave:</span> <span className="font-medium">{result.paid_leave_days}</span></div>
            </div>
          </div>

          {/* Earnings */}
          {result.earnings?.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Earnings</h4>
              <div className="space-y-1">
                {result.earnings.map((e: any) => (
                  <div key={e.code} className="flex justify-between rounded-lg bg-green-50/50 px-3 py-2 text-sm">
                    <span className="text-gray-700">{e.name}</span>
                    <div className="text-right">
                      <span className="font-medium text-green-700">₹{fmt(e.prorated)}</span>
                      {e.full_month !== e.prorated && (
                        <span className="ml-2 text-xs text-gray-400">(full: ₹{fmt(e.full_month)})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deductions */}
          {result.deductions?.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Deductions</h4>
              <div className="space-y-1">
                {result.deductions.map((d: any) => (
                  <div key={d.code} className="flex justify-between rounded-lg bg-red-50/50 px-3 py-2 text-sm">
                    <span className="text-gray-700">{d.name}</span>
                    <span className="font-medium text-red-700">- ₹{fmt(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employer Costs */}
          {result.employer_costs?.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Employer Costs</h4>
              <div className="space-y-1">
                {result.employer_costs.map((ec: any) => (
                  <div key={ec.code} className="flex justify-between rounded-lg bg-purple-50/50 px-3 py-2 text-sm">
                    <span className="text-gray-700">{ec.name}</span>
                    <span className="font-medium text-purple-700">₹{fmt(ec.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Net Pay */}
          <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><span className="text-gray-500">Gross:</span> <span className="font-semibold">₹{fmt(result.gross_pay)}</span></div>
              <div><span className="text-gray-500">Deductions:</span> <span className="font-semibold text-red-700">₹{fmt(result.total_deductions)}</span></div>
              <div><span className="text-gray-500">Net Pay:</span> <span className="font-semibold text-green-700">₹{fmt(result.net_pay)}</span></div>
              <div><span className="text-gray-500">Employer Cost:</span> <span className="font-semibold text-purple-700">₹{fmt(result.total_employer_cost)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
