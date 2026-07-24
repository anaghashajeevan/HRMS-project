// import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import {
//   Calendar, User, Upload, AlertCircle, CheckCircle2,
//   Loader2, ArrowLeft, Send, Info,
// } from 'lucide-react';
// import toast from 'react-hot-toast';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { leaveTypesApi, leaveBalancesApi, leaveApplicationsApi } from '../../api/leave';
// import { employeesApi } from '../../api/employees';
// import type {
//   LeaveTypeMini, LeaveBalance, LeaveValidationResult, HalfDayPeriod,
// } from '../../types/leave';

// export default function ApplyLeavePage() {
//   const navigate = useNavigate();

//   const [leaveTypes, setLeaveTypes] = useState<LeaveTypeMini[]>([]);
//   const [balances, setBalances] = useState<LeaveBalance[]>([]);
//   const [managers, setManagers] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);

//   // Form state
//   const [leaveTypeId, setLeaveTypeId] = useState('');
//   const [startDate, setStartDate] = useState('');
//   const [endDate, setEndDate] = useState('');
//   const [isHalfDay, setIsHalfDay] = useState(false);
//   const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>('AM');
//   const [reason, setReason] = useState('');
//   const [contactDuringLeave, setContactDuringLeave] = useState('');
//   const [handoverToId, setHandoverToId] = useState('');
//   const [handoverNotes, setHandoverNotes] = useState('');
//   const [supportingDoc, setSupportingDoc] = useState<File | null>(null);

//   // Validation
//   const [validation, setValidation] = useState<LeaveValidationResult | null>(null);
//   const [validating, setValidating] = useState(false);

//   useEffect(() => {
//     loadData();
//   }, []);

//   useEffect(() => {
//     // Auto-validate when key fields change
//     if (leaveTypeId && startDate && endDate) {
//       validateLeave();
//     } else {
//       setValidation(null);
//     }
//   }, [leaveTypeId, startDate, endDate, isHalfDay, halfDayPeriod]);

//   const loadData = async () => {
//     try {
//       const [types, myBalances, mgrs] = await Promise.all([
//         leaveTypesApi.mini(),
//         leaveBalancesApi.myBalance(),
//         employeesApi.getManagers(),
//       ]);
//       setLeaveTypes(types);
//       setBalances(myBalances);
//       setManagers(mgrs);
//     } catch (error) {
//       toast.error('Failed to load data');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const validateLeave = async () => {
//     if (!leaveTypeId || !startDate || !endDate) return;

//     setValidating(true);
//     try {
//       const result = await leaveApplicationsApi.validate({
//         leave_type: leaveTypeId,
//         start_date: startDate,
//         end_date: endDate,
//         is_half_day: isHalfDay,
//         half_day_period: halfDayPeriod,
//       });
//       setValidation(result);
//     } catch (error: any) {
//       const errMsg = error?.response?.data?.detail || 'Validation failed';
//       setValidation({
//         valid: false,
//         errors: [errMsg],
//         warnings: [],
//         total_days: '0',
//         is_lop: false,
//         lop_days: '0',
//       });
//     } finally {
//       setValidating(false);
//     }
//   };

//   const handleSubmit = async () => {
//     if (!leaveTypeId || !startDate || !endDate || !reason.trim()) {
//       toast.error('Please fill all required fields');
//       return;
//     }

//     const selectedType = leaveTypes.find(t => t.id === leaveTypeId);
//     if (selectedType?.requires_document && !supportingDoc) {
//       toast.error(`${selectedType.name} requires a supporting document`);
//       return;
//     }

//     if (validation && !validation.valid) {
//       toast.error('Please fix validation errors first');
//       return;
//     }

//     setSubmitting(true);
//     try {
//       const app = await leaveApplicationsApi.create({
//         leave_type: leaveTypeId,
//         start_date: startDate,
//         end_date: endDate,
//         reason,
//         is_half_day: isHalfDay,
//         half_day_period: isHalfDay ? halfDayPeriod : undefined,
//         contact_during_leave: contactDuringLeave,
//         handover_to: handoverToId || undefined,
//         handover_notes: handoverNotes,
//         supporting_document: supportingDoc,
//       });
//       toast.success(`Leave application ${app.application_number} submitted!`);
//       navigate('/leave');
//     } catch (error: any) {
//       const errMsg = error?.response?.data?.detail || 'Failed to submit';
//       toast.error(errMsg);
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const selectedType = leaveTypes.find(t => t.id === leaveTypeId);
//   const selectedBalance = balances.find(b => b.leave_type.id === leaveTypeId);

//   if (loading) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 flex-col overflow-hidden">
//           <Topbar />
//           <div className="flex items-center justify-center py-16">
//             <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6 flex items-center gap-3">
//             <button
//               onClick={() => navigate('/leave')}
//               className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
//             >
//               <ArrowLeft className="h-5 w-5" />
//             </button>
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900">Apply for Leave</h1>
//               <p className="mt-1 text-sm text-gray-600">
//                 Fill in the details below to submit your leave request
//               </p>
//             </div>
//           </div>

//           <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
//             {/* Form (left) */}
//             <div className="lg:col-span-2 space-y-4">
//               {/* Leave Type */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <label className="block text-sm font-semibold text-gray-700 mb-2">
//                   Leave Type *
//                 </label>
//                 <select
//                   value={leaveTypeId}
//                   onChange={(e) => setLeaveTypeId(e.target.value)}
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//                 >
//                   <option value="">-- Select leave type --</option>
//                   {leaveTypes.map((t) => {
//                     const balance = balances.find(b => b.leave_type.id === t.id);
//                     return (
//                       <option key={t.id} value={t.id}>
//                         {t.code} - {t.name} {balance ? `(${balance.available} available)` : ''}
//                       </option>
//                     );
//                   })}
//                 </select>

//                 {selectedType?.requires_document && (
//                   <p className="mt-2 flex items-center gap-1 text-xs text-orange-600">
//                     <Info className="h-3 w-3" />
//                     Supporting document required
//                   </p>
//                 )}
//               </div>

//               {/* Dates */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <div className="grid grid-cols-2 gap-4">
//                   <div>
//                     <label className="block text-sm font-semibold text-gray-700 mb-2">
//                       Start Date *
//                     </label>
//                     <input
//                       type="date"
//                       value={startDate}
//                       onChange={(e) => setStartDate(e.target.value)}
//                       className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-sm font-semibold text-gray-700 mb-2">
//                       End Date *
//                     </label>
//                     <input
//                       type="date"
//                       value={endDate}
//                       onChange={(e) => setEndDate(e.target.value)}
//                       min={startDate}
//                       className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//                     />
//                   </div>
//                 </div>

//                 {selectedType?.can_apply_half_day && startDate === endDate && startDate && (
//                   <div className="mt-3 border-t border-gray-100 pt-3">
//                     <label className="flex items-center gap-2 cursor-pointer">
//                       <input
//                         type="checkbox"
//                         checked={isHalfDay}
//                         onChange={(e) => setIsHalfDay(e.target.checked)}
//                         className="h-4 w-4 rounded border-gray-300 text-blue-600"
//                       />
//                       <span className="text-sm font-medium text-gray-700">Half Day</span>
//                     </label>
//                     {isHalfDay && (
//                       <div className="mt-2 flex gap-3">
//                         <label className="flex items-center gap-2 cursor-pointer">
//                           <input
//                             type="radio"
//                             checked={halfDayPeriod === 'AM'}
//                             onChange={() => setHalfDayPeriod('AM')}
//                             className="h-4 w-4 border-gray-300 text-blue-600"
//                           />
//                           <span className="text-sm">First Half (Morning)</span>
//                         </label>
//                         <label className="flex items-center gap-2 cursor-pointer">
//                           <input
//                             type="radio"
//                             checked={halfDayPeriod === 'PM'}
//                             onChange={() => setHalfDayPeriod('PM')}
//                             className="h-4 w-4 border-gray-300 text-blue-600"
//                           />
//                           <span className="text-sm">Second Half (Afternoon)</span>
//                         </label>
//                       </div>
//                     )}
//                   </div>
//                 )}
//               </div>

//               {/* Reason */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <label className="block text-sm font-semibold text-gray-700 mb-2">
//                   Reason *
//                 </label>
//                 <textarea
//                   value={reason}
//                   onChange={(e) => setReason(e.target.value)}
//                   rows={3}
//                   placeholder="Explain the reason for your leave..."
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//                 />
//               </div>

//               {/* Contact */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <label className="block text-sm font-semibold text-gray-700 mb-2">
//                   Contact During Leave
//                 </label>
//                 <input
//                   type="text"
//                   value={contactDuringLeave}
//                   onChange={(e) => setContactDuringLeave(e.target.value)}
//                   placeholder="Phone number or alternate email"
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//                 />
//               </div>

//               {/* Handover */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <label className="block text-sm font-semibold text-gray-700 mb-2">
//                   Handover To (Optional)
//                 </label>
//                 <select
//                   value={handoverToId}
//                   onChange={(e) => setHandoverToId(e.target.value)}
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//                 >
//                   <option value="">-- Select colleague --</option>
//                   {managers.map((m) => (
//                     <option key={m.id} value={m.id}>
//                       {m.employee_id} - {m.full_name}
//                     </option>
//                   ))}
//                 </select>
//                 <textarea
//                   value={handoverNotes}
//                   onChange={(e) => setHandoverNotes(e.target.value)}
//                   rows={2}
//                   placeholder="Handover notes (optional)..."
//                   className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//                 />
//               </div>

//               {/* Supporting Document */}
//               {selectedType?.requires_document && (
//                 <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                   <label className="block text-sm font-semibold text-gray-700 mb-2">
//                     Supporting Document *
//                   </label>
//                   <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-6 hover:border-primary-400">
//                     <Upload className="mr-2 h-5 w-5 text-gray-400" />
//                     <span className="text-sm text-gray-600">
//                       {supportingDoc ? supportingDoc.name : 'Click to upload'}
//                     </span>
//                     <input
//                       type="file"
//                       onChange={(e) => setSupportingDoc(e.target.files?.[0] || null)}
//                       className="hidden"
//                     />
//                   </label>
//                 </div>
//               )}
//             </div>

//             {/* Sidebar (right) */}
//             <div className="space-y-4">
//               {/* Balance */}
//               {selectedBalance && (
//                 <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                   <h3 className="text-sm font-semibold text-gray-700 mb-3">
//                     Balance for {selectedType?.name}
//                   </h3>
//                   <div className="text-4xl font-bold text-green-600">
//                     {parseFloat(selectedBalance.available).toFixed(1)}
//                     <span className="text-sm text-gray-500 font-normal ml-1">days</span>
//                   </div>
//                   <div className="mt-3 space-y-1 text-xs text-gray-600">
//                     <div className="flex justify-between">
//                       <span>Allocated</span>
//                       <span className="font-semibold">{selectedBalance.allocated}</span>
//                     </div>
//                     <div className="flex justify-between">
//                       <span>Used</span>
//                       <span className="font-semibold text-red-600">{selectedBalance.used}</span>
//                     </div>
//                     <div className="flex justify-between">
//                       <span>Pending</span>
//                       <span className="font-semibold text-amber-600">{selectedBalance.pending}</span>
//                     </div>
//                   </div>
//                 </div>
//               )}

//               {/* Validation */}
//               {validating && (
//                 <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
//                   <div className="flex items-center gap-2">
//                     <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
//                     <span className="text-sm text-blue-700">Validating...</span>
//                   </div>
//                 </div>
//               )}

//               {validation && !validating && (
//                 <div className={`rounded-xl border p-4 ${
//                   validation.valid
//                     ? 'bg-green-50 border-green-200'
//                     : 'bg-red-50 border-red-200'
//                 }`}>
//                   {validation.valid ? (
//                     <>
//                       <div className="flex items-center gap-2 mb-2">
//                         <CheckCircle2 className="h-5 w-5 text-green-600" />
//                         <h3 className="font-semibold text-green-900">Ready to Submit</h3>
//                       </div>
//                       <div className="space-y-1 text-sm text-green-800">
//                         <p><strong>Total Days:</strong> {validation.total_days}</p>
//                         {selectedBalance && (
//                           <p><strong>Balance After:</strong> {
//                             (parseFloat(selectedBalance.available) - parseFloat(validation.total_days)).toFixed(1)
//                           } days</p>
//                         )}
//                       </div>
//                     </>
//                   ) : (
//                     <>
//                       <div className="flex items-center gap-2 mb-2">
//                         <AlertCircle className="h-5 w-5 text-red-600" />
//                         <h3 className="font-semibold text-red-900">Cannot Submit</h3>
//                       </div>
//                       <ul className="text-sm text-red-800 space-y-1">
//                         {validation.errors.map((err, i) => (
//                           <li key={i}>• {err}</li>
//                         ))}
//                       </ul>
//                     </>
//                   )}

//                   {validation.warnings.length > 0 && (
//                     <div className="mt-3 pt-3 border-t border-amber-200">
//                       <p className="text-xs font-semibold text-amber-900 mb-1">⚠️ Warnings:</p>
//                       <ul className="text-xs text-amber-800 space-y-1">
//                         {validation.warnings.map((w, i) => <li key={i}>• {w}</li>)}
//                       </ul>
//                     </div>
//                   )}

//                   {validation.is_lop && (
//                     <div className="mt-3 pt-3 border-t border-red-200 text-xs text-red-800">
//                       <strong>LOP:</strong> {validation.lop_days} days will be Loss of Pay
//                     </div>
//                   )}
//                 </div>
//               )}

//               {/* Submit Button */}
//               <button
                
//                 onClick={handleSubmit}
//                 disabled={submitting || (validation !== null && !validation.valid)}
//                 className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
//               >
//                 {submitting ? (
//                   <>
//                     <Loader2 className="h-4 w-4 animate-spin" />
//                     Submitting...
//                   </>
//                 ) : (
//                   <>
//                     <Send className="h-4 w-4" />
//                     Submit Application
//                   </>
//                 )}
//               </button>
//             </div>
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, User, Upload, AlertCircle, CheckCircle2,
  Loader2, ArrowLeft, Send, Info, FileText, Users, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { leaveTypesApi, leaveBalancesApi, leaveApplicationsApi } from '../../api/leave';
import { employeesApi } from '../../api/employees';
import type {
  LeaveTypeMini, LeaveBalance, LeaveValidationResult, HalfDayPeriod,
} from '../../types/leave';

export default function ApplyLeavePage() {
  const navigate = useNavigate();

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeMini[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>('AM');
  const [reason, setReason] = useState('');
  const [contactDuringLeave, setContactDuringLeave] = useState('');
  const [handoverToId, setHandoverToId] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);

  // Validation
  const [validation, setValidation] = useState<LeaveValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Auto-validate when key fields change
    if (leaveTypeId && startDate && endDate) {
      validateLeave();
    } else {
      setValidation(null);
    }
  }, [leaveTypeId, startDate, endDate, isHalfDay, halfDayPeriod]);

  const loadData = async () => {
    try {
      const [types, myBalances, mgrs] = await Promise.all([
        leaveTypesApi.mini(),
        leaveBalancesApi.myBalance(),
        employeesApi.getManagers(),
      ]);
      setLeaveTypes(types);
      setBalances(myBalances);
      setManagers(mgrs);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const validateLeave = async () => {
    if (!leaveTypeId || !startDate || !endDate) return;

    setValidating(true);
    try {
      const result = await leaveApplicationsApi.validate({
        leave_type: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        is_half_day: isHalfDay,
        half_day_period: halfDayPeriod,
      });
      setValidation(result);
    } catch (error: any) {
      const errMsg = error?.response?.data?.detail || 'Validation failed';
      setValidation({
        valid: false,
        errors: [errMsg],
        warnings: [],
        total_days: '0',
        is_lop: false,
        lop_days: '0',
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!leaveTypeId || !startDate || !endDate || !reason.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    const selectedType = leaveTypes.find(t => t.id === leaveTypeId);
    if (selectedType?.requires_document && !supportingDoc) {
      toast.error(`${selectedType.name} requires a supporting document`);
      return;
    }

    if (validation && !validation.valid) {
      toast.error('Please fix validation errors first');
      return;
    }

    setSubmitting(true);
    try {
      const app = await leaveApplicationsApi.create({
        leave_type: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        reason,
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : undefined,
        contact_during_leave: contactDuringLeave,
        handover_to: handoverToId || undefined,
        handover_notes: handoverNotes,
        supporting_document: supportingDoc,
      });
      toast.success(`Leave application ${app.application_number} submitted!`);
      navigate('/leave');
    } catch (error: any) {
      const errMsg = error?.response?.data?.detail || 'Failed to submit';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = leaveTypes.find(t => t.id === leaveTypeId);
  const selectedBalance = balances.find(b => b.leave_type.id === leaveTypeId);
  const balanceUsedPct = selectedBalance
    ? Math.min(100, (parseFloat(selectedBalance.used) / Math.max(parseFloat(selectedBalance.allocated), 1)) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-10 w-10">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary-400 opacity-30" />
                <Loader2 className="relative h-10 w-10 animate-spin text-primary-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Loading leave details...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <style>{`
        @keyframes riseIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rise-in { animation: riseIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .rise-1 { animation-delay: 0.02s; }
        .rise-2 { animation-delay: 0.06s; }
        .rise-3 { animation-delay: 0.10s; }
        .rise-4 { animation-delay: 0.14s; }
        .rise-5 { animation-delay: 0.18s; }
        .rise-6 { animation-delay: 0.22s; }
        @keyframes barGrow {
          from { width: 0%; }
        }
        .bar-grow { animation: barGrow 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 4px 14px 0 rgba(var(--primary-glow, 37 99 235) / 0.25); }
          50% { box-shadow: 0 4px 24px 4px rgba(var(--primary-glow, 37 99 235) / 0.4); }
        }
        .glow-pulse { animation: glowPulse 2.4s ease-in-out infinite; }
      `}</style>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-4 lg:p-5">
          {/* Gradient header banner */}
          <div className="rise-in relative mb-4 flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 px-4 py-4 shadow-lg sm:px-6 sm:py-5">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-12 right-16 h-24 w-24 rounded-full bg-white/5" />
            <button
              onClick={() => navigate('/leave')}
              className="relative z-10 rounded-lg bg-white/15 p-2 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/25 active:scale-90"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative z-10">
              <h1 className="text-lg font-bold text-white sm:text-2xl">Apply for Leave</h1>
              <p className="text-xs text-primary-100 sm:text-sm">
                Fill in the details below to submit your leave request
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-4">
            {/* Form (left) */}
            <div className="space-y-3 lg:col-span-2">
              {/* Leave Type */}
              <div className="rise-in rise-1 group rounded-xl border-l-4 border-primary-500 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:p-4">
                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  Leave Type <span className="text-primary-500">*</span>
                </label>
                <select
                  value={leaveTypeId}
                  onChange={(e) => setLeaveTypeId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all duration-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                >
                  <option value="">-- Select leave type --</option>
                  {leaveTypes.map((t) => {
                    const balance = balances.find(b => b.leave_type.id === t.id);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.code} - {t.name} {balance ? `(${balance.available} available)` : ''}
                      </option>
                    );
                  })}
                </select>

                {selectedType?.requires_document && (
                  <p className="rise-in mt-2 flex items-center gap-1 text-xs font-medium text-amber-600">
                    <Info className="h-3 w-3" />
                    Supporting document required
                  </p>
                )}
              </div>

              {/* Dates */}
              <div className="rise-in rise-2 rounded-xl border-l-4 border-primary-500 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                    <Calendar className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-semibold text-gray-700">Leave Duration</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Start Date <span className="text-primary-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all duration-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      End Date <span className="text-primary-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all duration-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                    />
                  </div>
                </div>

                {selectedType?.can_apply_half_day && startDate === endDate && startDate && (
                  <div className="rise-in mt-3 border-t border-gray-100 pt-3">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isHalfDay}
                        onChange={(e) => setIsHalfDay(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-200"
                      />
                      <span className="text-sm font-medium text-gray-700">Half Day</span>
                    </label>
                    {isHalfDay && (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 transition-colors duration-150 has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50">
                          <input
                            type="radio"
                            checked={halfDayPeriod === 'AM'}
                            onChange={() => setHalfDayPeriod('AM')}
                            className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-200"
                          />
                          <span className="text-sm">First Half (Morning)</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 transition-colors duration-150 has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50">
                          <input
                            type="radio"
                            checked={halfDayPeriod === 'PM'}
                            onChange={() => setHalfDayPeriod('PM')}
                            className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-200"
                          />
                          <span className="text-sm">Second Half (Afternoon)</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="rise-in rise-3 rounded-xl border-l-4 border-primary-500 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <FileText className="h-3.5 w-3.5 text-primary-500" />
                  Reason <span className="text-primary-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Explain the reason for your leave..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all duration-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                />
              </div>

              {/* Contact */}
              <div className="rise-in rise-4 rounded-xl border-l-4 border-primary-500 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Contact During Leave
                </label>
                <input
                  type="text"
                  value={contactDuringLeave}
                  onChange={(e) => setContactDuringLeave(e.target.value)}
                  placeholder="Phone number or alternate email"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all duration-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                />
              </div>

              {/* Handover */}
              <div className="rise-in rise-5 rounded-xl border-l-4 border-primary-500 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-semibold text-gray-700">Handover To (Optional)</span>
                </div>
                <select
                  value={handoverToId}
                  onChange={(e) => setHandoverToId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all duration-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                >
                  <option value="">-- Select colleague --</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.employee_id} - {m.full_name}
                    </option>
                  ))}
                </select>
                <textarea
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  rows={2}
                  placeholder="Handover notes (optional)..."
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                />
              </div>

              {/* Supporting Document */}
              {selectedType?.requires_document && (
                <div className="rise-in rise-6 rounded-xl border-l-4 border-amber-400 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Supporting Document <span className="text-amber-500">*</span>
                  </label>
                  <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 py-6 transition-all duration-200 hover:border-amber-400 hover:bg-amber-50">
                    <Upload className="mr-2 h-5 w-5 text-amber-500" />
                    <span className="text-sm text-gray-700">
                      {supportingDoc ? supportingDoc.name : 'Click to upload'}
                    </span>
                    <input
                      type="file"
                      onChange={(e) => setSupportingDoc(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Sidebar (right) */}
            <div className="space-y-3 lg:sticky lg:top-4 lg:h-fit">
              {/* Balance */}
              {selectedBalance && (
                <div className="rise-in rise-2 relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 p-4 text-white shadow-lg">
                  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                  <h3 className="mb-1 text-sm font-semibold text-primary-100">
                    Balance for {selectedType?.name}
                  </h3>
                  <div className="text-4xl font-bold text-white">
                    {parseFloat(selectedBalance.available).toFixed(1)}
                    <span className="ml-1 text-sm font-normal text-primary-100">days available</span>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="bar-grow h-full rounded-full bg-amber-400"
                      style={{ width: `${balanceUsedPct}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-white/10 py-2">
                      <div className="font-semibold text-white">{selectedBalance.allocated}</div>
                      <div className="text-primary-100">Allocated</div>
                    </div>
                    <div className="rounded-lg bg-white/10 py-2">
                      <div className="font-semibold text-white">{selectedBalance.used}</div>
                      <div className="text-primary-100">Used</div>
                    </div>
                    <div className="rounded-lg bg-white/10 py-2">
                      <div className="font-semibold text-white">{selectedBalance.pending}</div>
                      <div className="text-primary-100">Pending</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Validation */}
              {validating && (
                <div className="rise-in flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Validating...</span>
                </div>
              )}

              {validation && !validating && (
                <div className={`rise-in rounded-xl border-l-4 p-4 shadow-sm transition-colors duration-300 ${
                  validation.valid
                    ? 'border-green-500 bg-green-50'
                    : 'border-red-500 bg-red-50'
                }`}>
                  {validation.valid ? (
                    <>
                      <div className="mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <h3 className="font-semibold text-green-900">Ready to Submit</h3>
                      </div>
                      <div className="space-y-1 text-sm text-green-800">
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <strong>Total Days:</strong> {validation.total_days}
                        </p>
                        {selectedBalance && (
                          <p><strong>Balance After:</strong> {
                            (parseFloat(selectedBalance.available) - parseFloat(validation.total_days)).toFixed(1)
                          } days</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-2 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <h3 className="font-semibold text-red-900">Cannot Submit</h3>
                      </div>
                      <ul className="space-y-1 text-sm text-red-800">
                        {validation.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {validation.warnings.length > 0 && (
                    <div className="mt-3 border-t border-amber-200 pt-3">
                      <p className="mb-1 text-xs font-semibold text-amber-900">⚠️ Warnings:</p>
                      <ul className="space-y-1 text-xs text-amber-800">
                        {validation.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                      </ul>
                    </div>
                  )}

                  {validation.is_lop && (
                    <div className="mt-3 border-t border-red-200 pt-3 text-xs text-red-800">
                      <strong>LOP:</strong> {validation.lop_days} days will be Loss of Pay
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={submitting || (validation !== null && !validation.valid)}
                className="rise-in group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:from-primary-700 hover:to-primary-800 hover:shadow-xl active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg enabled:glow-pulse"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    Submit Application
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}