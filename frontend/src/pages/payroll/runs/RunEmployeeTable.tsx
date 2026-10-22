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
  const tds = detail?.input_snapshot?.tds;
  const runComponents = detail?.component_details || [];
  const employeePfDeduction = runComponents
    .filter((component: any) => component.component_code === 'PF_EMP')
    .reduce((sum: number, component: any) => sum + Number(component.amount || 0), 0);
  const employeeEsiDeduction = runComponents
    .filter((component: any) => component.component_code === 'ESI_EMP')
    .reduce((sum: number, component: any) => sum + Number(component.amount || 0), 0);
  const lopDeduction = runComponents
    .filter((component: any) => !component.component_code && String(component.component_name || '').startsWith('Leave / LOP Deduction'))
    .reduce((sum: number, component: any) => sum + Number(component.amount || 0), 0);
  const tdsMonthlyTaxableFromDetails = (detail?.component_details || []).reduce((sum: number, component: any) => (
    component.is_earning && component.component_is_taxable && !component.is_reimbursement
      ? sum + Number(component.amount || 0)
      : sum
  ), 0);
  const tdsPayableDays = Math.max(Number(detail?.eligible_calendar_days || 0) - Number(detail?.lop_days || 0), 0)
    + Number(lockedDayData?.summary?.off_day_worked || 0);
  const tdsDivisor = Number(detail?.salary_divisor_days || detail?.days_in_month || 0);
  const tdsCurrentPeriodTaxable = tds?.current_period_taxable_salary != null
    ? Number(tds.current_period_taxable_salary)
    : tdsDivisor > 0 ? tdsMonthlyTaxableFromDetails * tdsPayableDays / tdsDivisor : null;
  const tdsPriorTaxable = tds?.prior_taxable_salary != null ? Number(tds.prior_taxable_salary) : null;
  const tdsFutureProjected = tds?.future_projected_salary != null
    ? Number(tds.future_projected_salary)
    : tds?.projected_salary != null && tdsPriorTaxable != null && tdsCurrentPeriodTaxable != null
      ? Number(tds.projected_salary) - tdsPriorTaxable - tdsCurrentPeriodTaxable
      : null;
  const tdsFuturePeriods = tds?.future_periods != null
    ? Number(tds.future_periods)
    : Math.max(Number(tds?.remaining_periods || 0) - 1, 0);
  const tdsMonthlyProjection = tds?.monthly_taxable_projection != null
    ? Number(tds.monthly_taxable_projection)
    : tdsFutureProjected != null && tdsFuturePeriods > 0
      ? tdsFutureProjected / tdsFuturePeriods
      : detail?.component_details?.length ? tdsMonthlyTaxableFromDetails : null;
  const hasStoredMonthlyProjection = tds?.monthly_taxable_projection != null;
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
                    <div><span className="text-gray-500">Attendance/leave payable days:</span> <span className="font-medium">{detail.payable_days}</span></div>
                    <div><span className="text-gray-500">LOP:</span> <span className="font-medium text-red-600">{detail.lop_days}</span></div>
                    <div><span className="text-gray-500">Paid leave:</span> <span className="font-medium">{detail.input_snapshot?.locked_inputs?.day_data?.summary?.paid_leave || '0'}</span></div>
                  </div>
                  {detail.input_snapshot?.locked_inputs?.day_data?.summary && (
                    <p className="mt-2 text-xs text-gray-500">
                      Weekend/holiday attendance counted as extra paid days: {detail.input_snapshot.locked_inputs.day_data.summary.off_day_worked || 0}
                    </p>
                  )}
                </div>

                {tds && (
                  <div className="rounded-xl bg-purple-50 p-4 ring-1 ring-purple-100">
                    <h4 className="mb-2 text-xs font-semibold uppercase text-purple-700">TDS Estimate</h4>
                    {tds.reason ? (
                      <p className="text-sm text-purple-900">{tds.reason}</p>
                    ) : (
                      <>
                        <div className="text-sm">
                          <div><span className="text-gray-600">Tax regime:</span> <span className="font-medium">{tds.tax_regime}</span></div>
                          {tdsFutureProjected != null && tdsPriorTaxable != null && tdsCurrentPeriodTaxable != null ? (
                            <div className="mt-3 rounded-lg bg-white/80 p-3 ring-1 ring-purple-100">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-800">How projected taxable income is built</p>
                              <p className="mb-2 text-xs text-gray-500">Financial year: {tds.financial_year_start} to {tds.financial_year_end}</p>
                              <div className="space-y-1.5">
                                <div className="flex justify-between gap-3"><span className="text-gray-600">Taxable earnings from earlier finalized/paid months</span><span className="shrink-0 font-medium">₹{fmt(tdsPriorTaxable)}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-gray-600">Taxable earnings for this pay period</span><span className="shrink-0 font-medium">₹{fmt(tdsCurrentPeriodTaxable)}</span></div>
                                {tds.current_period_basis && (
                                  <div className="my-2 rounded-md bg-purple-50/70 p-2.5 text-xs text-gray-700">
                                    <p className="mb-1 font-semibold text-purple-900">How this pay period’s taxable salary was derived</p>
                                    <p>Full-month taxable salary: ₹{fmt(tds.current_period_basis.full_month_taxable_salary)}</p>
                                    <p>Eligible calendar days {tds.current_period_basis.eligible_calendar_days} − LOP days {tds.current_period_basis.lop_days} + off-day work {tds.current_period_basis.off_day_worked} = {tds.current_period_basis.salary_calendar_day_equivalent} salary calendar-day equivalent(s).</p>
                                    <p>₹{fmt(tds.current_period_basis.full_month_taxable_salary)} × {tds.current_period_basis.salary_calendar_day_equivalent} ÷ {tds.current_period_basis.calendar_day_divisor} calendar days = ₹{fmt(tdsCurrentPeriodTaxable)} taxable salary.</p>
                                    <p>Attendance/leave payable days recorded: {tds.current_period_basis.attendance_payable_days}.</p>
                                    <p className="mt-1 text-gray-500">Salary calendar-day equivalents are not days recorded as worked or paid leave. Under the current policy, only scheduled absent workdays count as LOP; weekends are not LOP and remain in the monthly salary balance.</p>
                                  </div>
                                )}
                                {Number(tds.current_month_other_settled_taxable_salary || 0) !== 0 && <div className="flex justify-between gap-3"><span className="text-gray-600">Other finalized/paid taxable payroll in this month</span><span className="shrink-0 font-medium">₹{fmt(tds.current_month_other_settled_taxable_salary)}</span></div>}
                                <div className="flex justify-between gap-3"><span className="text-gray-600">Taxable earnings for later months ({tdsFuturePeriods} months; actual payroll where finalized/paid, otherwise forecast)</span><span className="shrink-0 font-medium">₹{fmt(tdsFutureProjected)}</span></div>
                                <div className="flex justify-between gap-3 border-t border-purple-100 pt-1.5 font-semibold"><span>Projected salary before standard deduction</span><span className="shrink-0">₹{fmt(tds.projected_salary)}</span></div>
                                <div className="flex justify-between gap-3 text-gray-700"><span>Standard deduction</span><span className="shrink-0">− ₹{fmt(tds.standard_deduction)}</span></div>
                                <div className="flex justify-between gap-3 border-t border-purple-100 pt-1.5 font-bold text-purple-900"><span>Projected taxable income</span><span className="shrink-0">₹{fmt(tds.taxable_income)}</span></div>
                              </div>
                              {Array.isArray(tds.future_projection_details) ? (
                                <div className="mt-3 overflow-hidden rounded-lg ring-1 ring-purple-100">
                                  <div className="bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-800">Later month actuals and salary forecasts</div>
                                  <div className="divide-y divide-purple-100 bg-white/70">
                                    {tds.future_projection_details.map((month: any) => (
                                      <div key={month.month_start} className="grid grid-cols-[minmax(5.5rem,0.8fr)_minmax(0,2fr)_auto] gap-3 px-3 py-2 text-xs">
                                        <span className="font-medium text-gray-700">{month.period}</span>
                                        <div className="text-gray-600">
                                          {month.settled_payroll?.map((payroll: any, index: number) => (
                                            <div key={`actual-${index}`} className="text-green-800">
                                              Actual {payroll.run_type} payroll ({payroll.status}): taxable ₹{fmt(payroll.taxable_salary)}
                                            </div>
                                          ))}
                                          {month.assignments?.map((assignment: any, index: number) => (
                                            <div key={`${assignment.effective_from}-${index}`}>
                                              Forecast · {assignment.structure_name}: ₹{fmt(assignment.full_month_taxable_salary)} × {assignment.covered_days}/{assignment.calendar_days} days = ₹{fmt(assignment.projected_taxable_salary)}
                                            </div>
                                          ))}
                                          {!month.settled_payroll?.length && !month.assignments?.length && <span className="italic text-gray-500">No finalized/paid payroll or active assignment; ₹0 included</span>}
                                        </div>
                                        <span className="whitespace-nowrap font-medium text-purple-900">₹{fmt(month.projected_taxable_salary)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-gray-500">
                                  {hasStoredMonthlyProjection
                                    ? `This saved estimate used ₹${fmt(tdsMonthlyProjection)} of taxable salary per future period. It predates the month-by-month assignment forecast.`
                                    : `This saved run did not store the month-by-month assignment forecast. The future total implies an average of ₹${fmt(tdsMonthlyProjection)} per period (${fmt(tdsFutureProjected)} ÷ ${tdsFuturePeriods}).`}
                                  {' '}This is a tax projection, not annual CTC.
                                </p>
                              )}
                              <p className="mt-2 text-xs text-gray-500">Finalized/paid payroll months use their saved taxable payroll amount. Months without a completed regular payroll use the effective salary assignment, prorated by covered calendar days; that is a forecast and assumes the assigned full-month salary before unknown future attendance or leave. Months without an assignment add ₹0. Tax declarations, other income, and previous-employer data are not included.</p>
                            </div>
                          ) : (
                            <div className="mt-2 rounded-lg bg-white/80 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
                              The saved payroll data does not contain enough detail to split this projection into its source values.
                            </div>
                          )}
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div><span className="text-gray-600">Projected annual tax (using this regime's effective rule):</span> <span className="font-medium">₹{fmt(tds.annual_tax)}</span></div>
                            <div><span className="text-gray-600">TDS already deducted in other finalized/paid payrolls this financial year:</span> <span className="font-medium">₹{fmt(tds.prior_tds)}</span></div>
                            <div><span className="text-gray-600">Periods left, including current:</span> <span className="font-medium">{tds.remaining_periods}</span></div>
                            <div className="col-span-2 border-t border-purple-100 pt-2"><span className="text-gray-600">TDS for this run = max(projected annual tax − TDS already deducted in finalized/paid payrolls, 0) ÷ remaining unpaid payroll periods (including this run):</span> <span className="font-semibold">₹{fmt(tds.amount)}</span></div>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-purple-900">
                          The estimate uses finalized/paid payroll records, this run’s calculated taxable salary, and effective salary assignments for regular payroll months not yet finalized/paid. It does not use assigned annual CTC directly; employee declarations, other income, and previous-employer data are not included.
                        </p>
                        {tds.rebate_not_applied_reason && <p className="mt-1 text-xs font-medium text-amber-800">{tds.rebate_not_applied_reason}</p>}
                      </>
                    )}
                  </div>
                )}

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

                <section className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-gray-900">Wage and deduction reconciliation</h4>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    Gross Pay is the full assigned earning components shown above, before deductions. ESI wages payable are prorated wages before employee PF/ESI deductions, so the two values can differ. LOP is deducted separately.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                    <div><span className="text-gray-500">Gross Pay before deductions:</span> <span className="font-medium">₹{fmt(detail.gross_pay)}</span></div>
                    <div><span className="text-gray-500">ESI wages payable:</span> <span className="font-medium">{detail.input_snapshot?.fixed_gross_pay_prorated != null ? `₹${fmt(detail.input_snapshot.fixed_gross_pay_prorated)}` : 'Not recorded'}</span></div>
                    <div><span className="text-gray-500">Fixed monthly ESI base:</span> <span className="font-medium">{detail.input_snapshot?.esi_wage_base != null ? `₹${fmt(detail.input_snapshot.esi_wage_base)}` : 'Not recorded'}</span></div>
                    <div><span className="text-gray-500">LOP deduction:</span> <span className="font-medium">₹{fmt(lopDeduction)}</span></div>
                    <div><span className="text-gray-500">Employee PF:</span> <span className="font-medium">₹{fmt(employeePfDeduction)}</span></div>
                    <div><span className="text-gray-500">Employee ESI:</span> <span className="font-medium">₹{fmt(employeeEsiDeduction)}</span></div>
                    <div><span className="text-gray-500">Net pay:</span> <span className="font-semibold text-green-700">₹{fmt(detail.net_pay)}</span></div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Net Pay = Gross Pay + Reimbursements − Total Deductions.</p>
                </section>

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
