// import { useCallback, useEffect, useState } from 'react';
// import toast from 'react-hot-toast';
// import { useAuth } from '../../../context/AuthContext';
// import Sidebar from '../../../components/Sidebar';
// import Topbar from '../../../components/Topbar';
// import {
//   decidePayslipRequest, downloadPayslip, getEligiblePayslipRuns,
//   getPayslipRequests, requestPayslip,
// } from '../../../api/payrollApi';

// type RequestRow = {
//   id: string;
//   employee_name: string;
//   employee_code: string;
//   run_id: string;
//   year: number;
//   month: number;
//   status: string;
//   reason: string;
//   requested_at: string;
//   rejection_reason?: string;
//   can_review?: boolean;
//   is_requester?: boolean;
//   approval_actions?: Array<{ step_number: number; step_name: string; status: string; assigned_to_name: string; comments?: string }>;
// };

// const monthLabel = (month: number, year: number) =>
//   new Date(year, month - 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });

// export default function PayslipsPage() {
//   const { user } = useAuth();
//   const isPayrollAdmin = Boolean(user?.role_codes?.some((role) => ['HR_ADMIN', 'SYSTEM_ADMIN'].includes(role)));
//   const [eligible, setEligible] = useState<any[]>([]);
//   const [requests, setRequests] = useState<RequestRow[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [working, setWorking] = useState<string | null>(null);
//   const [requestReason, setRequestReason] = useState('');
//   const [requestFormOpen, setRequestFormOpen] = useState(false);
//   const [selectedRunId, setSelectedRunId] = useState('');

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const requestResponse = await getPayslipRequests();
//       setRequests(requestResponse.data);
//       try {
//         const eligibleResponse = await getEligiblePayslipRuns();
//         setEligible(eligibleResponse.data);
//       } catch (error) {
//         setEligible([]);
//         if (!isPayrollAdmin) throw error;
//       }
//     } catch (error: any) {
//       toast.error(error?.response?.data?.detail || 'Could not load payslip information');
//     } finally {
//       setLoading(false);
//     }
//   }, [isPayrollAdmin]);

//   useEffect(() => { void load(); }, [load]);

//   const submitRequest = async (runId = selectedRunId) => {
//     if (!runId) {
//       toast.error('Select a paid payroll month');
//       return;
//     }
//     if (!requestReason.trim()) {
//       toast.error('Enter a reason for requesting this payslip');
//       return;
//     }
//     setWorking(runId);
//     try {
//       await requestPayslip(runId, requestReason.trim());
//       toast.success('Payslip request submitted for approval');
//       setRequestFormOpen(false);
//       setSelectedRunId('');
//       setRequestReason('');
//       await load();
//     } catch (error: any) {
//       toast.error(error?.response?.data?.detail || 'Could not submit the request');
//     } finally { setWorking(null); }
//   };

//   const review = async (row: RequestRow, decision: 'approve' | 'reject') => {
//     const reason = decision === 'reject' ? window.prompt('Reason for rejection:')?.trim() : '';
//     if (decision === 'reject' && !reason) return;
//     setWorking(row.id);
//     try {
//       await decidePayslipRequest(row.id, decision, reason || '');
//       toast.success(decision === 'approve' ? 'Request approved' : 'Request rejected');
//       await load();
//     } catch (error: any) {
//       toast.error(error?.response?.data?.detail || 'Could not update the request');
//     } finally { setWorking(null); }
//   };

//   const download = async (requestId: string) => {
//     setWorking(requestId);
//     try { await downloadPayslip(requestId); }
//     catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not download payslip'); }
//     finally { setWorking(null); }
//   };

//   const statusClass = (status: string) => ({
//     APPROVED: 'bg-green-100 text-green-800', REJECTED: 'bg-red-100 text-red-800',
//     PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
//   }[status] || 'bg-gray-100 text-gray-700');
//   const myRequests = requests.filter((row) => row.is_requester);
//   const requestableMonths = eligible.filter((item) => !['PENDING_APPROVAL', 'APPROVED'].includes(item.request?.status));
//   const myPayslipsPanel = (
//     <>
//       <section className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
//         <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
//           <div><h2 className="font-medium">Paid payroll months</h2><p className="mt-1 text-xs text-gray-500">A month appears after its payroll payment batch is reconciled.</p></div>
//           <button type="button" disabled={!requestableMonths.length} onClick={() => {
//             setSelectedRunId(requestableMonths[0] ? String(requestableMonths[0].run_id) : '');
//             setRequestReason('');
//             setRequestFormOpen(true);
//           }} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Create Payslip Request</button>
//         </div>
//         {requestFormOpen && <div className="border-b bg-blue-50/50 p-5">
//           <div className="grid gap-4 sm:grid-cols-2">
//             <div><label className="mb-1 block text-xs font-medium text-gray-700">Payroll month *</label>
//               <select value={selectedRunId} onChange={(event) => setSelectedRunId(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
//                 {requestableMonths.map((item) => <option key={item.run_id} value={item.run_id}>{monthLabel(item.month, item.year)}</option>)}
//               </select>
//             </div>
//             <div><label className="mb-1 block text-xs font-medium text-gray-700">Reason *</label>
//               <textarea value={requestReason} onChange={(event) => setRequestReason(event.target.value)} maxLength={1000} rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Explain why you need this payslip" />
//             </div>
//           </div>
//           <div className="mt-3 flex gap-2"><button disabled={working === selectedRunId || !selectedRunId || !requestReason.trim()} onClick={() => void submitRequest()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">{working === selectedRunId ? 'Submitting…' : 'Submit request'}</button><button onClick={() => { setRequestFormOpen(false); setRequestReason(''); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Cancel</button></div>
//         </div>}
//         {eligible.length === 0 ? <p className="p-6 text-sm text-gray-500">No paid payslips are available yet.</p> : <ul className="divide-y divide-gray-100">{eligible.map((item) => {
//           const request = item.request as RequestRow | null;
//           return <li key={item.run_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
//             <div><p className="font-medium">{monthLabel(item.month, item.year)}</p><p className="text-sm text-gray-500">Net pay: ₹{Number(item.net_pay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
//               {request?.status === 'REJECTED' && request.rejection_reason && <p className="mt-1 text-sm text-red-600">Rejected: {request.rejection_reason}</p>}
//             </div>
//             {request?.status === 'APPROVED' ? <button disabled={working === request.id} onClick={() => void download(request.id)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">Download PDF</button>
//               : request?.status === 'PENDING_APPROVAL' ? <span className={`rounded-full px-3 py-1 text-xs ${statusClass(request.status)}`}>Pending approval</span>
//               : <span className="text-xs text-gray-500">{request?.status === 'REJECTED' ? 'Request again is available above' : 'Request available above'}</span>}
//           </li>;
//         })}</ul>}
//       </section>
//       <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
//         <div className="border-b px-5 py-4"><h2 className="font-medium">My request history</h2></div>
//         {myRequests.length === 0 ? <p className="p-6 text-sm text-gray-500">Your requests will appear here.</p> : <ul className="divide-y divide-gray-100">{myRequests.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
//           <div><p className="font-medium">{monthLabel(row.month, row.year)}</p><p className="text-sm text-gray-500">Requested {new Date(row.requested_at).toLocaleDateString()}</p>{row.rejection_reason && <p className="text-sm text-red-600">{row.rejection_reason}</p>}
//             {row.approval_actions?.length ? <ol className="mt-2 space-y-1 text-xs text-gray-500">{row.approval_actions.map((step) => <li key={`${row.id}-${step.step_number}-${step.assigned_to_name}`}>Step {step.step_number}: {step.step_name} — {step.status.toLowerCase().replace('_', ' ')} ({step.assigned_to_name}){step.comments ? ` — ${step.comments}` : ''}</li>)}</ol> : null}
//           </div><span className={`rounded-full px-3 py-1 text-xs ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span>
//         </li>)}</ul>}
//       </section>
//     </>
//   );

//   return (
//     <div className="flex h-screen overflow-hidden bg-gray-50">
//       <Sidebar />
//       <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-4 sm:p-6">
//           <div className="mx-auto max-w-6xl space-y-6">
//       <div className="mb-6">
//         <h1 className="text-2xl font-semibold text-gray-900">{isPayrollAdmin ? 'Payslip Requests' : 'My Payslips'}</h1>
//         <p className="mt-1 text-sm text-gray-600">
//           {isPayrollAdmin ? 'Review employee payslip requests.' : 'Request a payslip for a paid month. Each month is available after payment reconciliation.'}
//         </p>
//       </div>

//       {loading ? <p className="py-10 text-center text-gray-500">Loading…</p> : isPayrollAdmin ? <>
//         <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
//           <div className="border-b px-5 py-4"><h2 className="font-medium">Employee requests</h2></div>
//           {requests.length === 0 ? <p className="p-6 text-sm text-gray-500">No payslip requests.</p> : (
//             <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm">
//               <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr>
//                 <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Pay period</th>
//                 <th className="px-4 py-3">Requested</th><th className="px-4 py-3">Reason</th>
//                 <th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
//               </tr></thead><tbody className="divide-y divide-gray-100">
//                 {requests.map((row) => <tr key={row.id}>
//                   <td className="px-4 py-3">{row.employee_name}<div className="text-xs text-gray-500">{row.employee_code}</div></td>
//                   <td className="px-4 py-3">{monthLabel(row.month, row.year)}</td>
//                   <td className="px-4 py-3">{new Date(row.requested_at).toLocaleDateString()}</td>
//                   <td className="max-w-xs px-4 py-3">{row.reason || '—'}</td>
//                   <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span></td>
//                   <td className="px-4 py-3">
//                     {row.status === 'PENDING_APPROVAL' && row.can_review ? <div className="flex gap-2">
//                       <button disabled={working === row.id} onClick={() => void review(row, 'approve')} className="rounded bg-green-700 px-3 py-1.5 text-xs text-white disabled:opacity-50">Approve</button>
//                       <button disabled={working === row.id} onClick={() => void review(row, 'reject')} className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50">Reject</button>
//                     </div> : row.status === 'APPROVED' ? <button disabled={working === row.id} onClick={() => void download(row.id)} className="text-blue-700 hover:underline">Download PDF</button> : <span className="text-gray-400">—</span>}
//                   </td>
//                 </tr>)}
//               </tbody></table></div>
//           )}
//         </section>
//         {myPayslipsPanel}
//       </> : <>
//         {requests.some((row) => row.can_review) && <section className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
//           <div className="border-b px-5 py-4"><h2 className="font-medium">Payslip requests awaiting your approval</h2></div>
//           <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm">
//             <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr>
//               <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Pay period</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Current step</th><th className="px-4 py-3">Actions</th>
//             </tr></thead><tbody className="divide-y divide-gray-100">{requests.filter((row) => row.can_review).map((row) => <tr key={row.id}>
//               <td className="px-4 py-3">{row.employee_name}<div className="text-xs text-gray-500">{row.employee_code}</div></td>
//               <td className="px-4 py-3">{monthLabel(row.month, row.year)}</td><td className="px-4 py-3">{row.reason}</td>
//               <td className="px-4 py-3">{row.approval_actions?.find((step) => step.status === 'PENDING')?.step_name || '—'}</td>
//               <td className="px-4 py-3"><div className="flex gap-2">
//                 <button disabled={working === row.id} onClick={() => void review(row, 'approve')} className="rounded bg-green-700 px-3 py-1.5 text-xs text-white disabled:opacity-50">Approve</button>
//                 <button disabled={working === row.id} onClick={() => void review(row, 'reject')} className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50">Reject</button>
//               </div></td>
//             </tr>)}</tbody></table></div>
//         </section>}
//         {myPayslipsPanel}
//       </>}
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// }



import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import Sidebar from '../../../components/Sidebar';
import Topbar from '../../../components/Topbar';
import {
  decidePayslipRequest, downloadPayslip, getEligiblePayslipRuns,
  getPayslipRequests, requestPayslip,
} from '../../../api/payrollApi';

type RequestRow = {
  id: string;
  employee_name: string;
  employee_code: string;
  run_id: string;
  year: number;
  month: number;
  run_type?: string;
  run_type_display?: string;
  status: string;
  reason: string;
  requested_at: string;
  rejection_reason?: string;
  can_review?: boolean;
  is_requester?: boolean;
  approval_actions?: Array<{ step_number: number; step_name: string; status: string; assigned_to_name: string; comments?: string }>;
};

const monthLabel = (month: number, year: number) =>
  new Date(year, month - 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });

/* ---------- UI tokens (styling only) ---------- */
const card = 'overflow-hidden rounded-2xl bg-white shadow-[0_10px_40px_-12px_rgba(79,70,229,0.18)]';
const cardHead = 'flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4';
const cardTitle = 'text-lg font-semibold text-slate-800';
const cardSub = 'mt-0.5 text-sm text-slate-500';
const primaryBtn =
  'rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none';
const ghostBtn =
  'rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50';
const approveBtn =
  'rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:opacity-50';
const rejectBtn =
  'rounded-lg bg-rose-50 px-3.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50';
const fieldCls =
  'w-full rounded-xl border-0 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm ring-1 ring-inset ring-slate-200/70 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500';
const labelCls = 'mb-1.5 block text-xs font-medium text-slate-600';
const th = 'px-4 py-2 text-left text-xs font-medium text-slate-400';
const rowTd = 'bg-slate-50/70 px-4 py-3.5 first:rounded-l-xl last:rounded-r-xl';

export default function PayslipsPage() {
  const { user } = useAuth();
  const isPayrollAdmin = Boolean(user?.role_codes?.some((role) => ['HR_ADMIN', 'SYSTEM_ADMIN'].includes(role)));
  const [eligible, setEligible] = useState<any[]>([]);
  const [eligibleLoadError, setEligibleLoadError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setEligibleLoadError(null);
    try {
      const requestResponse = await getPayslipRequests();
      setRequests(requestResponse.data);
      try {
        const eligibleResponse = await getEligiblePayslipRuns();
        setEligible(eligibleResponse.data);
      } catch (error: any) {
        setEligible([]);
        const detail = error?.response?.data?.detail;
        if (isPayrollAdmin) setEligibleLoadError(detail || 'Could not load the employee-linked paid payroll months.');
        else throw error;
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Could not load payslip information');
    } finally {
      setLoading(false);
    }
  }, [isPayrollAdmin]);

  useEffect(() => { void load(); }, [load]);

  const submitRequest = async (runId = selectedRunId) => {
    if (!runId) {
      toast.error('Select a paid payroll month');
      return;
    }
    if (!requestReason.trim()) {
      toast.error('Enter a reason for requesting this payslip');
      return;
    }
    setWorking(runId);
    try {
      await requestPayslip(runId, requestReason.trim());
      toast.success('Payslip request submitted for approval');
      setRequestFormOpen(false);
      setSelectedRunId('');
      setRequestReason('');
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Could not submit the request');
    } finally { setWorking(null); }
  };

  const review = async (row: RequestRow, decision: 'approve' | 'reject') => {
    const reason = decision === 'reject' ? window.prompt('Reason for rejection:')?.trim() : '';
    if (decision === 'reject' && !reason) return;
    setWorking(row.id);
    try {
      await decidePayslipRequest(row.id, decision, reason || '');
      toast.success(decision === 'approve' ? 'Request approved' : 'Request rejected');
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Could not update the request');
    } finally { setWorking(null); }
  };

  const download = async (requestId: string) => {
    setWorking(requestId);
    try { await downloadPayslip(requestId); }
    catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not download payslip'); }
    finally { setWorking(null); }
  };

  const statusClass = (status: string) => ({
    APPROVED: 'bg-emerald-50 text-emerald-700',
    REJECTED: 'bg-rose-50 text-rose-700',
    PENDING_APPROVAL: 'bg-amber-50 text-amber-700',
  }[status] || 'bg-slate-100 text-slate-600');
  const myRequests = requests.filter((row) => row.is_requester);
  const requestableMonths = eligible.filter((item) => !['PENDING_APPROVAL', 'APPROVED'].includes(item.request?.status));

  const myPayslipsPanel = (
    <>
      <section className={card}>
        <div className={cardHead}>
          <div>
            <h2 className={cardTitle}>Paid payroll months</h2>
            <p className={cardSub}>A month appears after its payroll payment batch is reconciled.</p>
          </div>
          <button type="button" title={!requestableMonths.length ? 'Available after this employee has a paid, reconciled payroll month' : undefined} disabled={!requestableMonths.length} onClick={() => {
            setSelectedRunId(requestableMonths[0] ? String(requestableMonths[0].run_id) : '');
            setRequestReason('');
            setRequestFormOpen(true);
          }} className={primaryBtn}>Create Payslip Request</button>
        </div>
        {requestFormOpen && <div className="mx-6 mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelCls}>Payroll month *</label>
              <select value={selectedRunId} onChange={(event) => setSelectedRunId(event.target.value)} className={fieldCls}>
                {requestableMonths.map((item) => <option key={item.run_id} value={item.run_id}>{monthLabel(item.month, item.year)} · {item.run_type_display || item.run_type || 'Regular'}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Reason *</label>
              <textarea value={requestReason} onChange={(event) => setRequestReason(event.target.value)} maxLength={1000} rows={2} className={`${fieldCls} resize-none`} placeholder="Explain why you need this payslip" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button disabled={working === selectedRunId || !selectedRunId || !requestReason.trim()} onClick={() => void submitRequest()} className={primaryBtn}>{working === selectedRunId ? 'Submitting…' : 'Submit request'}</button>
            <button onClick={() => { setRequestFormOpen(false); setRequestReason(''); }} className={ghostBtn}>Cancel</button>
          </div>
        </div>}
        {eligible.length === 0 ? <p className="px-6 pb-8 pt-2 text-sm text-slate-500">{eligibleLoadError || (isPayrollAdmin ? 'No paid payroll month is linked to the employee account used for this admin login. Sign in as the employee included in the run to request their own payslip.' : 'No paid payslips are available yet.')}</p> : <ul className="space-y-3 px-6 pb-6">{eligible.map((item) => {
          const request = item.request as RequestRow | null;
          return <li key={item.run_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50/70 px-5 py-4 transition hover:bg-indigo-50/50">
            <div><p className="font-medium text-slate-800">{monthLabel(item.month, item.year)} · {item.run_type_display || item.run_type || 'Regular'}</p><p className="mt-0.5 text-sm text-slate-500">Net pay: ₹{Number(item.net_pay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              {request?.status === 'REJECTED' && request.rejection_reason && <p className="mt-1 text-sm text-rose-600">Rejected: {request.rejection_reason}</p>}
            </div>
            {request?.status === 'APPROVED' ? <button disabled={working === request.id} onClick={() => void download(request.id)} className={primaryBtn}>Download PDF</button>
              : request?.status === 'PENDING_APPROVAL' ? <span className={`rounded-full px-3.5 py-1 text-xs font-medium ${statusClass(request.status)}`}>Pending approval</span>
              : <span className="text-xs text-slate-400">{request?.status === 'REJECTED' ? 'Request again is available above' : 'Request available above'}</span>}
          </li>;
        })}</ul>}
      </section>

      <section className={card}>
        <div className={cardHead}><h2 className={cardTitle}>My request history</h2></div>
        {myRequests.length === 0 ? <p className="px-6 pb-8 pt-2 text-sm text-slate-500">Your requests will appear here.</p> : <ul className="space-y-3 px-6 pb-6">{myRequests.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50/70 px-5 py-4 transition hover:bg-indigo-50/50">
          <div><p className="font-medium text-slate-800">{monthLabel(row.month, row.year)} · {row.run_type_display || row.run_type || 'Regular'}</p><p className="mt-0.5 text-sm text-slate-500">Requested {new Date(row.requested_at).toLocaleDateString()}</p>{row.rejection_reason && <p className="mt-1 text-sm text-rose-600">{row.rejection_reason}</p>}
            {row.approval_actions?.length ? <ol className="mt-2 space-y-1 text-xs text-slate-500">{row.approval_actions.map((step) => <li key={`${row.id}-${step.step_number}-${step.assigned_to_name}`}>Step {step.step_number}: {step.step_name} — {step.status.toLowerCase().replace('_', ' ')} ({step.assigned_to_name}){step.comments ? ` — ${step.comments}` : ''}</li>)}</ol> : null}
          </div><span className={`rounded-full px-3.5 py-1 text-xs font-medium ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span>
        </li>)}</ul>}
      </section>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-8 py-8 text-white shadow-xl shadow-indigo-500/25">
              <h1 className="text-3xl font-bold tracking-tight">{isPayrollAdmin ? 'Payslip Requests' : 'My Payslips'}</h1>
              <p className="mt-2 max-w-2xl text-base text-indigo-100">
                {isPayrollAdmin ? 'Review employee payslip requests.' : 'Request a payslip for a paid month. Each month is available after payment reconciliation.'}
              </p>
            </div>

            {loading ? <p className="py-16 text-center text-slate-500">Loading…</p> : isPayrollAdmin ? <>
              <section className={card}>
                <div className={cardHead}><h2 className={cardTitle}>Employee requests</h2></div>
                {requests.length === 0 ? <p className="px-6 pb-8 pt-2 text-sm text-slate-500">No payslip requests.</p> : (
                  <div className="overflow-x-auto px-4 pb-5"><table className="min-w-full border-separate border-spacing-y-2 text-sm">
                    <thead><tr>
                      <th className={th}>Employee</th><th className={th}>Pay period</th>
                      <th className={th}>Requested</th><th className={th}>Reason</th>
                      <th className={th}>Status</th><th className={th}>Actions</th>
                    </tr></thead><tbody>
                      {requests.map((row) => <tr key={row.id}>
                        <td className={`${rowTd} font-medium text-slate-800`}>{row.employee_name}<div className="text-xs font-normal text-slate-500">{row.employee_code}</div></td>
                        <td className={`${rowTd} text-slate-700`}>{monthLabel(row.month, row.year)}</td>
                        <td className={`${rowTd} text-slate-700`}>{new Date(row.requested_at).toLocaleDateString()}</td>
                        <td className={`${rowTd} max-w-xs text-slate-700`}>{row.reason || '—'}</td>
                        <td className={rowTd}><span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(row.status)}`}>{row.status.replace('_', ' ')}</span></td>
                        <td className={rowTd}>
                          {row.status === 'PENDING_APPROVAL' && row.can_review ? <div className="flex gap-2">
                            <button disabled={working === row.id} onClick={() => void review(row, 'approve')} className={approveBtn}>Approve</button>
                            <button disabled={working === row.id} onClick={() => void review(row, 'reject')} className={rejectBtn}>Reject</button>
                          </div> : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>)}
                    </tbody></table></div>
                )}
              </section>
              {myPayslipsPanel}
            </> : <>
              {requests.some((row) => row.can_review) && <section className={card}>
                <div className={cardHead}><h2 className={cardTitle}>Payslip requests awaiting your approval</h2></div>
                <div className="overflow-x-auto px-4 pb-5"><table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead><tr>
                    <th className={th}>Employee</th><th className={th}>Pay period</th><th className={th}>Reason</th><th className={th}>Current step</th><th className={th}>Actions</th>
                  </tr></thead><tbody>{requests.filter((row) => row.can_review).map((row) => <tr key={row.id}>
                    <td className={`${rowTd} font-medium text-slate-800`}>{row.employee_name}<div className="text-xs font-normal text-slate-500">{row.employee_code}</div></td>
                    <td className={`${rowTd} text-slate-700`}>{monthLabel(row.month, row.year)}</td>
                    <td className={`${rowTd} text-slate-700`}>{row.reason}</td>
                    <td className={`${rowTd} text-slate-700`}>{row.approval_actions?.find((step) => step.status === 'PENDING')?.step_name || '—'}</td>
                    <td className={rowTd}><div className="flex gap-2">
                      <button disabled={working === row.id} onClick={() => void review(row, 'approve')} className={approveBtn}>Approve</button>
                      <button disabled={working === row.id} onClick={() => void review(row, 'reject')} className={rejectBtn}>Reject</button>
                    </div></td>
                  </tr>)}</tbody></table></div>
              </section>}
              {myPayslipsPanel}
            </>}
          </div>
        </main>
      </div>
    </div>
  );
}
