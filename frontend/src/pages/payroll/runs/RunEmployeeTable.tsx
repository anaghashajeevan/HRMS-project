import { useState } from 'react';
import { EyeIcon, XCircleIcon, PlusIcon } from '@heroicons/react/24/outline';
import { createRunAdjustment, excludeRunEmployee, getRunEmployee } from '../../../api/payrollApi';

const fmt = (v: number | string | null) =>
  v != null ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-50 text-gray-600',
  CALCULATED: 'bg-green-50 text-green-700',
  ERROR: 'bg-red-50 text-red-700',
  EXCLUDED: 'bg-yellow-50 text-yellow-700',
};

interface Props {
  employees: any[];
  runId: string;
  runStatus: string;
  canAdjustReturned?: boolean;
  onReload: () => void;
}

export default function RunEmployeeTable({ employees, runId, runStatus, canAdjustReturned = false, onReload }: Props) {
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adjustmentEmployee, setAdjustmentEmployee] = useState<any>(null);
  const [adjustmentType, setAdjustmentType] = useState('VARIABLE_EARNING');
  const [adjustmentLabel, setAdjustmentLabel] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const lockedDayData = detail?.input_snapshot?.locked_inputs?.day_data;
  const reconciledDays = Object.entries(lockedDayData?.day_map || {}) as [string, string][];
  const leaveBreakdown = lockedDayData?.leave_breakdown || [];

  const viewDetail = async (empRecordId: string) => {
    setDetailLoading(true);
    try {
      const res = await getRunEmployee(runId, empRecordId);
      setDetail(res.data);
    } catch {} finally { setDetailLoading(false); }
  };

  const handleExclude = async (empRecordId: string) => {
    const reason = prompt('Reason for exclusion:');
    if (!reason) return;
    try {
      await excludeRunEmployee(runId, empRecordId, { reason });
      onReload();
    } catch (err: any) {
      alert(JSON.stringify(err?.response?.data) || 'Exclude failed.');
    }
  };

  const saveAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adjustmentEmployee) return;
    setAdjustmentSaving(true);
    try {
      await createRunAdjustment(runId, {
        employee: adjustmentEmployee.employee,
        adjustment_type: adjustmentType as 'VARIABLE_EARNING' | 'DEDUCTION' | 'REIMBURSEMENT',
        label: adjustmentLabel,
        amount: Number(adjustmentAmount),
        reason: adjustmentReason,
      });
      setAdjustmentEmployee(null);
      setAdjustmentLabel(''); setAdjustmentAmount(''); setAdjustmentReason('');
      onReload();
    } catch (err: any) {
      alert(JSON.stringify(err?.response?.data) || 'Could not save adjustment.');
    } finally { setAdjustmentSaving(false); }
  };

  return (
    <>
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        {employees.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No employees in this run.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Payable / Workdays</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">LOP</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net Pay</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map((e: any) => (
                  <tr key={e.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{e.employee_name || e.employee}</div>
                      <div className="text-xs text-gray-400">{e.employee_code || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">
                      {e.payable_days != null ? `${e.payable_days}/${e.salary_divisor_days || e.days_in_month}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{e.lop_days ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">₹{fmt(e.gross_pay)}</td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">₹{fmt(e.total_deductions)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-green-700">₹{fmt(e.net_pay)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${STATUS_COLORS[e.status] || ''}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {(runStatus === 'LOCKED' || (runStatus === 'CALCULATED' && canAdjustReturned)) && e.status !== 'EXCLUDED' && (
                          <button onClick={() => setAdjustmentEmployee(e)} className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 transition" title="Add payroll adjustment">
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => viewDetail(e.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition" title="View detail">
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {['OPEN', 'LOCKED', 'CALCULATED'].includes(runStatus) && e.status !== 'EXCLUDED' && (
                          <button onClick={() => handleExclude(e.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition" title="Exclude">
                            <XCircleIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adjustmentEmployee && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveAdjustment} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="font-semibold text-gray-900">Adjustment for {adjustmentEmployee.employee_name}</div>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)}>
              <option value="VARIABLE_EARNING">Variable earning</option>
              <option value="DEDUCTION">Deduction</option>
              <option value="REIMBURSEMENT">Reimbursement</option>
            </select>
            <input required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Description" value={adjustmentLabel} onChange={(e) => setAdjustmentLabel(e.target.value)} />
            <input required min="0.01" step="0.01" type="number" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Amount" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} />
            <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Reason (optional)" value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdjustmentEmployee(null)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button disabled={adjustmentSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{adjustmentSaving ? 'Saving…' : 'Add adjustment'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Employee Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {detail.employee_name || 'Employee'} — Pay Details
              </h3>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1 hover:bg-gray-100 transition text-gray-400">✕</button>
            </div>

            {detailLoading ? (
              <div className="py-12 flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-4">
                {detail.salary_assignment_details && (
                  <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
                    <h4 className="text-xs font-semibold uppercase text-blue-700 mb-2">Salary Assignment Used</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-600">Structure:</span> <span className="font-medium">{detail.salary_assignment_details.structure_name}</span></div>
                      <div><span className="text-gray-600">Assigned monthly CTC:</span> <span className="font-medium">₹{fmt(detail.salary_assignment_details.ctc_monthly)}</span></div>
                      <div><span className="text-gray-600">Annual CTC:</span> <span className="font-medium">₹{fmt(detail.salary_assignment_details.ctc_annual)}</span></div>
                      <div><span className="text-gray-600">Effective:</span> <span className="font-medium">{detail.salary_assignment_details.effective_from}{detail.salary_assignment_details.effective_to ? ` to ${detail.salary_assignment_details.effective_to}` : ''}</span></div>
                    </div>
                  </div>
                )}
                {/* Day Summary */}
                <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100">
                  <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Day Summary</h4>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div><span className="text-gray-500">Calendar Days:</span> <span className="font-medium">{detail.days_in_month}</span></div>
                    <div><span className="text-gray-500">Salary Divisor:</span> <span className="font-medium">{detail.salary_divisor_days || detail.days_in_month} calendar days</span></div>
                    <div><span className="text-gray-500">Eligible:</span> <span className="font-medium">{detail.eligible_calendar_days}</span></div>
                    <div><span className="text-gray-500">Payable:</span> <span className="font-medium">{detail.payable_days}</span></div>
                    <div><span className="text-gray-500">LOP:</span> <span className="font-medium text-red-600">{detail.lop_days}</span></div>
                    <div><span className="text-gray-500">Paid leave:</span> <span className="font-medium">{detail.input_snapshot?.locked_inputs?.day_data?.summary?.paid_leave || '0'}</span></div>
                  </div>
                  {detail.input_snapshot?.locked_inputs?.day_data?.summary && (
                    <p className="mt-2 text-xs text-gray-500">
                      Weekend/holiday attendance counted as extra paid days: {detail.input_snapshot.locked_inputs.day_data.summary.off_day_worked || 0}
                    </p>
                  )}
                </div>

                {reconciledDays.length > 0 && (
                  <div className="rounded-xl bg-white p-4 ring-1 ring-gray-200">
                    <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Reconciled Attendance Dates</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                      {reconciledDays.map(([date, status]) => (
                        <div key={date} className="flex justify-between border-b border-gray-100 py-1">
                          <span>{date}</span>
                          <span className={status === 'absent' || status.includes('lop') ? 'font-medium text-red-600' : status === 'off_day_worked' || status === 'present' ? 'font-medium text-green-700' : 'text-gray-600'}>
                            {status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                    {leaveBreakdown.length > 0 && (
                      <div className="mt-3 border-t border-gray-200 pt-2">
                        <h5 className="text-xs font-semibold uppercase text-gray-500 mb-1">Approved Leave Inputs</h5>
                        {leaveBreakdown.map((leave: any) => (
                          <div key={leave.application_number} className="py-1 text-xs text-gray-600">
                            {leave.application_number} ({leave.type}): {leave.start_date} to {leave.end_date}; {leave.days} leave days, {leave.paid_days} paid, {leave.lop_days} LOP
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Component Breakdown */}
                {detail.component_details && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Components</h4>
                    <p className="mb-2 text-xs text-gray-500">Salary structure components are shown at their assigned monthly amounts. LOP and unpaid days are listed separately under deductions.</p>
                    <div className="space-y-1">
                      {detail.component_details
                        .filter((c: any) => c.is_earning && !c.is_employer_cost)
                        .map((c: any) => (
                          <div key={c.id} className="flex justify-between rounded-lg bg-green-50/50 px-3 py-2 text-sm">
                            <span className="text-gray-700">{c.component_name || c.component}</span>
                            <span className="font-medium text-green-700">₹{fmt(c.amount)}</span>
                          </div>
                        ))}
                      {detail.component_details
                        .filter((c: any) => !c.is_earning && !c.is_employer_cost && !c.is_reimbursement)
                        .map((c: any) => (
                          <div key={c.id} className="flex justify-between rounded-lg bg-red-50/50 px-3 py-2 text-sm">
                            <span className="text-gray-700">{c.component_name || c.component}</span>
                            <span className={`font-medium ${c.is_reimbursement ? 'text-green-700' : 'text-red-700'}`}>{c.is_reimbursement ? '+ ' : '- '}₹{fmt(c.amount)}</span>
                          </div>
                        ))}
                      {detail.component_details.some((c: any) => c.is_reimbursement) && (
                        <>
                          <div className="mt-2 text-xs font-semibold uppercase text-gray-500">Reimbursements (outside CTC)</div>
                          {detail.component_details.filter((c: any) => c.is_reimbursement).map((c: any) => (
                            <div key={c.id} className="flex justify-between rounded-lg bg-emerald-50/50 px-3 py-2 text-sm">
                              <span className="text-gray-700">{c.component_name || c.component}</span>
                              <span className="font-medium text-emerald-700">+ ₹{fmt(c.amount)}</span>
                            </div>
                          ))}
                        </>
                      )}
                      <div className="border-t border-gray-200 my-2" />
                      {detail.component_details
                        .filter((c: any) => c.is_employer_cost)
                        .map((c: any) => (
                          <div key={c.id} className="flex justify-between rounded-lg bg-purple-50/50 px-3 py-2 text-sm">
                            <span className="text-gray-700">{c.component_name || c.component} (Employer)</span>
                            <span className="font-medium text-purple-700">₹{fmt(c.amount)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Gross Pay:</span> <span className="font-semibold">₹{fmt(detail.gross_pay)}</span></div>
                  <div><span className="text-gray-500">Total Deductions:</span> <span className="font-semibold text-red-700">₹{fmt(detail.total_deductions)}</span></div>
                  <div><span className="text-gray-500">Reimbursements:</span> <span className="font-semibold text-green-700">₹{fmt(detail.total_reimbursements)}</span></div>
                  <div><span className="text-gray-500">Net Pay:</span> <span className="font-semibold text-green-700">₹{fmt(detail.net_pay)}</span></div>
                  <div><span className="text-gray-500">Employer Cost:</span> <span className="font-semibold text-purple-700">₹{fmt(detail.total_employer_cost)}</span></div>
                  <div><span className="text-gray-500">CTC:</span> <span className="font-semibold text-purple-700">₹{fmt(detail.total_ctc)}</span></div>
                </div>

                {detail.error_message && (
                  <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-100 text-sm text-red-700">
                    <span className="font-semibold">Error:</span> {detail.error_message}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button onClick={() => setDetail(null)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
