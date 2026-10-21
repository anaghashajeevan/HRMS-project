import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  LockClosedIcon,
  CalculatorIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ArrowUturnLeftIcon,
  DocumentCheckIcon,
  BanknotesIcon,
  ClockIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { getPayRun, transitionPayRun, getRunEmployees, getRunAuditLog, getRunPaymentBatches, createRunPaymentBatch, downloadPaymentBatchFile, refreshPaymentBatchBankDetails, updatePaymentLineStatus } from '../../../api/payrollApi';
import RunEmployeeTable from './RunEmployeeTable';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  LOCKED: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  CALCULATED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  UNDER_REVIEW: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  APPROVED: 'bg-green-50 text-green-700 ring-green-600/20',
  FINALIZED: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  REVERSED: 'bg-red-50 text-red-700 ring-red-600/20',
};

const fmt = (v: number | string | null) =>
  v != null ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

interface ActionDef {
  key: string;
  label: string;
  icon: any;
  color: string;
  needsReason?: boolean;
  confirm?: string;
}

const ACTIONS: Record<string, ActionDef[]> = {
  OPEN: [{ key: 'lock', label: 'Lock Inputs & Load Employees', icon: LockClosedIcon, color: 'bg-yellow-600 hover:bg-yellow-700', confirm: 'Lock inputs and load employees with an eligible salary assignment for this pay period?' }],
  LOCKED: [{ key: 'calculate', label: 'Calculate', icon: CalculatorIcon, color: 'bg-indigo-600 hover:bg-indigo-700', confirm: 'Run payroll calculation for all employees?' }],
  CALCULATED: [{ key: 'submit-review', label: 'Submit for Review', icon: PaperAirplaneIcon, color: 'bg-orange-600 hover:bg-orange-700' }],
  UNDER_REVIEW: [
    { key: 'approve', label: 'Approve', icon: CheckCircleIcon, color: 'bg-green-600 hover:bg-green-700', confirm: 'Approve this pay run?' },
    { key: 'return', label: 'Return', icon: ArrowUturnLeftIcon, color: 'bg-red-600 hover:bg-red-700', needsReason: true },
  ],
  APPROVED: [{ key: 'finalize', label: 'Finalize', icon: DocumentCheckIcon, color: 'bg-teal-600 hover:bg-teal-700', confirm: 'Finalize this pay run? This cannot be undone easily.' }],
  FINALIZED: [{ key: 'mark-paid', label: 'Mark Paid', icon: BanknotesIcon, color: 'bg-emerald-600 hover:bg-emerald-700', confirm: 'Mark this run as paid?' }],
};

export default function PayRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [paymentMode, setPaymentMode] = useState('NEFT');
  const [tab, setTab] = useState<'employees' | 'summary'>('employees');
  const [paymentBatches, setPaymentBatches] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [runRes, empRes] = await Promise.all([
        getPayRun(id),
        getRunEmployees(id),
      ]);
      setRun(runRes.data);
      setEmployees(empRes.data.results || empRes.data);
      if (['FINALIZED', 'PAID'].includes(runRes.data.status)) {
        try {
          const batchRes = await getRunPaymentBatches(id);
          setPaymentBatches(batchRes.data);
        } catch {
          setPaymentBatches([]);
        }
      } else {
        setPaymentBatches([]);
      }
    } catch {} finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action: ActionDef) => {
    if (action.needsReason) {
      setShowReturn(true);
      return;
    }
    if (action.confirm && !confirm(action.confirm)) return;
    setActing(true);
    try {
      const response = await transitionPayRun(id!, action.key);
      setRun(response.data);
      load();
    } catch (err: any) {
      alert(JSON.stringify(err?.response?.data) || 'Action failed.');
    } finally {
      setActing(false);
    }
  };

  const handleReturn = async () => {
    if (!returnReason.trim()) { alert('Reason is required.'); return; }
    setActing(true);
    try {
      const response = await transitionPayRun(id!, 'return', { reason: returnReason });
      setRun(response.data);
      setShowReturn(false);
      setReturnReason('');
      load();
    } catch (err: any) {
      alert(JSON.stringify(err?.response?.data) || 'Return failed.');
    } finally {
      setActing(false);
    }
  };

  const loadAudit = async () => {
    try {
      const res = await getRunAuditLog(id!);
      setAuditLog(res.data.results || res.data);
      setShowAudit(true);
    } catch {}
  };

  const handleCreatePaymentBatch = async () => {
    if (!confirm('Create a bank payment batch from this finalized run’s net pay and saved bank profiles?')) return;
    setActing(true);
    try {
      await createRunPaymentBatch(id!, paymentMode);
      await load();
    } catch (err: any) {
      alert(JSON.stringify(err?.response?.data) || 'Could not create payment batch.');
    } finally {
      setActing(false);
    }
  };

  const handlePaymentBatchDownload = async (batchId: string, format: 'csv' | 'pdf') => {
    try {
      await downloadPaymentBatchFile(batchId, format);
    } catch (err: any) {
      let payload = err?.response?.data;
      if (payload instanceof Blob) {
        try {
          payload = JSON.parse(await payload.text());
        } catch {
          payload = null;
        }
      }
      const details = Array.isArray(payload?.invalid_payment_details)
        ? payload.invalid_payment_details.join('\n')
        : '';
      alert([payload?.detail, details].filter(Boolean).join('\n') || 'Could not download the payment document.');
    }
  };

  const handleRefreshPaymentBankDetails = async (batchId: string) => {
    if (!confirm('Refresh this pending batch with the employee bank profiles effective on its payment date?')) return;
    setActing(true);
    try {
      const response = await refreshPaymentBatchBankDetails(batchId);
      alert(response.data.detail);
      await load();
    } catch (err: any) {
      const payload = err?.response?.data;
      alert([payload?.detail, ...(payload?.invalid_payment_details || [])].filter(Boolean).join('\n') || 'Could not refresh bank details.');
    } finally {
      setActing(false);
    }
  };

  const handlePaymentLineUpdate = async (batchId: string, lineId: string, form: HTMLFormElement) => {
    const values = new FormData(form);
    setActing(true);
    try {
      const response = await updatePaymentLineStatus(batchId, lineId, {
        status: String(values.get('status') || ''),
        utr_number: String(values.get('utr_number') || ''),
        settlement_date: String(values.get('settlement_date') || '') || undefined,
        failure_reason: String(values.get('failure_reason') || ''),
      });
      setPaymentBatches((current) => current.map((batch) => batch.id === batchId ? response.data : batch));
    } catch (err: any) {
      alert(JSON.stringify(err?.response?.data) || 'Could not update payment status.');
    } finally {
      setActing(false);
    }
  };

  if (loading || !run) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const actions = run.status === 'CALCULATED' && run.returned_by
    ? [{ key: 'recalculate', label: 'Recalculate', icon: CalculatorIcon, color: 'bg-indigo-600 hover:bg-indigo-700', confirm: 'Recalculate using the inputs frozen when this run was locked?' }]
    : run.status === 'FINALIZED' && !paymentBatches.some((batch) => batch.status === 'RECONCILED')
      ? []
    : run.status === 'UNDER_REVIEW' && !run.can_current_user_approve
      ? []
      : ACTIONS[run.status] || [];
  const totals = run.totals || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/payroll/runs')} className="rounded-lg p-2 hover:bg-gray-100 transition">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">
            {run.pay_calendar_display || 'Pay Run'} — {run.run_type}
          </h2>
          <p className="text-sm text-gray-500">
            {run.pay_calendar?.period_start} → {run.pay_calendar?.period_end}
          </p>
        </div>
        <span className={`inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${STATUS_COLORS[run.status] || ''}`}>
          {run.status}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total Gross', value: totals.total_gross_pay },
          { label: 'Total Deductions', value: totals.total_deductions },
          { label: 'Reimbursements', value: totals.total_reimbursements },
          { label: 'Total Net Pay', value: totals.total_net_pay },
          { label: 'Employer Cost', value: totals.total_employer_cost },
          { label: 'Total CTC', value: totals.total_ctc },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">{card.label}</p>
            <p className="text-lg font-semibold text-gray-900">₹{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {run.status === 'OPEN' && employees.length === 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          This run is an empty draft. Choose <strong>Lock Inputs &amp; Load Employees</strong> to add employees who have a salary assignment effective during this pay period. Their pay amounts are calculated in the next step.
        </div>
      )}
      {run.status === 'LOCKED' && employees.length > 0 && employees.every((employee) => employee.status === 'PENDING') && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          Employees and attendance inputs are loaded. Choose <strong>Calculate</strong> to calculate salary, deductions, reimbursements, and net pay.
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {actions.map((a) => (
          <button
            key={a.key}
            onClick={() => handleAction(a)}
            disabled={acting}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-50 transition ${a.color}`}
          >
            <a.icon className="h-4 w-4" />
            {a.label}
          </button>
        ))}
        <button
          onClick={loadAudit}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition"
        >
          <ClockIcon className="h-4 w-4" /> Audit Log
        </button>
      </div>

      {run.status === 'UNDER_REVIEW' && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Approval workflow</h3>
          <div className="mt-3 space-y-2">
            {(run.approval_actions || []).map((approval: any) => (
              <div key={approval.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span className="font-medium text-gray-800">Step {approval.step_number}: {approval.step_name} · {approval.assigned_to_name}</span>
                <span className={approval.status === 'APPROVED' ? 'text-green-700' : approval.status === 'PENDING' ? 'text-amber-700' : 'text-gray-500'}>{approval.status}</span>
                {approval.comments && <span className="w-full text-xs text-gray-600">{approval.comments}</span>}
              </div>
            ))}
          </div>
          {!run.can_current_user_approve && <p className="mt-3 text-xs text-gray-500">Waiting for the assigned approver(s) to complete the current step.</p>}
        </section>
      )}

      {['FINALIZED', 'PAID'].includes(run.status) && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Bank payment documents</h3>
              <p className="mt-1 text-xs text-gray-500">Create the payment batch after finalization. CSV is a generic bank upload layout; confirm your bank’s required format before uploading.</p>
            </div>
            {paymentBatches.length === 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600" htmlFor="payment-mode">Payment mode</label>
                <select id="payment-mode" value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)} className="rounded-lg border border-gray-200 px-2 py-2 text-sm">
                  <option value="NEFT">NEFT</option><option value="RTGS">RTGS</option><option value="IMPS">IMPS</option><option value="BANK_BULK">Bank bulk transfer</option>
                </select>
                <button onClick={handleCreatePaymentBatch} disabled={acting} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Create payment batch
                </button>
              </div>
            )}
          </div>
          {paymentBatches.map((batch) => (
            <div key={batch.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4">
              <div className="text-sm">
                <div className="font-semibold text-gray-800">{batch.batch_number} · {batch.payment_mode} · {batch.status}</div>
                <div className="text-gray-500">{batch.line_count} payments · ₹{fmt(batch.total_amount)}</div>
              </div>
              <div className="flex gap-2">
                {batch.status === 'PENDING' && !batch.file_generated && (
                  <button onClick={() => void handleRefreshPaymentBankDetails(batch.id)} disabled={acting} className="rounded-lg bg-white px-3 py-2 text-sm text-gray-700 ring-1 ring-gray-200 disabled:opacity-50">Refresh bank details</button>
                )}
                <button onClick={() => void handlePaymentBatchDownload(batch.id, 'csv')} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm text-blue-700 ring-1 ring-gray-200"><ArrowDownTrayIcon className="h-4 w-4" /> Bank transfer CSV</button>
                <button onClick={() => void handlePaymentBatchDownload(batch.id, 'pdf')} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm text-blue-700 ring-1 ring-gray-200"><ArrowDownTrayIcon className="h-4 w-4" /> PDF report</button>
              </div>
              <div className="mt-4 w-full space-y-2">
                {(batch.lines || []).map((line: any) => (
                  <form key={line.id} onSubmit={(event) => { event.preventDefault(); void handlePaymentLineUpdate(batch.id, line.id, event.currentTarget); }} className="grid grid-cols-1 items-end gap-2 rounded-lg bg-white p-3 ring-1 ring-gray-200 md:grid-cols-7">
                    <div className="text-sm"><div className="font-medium">{line.employee_name}</div><div className="text-gray-500">{line.employee_code} · ₹{fmt(line.amount)}</div></div>
                    <select name="status" defaultValue={line.status === 'PENDING' ? 'UPLOADED' : line.status} className="rounded-lg border border-gray-200 px-2 py-2 text-sm">
                      <option value="UPLOADED">Uploaded to bank</option><option value="SETTLED">Settled</option><option value="FAILED">Failed</option><option value="RETURNED">Returned</option><option value="REPAYMENT_PENDING">Repayment pending</option>
                    </select>
                    <input name="utr_number" defaultValue={line.utr_number} placeholder="UTR (required to settle)" className="rounded-lg border border-gray-200 px-2 py-2 text-sm" />
                    <input name="settlement_date" type="date" defaultValue={line.settlement_date || ''} className="rounded-lg border border-gray-200 px-2 py-2 text-sm" />
                    <input name="failure_reason" defaultValue={line.failure_reason} placeholder="Failure/return reason" className="rounded-lg border border-gray-200 px-2 py-2 text-sm" />
                    <span className="text-xs text-gray-500">Current: {line.status}</span>
                    <button disabled={acting} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">Save</button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Return Reason Modal */}
      {showReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Return Reason</h3>
            <textarea
              className="block w-full rounded-xl border-0 bg-gray-50 px-4 py-3 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500 h-24"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Explain why this run is being returned…"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => { setShowReturn(false); setReturnReason(''); }} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
              <button onClick={handleReturn} disabled={acting} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition">
                {acting ? 'Returning…' : 'Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Toggle */}
      <div className="flex rounded-xl bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setTab('employees')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'employees' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          Employees ({employees.length})
        </button>
        <button
          onClick={() => setTab('summary')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'summary' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          Run Info
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'employees' && (
        <RunEmployeeTable employees={employees} runId={id!} runStatus={run.status} canAdjustReturned={Boolean(run.returned_by)} onReload={load} />
      )}

      {tab === 'summary' && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><span className="text-gray-500">Prepared by:</span> <span className="font-medium">{run.prepared_by_name || '—'}</span></div>
            <div><span className="text-gray-500">Approved by:</span> <span className="font-medium">{run.approved_by_name || '—'}</span></div>
            <div><span className="text-gray-500">Finalized by:</span> <span className="font-medium">{run.finalized_by_name || '—'}</span></div>
            <div><span className="text-gray-500">Formula Version:</span> <span className="font-mono">{run.formula_version || '—'}</span></div>
            <div><span className="text-gray-500">Created:</span> <span>{run.created_at}</span></div>
            <div><span className="text-gray-500">Locked at:</span> <span>{run.locked_at || '—'}</span></div>
            <div><span className="text-gray-500">Calculated at:</span> <span>{run.calculated_at || '—'}</span></div>
            <div><span className="text-gray-500">Approved at:</span> <span>{run.approved_at || '—'}</span></div>
          </div>
          {run.return_reason && (
            <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-100">
              <span className="text-xs font-semibold text-red-700">Return Reason:</span>
              <p className="mt-1 text-red-700">{run.return_reason}</p>
            </div>
          )}
        </div>
      )}

      {/* Audit Log Modal */}
      {showAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Audit Log</h3>
              <button onClick={() => setShowAudit(false)} className="rounded-lg p-1 hover:bg-gray-100 transition text-gray-400">✕</button>
            </div>
            {auditLog.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No audit entries.</p>
            ) : (
              <div className="space-y-3">
                {auditLog.map((log: any, i: number) => (
                  <div key={i} className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{log.action}</span>
                      <span className="text-xs text-gray-400">{log.timestamp}</span>
                    </div>
                    {log.run_status_from && (
                      <p className="text-gray-500">{log.run_status_from} → {log.run_status_to}</p>
                    )}
                    {log.reason && <p className="text-gray-600 italic mt-1">{log.reason}</p>}
                    <p className="text-xs text-gray-400 mt-1">By: {log.performed_by_name || log.performed_by}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
