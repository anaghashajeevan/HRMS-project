import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { previewStructure } from '../../../api/payrollApi';

const inputCls =
  'block w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500 transition';

const fmt = (v: number | string | null | undefined) => {
  const amount = Number(v);
  return Number.isFinite(amount)
    ? amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
};

interface Props {
  structureId: string;
  onClose: () => void;
}

export default function StructurePreviewModal({ structureId, onClose }: Props) {
  const [ctc, setCtc] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePreview = async () => {
    if (!ctc) return;
    setLoading(true);
    setError('');
    try {
      const res = await previewStructure({ structure_id: structureId, ctc_annual: parseFloat(ctc) });
      setData(res.data);
    } catch (err: any) {
      setError(JSON.stringify(err?.response?.data) || 'Preview failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Structure Preview</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="mb-4 flex gap-3">
          <input
            type="number"
            className={inputCls}
            placeholder="Annual CTC (e.g. 600000)"
            value={ctc}
            onChange={(e) => setCtc(e.target.value)}
          />
          <button
            onClick={handlePreview}
            disabled={loading || !ctc}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition whitespace-nowrap"
          >
            {loading ? 'Loading…' : 'Preview'}
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {data && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Annual CTC:</span> <span className="font-medium">₹{fmt(data.ctc_annual)}</span></div>
                <div><span className="text-gray-500">Monthly CTC:</span> <span className="font-medium">₹{fmt(data.ctc_monthly)}</span></div>
              </div>
            </div>

            {data.earnings?.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Earnings</h4>
                <div className="space-y-1">
                  {data.earnings.map((e: any) => (
                    <div key={e.code} className="flex justify-between rounded-lg bg-green-50/50 px-3 py-2 text-sm">
                      <span className="text-gray-700">{e.name}</span>
                      <span className="font-medium text-green-700">₹{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.deductions?.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Deductions</h4>
                <div className="space-y-1">
                  {data.deductions.map((d: any) => (
                    <div key={d.code} className="flex justify-between gap-3 rounded-lg bg-red-50/50 px-3 py-2 text-sm">
                      <span className="text-gray-700">
                        {d.name}
                        {d.calculated_in_employee_payroll && <span className="mt-0.5 block text-xs font-medium text-blue-700">Set the employee's regime in Payroll &gt; Tax &amp; Bank Profiles; the employee-specific TDS appears in the pay run.</span>}
                        {d.code === 'ESI_EMP' && <span className="mt-0.5 block text-xs text-gray-500">{d.rate}% of fixed salary ₹{fmt(d.wage_base)}{d.threshold != null ? ` · coverage ceiling ₹${fmt(d.threshold)}` : ''}</span>}
                        {d.reason && <span className="mt-0.5 block text-xs text-amber-700">{d.reason}</span>}
                      </span>
                      <span className="shrink-0 text-right text-sm font-medium text-red-700">{d.calculated_in_employee_payroll ? 'Profile based' : `₹${fmt(d.amount)}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.employer_costs?.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Employer Costs</h4>
                <div className="space-y-1">
                  {data.employer_costs.map((ec: any) => (
                    <div key={ec.code} className="flex justify-between gap-3 rounded-lg bg-purple-50/50 px-3 py-2 text-sm">
                      <span className="text-gray-700">
                        {ec.name}
                        {ec.code === 'ESI_ER' && <span className="mt-0.5 block text-xs text-gray-500">{ec.rate}% of fixed salary ₹{fmt(ec.wage_base)}{ec.threshold != null ? ` · coverage ceiling ₹${fmt(ec.threshold)}` : ''}</span>}
                        {ec.reason && <span className="mt-0.5 block text-xs text-amber-700">{ec.reason}</span>}
                      </span>
                      <span className="shrink-0 font-medium text-purple-700">₹{fmt(ec.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Gross Pay:</span> <span className="font-semibold">₹{fmt(data.gross ?? data.gross_monthly)}</span></div>
                <div><span className="text-gray-500">{data.net_excludes_tds ? 'Estimated Net (before TDS):' : 'Net Pay:'}</span> <span className="font-semibold text-blue-700">₹{fmt(data.net ?? data.net_monthly)}</span></div>
              </div>
              {data.net_excludes_tds && <p className="mt-2 text-xs text-blue-700">Set the employee's regime and residency in Payroll &gt; Tax &amp; Bank Profiles. A pay run then estimates TDS using that profile, available pay history, and the effective TDS rule.</p>}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
