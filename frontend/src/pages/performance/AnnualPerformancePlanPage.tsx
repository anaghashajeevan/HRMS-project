// import { useEffect, useState, useMemo } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import {
//   Calendar, CheckCircle2, Clock, AlertCircle, FileText,
//   Target, Award, ArrowLeft, Plus, ChevronDown, ChevronRight,
//   Send, Trash2, Edit2, Upload, Lock, ShieldCheck, Sparkles,
//   TrendingUp, User, Building2, Info, Loader2, FileSpreadsheet,
//   AlertTriangle, RefreshCw
// } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { useAuth } from '../../context/AuthContext';
// import {
//   annualPlansApi,
//   monthlyPlansApi,
//   monthlyKRAsApi,
//   monthlyKPIsApi,
// } from '../../api/performance';
// import type {
//   AnnualPerformancePlanDetail,
//   MonthlyPerformancePlan,
//   MonthlyKRA,
//   MonthlyKPI,
//   MonthlyPlanStatus,
// } from '../../types/performance';
// import toast from 'react-hot-toast';

// // Financial Year Month Order (April to March)
// const MONTH_SEQUENCE = [
//   { num: 4, name: 'Apr', label: 'April', quarter: 'Q1' },
//   { num: 5, name: 'May', label: 'May', quarter: 'Q1' },
//   { num: 6, name: 'Jun', label: 'June', quarter: 'Q1' },
//   { num: 7, name: 'Jul', label: 'July', quarter: 'Q2' },
//   { num: 8, name: 'Aug', label: 'August', quarter: 'Q2' },
//   { num: 9, name: 'Sep', label: 'September', quarter: 'Q2' },
//   { num: 10, name: 'Oct', label: 'October', quarter: 'Q3' },
//   { num: 11, name: 'Nov', label: 'November', quarter: 'Q3' },
//   { num: 12, name: 'Dec', label: 'December', quarter: 'Q3' },
//   { num: 1, name: 'Jan', label: 'January', quarter: 'Q4' },
//   { num: 2, name: 'Feb', label: 'February', quarter: 'Q4' },
//   { num: 3, name: 'Mar', label: 'March', quarter: 'Q4' },
// ];

// const STATUS_BADGES: Record<MonthlyPlanStatus, { label: string; color: string }> = {
//   DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-200' },
//   OPEN: { label: 'Open', color: 'bg-blue-50 text-blue-700 border-blue-200' },
//   REVIEW_DUE: { label: 'Review Due', color: 'bg-amber-50 text-amber-700 border-amber-200' },
//   EMPLOYEE_SUBMITTED: { label: 'Submitted', color: 'bg-purple-50 text-purple-700 border-purple-200' },
//   UNDER_REVIEW: { label: 'Under Review', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
//   RETURNED: { label: 'Returned', color: 'bg-red-50 text-red-700 border-red-200' },
//   APPROVED: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
//   CLOSED: { label: 'Closed ✓', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
// };

// export default function AnnualPerformancePlanPage() {
//   const { planId } = useParams<{ planId?: string }>();
//   const navigate = useNavigate();
//   const { user } = useAuth();

//   const [annualPlan, setAnnualPlan] = useState<AnnualPerformancePlanDetail | null>(null);
//   const [loading, setLoading] = useState(true);

//   // Selections
//   const [activeMonthNum, setActiveMonthNum] = useState<number>(4); // Default to April
//   const [activeTab, setActiveTab] = useState<
//     'PLAN' | 'KRAS' | 'TARGETS' | 'PROGRESS' | 'REVIEW' | 'CARRY' | 'SCORE'
//   >('KRAS');

//   // UI state for KRA modals/forms
//   const [showAddKraModal, setShowAddKraModal] = useState(false);
//   const [newKraName, setNewKraName] = useState('');
//   const [newKraWeight, setNewKraWeight] = useState('20');
//   const [newKraDesc, setNewKraDesc] = useState('');
//   const [submittingKra, setSubmittingKra] = useState(false);

//   // UI state for KPI forms
//   const [addingKpiKraId, setAddingKpiKraId] = useState<string | null>(null);
//   const [newKpiName, setNewKpiName] = useState('');
//   const [newKpiTarget, setNewKpiNameTarget] = useState('');
//   const [newKpiType, setNewKpiType] = useState<'NUMERIC_UP' | 'PERCENTAGE' | 'BOOLEAN'>('NUMERIC_UP');
//   const [newKpiWeight, setNewKpiWeight] = useState('100');
//   const [submittingKpi, setSubmittingKpi] = useState(false);

//   // Fetch plan
//   const loadPlan = async () => {
//     setLoading(true);
//     try {
//       let data: AnnualPerformancePlanDetail;
//       if (planId) {
//         data = await annualPlansApi.getById(planId);
//       } else {
//         data = await annualPlansApi.getMyPlan('2026-27');
//       }
//       setAnnualPlan(data);
//     } catch (err: any) {
//       toast.error(err.response?.data?.detail || 'Failed to load Annual Performance Plan');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadPlan();
//   }, [planId]);

//   // Derive current month plan object
//   const currentMonthlyPlan = useMemo(() => {
//     if (!annualPlan) return null;
//     for (const qr of annualPlan.quarterly_reviews) {
//       const match = qr.monthly_plans.find((m) => m.month === activeMonthNum);
//       if (match) return match;
//     }
//     return null;
//   }, [annualPlan, activeMonthNum]);

//   // Role checks
//   const isHR = user?.role_codes.includes('HR_ADMIN') || user?.role_codes.includes('SYSTEM_ADMIN');
//   const isManager = user?.role_codes.includes('MANAGER') || isHR;
//   const isOwner = user?.employee?.id === annualPlan?.employee;

//   // Handlers
//   const handleAddIndividualKRA = async () => {
//     if (!currentMonthlyPlan || !newKraName.trim()) return;
//     setSubmittingKra(true);
//     try {
//       await monthlyKRAsApi.create({
//         monthly_plan: currentMonthlyPlan.id,
//         kra_type: 'INDIVIDUAL',
//         name: newKraName.trim(),
//         description: newKraDesc.trim(),
//         weight: parseFloat(newKraWeight) || 0,
//         kra_start_date: currentMonthlyPlan.month_start_date,
//         kra_end_date: currentMonthlyPlan.month_end_date,
//       });
//       toast.success('Individual KRA added for this month');
//       setShowAddKraModal(false);
//       setNewKraName('');
//       setNewKraDesc('');
//       loadPlan();
//     } catch (err: any) {
//       toast.error(err.response?.data?.detail || 'Failed to add KRA');
//     } finally {
//       setSubmittingKra(false);
//     }
//   };

//   const handleAddKPI = async () => {
//     if (!addingKpiKraId || !newKpiName.trim() || !newKpiTarget.trim()) return;
//     setSubmittingKpi(true);
//     try {
//       await monthlyKPIsApi.create({
//         monthly_kra: addingKpiKraId,
//         name: newKpiName.trim(),
//         target_value: newKpiTarget.trim(),
//         metric_type: newKpiType,
//         weight_in_kra: parseFloat(newKpiWeight) || 100,
//       });
//       toast.success('KPI added');
//       setAddingKpiKraId(null);
//       setNewKpiName('');
//       setNewKpiNameTarget('');
//       loadPlan();
//     } catch (err: any) {
//       toast.error('Failed to add KPI');
//     } finally {
//       setSubmittingKpi(false);
//     }
//   };

//   const handleSaveActual = async (kpiId: string, actual: string, comment: string) => {
//     try {
//       await monthlyKPIsApi.update(kpiId, {
//         actual_value: actual,
//         employee_comment: comment,
//       });
//       toast.success('Progress saved');
//       loadPlan();
//     } catch {
//       toast.error('Failed to save progress');
//     }
//   };

//   const handleUpdateStatus = async (newStatus: MonthlyPlanStatus) => {
//     if (!currentMonthlyPlan) return;
//     try {
//       await monthlyPlansApi.update(currentMonthlyPlan.id, { status: newStatus });
//       toast.success(`Plan updated to ${newStatus}`);
//       loadPlan();
//     } catch {
//       toast.error('Failed to update status');
//     }
//   };

//   if (loading) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 items-center justify-center">
//           <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
//         </div>
//       </div>
//     );
//   }

//   if (!annualPlan) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 flex-col overflow-hidden">
//           <Topbar />
//           <main className="p-8 text-center">
//             <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
//             <h2 className="mt-4 text-xl font-bold text-gray-900">No Annual Plan Found</h2>
//             <p className="mt-2 text-sm text-gray-500">
//               An annual performance plan has not been generated for this financial year yet.
//             </p>
//             {isManager && (
//               <button
//                 onClick={() => navigate('/performance/annual-plans')}
//                 className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
//               >
//                 Go to Plans Directory & Generate
//               </button>
//             )}
//           </main>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
//           {/* Header Card */}
//           <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//             <div className="flex flex-wrap items-center justify-between gap-4">
//               <div className="flex items-center gap-4">
//                 <button
//                   onClick={() => navigate(-1)}
//                   className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-100"
//                 >
//                   <ArrowLeft className="h-5 w-5" />
//                 </button>
//                 <div>
//                   <div className="flex items-center gap-2">
//                     <h1 className="text-2xl font-bold text-gray-900">
//                       Annual Performance Plan ({annualPlan.financial_year})
//                     </h1>
//                     <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
//                       {annualPlan.status_display}
//                     </span>
//                   </div>
//                   <p className="mt-1 text-sm text-gray-500">
//                     Employee: <strong className="text-gray-900">{annualPlan.employee_name}</strong> ({annualPlan.employee_id_display})
//                   </p>
//                 </div>
//               </div>

//               {/* Annual Score Snapshot */}
//               {annualPlan.annual_score !== null && (
//                 <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white shadow-sm">
//                   <Award className="h-8 w-8" />
//                   <div>
//                     <div className="text-xs font-medium uppercase opacity-90">Annual Score</div>
//                     <div className="text-2xl font-bold">{annualPlan.annual_score}%</div>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* MONTH SELECTOR BAR (Requirement 15) */}
//           <div className="mb-6 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
//             <div className="flex items-center gap-2 min-w-max">
//               <button
//                 onClick={() => setActiveMonthNum(0)} // 0 = Annual View
//                 className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
//                   activeMonthNum === 0
//                     ? 'bg-indigo-600 text-white shadow-md'
//                     : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                 }`}
//               >
//                 <Target className="h-4 w-4" />
//                 Annual View
//               </button>

//               <div className="h-6 w-px bg-gray-200" />

//               {MONTH_SEQUENCE.map((m) => {
//                 const isActive = activeMonthNum === m.num;
//                 // Find monthly plan status
//                 let mPlan: MonthlyPerformancePlan | undefined;
//                 for (const qr of annualPlan.quarterly_reviews) {
//                   const found = qr.monthly_plans.find((mp) => mp.month === m.num);
//                   if (found) {
//                     mPlan = found;
//                     break;
//                   }
//                 }

//                 const badge = mPlan ? STATUS_BADGES[mPlan.status] : null;

//                 return (
//                   <button
//                     key={m.num}
//                     onClick={() => setActiveMonthNum(m.num)}
//                     className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
//                       isActive
//                         ? 'bg-indigo-600 text-white shadow-md'
//                         : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
//                     }`}
//                   >
//                     <span>{m.name}</span>
//                     {badge && (
//                       <span
//                         className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
//                           isActive ? 'bg-white/20 text-white border-white/30' : badge.color
//                         }`}
//                       >
//                         {badge.label}
//                       </span>
//                     )}
//                   </button>
//                 );
//               })}
//             </div>
//           </div>

//           {/* IF ANNUAL VIEW SELECTED */}
//           {activeMonthNum === 0 ? (
//             <AnnualOverviewTab annualPlan={annualPlan} />
//           ) : (
//             /* IF MONTH SELECTED — WORKFLOW TABS (Requirement 15 - 22) */
//             <div className="space-y-6">
//               {/* Tab Navigation */}
//               <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
//                 {[
//                   { id: 'PLAN', label: 'Plan Info', icon: FileText },
//                   { id: 'KRAS', label: 'KRA & KPI', icon: Target },
//                   { id: 'TARGETS', label: 'Targets', icon: Calendar },
//                   { id: 'PROGRESS', label: 'Progress', icon: TrendingUp },
//                   { id: 'REVIEW', label: 'Review', icon: CheckCircle2 },
//                   { id: 'CARRY', label: 'Carry Forward', icon: RefreshCw },
//                   { id: 'SCORE', label: 'Monthly Score', icon: Award },
//                 ].map((tab) => {
//                   const Icon = tab.icon;
//                   const isTabActive = activeTab === tab.id;
//                   return (
//                     <button
//                       key={tab.id}
//                       onClick={() => setActiveTab(tab.id as any)}
//                       className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
//                         isTabActive
//                           ? 'bg-indigo-600 text-white shadow-sm'
//                           : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
//                       }`}
//                     >
//                       <Icon className="h-4 w-4" />
//                       {tab.label}
//                     </button>
//                   );
//                 })}
//               </div>

//               {/* TAB 1: PLAN INFO */}
//               {activeTab === 'PLAN' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Monthly Plan Details</h3>
//                   <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
//                     <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
//                       <span className="text-xs font-semibold text-gray-500 uppercase">Period</span>
//                       <p className="mt-1 text-sm font-bold text-gray-900">
//                         {currentMonthlyPlan.month_start_date} to {currentMonthlyPlan.month_end_date}
//                       </p>
//                     </div>
//                     <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
//                       <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
//                       <p className="mt-1 text-sm font-bold text-indigo-600">
//                         {currentMonthlyPlan.status_display || currentMonthlyPlan.status}
//                       </p>
//                     </div>
//                     <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
//                       <span className="text-xs font-semibold text-gray-500 uppercase">Score</span>
//                       <p className="mt-1 text-sm font-bold text-emerald-600">
//                         {currentMonthlyPlan.monthly_score !== null ? `${currentMonthlyPlan.monthly_score}%` : 'Not computed yet'}
//                       </p>
//                     </div>
//                   </div>

//                   {/* Actions */}
//                   <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-6">
//                     {currentMonthlyPlan.status === 'DRAFT' && (
//                       <button
//                         onClick={() => handleUpdateStatus('OPEN')}
//                         className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
//                       >
//                         Open Plan for Working
//                       </button>
//                     )}
//                     {currentMonthlyPlan.status === 'OPEN' && (
//                       <button
//                         onClick={() => handleUpdateStatus('EMPLOYEE_SUBMITTED')}
//                         className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700"
//                       >
//                         Submit Monthly Review to Manager
//                       </button>
//                     )}
//                     {isManager && currentMonthlyPlan.status === 'EMPLOYEE_SUBMITTED' && (
//                       <button
//                         onClick={() => handleUpdateStatus('APPROVED')}
//                         className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
//                       >
//                         Approve Monthly Plan
//                       </button>
//                     )}
//                   </div>
//                 </div>
//               )}

//               {/* TAB 2: KRA & KPI CONFIGURATION */}
//               {activeTab === 'KRAS' && currentMonthlyPlan && (
//                 <div className="space-y-6">
//                   {/* Top Toolbar */}
//                   <div className="flex items-center justify-between">
//                     <div>
//                       <h3 className="text-lg font-bold text-gray-900">
//                         Monthly KRA & KPI Assignments
//                       </h3>
//                       <p className="text-xs text-gray-500">
//                         Common & Departmental KRAs were auto-injected. Manager can add Individual KRAs below.
//                       </p>
//                     </div>

//                     {isManager && !currentMonthlyPlan.is_locked && (
//                       <button
//                         onClick={() => setShowAddKraModal(true)}
//                         className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
//                       >
//                         <Plus className="h-4 w-4" /> Add Individual KRA
//                       </button>
//                     )}
//                   </div>

//                   {/* KRA Sections: Common, Departmental, Individual */}
//                   {['COMMON', 'DEPARTMENTAL', 'INDIVIDUAL'].map((type) => {
//                     const filteredKras = currentMonthlyPlan.kras.filter((k) => k.kra_type === type);
//                     if (filteredKras.length === 0 && type !== 'INDIVIDUAL') return null;

//                     const typeLabels: Record<string, { label: string; badge: string }> = {
//                       COMMON: { label: '📘 Common KRAs (Company-Wide)', badge: 'bg-blue-100 text-blue-800' },
//                       DEPARTMENTAL: { label: '🏢 Departmental KRAs (Engineering/Sales)', badge: 'bg-purple-100 text-purple-800' },
//                       INDIVIDUAL: { label: '👤 Individual Custom KRAs', badge: 'bg-indigo-100 text-indigo-800' },
//                     };

//                     return (
//                       <div key={type} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                         <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
//                           <h4 className="text-base font-bold text-gray-900">{typeLabels[type].label}</h4>
//                           <span className={`rounded-full px-3 py-1 text-xs font-bold ${typeLabels[type].badge}`}>
//                             {filteredKras.length} Assigned
//                           </span>
//                         </div>

//                         {filteredKras.length === 0 ? (
//                           <p className="text-xs italic text-gray-400">No individual KRAs added for this month yet.</p>
//                         ) : (
//                           <div className="space-y-4">
//                             {filteredKras.map((kra) => (
//                               <div key={kra.id} className="rounded-xl border border-gray-200 p-4 hover:border-indigo-300">
//                                 <div className="flex items-center justify-between">
//                                   <div>
//                                     <h5 className="font-bold text-gray-900">{kra.name}</h5>
//                                     <p className="text-xs text-gray-500">{kra.description}</p>
//                                   </div>
//                                   <div className="flex items-center gap-3">
//                                     <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
//                                       Weight: {kra.weight}%
//                                     </span>
//                                     {isManager && !currentMonthlyPlan.is_locked && (
//                                       <button
//                                         onClick={() => setAddingKpiKraId(kra.id)}
//                                         className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100"
//                                       >
//                                         <Plus className="h-3.5 w-3.5" /> Add KPI
//                                       </button>
//                                     )}
//                                   </div>
//                                 </div>

//                                 {/* KPIs List */}
//                                 <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
//                                   {kra.kpis.map((kpi) => (
//                                     <div key={kpi.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-xs">
//                                       <div>
//                                         <span className="font-semibold text-gray-900">{kpi.name}</span>
//                                         <span className="ml-2 text-gray-500">({kpi.metric_type})</span>
//                                       </div>
//                                       <div className="flex items-center gap-4">
//                                         <span className="font-bold text-indigo-600">Target: {kpi.target_value}</span>
//                                         <span className="text-gray-400">Weight: {kpi.weight_in_kra}%</span>
//                                       </div>
//                                     </div>
//                                   ))}
//                                 </div>
//                               </div>
//                             ))}
//                           </div>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}

//               {/* TAB 3: TARGETS */}
//               {activeTab === 'TARGETS' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Monthly Targets Summary</h3>
//                   <div className="mt-4 overflow-x-auto">
//                     <table className="w-full text-left text-xs">
//                       <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
//                         <tr>
//                           <th className="p-3">KRA</th>
//                           <th className="p-3">KPI Name</th>
//                           <th className="p-3">Metric Type</th>
//                           <th className="p-3">Target</th>
//                         </tr>
//                       </thead>
//                       <tbody className="divide-y divide-gray-100">
//                         {currentMonthlyPlan.kras.flatMap((kra) =>
//                           kra.kpis.map((kpi) => (
//                             <tr key={kpi.id}>
//                               <td className="p-3 font-semibold text-gray-900">{kra.name}</td>
//                               <td className="p-3 text-gray-700">{kpi.name}</td>
//                               <td className="p-3 text-gray-500">{kpi.metric_type}</td>
//                               <td className="p-3 font-bold text-indigo-600">{kpi.target_value}</td>
//                             </tr>
//                           ))
//                         )}
//                       </tbody>
//                     </table>
//                   </div>
//                 </div>
//               )}

//               {/* TAB 4: PROGRESS & ACTUALS */}
//               {activeTab === 'PROGRESS' && currentMonthlyPlan && (
//                 <div className="space-y-4">
//                   <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                     <h3 className="text-lg font-bold text-gray-900">Enter Monthly Achievements</h3>
//                     <p className="text-xs text-gray-500">
//                       Update your actual numbers and notes for this month before submitting for review.
//                     </p>
//                   </div>

//                   {currentMonthlyPlan.kras.map((kra) => (
//                     <div key={kra.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                       <h4 className="font-bold text-gray-900">{kra.name}</h4>
//                       <div className="mt-4 space-y-4">
//                         {kra.kpis.map((kpi) => (
//                           <ProgressInputRow
//                             key={kpi.id}
//                             kpi={kpi}
//                             isLocked={currentMonthlyPlan.is_locked}
//                             onSave={handleSaveActual}
//                           />
//                         ))}
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               )}

//               {/* TAB 5: MONTHLY REVIEW */}
//               {activeTab === 'REVIEW' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Monthly Review & Approval</h3>
//                   <div className="mt-4 space-y-4">
//                     {currentMonthlyPlan.kras.map((kra) => (
//                       <div key={kra.id} className="rounded-xl border border-gray-200 p-4">
//                         <div className="flex items-center justify-between font-bold text-gray-900">
//                           <span>{kra.name}</span>
//                           <span className="text-sm text-emerald-600">Score: {kra.kra_score || 0}%</span>
//                         </div>
//                         <div className="mt-2 space-y-2">
//                           {kra.kpis.map((kpi) => (
//                             <div key={kpi.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg text-xs">
//                               <div>
//                                 <span className="font-semibold text-gray-900">{kpi.name}</span>
//                                 <div className="text-gray-500">Comment: {kpi.employee_comment || 'None'}</div>
//                               </div>
//                               <div className="text-right">
//                                 <div>Target: {kpi.target_value} | Actual: <strong>{kpi.actual_value || '0'}</strong></div>
//                                 <div className="font-bold text-indigo-600">Achievement: {kpi.achievement_percentage || 0}%</div>
//                               </div>
//                             </div>
//                           ))}
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}

//               {/* TAB 6: CARRY FORWARD */}
//               {activeTab === 'CARRY' && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Shortfall & Carry Forward Records</h3>
//                   <p className="mt-1 text-xs text-gray-500">
//                     Incomplete targets from past months can be carried forward to future months without altering original targets.
//                   </p>
//                   <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
//                     No active carry-forward requests pending for this period.
//                   </div>
//                 </div>
//               )}

//               {/* TAB 7: MONTHLY SCORE */}
//               {activeTab === 'SCORE' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 text-center">
//                   <Award className="mx-auto h-12 w-12 text-indigo-600" />
//                   <h3 className="mt-2 text-xl font-bold text-gray-900">
//                     Monthly Performance Rollup
//                   </h3>
//                   <div className="mt-4 text-4xl font-extrabold text-indigo-600">
//                     {currentMonthlyPlan.monthly_score !== null ? `${currentMonthlyPlan.monthly_score}%` : '—'}
//                   </div>
//                   <p className="mt-2 text-xs text-gray-500">
//                     Calculated as the weighted sum of all assigned KRAs and KPIs for this month.
//                   </p>
//                 </div>
//               )}
//             </div>
//           )}

//           {/* ADD KRA MODAL */}
//           {showAddKraModal && (
//             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//               <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
//                 <h3 className="text-lg font-bold text-gray-900">Add Individual KRA</h3>
//                 <div className="mt-4 space-y-3">
//                   <input
//                     type="text"
//                     placeholder="KRA Name (e.g. AI Chatbot Development)"
//                     value={newKraName}
//                     onChange={(e) => setNewKraName(e.target.value)}
//                     className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                   />
//                   <textarea
//                     placeholder="KRA Description"
//                     value={newKraDesc}
//                     onChange={(e) => setNewKraDesc(e.target.value)}
//                     className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                   />
//                   <input
//                     type="number"
//                     placeholder="Weight % (e.g. 20)"
//                     value={newKraWeight}
//                     onChange={(e) => setNewKraWeight(e.target.value)}
//                     className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                   />
//                 </div>
//                 <div className="mt-6 flex justify-end gap-2">
//                   <button
//                     onClick={() => setShowAddKraModal(false)}
//                     className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-600"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     onClick={handleAddIndividualKRA}
//                     disabled={submittingKra}
//                     className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"
//                   >
//                     {submittingKra ? 'Adding...' : 'Add KRA'}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* ADD KPI MODAL */}
//           {addingKpiKraId && (
//             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//               <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
//                 <h3 className="text-lg font-bold text-gray-900">Add Measurable KPI Target</h3>
//                 <div className="mt-4 space-y-3">
//                   <input
//                     type="text"
//                     placeholder="KPI Name (e.g. Complete 40 story points)"
//                     value={newKpiName}
//                     onChange={(e) => setNewKpiName(e.target.value)}
//                     className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                   />
//                   <input
//                     type="text"
//                     placeholder="Target Value (e.g. 40 or 90%)"
//                     value={newKpiTarget}
//                     onChange={(e) => setNewKpiNameTarget(e.target.value)}
//                     className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                   />
//                   <select
//                     value={newKpiType}
//                     onChange={(e) => setNewKpiType(e.target.value as any)}
//                     className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                   >
//                     <option value="NUMERIC_UP">Numeric (Higher is better)</option>
//                     <option value="PERCENTAGE">Percentage</option>
//                     <option value="BOOLEAN">Yes / No</option>
//                   </select>
//                 </div>
//                 <div className="mt-6 flex justify-end gap-2">
//                   <button
//                     onClick={() => setAddingKpiKraId(null)}
//                     className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-600"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     onClick={handleAddKPI}
//                     disabled={submittingKpi}
//                     className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"
//                   >
//                     {submittingKpi ? 'Saving...' : 'Add KPI'}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

// // Sub-component for Progress Input Row
// function ProgressInputRow({
//   kpi,
//   isLocked,
//   onSave,
// }: {
//   kpi: MonthlyKPI;
//   isLocked: boolean;
//   onSave: (id: string, actual: string, comment: string) => void;
// }) {
//   const [actual, setActual] = useState(kpi.actual_value || '');
//   const [comment, setComment] = useState(kpi.employee_comment || '');

//   return (
//     <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
//       <div className="flex items-center justify-between">
//         <div>
//           <h5 className="font-bold text-gray-900">{kpi.name}</h5>
//           <span className="text-xs text-indigo-600 font-semibold">Target: {kpi.target_value}</span>
//         </div>
//         {kpi.achievement_percentage !== null && (
//           <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
//             {kpi.achievement_percentage}% Achieved
//           </span>
//         )}
//       </div>

//       <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
//         <input
//           type="text"
//           placeholder="Actual Value achieved"
//           value={actual}
//           onChange={(e) => setActual(e.target.value)}
//           disabled={isLocked}
//           className="rounded-xl border border-gray-300 p-2.5 text-xs"
//         />
//         <input
//           type="text"
//           placeholder="Your comments / notes"
//           value={comment}
//           onChange={(e) => setComment(e.target.value)}
//           disabled={isLocked}
//           className="rounded-xl border border-gray-300 p-2.5 text-xs"
//         />
//       </div>

//       {!isLocked && (
//         <div className="mt-3 flex justify-end">
//           <button
//             onClick={() => onSave(kpi.id, actual, comment)}
//             className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
//           >
//             Save Progress
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// // Sub-component for Annual Overview Tab
// function AnnualOverviewTab({ annualPlan }: { annualPlan: AnnualPerformancePlanDetail }) {
//   return (
//     <div className="space-y-6">
//       <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//         <h3 className="text-lg font-bold text-gray-900">Quarterly Breakdown ({annualPlan.financial_year})</h3>
//         <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
//           {annualPlan.quarterly_reviews.map((qr) => (
//             <div key={qr.id} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
//               <div className="flex items-center justify-between">
//                 <span className="font-bold text-gray-900">{qr.quarter}</span>
//                 <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
//                   {qr.status}
//                 </span>
//               </div>
//               <div className="mt-3 text-2xl font-extrabold text-indigo-600">
//                 {qr.quarterly_score !== null ? `${qr.quarterly_score}%` : '—'}
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }

// =====================================================================================================================
// import { useEffect, useState, useMemo } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import {
//   Calendar, CheckCircle2, Clock, AlertCircle, FileText,
//   Target, Award, ArrowLeft, Plus, ChevronDown, ChevronRight,
//   TrendingUp, Users2, Star, User, Info, Loader2, X, Search,
// } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { useAuth } from '../../context/AuthContext';
// import {
//   annualPlansApi,
//   monthlyPlansApi,
//   monthlyKRAsApi,
//   monthlyKPIsApi,
//   peerNominationsApi,
// } from '../../api/performance';
// import { employeesApi, type ManagerOption } from '../../api/employees';
// import type {
//   AnnualPerformancePlanDetail,
//   MonthlyPerformancePlan,
//   MonthlyKRA,
//   MonthlyKPI,
//   MonthlyPlanStatus,
// } from '../../types/performance';
// import toast from 'react-hot-toast';

// const MONTH_SEQUENCE = [
//   { num: 4, name: 'Apr', label: 'April', quarter: 'Q1' },
//   { num: 5, name: 'May', label: 'May', quarter: 'Q1' },
//   { num: 6, name: 'Jun', label: 'June', quarter: 'Q1' },
//   { num: 7, name: 'Jul', label: 'July', quarter: 'Q2' },
//   { num: 8, name: 'Aug', label: 'August', quarter: 'Q2' },
//   { num: 9, name: 'Sep', label: 'September', quarter: 'Q2' },
//   { num: 10, name: 'Oct', label: 'October', quarter: 'Q3' },
//   { num: 11, name: 'Nov', label: 'November', quarter: 'Q3' },
//   { num: 12, name: 'Dec', label: 'December', quarter: 'Q3' },
//   { num: 1, name: 'Jan', label: 'January', quarter: 'Q4' },
//   { num: 2, name: 'Feb', label: 'February', quarter: 'Q4' },
//   { num: 3, name: 'Mar', label: 'March', quarter: 'Q4' },
// ];

// const STATUS_BADGES: Record<MonthlyPlanStatus, { label: string; color: string }> = {
//   DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-200' },
//   OPEN: { label: 'Open', color: 'bg-blue-50 text-blue-700 border-blue-200' },
//   REVIEW_DUE: { label: 'Review Due', color: 'bg-amber-50 text-amber-700 border-amber-200' },
//   EMPLOYEE_SUBMITTED: { label: 'Submitted', color: 'bg-purple-50 text-purple-700 border-purple-200' },
//   UNDER_REVIEW: { label: 'Under Review', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
//   RETURNED: { label: 'Returned', color: 'bg-red-50 text-red-700 border-red-200' },
//   APPROVED: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
//   CLOSED: { label: 'Closed ✓', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
// };

// export default function AnnualPerformancePlanPage() {
//   const { planId } = useParams<{ planId?: string }>();
//   const navigate = useNavigate();
//   const { user } = useAuth();

//   const [annualPlan, setAnnualPlan] = useState<AnnualPerformancePlanDetail | null>(null);
//   const [loading, setLoading] = useState(true);

//   // Selections
//   const [activeMonthNum, setActiveMonthNum] = useState<number>(4);
//   const [activeTab, setActiveTab] = useState<'PLAN' | 'KRAS' | 'TARGETS' | 'PROGRESS' | 'REVIEW' | 'SCORE'>('KRAS');

//   // Add KRA State
//   const [showAddKraModal, setShowAddKraModal] = useState(false);
//   const [newKraName, setNewKraName] = useState('');
//   const [newKraWeight, setNewKraWeight] = useState('20');
//   const [newKraDesc, setNewKraDesc] = useState('');
//   const [newKraPeerRequired, setNewKraPeerRequired] = useState(false);
//   const [submittingKra, setSubmittingKra] = useState(false);

//   // Peer Selection Modal
//   const [peerNominateKra, setPeerNominateKra] = useState<MonthlyKRA | null>(null);

//   // Add KPI State
//   const [addingKpiKraId, setAddingKpiKraId] = useState<string | null>(null);
//   const [newKpiName, setNewKpiName] = useState('');
//   const [newKpiTarget, setNewKpiTarget] = useState('');
//   const [newKpiType, setNewKpiType] = useState<'NUMERIC_UP' | 'PERCENTAGE' | 'BOOLEAN'>('NUMERIC_UP');
//   const [newKpiWeight, setNewKpiWeight] = useState('100');
//   const [submittingKpi, setSubmittingKpi] = useState(false);

//   const loadPlan = async () => {
//     setLoading(true);
//     try {
//       let data: AnnualPerformancePlanDetail;
//       if (planId) {
//         data = await annualPlansApi.getById(planId);
//       } else {
//         data = await annualPlansApi.getMyPlan('2026-27');
//       }
//       setAnnualPlan(data);
//     } catch (err: any) {
//       toast.error(err.response?.data?.detail || 'Failed to load Annual Performance Plan');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadPlan();
//   }, [planId]);

//   const currentMonthlyPlan = useMemo(() => {
//     if (!annualPlan) return null;
//     for (const qr of annualPlan.quarterly_reviews) {
//       const match = qr.monthly_plans.find((m) => m.month === activeMonthNum);
//       if (match) return match;
//     }
//     return null;
//   }, [annualPlan, activeMonthNum]);

//   const isHR = user?.role_codes.includes('HR_ADMIN') || user?.role_codes.includes('SYSTEM_ADMIN');
//   const isManager = user?.role_codes.includes('MANAGER') || isHR;

//   const handleAddIndividualKRA = async () => {
//     if (!currentMonthlyPlan || !newKraName.trim()) return;
//     setSubmittingKra(true);
//     try {
//       await monthlyKRAsApi.create({
//         monthly_plan: currentMonthlyPlan.id,
//         kra_type: 'INDIVIDUAL',
//         name: newKraName.trim(),
//         description: newKraDesc.trim(),
//         weight: parseFloat(newKraWeight) || 0,
//         peer_rating_required: newKraPeerRequired,
//         kra_start_date: currentMonthlyPlan.month_start_date,
//         kra_end_date: currentMonthlyPlan.month_end_date,
//       });
//       toast.success('Individual KRA added');
//       setShowAddKraModal(false);
//       setNewKraName('');
//       setNewKraDesc('');
//       setNewKraPeerRequired(false);
//       loadPlan();
//     } catch (err: any) {
//       toast.error(err.response?.data?.detail || 'Failed to add KRA');
//     } finally {
//       setSubmittingKra(false);
//     }
//   };

//   const handleAddKPI = async () => {
//     if (!addingKpiKraId || !newKpiName.trim() || !newKpiTarget.trim()) return;
//     setSubmittingKpi(true);
//     try {
//       await monthlyKPIsApi.create({
//         monthly_kra: addingKpiKraId,
//         name: newKpiName.trim(),
//         target_value: newKpiTarget.trim(),
//         metric_type: newKpiType,
//         weight_in_kra: parseFloat(newKpiWeight) || 100,
//       });
//       toast.success('KPI added');
//       setAddingKpiKraId(null);
//       setNewKpiName('');
//       setNewKpiTarget('');
//       loadPlan();
//     } catch {
//       toast.error('Failed to add KPI');
//     } finally {
//       setSubmittingKpi(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 items-center justify-center">
//           <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
//         </div>
//       </div>
//     );
//   }

//   if (!annualPlan) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 flex-col overflow-hidden">
//           <Topbar />
//           <main className="p-8 text-center">
//             <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
//             <h2 className="mt-4 text-xl font-bold text-gray-900">No Annual Plan Found</h2>
//           </main>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
//           {/* Header */}
//           <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//             <div className="flex flex-wrap items-center justify-between gap-4">
//               <div className="flex items-center gap-4">
//                 <button onClick={() => navigate(-1)} className="rounded-xl border p-2 hover:bg-gray-100">
//                   <ArrowLeft className="h-5 w-5 text-gray-500" />
//                 </button>
//                 <div>
//                   <h1 className="text-2xl font-bold text-gray-900">
//                     Annual Performance Plan ({annualPlan.financial_year})
//                   </h1>
//                   <p className="mt-1 text-sm text-gray-500">
//                     Employee: <strong className="text-gray-900">{annualPlan.employee_name}</strong> ({annualPlan.employee_id_display})
//                   </p>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Month Selector */}
//           <div className="mb-6 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
//             <div className="flex items-center gap-2 min-w-max">
//               {MONTH_SEQUENCE.map((m) => {
//                 const isActive = activeMonthNum === m.num;
//                 let mPlan: MonthlyPerformancePlan | undefined;
//                 for (const qr of annualPlan.quarterly_reviews) {
//                   const found = qr.monthly_plans.find((mp) => mp.month === m.num);
//                   if (found) { mPlan = found; break; }
//                 }
//                 const badge = mPlan ? STATUS_BADGES[mPlan.status] : null;

//                 return (
//                   <button
//                     key={m.num}
//                     onClick={() => setActiveMonthNum(m.num)}
//                     className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
//                       isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-gray-700 hover:bg-gray-50'
//                     }`}
//                   >
//                     <span>{m.name}</span>
//                     {badge && (
//                       <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${isActive ? 'bg-white/20 text-white' : badge.color}`}>
//                         {badge.label}
//                       </span>
//                     )}
//                   </button>
//                 );
//               })}
//             </div>
//           </div>

//           {/* Monthly Workflow */}
//           {currentMonthlyPlan && (
//             <div className="space-y-6">
//               {/* Tab Navigation */}
//               <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
//                 {[
//                   { id: 'KRAS', label: 'KRA & KPI', icon: Target },
//                   { id: 'TARGETS', label: 'Targets', icon: Calendar },
//                   { id: 'PROGRESS', label: 'Progress', icon: TrendingUp },
//                   { id: 'REVIEW', label: 'Review', icon: CheckCircle2 },
//                   { id: 'SCORE', label: 'Monthly Score', icon: Award },
//                 ].map((tab) => {
//                   const Icon = tab.icon;
//                   const isTabActive = activeTab === tab.id;
//                   return (
//                     <button
//                       key={tab.id}
//                       onClick={() => setActiveTab(tab.id as any)}
//                       className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
//                         isTabActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border text-gray-600 hover:bg-gray-50'
//                       }`}
//                     >
//                       <Icon className="h-4 w-4" />
//                       {tab.label}
//                     </button>
//                   );
//                 })}
//               </div>

//               {/* TAB: KRA & KPI */}
//               {activeTab === 'KRAS' && (
//                 <div className="space-y-6">
//                   <div className="flex items-center justify-between">
//                     <h3 className="text-lg font-bold text-gray-900">Monthly KRAs & KPIs</h3>
//                     {isManager && !currentMonthlyPlan.is_locked && (
//                       <button
//                         onClick={() => setShowAddKraModal(true)}
//                         className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
//                       >
//                         <Plus className="h-4 w-4" /> Add Individual KRA
//                       </button>
//                     )}
//                   </div>

//                   <div className="space-y-4">
//                     {currentMonthlyPlan.kras.map((kra) => (
//                       <div key={kra.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                         <div className="flex items-center justify-between border-b pb-3">
//                           <div>
//                             <div className="flex items-center gap-2">
//                               <h4 className="font-bold text-gray-900">{kra.name}</h4>
//                               <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
//                                 {kra.kra_type}
//                               </span>
//                               {kra.peer_rating_required && (
//                                 <span className="flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-bold text-pink-700">
//                                   <Star className="h-3 w-3 fill-current" /> Peer Rating Required
//                                 </span>
//                               )}
//                             </div>
//                             <p className="text-xs text-gray-500 mt-1">{kra.description}</p>
//                           </div>

//                           <div className="flex items-center gap-3">
//                             <span className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
//                               Weight: {kra.weight}%
//                             </span>

//                             {/* Nominate Peers Button */}
//                             {kra.peer_rating_required && isManager && (
//                               <button
//                                 onClick={() => setPeerNominateKra(kra)}
//                                 className="flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-pink-700"
//                               >
//                                 <Users2 className="h-3.5 w-3.5" /> Select Peers
//                               </button>
//                             )}

//                             {isManager && !currentMonthlyPlan.is_locked && (
//                               <button
//                                 onClick={() => setAddingKpiKraId(kra.id)}
//                                 className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100"
//                               >
//                                 <Plus className="h-3.5 w-3.5" /> Add KPI
//                               </button>
//                             )}
//                           </div>
//                         </div>

//                         {/* KPIs */}
//                         <div className="mt-4 space-y-2">
//                           {kra.kpis.map((kpi) => (
//                             <div key={kpi.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-xs">
//                               <span className="font-semibold text-gray-900">{kpi.name}</span>
//                               <span className="font-bold text-indigo-600">Target: {kpi.target_value}</span>
//                             </div>
//                           ))}
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Add Individual KRA Modal */}
//           {showAddKraModal && (
//             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//               <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
//                 <h3 className="text-lg font-bold text-gray-900">Add Individual KRA</h3>
//                 <input
//                   type="text"
//                   placeholder="KRA Name"
//                   value={newKraName}
//                   onChange={(e) => setNewKraName(e.target.value)}
//                   className="w-full rounded-xl border p-3 text-sm"
//                 />
//                 <textarea
//                   placeholder="Description"
//                   value={newKraDesc}
//                   onChange={(e) => setNewKraDesc(e.target.value)}
//                   className="w-full rounded-xl border p-3 text-sm"
//                 />
//                 <input
//                   type="number"
//                   placeholder="Weight %"
//                   value={newKraWeight}
//                   onChange={(e) => setNewKraWeight(e.target.value)}
//                   className="w-full rounded-xl border p-3 text-sm"
//                 />
//                 <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
//                   <input
//                     type="checkbox"
//                     checked={newKraPeerRequired}
//                     onChange={(e) => setNewKraPeerRequired(e.target.checked)}
//                     className="h-4 w-4 rounded text-pink-600"
//                   />
//                   Require Peer Rating for this KRA
//                 </label>
//                 <div className="flex justify-end gap-2 pt-2">
//                   <button onClick={() => setShowAddKraModal(false)} className="px-4 py-2 border rounded-xl text-sm">Cancel</button>
//                   <button onClick={handleAddIndividualKRA} disabled={submittingKra} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">
//                     {submittingKra ? 'Saving...' : 'Add KRA'}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Peer Nomination Modal */}
//           {peerNominateKra && (
//             <NominatePeersModal
//               kra={peerNominateKra}
//               excludeEmployeeId={annualPlan.employee}
//               onClose={() => setPeerNominateKra(null)}
//               onSuccess={() => {
//                 setPeerNominateKra(null);
//                 loadPlan();
//               }}
//             />
//           )}

//           {/* Add KPI Modal */}
//           {addingKpiKraId && (
//             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//               <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
//                 <h3 className="text-lg font-bold text-gray-900">Add KPI Target</h3>
//                 <input
//                   type="text"
//                   placeholder="KPI Name"
//                   value={newKpiName}
//                   onChange={(e) => setNewKpiName(e.target.value)}
//                   className="w-full rounded-xl border p-3 text-sm"
//                 />
//                 <input
//                   type="text"
//                   placeholder="Target Value (e.g. 40 or 90%)"
//                   value={newKpiTarget}
//                   onChange={(e) => setNewKpiTarget(e.target.value)}
//                   className="w-full rounded-xl border p-3 text-sm"
//                 />
//                 <div className="flex justify-end gap-2 pt-2">
//                   <button onClick={() => setAddingKpiKraId(null)} className="px-4 py-2 border rounded-xl text-sm">Cancel</button>
//                   <button onClick={handleAddKPI} disabled={submittingKpi} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">
//                     {submittingKpi ? 'Saving...' : 'Add KPI'}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

// // Sub-component: Nominate Peers Modal
// function NominatePeersModal({
//   kra,
//   excludeEmployeeId,
//   onClose,
//   onSuccess,
// }: {
//   kra: MonthlyKRA;
//   excludeEmployeeId: string;
//   onClose: () => void;
//   onSuccess: () => void;
// }) {
//   const [employees, setEmployees] = useState<ManagerOption[]>([]);
//   const [selectedIds, setSelectedIds] = useState<string[]>([]);
//   const [search, setSearch] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);

//   useEffect(() => {
//     employeesApi.getManagers(search).then((data) => {
//       setEmployees(data.filter((e) => e.id !== excludeEmployeeId));
//       setLoading(false);
//     });
//   }, [search, excludeEmployeeId]);

//   const toggleSelect = (id: string) => {
//     setSelectedIds((prev) =>
//       prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
//     );
//   };

//   const handleNominate = async () => {
//     if (selectedIds.length === 0) return toast.error('Please select at least one peer');
//     setSubmitting(true);
//     try {
//       await peerNominationsApi.nominate({
//         monthly_kra_id: kra.id,
//         peer_ids: selectedIds,
//       });
//       toast.success('Peers nominated successfully');
//       onSuccess();
//     } catch {
//       toast.error('Failed to nominate peers');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//       <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
//         <div className="flex items-center justify-between border-b pb-3">
//           <h3 className="font-bold text-gray-900">Nominate Peers for "{kra.name}"</h3>
//           <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
//         </div>

//         <input
//           type="text"
//           placeholder="Search peers..."
//           value={search}
//           onChange={(e) => setSearch(e.target.value)}
//           className="w-full rounded-xl border p-2.5 text-xs"
//         />

//         <div className="max-h-60 overflow-y-auto space-y-2">
//           {loading ? (
//             <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
//           ) : (
//             employees.map((emp) => (
//               <label
//                 key={emp.id}
//                 className="flex items-center justify-between p-2.5 rounded-xl border hover:bg-gray-50 cursor-pointer text-xs"
//               >
//                 <div>
//                   <p className="font-bold text-gray-900">{emp.full_name}</p>
//                   <p className="text-gray-500">{emp.official_email}</p>
//                 </div>
//                 <input
//                   type="checkbox"
//                   checked={selectedIds.includes(emp.id)}
//                   onChange={() => toggleSelect(emp.id)}
//                   className="h-4 w-4 rounded text-pink-600"
//                 />
//               </label>
//             ))
//           )}
//         </div>

//         <div className="flex justify-end gap-2 border-t pt-3">
//           <button onClick={onClose} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
//           <button
//             onClick={handleNominate}
//             disabled={submitting || selectedIds.length === 0}
//             className="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold"
//           >
//             {submitting ? 'Saving...' : `Nominate ${selectedIds.length} Peer(s)`}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// ===================================================================================================================================
// import { useEffect, useState, useMemo } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import {
//   Calendar, CheckCircle2, Clock, AlertCircle, FileText,
//   Target, Award, ArrowLeft, Plus, ChevronDown, ChevronRight,
//   Send, Trash2, Edit2, Upload, Lock, ShieldCheck, Sparkles,
//   TrendingUp, User, Building2, Info, Loader2, FileSpreadsheet,
//   AlertTriangle, RefreshCw, Star, Users2, X, Search, Check,
// } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { useAuth } from '../../context/AuthContext';
// import {
//   annualPlansApi,
//   monthlyPlansApi,
//   monthlyKRAsApi,
//   monthlyKPIsApi,
//   peerNominationsApi,
// } from '../../api/performance';
// import { employeesApi, type ManagerOption } from '../../api/employees';
// import type {
//   AnnualPerformancePlanDetail,
//   MonthlyPerformancePlan,
//   MonthlyKRA,
//   MonthlyKPI,
//   MonthlyPlanStatus,
// } from '../../types/performance';
// import toast from 'react-hot-toast';

// // Financial Year Month Order (April to March)
// const MONTH_SEQUENCE = [
//   { num: 4, name: 'Apr', label: 'April', quarter: 'Q1' },
//   { num: 5, name: 'May', label: 'May', quarter: 'Q1' },
//   { num: 6, name: 'Jun', label: 'June', quarter: 'Q1' },
//   { num: 7, name: 'Jul', label: 'July', quarter: 'Q2' },
//   { num: 8, name: 'Aug', label: 'August', quarter: 'Q2' },
//   { num: 9, name: 'Sep', label: 'September', quarter: 'Q2' },
//   { num: 10, name: 'Oct', label: 'October', quarter: 'Q3' },
//   { num: 11, name: 'Nov', label: 'November', quarter: 'Q3' },
//   { num: 12, name: 'Dec', label: 'December', quarter: 'Q3' },
//   { num: 1, name: 'Jan', label: 'January', quarter: 'Q4' },
//   { num: 2, name: 'Feb', label: 'February', quarter: 'Q4' },
//   { num: 3, name: 'Mar', label: 'March', quarter: 'Q4' },
// ];

// const STATUS_BADGES: Record<MonthlyPlanStatus, { label: string; color: string }> = {
//   DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-200' },
//   OPEN: { label: 'Open', color: 'bg-blue-50 text-blue-700 border-blue-200' },
//   REVIEW_DUE: { label: 'Review Due', color: 'bg-amber-50 text-amber-700 border-amber-200' },
//   EMPLOYEE_SUBMITTED: { label: 'Submitted', color: 'bg-purple-50 text-purple-700 border-purple-200' },
//   UNDER_REVIEW: { label: 'Under Review', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
//   RETURNED: { label: 'Returned', color: 'bg-red-50 text-red-700 border-red-200' },
//   APPROVED: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
//   CLOSED: { label: 'Closed ✓', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
// };

// export default function AnnualPerformancePlanPage() {
//   const { planId } = useParams<{ planId?: string }>();
//   const navigate = useNavigate();
//   const { user } = useAuth();

//   const [annualPlan, setAnnualPlan] = useState<AnnualPerformancePlanDetail | null>(null);
//   const [loading, setLoading] = useState(true);

//   // Selections
//   const [activeMonthNum, setActiveMonthNum] = useState<number>(4);
//   const [activeTab, setActiveTab] = useState<'PLAN' | 'KRAS' | 'TARGETS' | 'PROGRESS' | 'REVIEW' | 'CARRY' | 'SCORE'>('KRAS');

//   // Add KRA State
//   const [showAddKraModal, setShowAddKraModal] = useState(false);
//   const [newKraName, setNewKraName] = useState('');
//   const [newKraWeight, setNewKraWeight] = useState('20');
//   const [newKraDesc, setNewKraDesc] = useState('');
//   const [newKraPeerRequired, setNewKraPeerRequired] = useState(false);
//   const [submittingKra, setSubmittingKra] = useState(false);

//   // Peer Selection Modal
//   const [peerNominateKra, setPeerNominateKra] = useState<MonthlyKRA | null>(null);

//   // Add KPI State
//   const [addingKpiKraId, setAddingKpiKraId] = useState<string | null>(null);
//   const [newKpiName, setNewKpiName] = useState('');
//   const [newKpiTarget, setNewKpiTarget] = useState('');
//   const [newKpiType, setNewKpiType] = useState<'NUMERIC_UP' | 'PERCENTAGE' | 'BOOLEAN'>('NUMERIC_UP');
//   const [newKpiWeight, setNewKpiWeight] = useState('100');
//   const [submittingKpi, setSubmittingKpi] = useState(false);
//     // Edit KRA State
//   const [editingKra, setEditingKra] = useState<MonthlyKRA | null>(null);

//   // Edit KPI State
//   const [editingKpi, setEditingKpi] = useState<MonthlyKPI | null>(null);

//   const loadPlan = async () => {
//     setLoading(true);
//     try {
//       let data: AnnualPerformancePlanDetail;
//       if (planId) {
//         data = await annualPlansApi.getById(planId);
//       } else {
//         data = await annualPlansApi.getMyPlan('2026-27');
//       }
//       setAnnualPlan(data);
//     } catch (err: any) {
//       if (err.response?.status === 404) {
//         setAnnualPlan(null);
//       } else {
//         toast.error(err.response?.data?.detail || 'Failed to load Annual Performance Plan');
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadPlan();
//   }, [planId]);

//   const currentMonthlyPlan = useMemo(() => {
//     if (!annualPlan) return null;
//     for (const qr of annualPlan.quarterly_reviews) {
//       const match = qr.monthly_plans.find((m) => m.month === activeMonthNum);
//       if (match) return match;
//     }
//     return null;
//   }, [annualPlan, activeMonthNum]);

//   const isHR = user?.role_codes.includes('HR_ADMIN') || user?.role_codes.includes('SYSTEM_ADMIN');
//   const isManager = user?.role_codes.includes('MANAGER') || isHR;


//     // Comprehensive Weight Validation (KRA Total = 100% AND each KRA's KPI Total = 100%)
//   const weightValidation = useMemo(() => {
//     if (!currentMonthlyPlan) return { isValid: false, errors: [] };

//     const errors: string[] = [];

//     // 1. Check sum of all KRA weights in the month
//     const totalKraWeight = currentMonthlyPlan.kras.reduce(
//       (sum, kra) => sum + Number(kra.weight), 0
//     );
//     if (Math.abs(totalKraWeight - 100) > 0.01) {
//       errors.push(`Total KRA weight must be exactly 100% (currently ${totalKraWeight}%).`);
//     }

//     // 2. Check sum of KPI weights within EACH KRA
//     currentMonthlyPlan.kras.forEach((kra) => {
//       if (kra.kpis.length === 0) {
//         errors.push(`KRA "${kra.name}" has no KPIs defined.`);
//       } else {
//         const totalKpiWeight = kra.kpis.reduce(
//           (sum, kpi) => sum + Number(kpi.weight_in_kra), 0
//         );
//         if (Math.abs(totalKpiWeight - 100) > 0.01) {
//           errors.push(`KPI weights in "${kra.name}" must total 100% (currently ${totalKpiWeight}%).`);
//         }
//       }
//     });

//     return {
//       isValid: errors.length === 0,
//       errors,
//       totalKraWeight,
//     };
//   }, [currentMonthlyPlan]);

//   const handleAddIndividualKRA = async () => {
//     if (!currentMonthlyPlan || !newKraName.trim()) return;
//     setSubmittingKra(true);
//     try {
//       await monthlyKRAsApi.create({
//         monthly_plan: currentMonthlyPlan.id,
//         kra_type: 'INDIVIDUAL',
//         name: newKraName.trim(),
//         description: newKraDesc.trim(),
//         weight: parseFloat(newKraWeight) || 0,
//         peer_rating_required: newKraPeerRequired,
//         kra_start_date: currentMonthlyPlan.month_start_date,
//         kra_end_date: currentMonthlyPlan.month_end_date,
//       });
//       toast.success('Individual KRA added');
//       setShowAddKraModal(false);
//       setNewKraName('');
//       setNewKraDesc('');
//       setNewKraPeerRequired(false);
//       loadPlan();
//     } catch (err: any) {
//       toast.error(err.response?.data?.detail || 'Failed to add KRA');
//     } finally {
//       setSubmittingKra(false);
//     }
//   };

//   const handleAddKPI = async () => {
//     if (!addingKpiKraId || !newKpiName.trim() || !newKpiTarget.trim()) return;
//     setSubmittingKpi(true);
//     try {
//       await monthlyKPIsApi.create({
//         monthly_kra: addingKpiKraId,
//         name: newKpiName.trim(),
//         target_value: newKpiTarget.trim(),
//         metric_type: newKpiType,
//         weight_in_kra: parseFloat(newKpiWeight) || 100,
//       });
//       toast.success('KPI target added');
//       setAddingKpiKraId(null);
//       setNewKpiName('');
//       setNewKpiTarget('');
//       loadPlan();
//     } catch {
//       toast.error('Failed to add KPI');
//     } finally {
//       setSubmittingKpi(false);
//     }
//   };
//     // Handle KRA Updates
//   const handleUpdateKRA = async () => {
//     if (!editingKra || !newKraName.trim()) return;
//     setSubmittingKra(true);
//     try {
//       await monthlyKRAsApi.update(editingKra.id, {
//         name: newKraName.trim(),
//         description: newKraDesc.trim(),
//         weight: parseFloat(newKraWeight) || 0,
//         peer_rating_required: newKraPeerRequired,
//       });
//       toast.success('KRA updated successfully');
//       setEditingKra(null);
//       setShowAddKraModal(false);
//       loadPlan();
//     } catch (err: any) {
//       toast.error('Failed to update KRA');
//     } finally {
//       setSubmittingKra(false);
//     }
//   };

//   const handleDeleteKRA = async (kraId: string, kraName: string) => {
//     if (!confirm(`Are you sure you want to delete "${kraName}"? This will also delete its KPIs.`)) return;
//     try {
//       await monthlyKRAsApi.delete(kraId);
//       toast.success('KRA deleted');
//       loadPlan();
//     } catch {
//       toast.error('Failed to delete KRA');
//     }
//   };

//   // Handle KPI Updates
//   const handleUpdateKPI = async () => {
//     if (!editingKpi || !newKpiName.trim() || !newKpiTarget.trim()) return;
//     setSubmittingKpi(true);
//     try {
//       await monthlyKPIsApi.update(editingKpi.id, {
//         name: newKpiName.trim(),
//         target_value: newKpiTarget.trim(),
//         metric_type: newKpiType,
//         weight_in_kra: parseFloat(newKpiWeight) || 100,
//       });
//       toast.success('KPI updated successfully');
//       setEditingKpi(null);
//       setAddingKpiKraId(null);
//       loadPlan();
//     } catch {
//       toast.error('Failed to update KPI');
//     } finally {
//       setSubmittingKpi(false);
//     }
//   };

//   const handleDeleteKPI = async (kpiId: string, kpiName: string) => {
//     if (!confirm(`Are you sure you want to delete KPI "${kpiName}"?`)) return;
//     try {
//       await monthlyKPIsApi.delete(kpiId);
//       toast.success('KPI deleted');
//       loadPlan();
//     } catch {
//       toast.error('Failed to delete KPI');
//     }
//   };
//   const handleSaveActual = async (kpiId: string, actual: string, comment: string) => {
//     try {
//       await monthlyKPIsApi.update(kpiId, {
//         actual_value: actual,
//         employee_comment: comment,
//       });
//       toast.success('Progress saved');
//       loadPlan();
//     } catch {
//       toast.error('Failed to save progress');
//     }
//   };
//     const handleSaveManagerReview = async (kpiId: string, rating: number, comment: string) => {
//     try {
//       await monthlyKPIsApi.update(kpiId, {
//         manager_rating: rating,
//         manager_comment: comment,
//       });
//       toast.success('Manager review saved');
//       loadPlan();
//     } catch {
//       toast.error('Failed to save review');
//     }
//   };



//   const handleUpdateStatus = async (newStatus: MonthlyPlanStatus) => {
//     if (!currentMonthlyPlan) return;
//     try {
//       await monthlyPlansApi.update(currentMonthlyPlan.id, { status: newStatus });
//       toast.success(`Monthly plan status updated to ${newStatus}`);
//       loadPlan();
//     } catch {
//       toast.error('Failed to update status');
//     }
//   };

//   if (loading) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 items-center justify-center">
//           <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
//         </div>
//       </div>
//     );
//   }

//   if (!annualPlan) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 flex-col overflow-hidden">
//           <Topbar />
//           <main className="p-8 text-center">
//             <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
//             <h2 className="mt-4 text-xl font-bold text-gray-900">No Annual Plan Found</h2>
//             <p className="mt-2 text-sm text-gray-500">
//               An annual performance plan has not been generated for FY 2026-27 yet.
//             </p>
//             {isManager && (
//               <button
//                 onClick={() => navigate('/performance/annual-plans')}
//                 className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700"
//               >
//                 Go to Plans Directory & Generate
//               </button>
//             )}
//           </main>
//         </div>
//       </div>
//     );
//   }

//   // Count total KPIs in current month
//   const totalMonthlyKpis = currentMonthlyPlan
//     ? currentMonthlyPlan.kras.reduce((sum, kra) => sum + kra.kpis.length, 0)
//     : 0;

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
//           {/* Header Card */}
//           <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//             <div className="flex flex-wrap items-center justify-between gap-4">
//               <div className="flex items-center gap-4">
//                 <button onClick={() => navigate(-1)} className="rounded-xl border p-2 hover:bg-gray-100">
//                   <ArrowLeft className="h-5 w-5 text-gray-500" />
//                 </button>
//                 <div>
//                   <div className="flex items-center gap-2">
//                     <h1 className="text-2xl font-bold text-gray-900">
//                       Annual Performance Plan ({annualPlan.financial_year})
//                     </h1>
//                     <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
//                       {annualPlan.status_display}
//                     </span>
//                   </div>
//                   <p className="mt-1 text-sm text-gray-500">
//                     Employee: <strong className="text-gray-900">{annualPlan.employee_name}</strong> ({annualPlan.employee_id_display})
//                   </p>
//                 </div>
//               </div>

//               {annualPlan.annual_score !== null && (
//                 <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white shadow-sm">
//                   <Award className="h-8 w-8" />
//                   <div>
//                     <div className="text-xs font-medium uppercase opacity-90">Annual Score</div>
//                     <div className="text-2xl font-bold">{annualPlan.annual_score}%</div>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* MONTH SELECTOR BAR */}
//           <div className="mb-6 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
//             <div className="flex items-center gap-2 min-w-max">
//               <button
//                 onClick={() => setActiveMonthNum(0)}
//                 className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
//                   activeMonthNum === 0
//                     ? 'bg-indigo-600 text-white shadow-md'
//                     : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                 }`}
//               >
//                 <Target className="h-4 w-4" />
//                 Annual View
//               </button>

//               <div className="h-6 w-px bg-gray-200" />

//               {MONTH_SEQUENCE.map((m) => {
//                 const isActive = activeMonthNum === m.num;
//                 let mPlan: MonthlyPerformancePlan | undefined;
//                 for (const qr of annualPlan.quarterly_reviews) {
//                   const found = qr.monthly_plans.find((mp) => mp.month === m.num);
//                   if (found) { mPlan = found; break; }
//                 }
//                 const badge = mPlan ? STATUS_BADGES[mPlan.status] : null;

//                 return (
//                   <button
//                     key={m.num}
//                     onClick={() => setActiveMonthNum(m.num)}
//                     className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
//                       isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
//                     }`}
//                   >
//                     <span>{m.name}</span>
//                     {badge && (
//                       <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${isActive ? 'bg-white/20 text-white' : badge.color}`}>
//                         {badge.label}
//                       </span>
//                     )}
//                   </button>
//                 );
//               })}
//             </div>
//           </div>

//           {/* ANNUAL VIEW TAB */}
//           {activeMonthNum === 0 ? (
//             <AnnualOverviewTab annualPlan={annualPlan} />
//           ) : (
//             /* MONTHLY WORKFLOW TABS */
//             <div className="space-y-6">
//               {/* Tab Navigation */}
//               <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
//                 {[
//                   { id: 'KRAS', label: 'KRA & KPI', icon: Target },
//                   { id: 'TARGETS', label: 'Targets', icon: Calendar },
//                   { id: 'PROGRESS', label: 'Progress', icon: TrendingUp },
//                   { id: 'REVIEW', label: 'Review', icon: CheckCircle2 },
//                   { id: 'PLAN', label: 'Plan Info', icon: FileText },
//                   { id: 'CARRY', label: 'Carry Forward', icon: RefreshCw },
//                   { id: 'SCORE', label: 'Monthly Score', icon: Award },
//                 ].map((tab) => {
//                   const Icon = tab.icon;
//                   const isTabActive = activeTab === tab.id;
//                   return (
//                     <button
//                       key={tab.id}
//                       onClick={() => setActiveTab(tab.id as any)}
//                       className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
//                         isTabActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
//                       }`}
//                     >
//                       <Icon className="h-4 w-4" />
//                       {tab.label}
//                     </button>
//                   );
//                 })}
//               </div>

//               {/* TAB 1: KRA & KPI CONFIGURATION */}
//               {activeTab === 'KRAS' && currentMonthlyPlan && (
//                 <div className="space-y-6">
//                   <div className="flex items-center justify-between">
//                     <div>
//                       <h3 className="text-lg font-bold text-gray-900">
//                         Monthly KRA & KPI Assignments ({MONTH_SEQUENCE.find(m => m.num === activeMonthNum)?.label})
//                       </h3>
//                       <p className="text-xs text-gray-500">
//                         Common & Departmental KRAs were auto-injected. Managers can add Individual KRAs and specific KPIs below.
//                       </p>
//                     </div>

//                     {isManager && !currentMonthlyPlan.is_locked && (
//                       <button
//                         onClick={() => setShowAddKraModal(true)}
//                         className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
//                       >
//                         <Plus className="h-4 w-4" /> Add Individual KRA
//                       </button>
//                     )}
//                   </div>

//                   {currentMonthlyPlan.kras.length === 0 ? (
//                     <div className="rounded-2xl bg-white p-12 text-center shadow-sm border text-gray-500">
//                       <Target className="mx-auto h-12 w-12 text-gray-300 mb-2" />
//                       <p className="font-bold text-gray-900">No KRAs Assigned For This Month</p>
//                       <p className="text-xs text-gray-400 mt-1">Configure Master KRAs in Settings or click "Add Individual KRA" above.</p>
//                     </div>
//                   ) : (
//                     <div className="space-y-4">
//                       {['COMMON', 'DEPARTMENTAL', 'INDIVIDUAL'].map((type) => {
//                         const filteredKras = currentMonthlyPlan.kras.filter((k) => k.kra_type === type);
//                         if (filteredKras.length === 0 && type !== 'INDIVIDUAL') return null;

//                         const typeLabels: Record<string, { label: string; badge: string }> = {
//                           COMMON: { label: '📘 Common KRAs (Company-Wide)', badge: 'bg-blue-100 text-blue-800' },
//                           DEPARTMENTAL: { label: '🏢 Departmental KRAs', badge: 'bg-purple-100 text-purple-800' },
//                           INDIVIDUAL: { label: '👤 Individual Custom KRAs', badge: 'bg-indigo-100 text-indigo-800' },
//                         };

//                         return (
//                           <div key={type} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                             <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
//                               <h4 className="text-base font-bold text-gray-900">{typeLabels[type].label}</h4>
//                               <span className={`rounded-full px-3 py-1 text-xs font-bold ${typeLabels[type].badge}`}>
//                                 {filteredKras.length} Assigned
//                               </span>
//                             </div>

//                             {filteredKras.length === 0 ? (
//                               <p className="text-xs italic text-gray-400">No individual KRAs added for this month yet.</p>
//                             ) : (
//                               <div className="space-y-4">
//                                 {filteredKras.map((kra) => (
//   <div key={kra.id} className="rounded-xl border border-gray-200 p-4 hover:border-indigo-300">
//     <div className="flex items-start justify-between">
//       <div>
//         <div className="flex items-center gap-2">
//           <h5 className="font-bold text-gray-900">{kra.name}</h5>
//           {kra.peer_rating_required && (
//             <span className="flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-bold text-pink-700">
//               <Star className="h-3 w-3 fill-current" /> Peer Rating Required
//             </span>
//           )}
//         </div>
//         <p className="text-xs text-gray-500 mt-1">{kra.description}</p>
//       </div>

//       <div className="flex flex-col items-end gap-2">
//         <div className="flex items-center gap-3">
//           <span className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
//             Weight: {kra.weight}%
//           </span>
//           {/* Calculate KPI weight total for this specific KRA */}
// {(() => {
//   const kpiWeightSum = kra.kpis.reduce((sum, kpi) => sum + Number(kpi.weight_in_kra), 0);
//   const isValidKpiWeight = Math.abs(kpiWeightSum - 100) < 0.01;

//   return (
//     <div className="flex items-center gap-2">
//       <span className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
//         KRA Weight: {kra.weight}%
//       </span>

//       {/* 👇 NEW: KPI Weight Balance Badge */}
//       <span
//         className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${
//           kra.kpis.length === 0
//             ? 'bg-amber-50 text-amber-700 border-amber-200'
//             : isValidKpiWeight
//             ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
//             : 'bg-red-50 text-red-700 border-red-200'
//         }`}
//         title="Sum of KPI weights inside this KRA must equal 100%"
//       >
//         {kra.kpis.length === 0
//           ? '⚠️ No KPIs'
//           : isValidKpiWeight
//           ? 'KPI Weights: 100% ✓'
//           : `⚠️ KPI Weights: ${kpiWeightSum}% (Must be 100%)`}
//       </span>
//     </div>
//   );
// })()}
//           {/* Edit / Delete KRA Buttons (For Managers & HR) */}
//           {isManager && !currentMonthlyPlan.is_locked && (
//             <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
//               <button
//                 onClick={() => {
//                   setEditingKra(kra);
//                   setNewKraName(kra.name);
//                   setNewKraDesc(kra.description);
//                   setNewKraWeight(kra.weight.toString());
//                   setNewKraPeerRequired(kra.peer_rating_required);
//                   setShowAddKraModal(true);
//                 }}
//                 className="p-1.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
//                 title="Edit KRA"
//               >
//                 <Edit2 className="h-4 w-4" />
//               </button>
//               <button
//                 onClick={() => handleDeleteKRA(kra.id, kra.name)}
//                 className="p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg"
//                 title="Delete KRA"
//               >
//                 <Trash2 className="h-4 w-4" />
//               </button>
//             </div>
//           )}
//         </div>

//         {/* Action Buttons for KPIs / Peers */}
//         <div className="flex items-center gap-2">
//           {kra.peer_rating_required && isManager && (
//             <button
//               onClick={() => setPeerNominateKra(kra)}
//               className="flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-pink-700"
//             >
//               <Users2 className="h-3.5 w-3.5" /> Select Peers
//             </button>
//           )}

//           {isManager && !currentMonthlyPlan.is_locked && (
//             <button
//               onClick={() => {
//                 setAddingKpiKraId(kra.id);
//                 setEditingKpi(null);
//                 setNewKpiName('');
//                 setNewKpiTarget('');
//                 setNewKpiType('NUMERIC_UP');
//                 setNewKpiWeight('100');
//               }}
//               className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100"
//             >
//               <Plus className="h-3.5 w-3.5" /> Add KPI
//             </button>
//           )}
//         </div>
//       </div>
//     </div>

//     {/* KPIs List */}
//     <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
//       {kra.kpis.length === 0 ? (
//         <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
//           <span>⚠️ No KPIs added under this KRA yet. Click <strong>+ Add KPI</strong>.</span>
//         </div>
//       ) : (
//         kra.kpis.map((kpi) => (
//           <div key={kpi.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-xs group hover:bg-gray-100">
//             <div>
//               <span className="font-semibold text-gray-900">{kpi.name}</span>
//               <span className="ml-2 text-gray-500">({kpi.metric_type})</span>
//             </div>
//             <div className="flex items-center gap-4">
//               <span className="font-bold text-indigo-600">Target: {kpi.target_value}</span>
//               <span className="text-gray-400">Weight: {kpi.weight_in_kra}%</span>
              
//               {/* Edit / Delete KPI Buttons */}
//               {isManager && !currentMonthlyPlan.is_locked && (
//                 <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2">
//                   <button
//                     onClick={() => {
//                       setEditingKpi(kpi);
//                       setAddingKpiKraId(kra.id);
//                       setNewKpiName(kpi.name);
//                       setNewKpiTarget(kpi.target_value);
//                       setNewKpiType(kpi.metric_type as any);
//                       setNewKpiWeight(kpi.weight_in_kra.toString());
//                     }}
//                     className="p-1 text-gray-500 hover:text-indigo-600"
//                   >
//                     <Edit2 className="h-3.5 w-3.5" />
//                   </button>
//                   <button
//                     onClick={() => handleDeleteKPI(kpi.id, kpi.name)}
//                     className="p-1 text-gray-500 hover:text-red-600"
//                   >
//                     <Trash2 className="h-3.5 w-3.5" />
//                   </button>
//                 </div>
//               )}
//             </div>
//           </div>
//         ))
//       )}
//     </div>
//   </div>
// ))}
//                               </div>
//                             )}
//                           </div>
//                         );
//                       })}
//                     </div>
//                   )}
//                 </div>
//               )}

//               {/* TAB 2: TARGETS */}
//               {activeTab === 'TARGETS' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Monthly Targets Summary</h3>
//                   {totalMonthlyKpis === 0 ? (
//                     <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
//                       <Target className="mx-auto h-8 w-8 text-gray-300 mb-2" />
//                       <p className="font-semibold text-gray-700">No KPIs Configured for this Month</p>
//                       <p className="text-xs text-gray-400 mt-1">Go to the "KRA & KPI" tab and click "+ Add KPI" under any assigned KRA.</p>
//                     </div>
//                   ) : (
//                     <div className="mt-4 overflow-x-auto">
//                       <table className="w-full text-left text-xs">
//                         <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
//                           <tr>
//                             <th className="p-3">KRA</th>
//                             <th className="p-3">KPI Name</th>
//                             <th className="p-3">Metric Type</th>
//                             <th className="p-3">Target Value</th>
//                           </tr>
//                         </thead>
//                         <tbody className="divide-y divide-gray-100">
//                           {currentMonthlyPlan.kras.flatMap((kra) =>
//                             kra.kpis.map((kpi) => (
//                               <tr key={kpi.id}>
//                                 <td className="p-3 font-semibold text-gray-900">{kra.name}</td>
//                                 <td className="p-3 text-gray-700">{kpi.name}</td>
//                                 <td className="p-3 text-gray-500">{kpi.metric_type}</td>
//                                 <td className="p-3 font-bold text-indigo-600">{kpi.target_value}</td>
//                               </tr>
//                             ))
//                           )}
//                         </tbody>
//                       </table>
//                     </div>
//                   )}
//                 </div>
//               )}

//               {/* TAB 3: PROGRESS & ACTUALS */}
//               {activeTab === 'PROGRESS' && currentMonthlyPlan && (
//                 <div className="space-y-4">
//                   <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                     <h3 className="text-lg font-bold text-gray-900">Enter Monthly Achievements</h3>
//                     <p className="text-xs text-gray-500">
//                       Update your actual numbers and notes for this month before submitting for review.
//                     </p>
//                   </div>

//                   {totalMonthlyKpis === 0 ? (
//                     <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-200 text-sm text-gray-500">
//                       <TrendingUp className="mx-auto h-10 w-10 text-gray-300 mb-2" />
//                       <p className="font-semibold text-gray-700">No Measurable KPIs Available</p>
//                       <p className="text-xs text-gray-400 mt-1">There are no KPIs set up for this month to enter progress for. Go to "KRA & KPI" tab to add KPIs.</p>
//                     </div>
//                   ) : (
//                     currentMonthlyPlan.kras.map((kra) => (
//                       <div key={kra.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                         <h4 className="font-bold text-gray-900">{kra.name}</h4>
//                         {kra.kpis.length === 0 ? (
//                           <p className="mt-2 text-xs italic text-gray-400">No KPIs under this KRA yet.</p>
//                         ) : (
//                           <div className="mt-4 space-y-4">
//                             {kra.kpis.map((kpi) => (
//                               <ProgressInputRow
//                                 key={kpi.id}
//                                 kpi={kpi}
//                                 isLocked={currentMonthlyPlan.is_locked}
//                                 onSave={handleSaveActual}
//                               />
//                             ))}
//                           </div>
//                         )}
//                       </div>
//                     ))
//                   )}
//                 </div>
//               )}

//               {/* TAB 4: MONTHLY REVIEW */}
//                            {/* TAB 4: MONTHLY REVIEW */}
//               {activeTab === 'REVIEW' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Monthly Review & Verification</h3>
//                   <p className="text-xs text-gray-500 mb-4">Manager verifies employee progress, leaves comments, and provides a rating.</p>
                  
//                   {totalMonthlyKpis === 0 ? (
//                     <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
//                       <CheckCircle2 className="mx-auto h-8 w-8 text-gray-300 mb-2" />
//                       <p className="font-semibold text-gray-700">No KPIs to Review</p>
//                     </div>
//                   ) : (
//                     <div className="space-y-6">
//                       {currentMonthlyPlan.kras.map((kra) => (
//                         <div key={kra.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
//                           <div className="flex items-center justify-between font-bold text-gray-900 mb-3">
//                             <span>{kra.name}</span>
//                             <span className="text-sm rounded-lg bg-indigo-100 text-indigo-700 px-3 py-1">
//                               KRA Score: {kra.kra_score || 0}%
//                             </span>
//                           </div>
//                           <div className="space-y-3">
//                             {kra.kpis.map((kpi) => (
//                               <ManagerReviewRow 
//                                 key={kpi.id} 
//                                 kpi={kpi} 
//                                 isManager={isManager} 
//                                 isLocked={currentMonthlyPlan.is_locked}
//                                 onSave={handleSaveManagerReview} 
//                               />
//                             ))}
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   )}
//                 </div>
//               )}

//               {/* TAB 5: PLAN INFO */}
//               {activeTab === 'PLAN' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Monthly Plan Details & Lifecycle</h3>
//                   <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
//                     <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
//                       <span className="text-xs font-semibold text-gray-500 uppercase">Period</span>
//                       <p className="mt-1 text-sm font-bold text-gray-900">
//                         {currentMonthlyPlan.month_start_date} to {currentMonthlyPlan.month_end_date}
//                       </p>
//                     </div>
//                     <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
//                       <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
//                       <p className="mt-1 text-sm font-bold text-indigo-600">
//                         {currentMonthlyPlan.status_display || currentMonthlyPlan.status}
//                       </p>
//                     </div>
//                     <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
//                       <span className="text-xs font-semibold text-gray-500 uppercase">Monthly Score</span>
//                       <p className="mt-1 text-sm font-bold text-emerald-600">
//                         {currentMonthlyPlan.monthly_score !== null ? `${currentMonthlyPlan.monthly_score}%` : 'Not computed yet'}
//                       </p>
//                     </div>
//                   </div>

//                   {/* Actions */}
//                                     {/* Actions */}
//                   <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-6">
//                     {currentMonthlyPlan.status === 'DRAFT' && (
//                       <button
//                         onClick={() => handleUpdateStatus('OPEN')}
//                         className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
//                       >
//                         Open Plan for Working
//                       </button>
//                     )}
                    
//                     {(currentMonthlyPlan.status === 'OPEN' || currentMonthlyPlan.status === 'DRAFT') && (
//   <div className="space-y-2">
//     <button
//       onClick={() => handleUpdateStatus('EMPLOYEE_SUBMITTED')}
//       // 👇 Block submission if ANY validation error exists
//       disabled={!weightValidation.isValid}
//       className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
//     >
//       Submit Monthly Review to Manager
//     </button>

//     {/* 👇 Display list of validation errors if user cannot submit */}
//     {!weightValidation.isValid && (
//       <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-xs text-red-700 space-y-1">
//         <p className="font-bold flex items-center gap-1 text-red-800">
//           <AlertCircle className="h-4 w-4" /> Please fix the following errors before submitting:
//         </p>
//         <ul className="list-disc list-inside space-y-0.5 pl-1">
//           {weightValidation.errors.map((err, idx) => (
//             <li key={idx}>{err}</li>
//           ))}
//         </ul>
//       </div>
//     )}
//   </div>
// )}
                    
//                     {isManager && currentMonthlyPlan.status === 'EMPLOYEE_SUBMITTED' && (
//                       <button
//                         onClick={() => handleUpdateStatus('APPROVED')}
//                         className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
//                       >
//                         Approve Monthly Plan
//                       </button>
//                     )}
//                   </div>
//                 </div>
//               )}

//               {/* TAB 6: CARRY FORWARD */}
//               {activeTab === 'CARRY' && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Shortfall & Carry Forward Records</h3>
//                   <p className="mt-1 text-xs text-gray-500">
//                     Incomplete targets from past months can be carried forward to future months without altering original targets.
//                   </p>
//                   <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
//                     No active carry-forward requests pending for this period.
//                   </div>
//                 </div>
//               )}

//               {/* TAB 7: MONTHLY SCORE */}
//               {activeTab === 'SCORE' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 text-center">
//                   <Award className="mx-auto h-12 w-12 text-indigo-600" />
//                   <h3 className="mt-2 text-xl font-bold text-gray-900">
//                     Monthly Performance Rollup
//                   </h3>
//                   <div className="mt-4 text-4xl font-extrabold text-indigo-600">
//                     {currentMonthlyPlan.monthly_score !== null ? `${currentMonthlyPlan.monthly_score}%` : '—'}
//                   </div>
//                   <p className="mt-2 text-xs text-gray-500">
//                     Calculated as the weighted sum of all assigned KRAs and KPIs for this month.
//                   </p>
//                 </div>
//               )}
//             </div>
//           )}

//           {/* ADD KRA MODAL */}
//           {showAddKraModal && (
//             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//               <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
//                 <h3 className="text-lg font-bold text-gray-900">
//   {editingKra ? 'Edit KRA' : 'Add Individual KRA'}
// </h3>
//                 <input
//                   type="text"
//                   placeholder="KRA Name (e.g. AI Chatbot Development)"
//                   value={newKraName}
//                   onChange={(e) => setNewKraName(e.target.value)}
//                   className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                 />
//                 <textarea
//                   placeholder="KRA Description"
//                   value={newKraDesc}
//                   onChange={(e) => setNewKraDesc(e.target.value)}
//                   className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                 />
//                 <input
//                   type="number"
//                   placeholder="Weight % (e.g. 20)"
//                   value={newKraWeight}
//                   onChange={(e) => setNewKraWeight(e.target.value)}
//                   className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                 />
//                 <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
//                   <input
//                     type="checkbox"
//                     checked={newKraPeerRequired}
//                     onChange={(e) => setNewKraPeerRequired(e.target.checked)}
//                     className="h-4 w-4 rounded text-pink-600"
//                   />
//                   Require Peer Rating for this KRA
//                 </label>
//                 <div className="flex justify-end gap-2 pt-2">
//                   <button onClick={() => setShowAddKraModal(false)} className="px-4 py-2 border rounded-xl text-sm">Cancel</button>
//                   <button onClick={editingKra ? handleUpdateKRA : handleAddIndividualKRA} disabled={submittingKra} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">
//                     {submittingKra ? 'Adding...' : 'Add KRA'}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* PEER NOMINATION MODAL */}
//           {peerNominateKra && (
//             <NominatePeersModal
//               kra={peerNominateKra}
//               excludeEmployeeId={annualPlan.employee}
//               onClose={() => setPeerNominateKra(null)}
//               onSuccess={() => {
//                 setPeerNominateKra(null);
//                 loadPlan();
//               }}
//             />
//           )}

//           {/* ADD KPI MODAL */}
//           {addingKpiKraId && (
//             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//               <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
//                 <h3 className="text-lg font-bold text-gray-900">
//   {editingKpi ? 'Edit KPI Target' : 'Add KPI Target'}
// </h3>
//                 <input
//                   type="text"
//                   placeholder="KPI Name (e.g. Complete 40 story points)"
//                   value={newKpiName}
//                   onChange={(e) => setNewKpiName(e.target.value)}
//                   className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                 />
//                 <input
//                   type="text"
//                   placeholder="Target Value (e.g. 40 or 90%)"
//                   value={newKpiTarget}
//                   onChange={(e) => setNewKpiTarget(e.target.value)}
//                   className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                 />
//                 <div className="flex justify-end gap-2 pt-2">
//                   <button onClick={() => setAddingKpiKraId(null)} className="px-4 py-2 border rounded-xl text-sm">Cancel</button>
//                   <button onClick={editingKpi ? handleUpdateKPI : handleAddKPI} disabled={submittingKpi} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">
//                     {submittingKpi ? 'Saving...' : 'Add KPI'}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

// // Sub-component for Progress Input Row
// function ProgressInputRow({
//   kpi,
//   isLocked,
//   onSave,
// }: {
//   kpi: MonthlyKPI;
//   isLocked: boolean;
//   onSave: (id: string, actual: string, comment: string) => void;
// }) {
//   const [actual, setActual] = useState(kpi.actual_value || '');
//   const [comment, setComment] = useState(kpi.employee_comment || '');

//   return (
//     <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
//       <div className="flex items-center justify-between">
//         <div>
//           <h5 className="font-bold text-gray-900">{kpi.name}</h5>
//           <span className="text-xs text-indigo-600 font-semibold">Target: {kpi.target_value}</span>
//         </div>
//         {kpi.achievement_percentage !== null && (
//           <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
//             {kpi.achievement_percentage}% Achieved
//           </span>
//         )}
//       </div>

//       <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
//         <input
//           type="text"
//           placeholder="Actual Value achieved (e.g. 34)"
//           value={actual}
//           onChange={(e) => setActual(e.target.value)}
//           disabled={isLocked}
//           className="rounded-xl border border-gray-300 p-2.5 text-xs bg-white"
//         />
//         <input
//           type="text"
//           placeholder="Your comments / notes"
//           value={comment}
//           onChange={(e) => setComment(e.target.value)}
//           disabled={isLocked}
//           className="rounded-xl border border-gray-300 p-2.5 text-xs bg-white"
//         />
//       </div>

//       {!isLocked && (
//         <div className="mt-3 flex justify-end">
//           <button
//             onClick={() => onSave(kpi.id, actual, comment)}
//             className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
//           >
//             <Check className="h-3.5 w-3.5" /> Save Progress
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// // Sub-component for Manager Review Input Row
// function ManagerReviewRow({ kpi, isManager, isLocked, onSave }: any) {
//   const [rating, setRating] = useState(kpi.manager_rating || 0);
//   const [comment, setComment] = useState(kpi.manager_comment || '');

//   return (
//     <div className="rounded-xl bg-white p-4 border border-gray-200 shadow-sm">
//       <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-3">
//         <div>
//           <h5 className="font-bold text-gray-900">{kpi.name}</h5>
//           <p className="text-xs text-gray-500">Emp Comment: {kpi.employee_comment || 'None'}</p>
//         </div>
//         <div className="text-right">
//           <div className="text-xs text-gray-500">Target: {kpi.target_value} | Actual: <strong className="text-gray-900">{kpi.actual_value || '0'}</strong></div>
//           <div className="text-sm font-bold text-emerald-600">Achieved: {kpi.achievement_percentage || 0}%</div>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div>
//           <label className="text-xs font-bold text-gray-700 uppercase">Manager Rating (1-5)</label>
//           <div className="flex gap-1 mt-1">
//             {[1, 2, 3, 4, 5].map((n) => (
//               <button
//                 key={n}
//                 disabled={!isManager || isLocked}
//                 onClick={() => setRating(n)}
//                 className={`h-8 w-8 rounded-lg font-bold text-xs border ${
//                   rating >= n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-indigo-300'
//                 }`}
//               >
//                 {n}
//               </button>
//             ))}
//           </div>
//         </div>
        
//         <div>
//           <label className="text-xs font-bold text-gray-700 uppercase">Manager Comment</label>
//           <input
//             type="text"
//             placeholder="Feedback on this KPI..."
//             value={comment}
//             onChange={(e) => setComment(e.target.value)}
//             disabled={!isManager || isLocked}
//             className="w-full mt-1 border border-gray-200 rounded-lg p-2 text-xs"
//           />
//         </div>
//       </div>

//       {isManager && !isLocked && (
//         <div className="mt-3 flex justify-end">
//           <button
//             onClick={() => onSave(kpi.id, rating, comment)}
//             className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-1.5 rounded-lg text-xs font-bold transition"
//           >
//             Save Review
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }


// // Sub-component for Annual Overview Tab
// function AnnualOverviewTab({ annualPlan }: { annualPlan: AnnualPerformancePlanDetail }) {
//   return (
//     <div className="space-y-6">
//       <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//         <h3 className="text-lg font-bold text-gray-900">Quarterly Breakdown ({annualPlan.financial_year})</h3>
//         <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
//           {annualPlan.quarterly_reviews.map((qr) => (
//             <div key={qr.id} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
//               <div className="flex items-center justify-between">
//                 <span className="font-bold text-gray-900">{qr.quarter}</span>
//                 <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
//                   {qr.status}
//                 </span>
//               </div>
//               <div className="mt-3 text-2xl font-extrabold text-indigo-600">
//                 {qr.quarterly_score !== null ? `${qr.quarterly_score}%` : '—'}
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }

// // Sub-component for Nominate Peers Modal
// function NominatePeersModal({
//   kra,
//   excludeEmployeeId,
//   onClose,
//   onSuccess,
// }: {
//   kra: MonthlyKRA;
//   excludeEmployeeId: string;
//   onClose: () => void;
//   onSuccess: () => void;
// }) {
//   const [employees, setEmployees] = useState<ManagerOption[]>([]);
//   const [selectedIds, setSelectedIds] = useState<string[]>([]);
//   const [search, setSearch] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);

//   useEffect(() => {
//     employeesApi.getManagers(search).then((data) => {
//       setEmployees(data.filter((e) => e.id !== excludeEmployeeId));
//       setLoading(false);
//     });
//   }, [search, excludeEmployeeId]);

//   const toggleSelect = (id: string) => {
//     setSelectedIds((prev) =>
//       prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
//     );
//   };

//   const handleNominate = async () => {
//     if (selectedIds.length === 0) return toast.error('Please select at least one peer');
//     setSubmitting(true);
//     try {
//       await peerNominationsApi.nominate({
//         monthly_kra_id: kra.id,
//         peer_ids: selectedIds,
//       });
//       toast.success('Peers nominated successfully');
//       onSuccess();
//     } catch {
//       toast.error('Failed to nominate peers');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//       <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
//         <div className="flex items-center justify-between border-b pb-3">
//           <h3 className="font-bold text-gray-900">Nominate Peers for "{kra.name}"</h3>
//           <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
//         </div>

//         <input
//           type="text"
//           placeholder="Search peers..."
//           value={search}
//           onChange={(e) => setSearch(e.target.value)}
//           className="w-full rounded-xl border p-2.5 text-xs"
//         />

//         <div className="max-h-60 overflow-y-auto space-y-2">
//           {loading ? (
//             <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
//           ) : (
//             employees.map((emp) => (
//               <label
//                 key={emp.id}
//                 className="flex items-center justify-between p-2.5 rounded-xl border hover:bg-gray-50 cursor-pointer text-xs"
//               >
//                 <div>
//                   <p className="font-bold text-gray-900">{emp.full_name}</p>
//                   <p className="text-gray-500">{emp.official_email}</p>
//                 </div>
//                 <input
//                   type="checkbox"
//                   checked={selectedIds.includes(emp.id)}
//                   onChange={() => toggleSelect(emp.id)}
//                   className="h-4 w-4 rounded text-pink-600"
//                 />
//               </label>
//             ))
//           )}
//         </div>

//         <div className="flex justify-end gap-2 border-t pt-3">
//           <button onClick={onClose} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
//           <button
//             onClick={handleNominate}
//             disabled={submitting || selectedIds.length === 0}
//             className="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold"
//           >
//             {submitting ? 'Saving...' : `Nominate ${selectedIds.length} Peer(s)`}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// ============================================================================================================================
// import { useEffect, useState, useMemo } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import {
//   Calendar, CheckCircle2, Clock, AlertCircle, FileText,
//   Target, Award, ArrowLeft, Plus, ChevronDown, ChevronRight,
//   Send, Trash2, Edit2, Upload, Lock, ShieldCheck, Sparkles,
//   TrendingUp, User, Building2, Info, Loader2, FileSpreadsheet,
//   AlertTriangle, RefreshCw, Star, Users2, X, Search, Check,
// } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { useAuth } from '../../context/AuthContext';
// import {
//   annualPlansApi,
//   monthlyPlansApi,
//   monthlyKRAsApi,
//   monthlyKPIsApi,
//   peerNominationsApi,
//   carryForwardApi,
// } from '../../api/performance';
// import { employeesApi, type ManagerOption } from '../../api/employees';
// import type {
//   AnnualPerformancePlanDetail,
//   MonthlyPerformancePlan,
//   MonthlyKRA,
//   MonthlyKPI,
//   MonthlyPlanStatus,
//   CarryForwardRecord,
// } from '../../types/performance';
// import toast from 'react-hot-toast';

// // Financial Year Month Order (April to March)
// const MONTH_SEQUENCE = [
//   { num: 4, name: 'Apr', label: 'April', quarter: 'Q1' },
//   { num: 5, name: 'May', label: 'May', quarter: 'Q1' },
//   { num: 6, name: 'Jun', label: 'June', quarter: 'Q1' },
//   { num: 7, name: 'Jul', label: 'July', quarter: 'Q2' },
//   { num: 8, name: 'Aug', label: 'August', quarter: 'Q2' },
//   { num: 9, name: 'Sep', label: 'September', quarter: 'Q2' },
//   { num: 10, name: 'Oct', label: 'October', quarter: 'Q3' },
//   { num: 11, name: 'Nov', label: 'November', quarter: 'Q3' },
//   { num: 12, name: 'Dec', label: 'December', quarter: 'Q3' },
//   { num: 1, name: 'Jan', label: 'January', quarter: 'Q4' },
//   { num: 2, name: 'Feb', label: 'February', quarter: 'Q4' },
//   { num: 3, name: 'Mar', label: 'March', quarter: 'Q4' },
// ];

// const STATUS_BADGES: Record<MonthlyPlanStatus, { label: string; color: string }> = {
//   DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-200' },
//   OPEN: { label: 'Open', color: 'bg-blue-50 text-blue-700 border-blue-200' },
//   REVIEW_DUE: { label: 'Review Due', color: 'bg-amber-50 text-amber-700 border-amber-200' },
//   EMPLOYEE_SUBMITTED: { label: 'Submitted', color: 'bg-purple-50 text-purple-700 border-purple-200' },
//   UNDER_REVIEW: { label: 'Under Review', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
//   RETURNED: { label: 'Returned', color: 'bg-red-50 text-red-700 border-red-200' },
//   APPROVED: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
//   CLOSED: { label: 'Closed ✓', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
// };

// export default function AnnualPerformancePlanPage() {
//   const { planId } = useParams<{ planId?: string }>();
//   const navigate = useNavigate();
//   const { user } = useAuth();

//   const [annualPlan, setAnnualPlan] = useState<AnnualPerformancePlanDetail | null>(null);
//   const [loading, setLoading] = useState(true);

//   // Selections
//   const [activeMonthNum, setActiveMonthNum] = useState<number>(4);
//   const [activeTab, setActiveTab] = useState<'PLAN' | 'KRAS' | 'TARGETS' | 'PROGRESS' | 'REVIEW' | 'CARRY' | 'SCORE'>('KRAS');

//   // Add/Edit KRA State
//   const [showAddKraModal, setShowAddKraModal] = useState(false);
//   const [editingKra, setEditingKra] = useState<MonthlyKRA | null>(null);
//   const [newKraName, setNewKraName] = useState('');
//   const [newKraWeight, setNewKraWeight] = useState('20');
//   const [newKraDesc, setNewKraDesc] = useState('');
//   const [newKraPeerRequired, setNewKraPeerRequired] = useState(false);
//   const [submittingKra, setSubmittingKra] = useState(false);

//   // Peer Selection Modal
//   const [peerNominateKra, setPeerNominateKra] = useState<MonthlyKRA | null>(null);

//   // Add/Edit KPI State
//   const [addingKpiKraId, setAddingKpiKraId] = useState<string | null>(null);
//   const [editingKpiObj, setEditingKpiObj] = useState<MonthlyKPI | null>(null);
//   const [newKpiName, setNewKpiName] = useState('');
//   const [newKpiTarget, setNewKpiTarget] = useState('');
//   const [newKpiType, setNewKpiType] = useState<'NUMERIC_UP' | 'PERCENTAGE' | 'BOOLEAN'>('NUMERIC_UP');
//   const [newKpiWeight, setNewKpiWeight] = useState('100');
//   const [submittingKpi, setSubmittingKpi] = useState(false);

//   const [carryForwards, setCarryForwards] = useState<CarryForwardRecord[]>([]);
//   const [loadingCarryForwards, setLoadingCarryForwards] = useState(false);
//   const [selectedShortfallKpi, setSelectedShortfallKpi] = useState<MonthlyKPI | null>(null);
//   const [shortfallAmountInput, setShortfallAmountInput] = useState('');
//   const [carryReasonInput, setCarryReasonInput] = useState('');
//   const [submittingCarry, setSubmittingCarry] = useState(false);


//   const loadPlan = async () => {
//     setLoading(true);
//     try {
//       let data: AnnualPerformancePlanDetail;
//       if (planId) {
//         data = await annualPlansApi.getById(planId);
//       } else {
//         data = await annualPlansApi.getMyPlan('2026-27');
//       }
//       setAnnualPlan(data);
//     } catch (err: any) {
//       if (err.response?.status === 404) {
//         setAnnualPlan(null);
//       } else {
//         toast.error(err.response?.data?.detail || 'Failed to load Annual Performance Plan');
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadPlan();
//       const loadCarryForwards = async () => {
//     if (!annualPlan) return;
//     setLoadingCarryForwards(true);
//     try {
//       const records = await carryForwardApi.list(annualPlan.id);
//       setCarryForwards(records);
//     } catch {
//       // ignore
//     } fontally {
//       setLoadingCarryForwards(false);
//     }
//   };

//   // Auto-fetch carry forwards when CARRY tab is clicked
//   useEffect(() => {
//     if (activeTab === 'CARRY' && annualPlan) {
//       loadCarryForwards();
//     }
//   }, [activeTab, annualPlan?.id]);
//   }, [planId]);

//   const currentMonthlyPlan = useMemo(() => {
//     if (!annualPlan) return null;
//     for (const qr of annualPlan.quarterly_reviews) {
//       const match = qr.monthly_plans.find((m) => m.month === activeMonthNum);
//       if (match) return match;
//     }
//     return null;
//   }, [annualPlan, activeMonthNum]);

//   // Comprehensive Weight Validation
//   const weightValidation = useMemo(() => {
//     if (!currentMonthlyPlan) return { isValid: false, errors: [] };

//     const errors: string[] = [];

//     // 1. Total KRA Weight
//     const totalKraWeight = currentMonthlyPlan.kras.reduce(
//       (sum, kra) => sum + Number(kra.weight), 0
//     );
//     if (Math.abs(totalKraWeight - 100) > 0.01) {
//       errors.push(`Total KRA weight must equal 100% (currently ${totalKraWeight}%).`);
//     }

//     // 2. KPI Weight per KRA
//     currentMonthlyPlan.kras.forEach((kra) => {
//       if (kra.kpis.length === 0) {
//         errors.push(`KRA "${kra.name}" has no KPIs assigned.`);
//       } else {
//         const totalKpiWeight = kra.kpis.reduce(
//           (sum, kpi) => sum + Number(kpi.weight_in_kra), 0
//         );
//         if (Math.abs(totalKpiWeight - 100) > 0.01) {
//           errors.push(`KPI weights in KRA "${kra.name}" must equal 100% (currently ${totalKpiWeight}%).`);
//         }
//       }
//     });

//     return {
//       isValid: errors.length === 0,
//       errors,
//       totalKraWeight,
//     };
//   }, [currentMonthlyPlan]);

//   const isHR = user?.role_codes.includes('HR_ADMIN') || user?.role_codes.includes('SYSTEM_ADMIN');
//   const isManager = user?.role_codes.includes('MANAGER') || isHR;

//   // KRA Handlers
//   const handleSaveKRA = async () => {
//     if (!currentMonthlyPlan || !newKraName.trim()) return;
//     setSubmittingKra(true);
//     try {
//       if (editingKra) {
//         await monthlyKRAsApi.update(editingKra.id, {
//           name: newKraName.trim(),
//           description: newKraDesc.trim(),
//           weight: parseFloat(newKraWeight) || 0,
//           peer_rating_required: newKraPeerRequired,
//         });
//         toast.success('KRA updated');
//       } else {
//         await monthlyKRAsApi.create({
//           monthly_plan: currentMonthlyPlan.id,
//           kra_type: 'INDIVIDUAL',
//           name: newKraName.trim(),
//           description: newKraDesc.trim(),
//           weight: parseFloat(newKraWeight) || 0,
//           peer_rating_required: newKraPeerRequired,
//           kra_start_date: currentMonthlyPlan.month_start_date,
//           kra_end_date: currentMonthlyPlan.month_end_date,
//         });
//         toast.success('Individual KRA added');
//       }
//       setShowAddKraModal(false);
//       setEditingKra(null);
//       setNewKraName('');
//       setNewKraDesc('');
//       setNewKraPeerRequired(false);
//       loadPlan();
//     } catch (err: any) {
//       toast.error(err.response?.data?.detail || 'Failed to save KRA');
//     } finally {
//       setSubmittingKra(false);
//     }
//   };

//   const handleDeleteKRA = async (kraId: string, kraName: string) => {
//     if (!confirm(`Delete KRA "${kraName}"? This will delete all its KPIs as well.`)) return;
//     try {
//       await monthlyKRAsApi.delete(kraId);
//       toast.success('KRA deleted');
//       loadPlan();
//     } catch {
//       toast.error('Failed to delete KRA');
//     }
//   };

//   // KPI Handlers
//   const handleSaveKPI = async () => {
//     if (!addingKpiKraId || !newKpiName.trim() || !newKpiTarget.trim()) return;
//     setSubmittingKpi(true);
//     try {
//       if (editingKpiObj) {
//         await monthlyKPIsApi.update(editingKpiObj.id, {
//           name: newKpiName.trim(),
//           target_value: newKpiTarget.trim(),
//           metric_type: newKpiType,
//           weight_in_kra: parseFloat(newKpiWeight) || 100,
//         });
//         toast.success('KPI & Weight updated');
//       } else {
//         await monthlyKPIsApi.create({
//           monthly_kra: addingKpiKraId,
//           name: newKpiName.trim(),
//           target_value: newKpiTarget.trim(),
//           metric_type: newKpiType,
//           weight_in_kra: parseFloat(newKpiWeight) || 100,
//         });
//         toast.success('KPI added');
//       }
//       setAddingKpiKraId(null);
//       setEditingKpiObj(null);
//       setNewKpiName('');
//       setNewKpiTarget('');
//       setNewKpiWeight('100');
//       loadPlan();
//     } catch {
//       toast.error('Failed to save KPI');
//     } finally {
//       setSubmittingKpi(false);
//     }
//   };

//   const handleDeleteKPI = async (kpiId: string, kpiName: string) => {
//     if (!confirm(`Delete KPI "${kpiName}"?`)) return;
//     try {
//       await monthlyKPIsApi.delete(kpiId);
//       toast.success('KPI deleted');
//       loadPlan();
//     } catch {
//       toast.error('Failed to delete KPI');
//     }
//   };

//   const handleSaveActual = async (kpiId: string, actual: string, comment: string) => {
//     try {
//       await monthlyKPIsApi.update(kpiId, {
//         actual_value: actual,
//         employee_comment: comment,
//       });
//       toast.success('Progress saved');
//       loadPlan();
//     } catch {
//       toast.error('Failed to save progress');
//     }
//   };

//     const handleSaveManagerReview = async (kpiId: string, actual: string, rating: number, comment: string) => {
//     try {
//       await monthlyKPIsApi.update(kpiId, {
//         manager_actual: actual,  // 👈 NOW SENDING MANAGER ACTUAL
//         manager_rating: rating,
//         manager_comment: comment,
//       });
//       toast.success('Manager review saved');
//       loadPlan(); // 👈 This refresh will trigger the backend to calculate the %
//     } catch {
//       toast.error('Failed to save review');
//     }
//   };

//   const handleUpdateStatus = async (newStatus: MonthlyPlanStatus) => {
//     if (!currentMonthlyPlan) return;
//     try {
//       await monthlyPlansApi.update(currentMonthlyPlan.id, { status: newStatus });
//       toast.success(`Plan updated to ${newStatus}`);
//       loadPlan();
//     } catch {
//       toast.error('Failed to update status');
//     }
//   };

//   if (loading) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 items-center justify-center">
//           <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
//         </div>
//       </div>
//     );
//   }

//   if (!annualPlan) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 flex-col overflow-hidden">
//           <Topbar />
//           <main className="p-8 text-center">
//             <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
//             <h2 className="mt-4 text-xl font-bold text-gray-900">No Annual Plan Found</h2>
//             <p className="mt-2 text-sm text-gray-500">
//               An annual performance plan has not been generated for FY 2026-27 yet.
//             </p>
//             {isManager && (
//               <button
//                 onClick={() => navigate('/performance/annual-plans')}
//                 className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700"
//               >
//                 Go to Plans Directory & Generate
//               </button>
//             )}
//           </main>
//         </div>
//       </div>
//     );
//   }

//   const totalMonthlyKpis = currentMonthlyPlan
//     ? currentMonthlyPlan.kras.reduce((sum, kra) => sum + kra.kpis.length, 0)
//     : 0;

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
//           {/* Header Card */}
//           <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//             <div className="flex flex-wrap items-center justify-between gap-4">
//               <div className="flex items-center gap-4">
//                 <button onClick={() => navigate(-1)} className="rounded-xl border p-2 hover:bg-gray-100">
//                   <ArrowLeft className="h-5 w-5 text-gray-500" />
//                 </button>
//                 <div>
//                   <div className="flex items-center gap-2">
//                     <h1 className="text-2xl font-bold text-gray-900">
//                       Annual Performance Plan ({annualPlan.financial_year})
//                     </h1>
//                     <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
//                       {annualPlan.status_display}
//                     </span>
//                   </div>
//                   <p className="mt-1 text-sm text-gray-500">
//                     Employee: <strong className="text-gray-900">{annualPlan.employee_name}</strong> ({annualPlan.employee_id_display})
//                   </p>
//                 </div>
//               </div>

//               {annualPlan.annual_score !== null && (
//                 <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white shadow-sm">
//                   <Award className="h-8 w-8" />
//                   <div>
//                     <div className="text-xs font-medium uppercase opacity-90">Annual Score</div>
//                     <div className="text-2xl font-bold">{annualPlan.annual_score}%</div>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* MONTH SELECTOR BAR */}
//           <div className="mb-6 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
//             <div className="flex items-center gap-2 min-w-max">
//               <button
//                 onClick={() => setActiveMonthNum(0)}
//                 className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
//                   activeMonthNum === 0
//                     ? 'bg-indigo-600 text-white shadow-md'
//                     : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                 }`}
//               >
//                 <Target className="h-4 w-4" />
//                 Annual View
//               </button>

//               <div className="h-6 w-px bg-gray-200" />

//               {MONTH_SEQUENCE.map((m) => {
//                 const isActive = activeMonthNum === m.num;
//                 let mPlan: MonthlyPerformancePlan | undefined;
//                 for (const qr of annualPlan.quarterly_reviews) {
//                   const found = qr.monthly_plans.find((mp) => mp.month === m.num);
//                   if (found) { mPlan = found; break; }
//                 }
//                 const badge = mPlan ? STATUS_BADGES[mPlan.status] : null;

//                 return (
//                   <button
//                     key={m.num}
//                     onClick={() => setActiveMonthNum(m.num)}
//                     className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
//                       isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
//                     }`}
//                   >
//                     <span>{m.name}</span>
//                     {badge && (
//                       <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${isActive ? 'bg-white/20 text-white' : badge.color}`}>
//                         {badge.label}
//                       </span>
//                     )}
//                   </button>
//                 );
//               })}
//             </div>
//           </div>

//           {/* ANNUAL VIEW TAB */}
//           {activeMonthNum === 0 ? (
//             <AnnualOverviewTab annualPlan={annualPlan} />
//           ) : (
//             /* MONTHLY WORKFLOW TABS */
//             <div className="space-y-6">
//               {/* Tab Navigation */}
//               <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
//                 {[
//                   { id: 'KRAS', label: 'KRA & KPI', icon: Target },
//                   { id: 'TARGETS', label: 'Targets', icon: Calendar },
//                   { id: 'PROGRESS', label: 'Progress', icon: TrendingUp },
//                   { id: 'REVIEW', label: 'Review', icon: CheckCircle2 },
//                   { id: 'PLAN', label: 'Plan Info', icon: FileText },
//                   { id: 'CARRY', label: 'Carry Forward', icon: RefreshCw },
//                   { id: 'SCORE', label: 'Monthly Score', icon: Award },
//                 ].map((tab) => {
//                   const Icon = tab.icon;
//                   const isTabActive = activeTab === tab.id;
//                   return (
//                     <button
//                       key={tab.id}
//                       onClick={() => setActiveTab(tab.id as any)}
//                       className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
//                         isTabActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
//                       }`}
//                     >
//                       <Icon className="h-4 w-4" />
//                       {tab.label}
//                     </button>
//                   );
//                 })}
//               </div>

//               {/* TAB 1: KRA & KPI CONFIGURATION */}
//               {activeTab === 'KRAS' && currentMonthlyPlan && (
//                 <div className="space-y-6">
//                   <div className="flex items-center justify-between">
//                     <div>
//                       <h3 className="text-lg font-bold text-gray-900">
//                         Monthly KRA & KPI Assignments ({MONTH_SEQUENCE.find(m => m.num === activeMonthNum)?.label})
//                       </h3>
//                       <p className="text-xs text-gray-500">
//                         Manage KRA weights and define KPI targets.
//                       </p>
//                     </div>

//                     {isManager && !currentMonthlyPlan.is_locked && (
//                       <button
//                         onClick={() => {
//                           setEditingKra(null);
//                           setNewKraName('');
//                           setNewKraDesc('');
//                           setNewKraWeight('20');
//                           setNewKraPeerRequired(false);
//                           setShowAddKraModal(true);
//                         }}
//                         className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
//                       >
//                         <Plus className="h-4 w-4" /> Add Individual KRA
//                       </button>
//                     )}
//                   </div>

//                   {currentMonthlyPlan.kras.length === 0 ? (
//                     <div className="rounded-2xl bg-white p-12 text-center shadow-sm border text-gray-500">
//                       <Target className="mx-auto h-12 w-12 text-gray-300 mb-2" />
//                       <p className="font-bold text-gray-900">No KRAs Assigned For This Month</p>
//                     </div>
//                   ) : (
//                     <div className="space-y-4">
//                       {['COMMON', 'DEPARTMENTAL', 'INDIVIDUAL'].map((type) => {
//                         const filteredKras = currentMonthlyPlan.kras.filter((k) => k.kra_type === type);
//                         if (filteredKras.length === 0 && type !== 'INDIVIDUAL') return null;

//                         const typeLabels: Record<string, { label: string; badge: string }> = {
//                           COMMON: { label: '📘 Common KRAs (Company-Wide)', badge: 'bg-blue-100 text-blue-800' },
//                           DEPARTMENTAL: { label: '🏢 Departmental KRAs', badge: 'bg-purple-100 text-purple-800' },
//                           INDIVIDUAL: { label: '👤 Individual Custom KRAs', badge: 'bg-indigo-100 text-indigo-800' },
//                         };

//                         return (
//                           <div key={type} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                             <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
//                               <h4 className="text-base font-bold text-gray-900">{typeLabels[type].label}</h4>
//                               <span className={`rounded-full px-3 py-1 text-xs font-bold ${typeLabels[type].badge}`}>
//                                 {filteredKras.length} Assigned
//                               </span>
//                             </div>

//                             {filteredKras.length === 0 ? (
//                               <p className="text-xs italic text-gray-400">No individual KRAs added for this month yet.</p>
//                             ) : (
//                               <div className="space-y-4">
//                                 {filteredKras.map((kra) => {
//                                   // KPI weight total calculation
//                                   const kpiWeightSum = kra.kpis.reduce((sum, kpi) => sum + Number(kpi.weight_in_kra), 0);
//                                   const isValidKpiWeight = Math.abs(kpiWeightSum - 100) < 0.01;

//                                   return (
//                                     <div key={kra.id} className="rounded-xl border border-gray-200 p-4 hover:border-indigo-300">
//                                       <div className="flex items-start justify-between">
//                                         <div>
//                                           <div className="flex items-center gap-2">
//                                             <h5 className="font-bold text-gray-900">{kra.name}</h5>
//                                             {kra.peer_rating_required && (
//                                               <span className="flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-bold text-pink-700">
//                                                 <Star className="h-3 w-3 fill-current" /> Peer Rating Required
//                                               </span>
//                                             )}
//                                           </div>
//                                           <p className="text-xs text-gray-500 mt-1">{kra.description}</p>
//                                         </div>

//                                         <div className="flex flex-col items-end gap-2">
//                                           <div className="flex items-center gap-2">
//                                             <span className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
//                                               KRA Weight: {kra.weight}%
//                                             </span>

//                                             {/* KPI Weight Balance Badge */}
//                                             <span
//                                               className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${
//                                                 kra.kpis.length === 0
//                                                   ? 'bg-amber-50 text-amber-700 border-amber-200'
//                                                   : isValidKpiWeight
//                                                   ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
//                                                   : 'bg-red-50 text-red-700 border-red-200'
//                                               }`}
//                                             >
//                                               {kra.kpis.length === 0
//                                                 ? '⚠️ No KPIs'
//                                                 : isValidKpiWeight
//                                                 ? 'KPI Weights: 100% ✓'
//                                                 : `⚠️ KPI Weights: ${kpiWeightSum}%`}
//                                             </span>

//                                             {/* Edit / Delete KRA Buttons */}
//                                             {isManager && !currentMonthlyPlan.is_locked && (
//                                               <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
//                                                 <button
//                                                   onClick={() => {
//                                                     setEditingKra(kra);
//                                                     setNewKraName(kra.name);
//                                                     setNewKraDesc(kra.description);
//                                                     setNewKraWeight(kra.weight.toString());
//                                                     setNewKraPeerRequired(kra.peer_rating_required);
//                                                     setShowAddKraModal(true);
//                                                   }}
//                                                   className="p-1.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
//                                                   title="Edit KRA"
//                                                 >
//                                                   <Edit2 className="h-4 w-4" />
//                                                 </button>
//                                                 <button
//                                                   onClick={() => handleDeleteKRA(kra.id, kra.name)}
//                                                   className="p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg"
//                                                   title="Delete KRA"
//                                                 >
//                                                   <Trash2 className="h-4 w-4" />
//                                                 </button>
//                                               </div>
//                                             )}
//                                           </div>

//                                           <div className="flex items-center gap-2">
//                                             {kra.peer_rating_required && isManager && (
//                                               <button
//                                                 onClick={() => setPeerNominateKra(kra)}
//                                                 className="flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-pink-700"
//                                               >
//                                                 <Users2 className="h-3.5 w-3.5" /> Select Peers
//                                               </button>
//                                             )}

//                                             {isManager && !currentMonthlyPlan.is_locked && (
//                                               <button
//                                                 onClick={() => {
//                                                   setAddingKpiKraId(kra.id);
//                                                   setEditingKpiObj(null);
//                                                   setNewKpiName('');
//                                                   setNewKpiTarget('');
//                                                   setNewKpiType('NUMERIC_UP');
//                                                   setNewKpiWeight('100');
//                                                 }}
//                                                 className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100"
//                                               >
//                                                 <Plus className="h-3.5 w-3.5" /> Add KPI
//                                               </button>
//                                             )}
//                                           </div>
//                                         </div>
//                                       </div>
//                                       <PeerFeedbackSummaryCard kra={kra} />
//                                       {/* KPIs List */}
//                                       <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
//                                         {kra.kpis.length === 0 ? (
//                                           <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
//                                             <span>⚠️ No KPIs added under this KRA yet. Click <strong>+ Add KPI</strong>.</span>
//                                           </div>
//                                         ) : (
//                                           kra.kpis.map((kpi) => (
//                                             <div key={kpi.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-xs group hover:bg-gray-100">
//                                               <div>
//                                                 <span className="font-semibold text-gray-900">{kpi.name}</span>
//                                                 <span className="ml-2 text-gray-500">({kpi.metric_type})</span>
//                                               </div>
//                                               <div className="flex items-center gap-3">
//                                                 <span className="font-bold text-indigo-600">Target: {kpi.target_value}</span>
//                                                 <span className="rounded bg-indigo-50 px-2 py-1 font-bold text-indigo-700">
//                                                   Weight: {kpi.weight_in_kra}%
//                                                 </span>

//                                                 {/* Edit / Delete KPI Buttons */}
//                                                 {isManager && !currentMonthlyPlan.is_locked && (
//                                                   <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 border-l pl-2 border-gray-200">
//                                                     <button
//                                                       onClick={() => {
//                                                         setEditingKpiObj(kpi);
//                                                         setAddingKpiKraId(kra.id);
//                                                         setNewKpiName(kpi.name);
//                                                         setNewKpiTarget(kpi.target_value);
//                                                         setNewKpiType(kpi.metric_type as any);
//                                                         setNewKpiWeight(kpi.weight_in_kra.toString());
//                                                       }}
//                                                       className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-white rounded"
//                                                       title="Edit KPI & Weight"
//                                                     >
//                                                       <Edit2 className="h-3.5 w-3.5" />
//                                                     </button>
//                                                     <button
//                                                       onClick={() => handleDeleteKPI(kpi.id, kpi.name)}
//                                                       className="p-1 text-gray-500 hover:text-red-600 hover:bg-white rounded"
//                                                       title="Delete KPI"
//                                                     >
//                                                       <Trash2 className="h-3.5 w-3.5" />
//                                                     </button>
//                                                   </div>
//                                                 )}
//                                               </div>
//                                             </div>
//                                           ))
//                                         )}
//                                       </div>
//                                     </div>
                                    
//                                   );
//                                 })}
//                               </div>
//                             )}
//                           </div>
//                         );
//                       })}
//                     </div>
//                   )}
//                 </div>
//               )}

//               {/* TAB 2: TARGETS */}
//               {activeTab === 'TARGETS' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Monthly Targets Summary</h3>
//                   {totalMonthlyKpis === 0 ? (
//                     <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
//                       <Target className="mx-auto h-8 w-8 text-gray-300 mb-2" />
//                       <p className="font-semibold text-gray-700">No KPIs Configured for this Month</p>
//                     </div>
//                   ) : (
//                     <div className="mt-4 overflow-x-auto">
//                       <table className="w-full text-left text-xs">
//                         <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
//                           <tr>
//                             <th className="p-3">KRA</th>
//                             <th className="p-3">KPI Name</th>
//                             <th className="p-3">Metric Type</th>
//                             <th className="p-3">Target Value</th>
//                             <th className="p-3">KPI Weightage</th>
//                           </tr>
//                         </thead>
//                         <tbody className="divide-y divide-gray-100">
//                           {currentMonthlyPlan.kras.flatMap((kra) =>
//                             kra.kpis.map((kpi) => (
//                               <tr key={kpi.id}>
//                                 <td className="p-3 font-semibold text-gray-900">{kra.name}</td>
//                                 <td className="p-3 text-gray-700">{kpi.name}</td>
//                                 <td className="p-3 text-gray-500">{kpi.metric_type}</td>
//                                 <td className="p-3 font-bold text-indigo-600">{kpi.target_value}</td>
//                                 <td className="p-3 font-bold text-indigo-700">{kpi.weight_in_kra}%</td>
//                               </tr>
//                             ))
//                           )}
//                         </tbody>
//                       </table>
//                     </div>
//                   )}
//                 </div>
//               )}

//               {/* TAB 3: PROGRESS */}
//               {activeTab === 'PROGRESS' && currentMonthlyPlan && (
//                 <div className="space-y-4">
//                   <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                     <h3 className="text-lg font-bold text-gray-900">Enter Monthly Achievements</h3>
//                     <p className="text-xs text-gray-500">
//                       Update your actual numbers and notes for this month before submitting for review.
//                     </p>
//                   </div>

//                   {totalMonthlyKpis === 0 ? (
//                     <div className="rounded-2xl bg-white p-12 text-center shadow-sm text-sm text-gray-500">
//                       <p className="font-semibold text-gray-700">No Measurable KPIs Available</p>
//                     </div>
//                   ) : (
//                     currentMonthlyPlan.kras.map((kra) => (
//                       <div key={kra.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                         <h4 className="font-bold text-gray-900">{kra.name}</h4>
//                         <div className="mt-4 space-y-4">
//                           {kra.kpis.map((kpi) => (
//                             <ProgressInputRow
//                               key={kpi.id}
//                               kpi={kpi}
//                               isLocked={currentMonthlyPlan.is_locked}
//                               onSave={handleSaveActual}
//                               onUploadSuccess={loadPlan}
//                             />
//                           ))}
//                         </div>
//                       </div>
//                     ))
//                   )}
//                 </div>
//               )}

//               {/* TAB 4: REVIEW */}
//               {activeTab === 'REVIEW' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Monthly Review & Verification</h3>
//                   <p className="text-xs text-gray-500 mb-4">Manager verifies employee progress, leaves comments, and provides a rating.</p>
                  
//                   {totalMonthlyKpis === 0 ? (
//                     <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
//                       <CheckCircle2 className="mx-auto h-8 w-8 text-gray-300 mb-2" />
//                       <p className="font-semibold text-gray-700">No KPIs to Review</p>
//                     </div>
//                   ) : (
//                     <div className="space-y-6">
//                       {currentMonthlyPlan.kras.map((kra) => (
//                         <div key={kra.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
//                           <div className="flex items-center justify-between font-bold text-gray-900 mb-3">
//                             <span>{kra.name}</span>
//                             <span className="text-sm rounded-lg bg-indigo-100 text-indigo-700 px-3 py-1">
//                               KRA Score: {kra.kra_score || 0}%
//                             </span>
//                           </div>
//                           <PeerFeedbackSummaryCard kra={kra} />
//                           <div className="space-y-3">
//                             {kra.kpis.map((kpi) => (
//                               <ManagerReviewRow 
//                                 key={kpi.id} 
//                                 kpi={kpi} 
//                                 isManager={isManager} 
//                                 isLocked={currentMonthlyPlan.is_locked}
//                                 onSave={handleSaveManagerReview} 
//                               />
//                             ))}
//                           </div>
//                         </div>
                        
//                       ))}
//                     </div>
//                   )}
//                 </div>
//               )}

//               {/* TAB 5: PLAN INFO */}
//                             {/* TAB 5: PLAN INFO */}
//               {activeTab === 'PLAN' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                   <h3 className="text-lg font-bold text-gray-900">Monthly Plan Details & Lifecycle</h3>
//                   <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
//                     <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
//                       <span className="text-xs font-semibold text-gray-500 uppercase">Period</span>
//                       <p className="mt-1 text-sm font-bold text-gray-900">
//                         {currentMonthlyPlan.month_start_date} to {currentMonthlyPlan.month_end_date}
//                       </p>
//                     </div>
//                     <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
//                       <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
//                       <p className="mt-1 text-sm font-bold text-indigo-600">
//                         {currentMonthlyPlan.status_display || currentMonthlyPlan.status}
//                       </p>
//                     </div>
//                     <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
//                       <span className="text-xs font-semibold text-gray-500 uppercase">Monthly Score</span>
//                       <p className="mt-1 text-sm font-bold text-emerald-600">
//                         {currentMonthlyPlan.monthly_score !== null ? `${currentMonthlyPlan.monthly_score}%` : 'Not computed yet'}
//                       </p>
//                     </div>
//                   </div>

//                   {/* Actions & Weight Validation Warning */}
//                   <div className="mt-6 border-t border-gray-100 pt-6 flex flex-col gap-4">
//                     {/* 1. Open Plan for Working (When status is DRAFT) */}
//                     {currentMonthlyPlan.status === 'DRAFT' && isManager && (
//                       <div>
//                         <button
//                           onClick={() => handleUpdateStatus('OPEN')}
//                           className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700"
//                         >
//                           Open Plan for Working
//                         </button>
//                         <p className="mt-1 text-xs text-gray-500">
//                           Transition status from Draft to Open so the employee can start logging monthly progress.
//                         </p>
//                       </div>
//                     )}

//                     {/* 2. Submit Monthly Review to Manager (When status is OPEN) */}
//                     {(currentMonthlyPlan.status === 'OPEN' || currentMonthlyPlan.status === 'DRAFT') && (
//                       <div className="space-y-2">
//                         <button
//                           onClick={() => handleUpdateStatus('EMPLOYEE_SUBMITTED')}
//                           disabled={!weightValidation.isValid}
//                           className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
//                         >
//                           Submit Monthly Review to Manager
//                         </button>

//                         {!weightValidation.isValid && (
//                           <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-xs text-red-700 space-y-1">
//                             <p className="font-bold flex items-center gap-1 text-red-800">
//                               <AlertCircle className="h-4 w-4" /> Please fix the following errors before submitting:
//                             </p>
//                             <ul className="list-disc list-inside space-y-0.5 pl-1">
//                               {weightValidation.errors.map((err, idx) => (
//                                 <li key={idx}>{err}</li>
//                               ))}
//                             </ul>
//                           </div>
//                         )}
//                       </div>
//                     )}

//                     {/* 3. Manager Approval Actions (When status is EMPLOYEE_SUBMITTED) */}
//                     {isManager && currentMonthlyPlan.status === 'EMPLOYEE_SUBMITTED' && (
//                       <div className="flex items-center gap-3">
//                         <button
//                           onClick={() => handleUpdateStatus('APPROVED')}
//                           className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700"
//                         >
//                           Approve Monthly Plan
//                         </button>
//                         <button
//                           onClick={() => handleUpdateStatus('RETURNED')}
//                           className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-700"
//                         >
//                           Return for Revision
//                         </button>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               )}

//               {/* TAB 6: CARRY FORWARD */}
//                             {/* TAB 6: CARRY FORWARD */}
//                             {/* TAB 6: CARRY FORWARD & SHORTFALL MANAGEMENT */}
//               {activeTab === 'CARRY' && currentMonthlyPlan && (
//                 <div className="space-y-6">
//                   {/* Explanation Banner */}
//                   <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                     <div className="flex items-start gap-3">
//                       <RefreshCw className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-1" />
//                       <div>
//                         <h3 className="text-lg font-bold text-gray-900">Carry Forward Management</h3>
//                         <p className="text-xs text-gray-500 mt-1">
//                           Transfer incomplete targets (shortfalls) from this month to the next month.
//                           <strong className="text-gray-700"> Original historical targets and actuals are NEVER overwritten.</strong>
//                         </p>
//                       </div>
//                     </div>
//                   </div>

//                   {/* SECTION 1: INCOMPLETE KPIs FOR THIS MONTH */}
//                   <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                     <h4 className="font-bold text-gray-900 text-sm mb-3">
//                       Incomplete KPIs for {MONTH_SEQUENCE.find((m) => m.num === activeMonthNum)?.label}
//                     </h4>

//                     {currentMonthlyPlan.kras.flatMap((k) => k.kpis).length === 0 ? (
//                       <p className="text-xs italic text-gray-400">No KPIs in this month.</p>
//                     ) : (
//                       <div className="space-y-2">
//                         {currentMonthlyPlan.kras.flatMap((kra) =>
//                           kra.kpis.map((kpi) => {
//                             const targetNum = parseFloat(kpi.target_value) || 0;
//                             const actualNum = parseFloat(kpi.actual_value) || 0;
//                             const hasShortfall = targetNum > actualNum;
//                             const defaultShortfall = hasShortfall ? String(targetNum - actualNum) : '0';

//                             return (
//                               <div
//                                 key={kpi.id}
//                                 className="flex flex-wrap items-center justify-between rounded-xl bg-gray-50 p-3.5 border border-gray-200 text-xs"
//                               >
//                                 <div>
//                                   <p className="font-bold text-gray-900">{kpi.name}</p>
//                                   <p className="text-gray-500 text-[11px] mt-0.5">
//                                     Under KRA: <strong>{kra.name}</strong>
//                                   </p>
//                                 </div>

//                                 <div className="flex items-center gap-4">
//                                   <div className="text-right">
//                                     <span className="text-gray-500">Target: <strong>{kpi.target_value}</strong></span>
//                                     <span className="mx-2 text-gray-300">|</span>
//                                     <span className="text-gray-500">Actual: <strong>{kpi.actual_value || '0'}</strong></span>
//                                   </div>

//                                   <button
//                                     onClick={() => {
//                                       setSelectedShortfallKpi(kpi);
//                                       setShortfallAmountInput(defaultShortfall);
//                                       setCarryReasonInput('');
//                                     }}
//                                     className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
//                                   >
//                                     Carry Forward →
//                                   </button>
//                                 </div>
//                               </div>
//                             );
//                           })
//                         )}
//                       </div>
//                     )}
//                   </div>

//                   {/* SECTION 2: CARRY FORWARD REQUESTS TABLE */}
//                   <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//                     <div className="flex items-center justify-between mb-4 border-b pb-3">
//                       <h4 className="font-bold text-gray-900 text-sm">
//                         Carry Forward Request Records
//                       </h4>
//                       <button
//                         onClick={loadCarryForwards}
//                         className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
//                       >
//                         <RefreshCw className="h-3.5 w-3.5" /> Refresh List
//                       </button>
//                     </div>

//                     {loadingCarryForwards ? (
//                       <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto py-4" />
//                     ) : carryForwards.length === 0 ? (
//                       <p className="text-xs text-center text-gray-400 py-6">
//                         No carry forward requests submitted yet for this annual plan.
//                       </p>
//                     ) : (
//                       <div className="overflow-x-auto">
//                         <table className="w-full text-left text-xs">
//                           <thead className="bg-gray-50 uppercase text-gray-500 font-semibold">
//                             <tr>
//                               <th className="p-3">Source Month</th>
//                               <th className="p-3">Dest Month</th>
//                               <th className="p-3">KPI Name</th>
//                               <th className="p-3">Shortfall Carried</th>
//                               <th className="p-3">Status</th>
//                               <th className="p-3 text-right">Action</th>
//                             </tr>
//                           </thead>
//                           <tbody className="divide-y divide-gray-100">
//                             {carryForwards.map((cf: any) => (
//                               <tr key={cf.id}>
//                                 <td className="p-3 font-semibold text-gray-900">{cf.source_month_name}</td>
//                                 <td className="p-3 font-semibold text-indigo-600">{cf.destination_month_name}</td>
//                                 <td className="p-3 text-gray-700">{cf.source_kpi_name || 'KPI'}</td>
//                                 <td className="p-3 font-bold text-gray-900">{cf.shortfall_amount}</td>
//                                 <td className="p-3">
//                                   <span
//                                     className={`rounded-full px-2.5 py-0.5 font-bold ${
//                                       cf.status === 'APPROVED'
//                                         ? 'bg-emerald-100 text-emerald-800'
//                                         : cf.status === 'REJECTED'
//                                         ? 'bg-red-100 text-red-800'
//                                         : 'bg-amber-100 text-amber-800'
//                                     }`}
//                                   >
//                                     {cf.status}
//                                   </span>
//                                 </td>
//                                 <td className="p-3 text-right">
//                                   {isManager && cf.status === 'PENDING' && (
//                                     <div className="flex justify-end gap-1">
//                                       <button
//                                         onClick={async () => {
//                                           try {
//                                             await carryForwardApi.approve(cf.id);
//                                             toast.success('Approved! Target carried forward to next month.');
//                                             loadCarryForwards();
//                                             loadPlan();
//                                           } catch (err: any) {
//                                             toast.error(err.response?.data?.detail || 'Approval failed');
//                                           }
//                                         }}
//                                         className="bg-emerald-600 text-white px-2.5 py-1 rounded text-[11px] font-bold hover:bg-emerald-700"
//                                       >
//                                         Approve
//                                       </button>
//                                       <button
//                                         onClick={async () => {
//                                           try {
//                                             await carryForwardApi.reject(cf.id);
//                                             toast.success('Carry forward rejected.');
//                                             loadCarryForwards();
//                                           } catch {
//                                             toast.error('Rejection failed');
//                                           }
//                                         }}
//                                         className="bg-red-600 text-white px-2.5 py-1 rounded text-[11px] font-bold hover:bg-red-700"
//                                       >
//                                         Reject
//                                       </button>
//                                     </div>
//                                   )}
//                                 </td>
//                               </tr>
//                             ))}
//                           </tbody>
//                         </table>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               )}

//               {/* CARRY FORWARD REQUEST MODAL */}
//               {selectedShortfallKpi && (
//                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//                   <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
//                     <div className="flex items-center justify-between border-b pb-3">
//                       <h3 className="font-bold text-gray-900 text-base">Request Carry Forward</h3>
//                       <button onClick={() => setSelectedShortfallKpi(null)}>
//                         <X className="h-5 w-5 text-gray-400" />
//                       </button>
//                     </div>

//                     <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900">
//                       <p className="font-bold">{selectedShortfallKpi.name}</p>
//                       <p className="mt-0.5">
//                         Target: {selectedShortfallKpi.target_value} | Actual Achieved:{' '}
//                         {selectedShortfallKpi.actual_value || '0'}
//                       </p>
//                     </div>

//                     <div>
//                       <label className="text-xs font-bold uppercase text-gray-700">
//                         Shortfall Amount to Carry Over *
//                       </label>
//                       <input
//                         type="text"
//                         value={shortfallAmountInput}
//                         onChange={(e) => setShortfallAmountInput(e.target.value)}
//                         placeholder="e.g. 6"
//                         className="w-full mt-1 border border-gray-300 rounded-xl p-2.5 text-sm"
//                       />
//                     </div>

//                     <div>
//                       <label className="text-xs font-bold uppercase text-gray-700">
//                         Destination Month
//                       </label>
//                       <input
//                         type="text"
//                         disabled
//                         value={
//                           MONTH_SEQUENCE.find(
//                             (m) =>
//                               m.num ===
//                               (activeMonthNum === 12 ? 1 : activeMonthNum === 3 ? 4 : activeMonthNum + 1)
//                           )?.label || 'Next Month'
//                         }
//                         className="w-full mt-1 border border-gray-200 bg-gray-50 rounded-xl p-2.5 text-sm font-bold text-indigo-600"
//                       />
//                     </div>

//                     <div>
//                       <label className="text-xs font-bold uppercase text-gray-700">Reason</label>
//                       <textarea
//                         value={carryReasonInput}
//                         onChange={(e) => setCarryReasonInput(e.target.value)}
//                         placeholder="Reason for shortfall (e.g. Production support took extra capacity)"
//                         rows={3}
//                         className="w-full mt-1 border border-gray-300 rounded-xl p-2.5 text-sm"
//                       />
//                     </div>

//                     <div className="flex justify-end gap-2 border-t pt-3">
//                       <button
//                         onClick={() => setSelectedShortfallKpi(null)}
//                         className="px-4 py-2 border rounded-xl text-xs text-gray-600"
//                       >
//                         Cancel
//                       </button>
//                       <button
//                         onClick={async () => {
//                           if (!shortfallAmountInput.trim()) return toast.error('Enter shortfall amount');
//                           setSubmittingCarry(true);
//                           try {
//                             const sourceMonthName = MONTH_SEQUENCE.find((m) => m.num === activeMonthNum)?.label || 'Current';
//                             const destMonthName = MONTH_SEQUENCE.find(
//                               (m) => m.num === (activeMonthNum === 12 ? 1 : activeMonthNum === 3 ? 4 : activeMonthNum + 1)
//                             )?.label || 'Next';

//                             await carryForwardApi.create({
//                               annual_plan: annualPlan.id,
//                               source_kpi: selectedShortfallKpi.id,
//                               source_month_name: sourceMonthName,
//                               shortfall_amount: shortfallAmountInput.trim(),
//                               destination_month_name: destMonthName,
//                               reason: carryReasonInput.trim(),
//                               requested_by: user?.employee?.id,
//                             });
//                             toast.success('Carry forward requested');
//                             setSelectedShortfallKpi(null);
//                             loadCarryForwards();
//                           } catch {
//                             toast.error('Request failed');
//                           } finally {
//                             setSubmittingCarry(false);
//                           }
//                         }}
//                         disabled={submittingCarry}
//                         className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow hover:bg-indigo-700"
//                       >
//                         {submittingCarry ? 'Submitting...' : 'Submit Request'}
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               )}

//               {/* TAB 7: MONTHLY SCORE */}
//               {activeTab === 'SCORE' && currentMonthlyPlan && (
//                 <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 text-center">
//                   <Award className="mx-auto h-12 w-12 text-indigo-600" />
//                   <h3 className="mt-2 text-xl font-bold text-gray-900">
//                     Monthly Performance Rollup
//                   </h3>
//                   <div className="mt-4 text-4xl font-extrabold text-indigo-600">
//                     {currentMonthlyPlan.monthly_score !== null ? `${currentMonthlyPlan.monthly_score}%` : '—'}
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}

//           {/* ADD / EDIT KRA MODAL */}
//           {showAddKraModal && (
//             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//               <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
//                 <h3 className="text-lg font-bold text-gray-900">
//                   {editingKra ? 'Edit Individual KRA' : 'Add Individual KRA'}
//                 </h3>
//                 <input
//                   type="text"
//                   placeholder="KRA Name"
//                   value={newKraName}
//                   onChange={(e) => setNewKraName(e.target.value)}
//                   className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                 />
//                 <textarea
//                   placeholder="Description"
//                   value={newKraDesc}
//                   onChange={(e) => setNewKraDesc(e.target.value)}
//                   className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                 />
//                 <input
//                   type="number"
//                   placeholder="Weight %"
//                   value={newKraWeight}
//                   onChange={(e) => setNewKraWeight(e.target.value)}
//                   className="w-full rounded-xl border border-gray-300 p-3 text-sm"
//                 />
//                 <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
//                   <input
//                     type="checkbox"
//                     checked={newKraPeerRequired}
//                     onChange={(e) => setNewKraPeerRequired(e.target.checked)}
//                     className="h-4 w-4 rounded text-pink-600"
//                   />
//                   Require Peer Rating for this KRA
//                 </label>
//                 <div className="flex justify-end gap-2 pt-2">
//                   <button onClick={() => { setShowAddKraModal(false); setEditingKra(null); }} className="px-4 py-2 border rounded-xl text-sm">Cancel</button>
//                   <button onClick={editingKra ? handleSaveKRA : handleSaveKRA} disabled={submittingKra} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">
//                     {submittingKra ? 'Saving...' : editingKra ? 'Update KRA' : 'Add KRA'}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* ADD / EDIT KPI MODAL */}
//           {addingKpiKraId && (
//             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//               <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
//                 <div className="flex justify-between items-center border-b pb-3">
//                   <h3 className="text-lg font-bold text-gray-900">
//                     {editingKpiObj ? 'Edit KPI & Weightage' : 'Add KPI Target'}
//                   </h3>
//                   <button onClick={() => { setAddingKpiKraId(null); setEditingKpiObj(null); }}>
//                     <X className="h-5 w-5 text-gray-400" />
//                   </button>
//                 </div>

//                 <div>
//                   <label className="text-xs font-bold text-gray-700 uppercase">KPI Name *</label>
//                   <input
//                     type="text"
//                     placeholder="e.g. Complete 40 story points"
//                     value={newKpiName}
//                     onChange={(e) => setNewKpiName(e.target.value)}
//                     className="w-full mt-1 rounded-xl border border-gray-300 p-3 text-sm"
//                   />
//                 </div>

//                 <div>
//                   <label className="text-xs font-bold text-gray-700 uppercase">Target Value *</label>
//                   <input
//                     type="text"
//                     placeholder="e.g. 40 or 90%"
//                     value={newKpiTarget}
//                     onChange={(e) => setNewKpiTarget(e.target.value)}
//                     className="w-full mt-1 rounded-xl border border-gray-300 p-3 text-sm"
//                   />
//                 </div>

//                 <div>
//                   <label className="text-xs font-bold text-gray-700 uppercase">Metric Type</label>
//                   <select
//                     value={newKpiType}
//                     onChange={(e) => setNewKpiType(e.target.value as any)}
//                     className="w-full mt-1 rounded-xl border border-gray-300 p-3 text-sm"
//                   >
//                     <option value="NUMERIC_UP">Numeric (Higher is better)</option>
//                     <option value="NUMERIC_DOWN">Numeric (Lower is better)</option>
//                     <option value="PERCENTAGE">Percentage</option>
//                     <option value="BOOLEAN">Yes / No</option>
//                   </select>
//                 </div>

//                 {/* KPI WEIGHTAGE IN KRA (%) */}
//                 <div>
//                   <label className="text-xs font-bold text-gray-700 uppercase">
//                     KPI Weightage in KRA (%) *
//                   </label>
//                   <input
//                     type="number"
//                     min="1"
//                     max="100"
//                     placeholder="e.g. 50"
//                     value={newKpiWeight}
//                     onChange={(e) => setNewKpiWeight(e.target.value)}
//                     className="w-full mt-1 rounded-xl border border-gray-300 p-3 text-sm"
//                   />
//                   <p className="text-[11px] text-gray-500 mt-1">
//                     Sum of all KPI weights inside this KRA must equal 100%.
//                   </p>
//                 </div>

//                 <div className="mt-6 flex justify-end gap-2 pt-3 border-t">
//                   <button
//                     onClick={() => { setAddingKpiKraId(null); setEditingKpiObj(null); }}
//                     className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-600"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     onClick={handleSaveKPI}
//                     disabled={submittingKpi}
//                     className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
//                   >
//                     {submittingKpi ? 'Saving...' : editingKpiObj ? 'Update KPI' : 'Add KPI'}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* PEER NOMINATION MODAL */}
//           {peerNominateKra && (
//             <NominatePeersModal
//               kra={peerNominateKra}
//               excludeEmployeeId={annualPlan.employee}
//               onClose={() => setPeerNominateKra(null)}
//               onSuccess={() => {
//                 setPeerNominateKra(null);
//                 loadPlan();
//               }}
//             />
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }


// // Sub-component for Progress Input Row (With Evidence Upload)
// // Sub-component for Progress Input Row (With Auto-Save on Evidence Upload)
// function ProgressInputRow({
//   kpi,
//   isLocked,
//   onSave,
//   onUploadSuccess,
// }: {
//   kpi: MonthlyKPI;
//   isLocked: boolean;
//   onSave: (id: string, actual: string, comment: string) => Promise<void> | void;
//   onUploadSuccess: () => void;
// }) {
//   const [actual, setActual] = useState(kpi.actual_value || '');
//   const [comment, setComment] = useState(kpi.employee_comment || '');
//   const [uploading, setUploading] = useState(false);

//   // 1. Keep local inputs in sync if props change from server
//   useEffect(() => {
//     setActual(kpi.actual_value || '');
//     setComment(kpi.employee_comment || '');
//   }, [kpi.actual_value, kpi.employee_comment]);

//   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     setUploading(true);
//     try {
//       // 2. 🔥 SMART AUTO-SAVE: If user typed actuals/comments but didn't click "Save Progress" yet,
//       // save them to the database FIRST before uploading evidence!
//       const hasUnsavedActual = actual !== (kpi.actual_value || '');
//       const hasUnsavedComment = comment !== (kpi.employee_comment || '');

//       if (hasUnsavedActual || hasUnsavedComment) {
//         await onSave(kpi.id, actual, comment);
//       }

//       // 3. Upload the evidence file
//       const fd = new FormData();
//       fd.append('kpi', kpi.id);
//       fd.append('file', file);
//       fd.append('file_name', file.name);

//       await monthlyKPIsApi.uploadEvidence(fd);
//       toast.success('Evidence file uploaded');

//       // 4. Refresh plan data from server
//       onUploadSuccess();
//     } catch (err: any) {
//       toast.error(err?.response?.data?.detail || 'Failed to upload evidence');
//     } finally {
//       setUploading(false);
//     }
//   };

//   const handleDeleteEvidence = async (evidenceId: string) => {
//     if (!confirm('Delete this evidence file?')) return;
//     try {
//       await monthlyKPIsApi.deleteEvidence(evidenceId);
//       toast.success('Evidence deleted');
//       onUploadSuccess();
//     } catch {
//       toast.error('Failed to delete evidence');
//     }
//   };

//   return (
//     <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
//       <div className="flex items-center justify-between">
//         <div>
//           <h5 className="font-bold text-gray-900">{kpi.name}</h5>
//           <span className="text-xs text-indigo-600 font-semibold">Target: {kpi.target_value}</span>
//         </div>
//         {kpi.achievement_percentage !== null && (
//           <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
//             {kpi.achievement_percentage}% Achieved
//           </span>
//         )}
//       </div>

//       <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
//         <input
//           type="text"
//           placeholder="Actual Value achieved (e.g. 34)"
//           value={actual}
//           onChange={(e) => setActual(e.target.value)}
//           disabled={isLocked}
//           className="rounded-xl border border-gray-300 p-2.5 text-xs bg-white focus:border-indigo-500 focus:outline-none"
//         />
//         <input
//           type="text"
//           placeholder="Your comments / notes"
//           value={comment}
//           onChange={(e) => setComment(e.target.value)}
//           disabled={isLocked}
//           className="rounded-xl border border-gray-300 p-2.5 text-xs bg-white focus:border-indigo-500 focus:outline-none"
//         />
//       </div>

//       {/* 📎 Attached Evidence Files Section */}
//       <div className="mt-3 border-t border-gray-200 pt-3">
//         <div className="flex items-center justify-between mb-2">
//           <span className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1">
//             <FileText className="h-3.5 w-3.5 text-gray-500" /> Attached Evidence ({kpi.evidences?.length || 0})
//           </span>

//           {!isLocked && (
//             <label className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100 cursor-pointer transition">
//               {uploading ? (
//                 <Loader2 className="h-3.5 w-3.5 animate-spin" />
//               ) : (
//                 <Upload className="h-3.5 w-3.5" />
//               )}
//               {uploading ? 'Saving & Uploading...' : 'Upload Evidence'}
//               <input
//                 type="file"
//                 className="hidden"
//                 onChange={handleFileUpload}
//                 disabled={uploading || isLocked}
//               />
//             </label>
//           )}
//         </div>

//         {/* Evidence Items List */}
//         {kpi.evidences && kpi.evidences.length > 0 ? (
//           <div className="space-y-1.5">
//             {kpi.evidences.map((ev) => (
//               <div
//                 key={ev.id}
//                 className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-gray-200 text-xs"
//               >
//                 <div className="flex items-center gap-2 min-w-0">
//                   <FileText className="h-4 w-4 text-indigo-500 flex-shrink-0" />
//                   <a
//                     href={ev.file}
//                     target="_blank"
//                     rel="noreferrer"
//                     className="font-medium text-gray-900 truncate hover:text-indigo-600 hover:underline"
//                   >
//                     {ev.file_name}
//                   </a>
//                   <span className="text-gray-400 text-[10px]">({ev.file_size_kb} KB)</span>
//                 </div>

//                 {!isLocked && (
//                   <button
//                     onClick={() => handleDeleteEvidence(ev.id)}
//                     className="text-gray-400 hover:text-red-600 p-1 rounded"
//                     title="Delete Evidence"
//                   >
//                     <Trash2 className="h-3.5 w-3.5" />
//                   </button>
//                 )}
//               </div>
//             ))}
//           </div>
//         ) : (
//           <p className="text-[11px] text-gray-400 italic">No evidence files uploaded yet.</p>
//         )}
//       </div>

//       {!isLocked && (
//         <div className="mt-3 flex justify-end">
//           <button
//             onClick={() => onSave(kpi.id, actual, comment)}
//             className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
//           >
//             <Check className="h-3.5 w-3.5" /> Save Progress
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// // Sub-component for Manager Review Input Row
// // Sub-component for Manager Review Input Row
// function ManagerReviewRow({ kpi, isManager, isLocked, onSave }: any) {
//   const [actual, setActual] = useState(kpi.manager_actual || kpi.actual_value || '');
//   const [rating, setRating] = useState(kpi.manager_rating || 0);
//   const [comment, setComment] = useState(kpi.manager_comment || '');

//   return (
//     <div className="rounded-xl bg-white p-4 border border-gray-200 shadow-sm">
//       {/* Read-Only Employee Data Header */}
//       <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-3 bg-gray-50 p-3 rounded-lg">
//         <div>
//           <h5 className="font-bold text-gray-900">{kpi.name}</h5>
//           <p className="text-xs text-gray-600 mt-1"><strong className="text-gray-700">Emp Comment:</strong> {kpi.employee_comment || 'None'}</p>
          
//           {/* Show Evidence Links to Manager */}
//           {kpi.evidences && kpi.evidences.length > 0 && (
//             <div className="mt-2 flex gap-2 flex-wrap">
//               {kpi.evidences.map((ev: any) => (
//                 <a
//                   key={ev.id}
//                   href={ev.file}
//                   target="_blank"
//                   rel="noreferrer"
//                   className="flex items-center gap-1 rounded bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:underline"
//                 >
//                   <FileText className="h-3 w-3" /> View Evidence
//                 </a>
//               ))}
//             </div>
//           )}
//         </div>
//         <div className="text-right">
//           <div className="text-xs text-gray-500">Target: {kpi.target_value}</div>
//           <div className="text-xs text-gray-500">Emp Actual: <strong className="text-gray-900">{kpi.actual_value || '0'}</strong></div>
//           {kpi.achievement_percentage !== null && (
//             <div className="text-sm font-bold text-emerald-600 mt-1">Achieved: {kpi.achievement_percentage}%</div>
//           )}
//         </div>
//       </div>

//       {/* Manager Inputs */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//         {/* 1. Manager Actual */}
//         <div>
//           <label className="text-[10px] font-bold text-gray-700 uppercase">Manager Verified Actual</label>
//           <input
//             type="text"
//             placeholder="e.g. 34"
//             value={actual}
//             onChange={(e) => setActual(e.target.value)}
//             disabled={!isManager || isLocked}
//             className="w-full mt-1 border border-gray-200 rounded-lg p-2 text-xs focus:border-indigo-500 focus:outline-none"
//           />
//         </div>

//         {/* 2. Manager Rating */}
//         <div>
//           <label className="text-[10px] font-bold text-gray-700 uppercase">Manager Rating (1-5)</label>
//           <div className="flex gap-1 mt-1">
//             {[1, 2, 3, 4, 5].map((n) => (
//               <button
//                 key={n}
//                 disabled={!isManager || isLocked}
//                 onClick={() => setRating(n)}
//                 className={`h-8 w-8 rounded-lg font-bold text-xs border transition ${
//                   rating >= n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-indigo-300'
//                 }`}
//               >
//                 {n}
//               </button>
//             ))}
//           </div>
//         </div>
        
//         {/* 3. Manager Comment */}
//         <div>
//           <label className="text-[10px] font-bold text-gray-700 uppercase">Manager Comment</label>
//           <textarea
//             placeholder="Feedback on this KPI..."
//             value={comment}
//             onChange={(e) => setComment(e.target.value)}
//             disabled={!isManager || isLocked}
//             rows={2}
//             className="w-full mt-1 border border-gray-200 rounded-lg p-2 text-xs focus:border-indigo-500 focus:outline-none"
//           />
//         </div>
//       </div>

//       {isManager && !isLocked && (
//         <div className="mt-3 flex justify-end">
//           <button
//             // Pass ALL 3 fields back to the save handler!
//             onClick={() => onSave(kpi.id, actual, rating, comment)}
//             className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
//           >
//             Save Review
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// // Sub-component for Annual Overview Tab
// function AnnualOverviewTab({ annualPlan }: { annualPlan: AnnualPerformancePlanDetail }) {
//   return (
//     <div className="space-y-6">
//       <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
//         <h3 className="text-lg font-bold text-gray-900">Quarterly Breakdown ({annualPlan.financial_year})</h3>
//         <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
//           {annualPlan.quarterly_reviews.map((qr) => (
//             <div key={qr.id} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
//               <div className="flex items-center justify-between">
//                 <span className="font-bold text-gray-900">{qr.quarter}</span>
//                 <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
//                   {qr.status}
//                 </span>
//               </div>
//               <div className="mt-3 text-2xl font-extrabold text-indigo-600">
//                 {qr.quarterly_score !== null ? `${qr.quarterly_score}%` : '—'}
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }

// // Sub-component for Nominate Peers Modal
// function NominatePeersModal({
//   kra,
//   excludeEmployeeId,
//   onClose,
//   onSuccess,
// }: {
//   kra: MonthlyKRA;
//   excludeEmployeeId: string;
//   onClose: () => void;
//   onSuccess: () => void;
// }) {
//   const [employees, setEmployees] = useState<ManagerOption[]>([]);
//   const [selectedIds, setSelectedIds] = useState<string[]>([]);
//   const [search, setSearch] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);

//   useEffect(() => {
//     employeesApi.getManagers(search).then((data) => {
//       setEmployees(data.filter((e) => e.id !== excludeEmployeeId));
//       setLoading(false);
//     });
//   }, [search, excludeEmployeeId]);

//   const toggleSelect = (id: string) => {
//     setSelectedIds((prev) =>
//       prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
//     );
//   };

//   const handleNominate = async () => {
//     if (selectedIds.length === 0) return toast.error('Please select at least one peer');
//     setSubmitting(true);
//     try {
//       await peerNominationsApi.nominate({
//         monthly_kra_id: kra.id,
//         peer_ids: selectedIds,
//       });
//       toast.success('Peers nominated successfully');
//       onSuccess();
//     } catch {
//       toast.error('Failed to nominate peers');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//       <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
//         <div className="flex items-center justify-between border-b pb-3">
//           <h3 className="font-bold text-gray-900">Nominate Peers for "{kra.name}"</h3>
//           <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
//         </div>

//         <input
//           type="text"
//           placeholder="Search peers..."
//           value={search}
//           onChange={(e) => setSearch(e.target.value)}
//           className="w-full rounded-xl border p-2.5 text-xs"
//         />

//         <div className="max-h-60 overflow-y-auto space-y-2">
//           {loading ? (
//             <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
//           ) : (
//             employees.map((emp) => (
//               <label
//                 key={emp.id}
//                 className="flex items-center justify-between p-2.5 rounded-xl border hover:bg-gray-50 cursor-pointer text-xs"
//               >
//                 <div>
//                   <p className="font-bold text-gray-900">{emp.full_name}</p>
//                   <p className="text-gray-500">{emp.official_email}</p>
//                 </div>
//                 <input
//                   type="checkbox"
//                   checked={selectedIds.includes(emp.id)}
//                   onChange={() => toggleSelect(emp.id)}
//                   className="h-4 w-4 rounded text-pink-600"
//                 />
//               </label>
//             ))
//           )}
//         </div>

//         <div className="flex justify-end gap-2 border-t pt-3">
//           <button onClick={onClose} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
//           <button
//             onClick={handleNominate}
//             disabled={submitting || selectedIds.length === 0}
//             className="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold"
//           >
//             {submitting ? 'Saving...' : `Nominate ${selectedIds.length} Peer(s)`}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


// // Sub-component to display Peer Ratings & Comments for Peer-Rated KRAs
// function PeerFeedbackSummaryCard({ kra }: { kra: MonthlyKRA }) {
//   if (!kra.peer_rating_required) return null;

//   const nominations = kra.peer_nominations || [];
//   const submitted = nominations.filter((n) => n.rating && n.rating.status === 'SUBMITTED');
//   const pending = nominations.filter((n) => !n.rating || n.rating.status === 'PENDING');
//   const declined = nominations.filter((n) => n.rating && n.rating.status === 'DECLINED');

//   const ratingsWithScore = submitted
//     .map((n) => n.rating?.rating)
//     .filter((r): r is number => r !== null && r !== undefined);

//   const avgScore =
//     ratingsWithScore.length > 0
//       ? (ratingsWithScore.reduce((a, b) => a + b, 0) / ratingsWithScore.length).toFixed(1)
//       : null;

//   return (
//     <div className="mt-3 rounded-xl border border-pink-200 bg-pink-50/60 p-4 text-xs">
//       <div className="flex items-center justify-between border-b border-pink-200 pb-2 mb-3">
//         <span className="flex items-center gap-1.5 font-bold text-pink-900">
//           <Star className="h-4 w-4 fill-pink-600 text-pink-600" />
//           Peer Feedback Summary ({submitted.length}/{nominations.length} Submitted)
//         </span>
//         {avgScore && (
//           <span className="rounded-full bg-pink-600 px-3 py-0.5 text-xs font-bold text-white">
//             Avg Rating: {avgScore} / 5 ★
//           </span>
//         )}
//       </div>

//       {nominations.length === 0 ? (
//         <p className="italic text-pink-700">
//           ⚠️ No peers nominated yet. Click <strong>"Select Peers"</strong> above to assign peers.
//         </p>
//       ) : (
//         <div className="space-y-2">
//           {nominations.map((nom) => (
//             <div key={nom.id} className="rounded-lg bg-white p-3 border border-pink-100 shadow-sm">
//               <div className="flex items-center justify-between">
//                 <span className="font-bold text-gray-900">
//                   {nom.peer_name} <span className="text-gray-400 font-normal">({nom.peer_employee_id})</span>
//                 </span>
//                 {nom.rating?.status === 'SUBMITTED' ? (
//                   <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
//                     Submitted: {nom.rating.rating} / 5 ★
//                   </span>
//                 ) : nom.rating?.status === 'DECLINED' ? (
//                   <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600">
//                     Declined
//                   </span>
//                 ) : (
//                   <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800">
//                     Pending
//                   </span>
//                 )}
//               </div>

//               {/* Confidential Peer Feedback Comments */}
//               {nom.rating?.status === 'SUBMITTED' && (
//                 <div className="mt-2 space-y-1 text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
//                   {nom.rating.strengths_comment && (
//                     <p>
//                       <strong className="text-emerald-700">Feedback:</strong> {nom.rating.strengths_comment}
//                     </p>
//                   )}
//                   {nom.rating.improvements_comment && (
//                     <p>
//                       <strong className="text-amber-700">Improvements:</strong> {nom.rating.improvements_comment}
//                     </p>
//                   )}
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }



import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar, CheckCircle2, Clock, AlertCircle, FileText,
  Target, Award, ArrowLeft, Plus, ChevronDown, ChevronRight,
  Send, Trash2, Edit2, Upload, Lock, ShieldCheck, Sparkles,
  TrendingUp, User, Building2, Info, Loader2, FileSpreadsheet,
  AlertTriangle, RefreshCw, Star, Users2, X, Search, Check,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { useAuth } from '../../context/AuthContext';
import {
  annualPlansApi,
  monthlyPlansApi,
  monthlyKRAsApi,
  monthlyKPIsApi,
  peerNominationsApi,
  carryForwardApi,
} from '../../api/performance';
import { employeesApi, type ManagerOption } from '../../api/employees';
import type {
  AnnualPerformancePlanDetail,
  MonthlyPerformancePlan,
  MonthlyKRA,
  MonthlyKPI,
  MonthlyPlanStatus,
  CarryForwardRecord,
} from '../../types/performance';
import toast from 'react-hot-toast';

// Financial Year Month Order (April to March)
const MONTH_SEQUENCE = [
  { num: 4, name: 'Apr', label: 'April', quarter: 'Q1' },
  { num: 5, name: 'May', label: 'May', quarter: 'Q1' },
  { num: 6, name: 'Jun', label: 'June', quarter: 'Q1' },
  { num: 7, name: 'Jul', label: 'July', quarter: 'Q2' },
  { num: 8, name: 'Aug', label: 'August', quarter: 'Q2' },
  { num: 9, name: 'Sep', label: 'September', quarter: 'Q2' },
  { num: 10, name: 'Oct', label: 'October', quarter: 'Q3' },
  { num: 11, name: 'Nov', label: 'November', quarter: 'Q3' },
  { num: 12, name: 'Dec', label: 'December', quarter: 'Q3' },
  { num: 1, name: 'Jan', label: 'January', quarter: 'Q4' },
  { num: 2, name: 'Feb', label: 'February', quarter: 'Q4' },
  { num: 3, name: 'Mar', label: 'March', quarter: 'Q4' },
];

const STATUS_BADGES: Record<MonthlyPlanStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  OPEN: { label: 'Open', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  REVIEW_DUE: { label: 'Review Due', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  EMPLOYEE_SUBMITTED: { label: 'Submitted', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  UNDER_REVIEW: { label: 'Under Review', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  RETURNED: { label: 'Returned', color: 'bg-red-50 text-red-700 border-red-200' },
  APPROVED: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Closed ✓', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
};

export default function AnnualPerformancePlanPage() {
  const { planId } = useParams<{ planId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [annualPlan, setAnnualPlan] = useState<AnnualPerformancePlanDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Selections
  const [activeMonthNum, setActiveMonthNum] = useState<number>(4);
  const [activeTab, setActiveTab] = useState<
    'PLAN' | 'KRAS' | 'TARGETS' | 'PROGRESS' | 'REVIEW' | 'CARRY' | 'SCORE'
  >('KRAS');

  // Add/Edit KRA State
  const [showAddKraModal, setShowAddKraModal] = useState(false);
  const [editingKra, setEditingKra] = useState<MonthlyKRA | null>(null);
  const [newKraName, setNewKraName] = useState('');
  const [newKraWeight, setNewKraWeight] = useState('20');
  const [newKraDesc, setNewKraDesc] = useState('');
  const [newKraPeerRequired, setNewKraPeerRequired] = useState(false);
  const [submittingKra, setSubmittingKra] = useState(false);

  // Peer Selection Modal
  const [peerNominateKra, setPeerNominateKra] = useState<MonthlyKRA | null>(null);

  // Add/Edit KPI State
  const [addingKpiKraId, setAddingKpiKraId] = useState<string | null>(null);
  const [editingKpiObj, setEditingKpiObj] = useState<MonthlyKPI | null>(null);
  const [newKpiName, setNewKpiName] = useState('');
  const [newKpiTarget, setNewKpiTarget] = useState('');
  const [newKpiType, setNewKpiType] = useState<'NUMERIC_UP' | 'PERCENTAGE' | 'BOOLEAN'>('NUMERIC_UP');
  const [newKpiWeight, setNewKpiWeight] = useState('100');
  const [submittingKpi, setSubmittingKpi] = useState(false);

  // Carry Forward State
  const [carryForwards, setCarryForwards] = useState<CarryForwardRecord[]>([]);
  const [loadingCarryForwards, setLoadingCarryForwards] = useState(false);
  const [selectedShortfallKpi, setSelectedShortfallKpi] = useState<MonthlyKPI | null>(null);
  const [shortfallAmountInput, setShortfallAmountInput] = useState('');
  const [carryReasonInput, setCarryReasonInput] = useState('');
  const [submittingCarry, setSubmittingCarry] = useState(false);

  const loadPlan = async () => {
    setLoading(true);
    try {
      let data: AnnualPerformancePlanDetail;
      if (planId) {
        data = await annualPlansApi.getById(planId);
      } else {
        data = await annualPlansApi.getMyPlan('2026-27');
      }
      setAnnualPlan(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setAnnualPlan(null);
      } else {
        toast.error(err.response?.data?.detail || 'Failed to load Annual Performance Plan');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCarryForwards = async () => {
    if (!annualPlan) return;
    setLoadingCarryForwards(true);
    try {
      const records = await carryForwardApi.list(annualPlan.id);
      setCarryForwards(records);
    } catch {
      // ignore
    } finally {
      setLoadingCarryForwards(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, [planId]);

  useEffect(() => {
    if (activeTab === 'CARRY' && annualPlan) {
      loadCarryForwards();
    }
  }, [activeTab, annualPlan?.id]);

  const currentMonthlyPlan = useMemo(() => {
    if (!annualPlan) return null;
    for (const qr of annualPlan.quarterly_reviews) {
      const match = qr.monthly_plans.find((m) => m.month === activeMonthNum);
      if (match) return match;
    }
    return null;
  }, [annualPlan, activeMonthNum]);

  // Weight Validation
  const weightValidation = useMemo(() => {
    if (!currentMonthlyPlan) return { isValid: false, errors: [] };

    const errors: string[] = [];

    const totalKraWeight = currentMonthlyPlan.kras.reduce(
      (sum, kra) => sum + Number(kra.weight), 0
    );
    if (Math.abs(totalKraWeight - 100) > 0.01) {
      errors.push(`Total KRA weight must equal 100% (currently ${totalKraWeight}%).`);
    }

    currentMonthlyPlan.kras.forEach((kra) => {
      if (kra.kpis.length === 0) {
        errors.push(`KRA "${kra.name}" has no KPIs assigned.`);
      } else {
        const totalKpiWeight = kra.kpis.reduce(
          (sum, kpi) => sum + Number(kpi.weight_in_kra), 0
        );
        if (Math.abs(totalKpiWeight - 100) > 0.01) {
          errors.push(`KPI weights in KRA "${kra.name}" must equal 100% (currently ${totalKpiWeight}%).`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      totalKraWeight,
    };
  }, [currentMonthlyPlan]);

  const isHR = user?.role_codes.includes('HR_ADMIN') || user?.role_codes.includes('SYSTEM_ADMIN');
  const isManager = user?.role_codes.includes('MANAGER') || isHR;
  const isOwner = useMemo(() => {
    if (!annualPlan || !user?.employee?.id) return false;
    return annualPlan.employee === user.employee.id;
  }, [annualPlan, user?.employee?.id]);
  // KRA Handlers
  const handleSaveKRA = async () => {
    if (!currentMonthlyPlan || !newKraName.trim()) return;
    setSubmittingKra(true);
    try {
      if (editingKra) {
        await monthlyKRAsApi.update(editingKra.id, {
          name: newKraName.trim(),
          description: newKraDesc.trim(),
          weight: parseFloat(newKraWeight) || 0,
          peer_rating_required: newKraPeerRequired,
        });
        toast.success('KRA updated');
      } else {
        await monthlyKRAsApi.create({
          monthly_plan: currentMonthlyPlan.id,
          kra_type: 'INDIVIDUAL',
          name: newKraName.trim(),
          description: newKraDesc.trim(),
          weight: parseFloat(newKraWeight) || 0,
          peer_rating_required: newKraPeerRequired,
          kra_start_date: currentMonthlyPlan.month_start_date,
          kra_end_date: currentMonthlyPlan.month_end_date,
        });
        toast.success('Individual KRA added');
      }
      setShowAddKraModal(false);
      setEditingKra(null);
      setNewKraName('');
      setNewKraDesc('');
      setNewKraPeerRequired(false);
      loadPlan();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save KRA');
    } finally {
      setSubmittingKra(false);
    }
  };

  const handleDeleteKRA = async (kraId: string, kraName: string) => {
    if (!confirm(`Delete KRA "${kraName}"? This will delete all its KPIs as well.`)) return;
    try {
      await monthlyKRAsApi.delete(kraId);
      toast.success('KRA deleted');
      loadPlan();
    } catch {
      toast.error('Failed to delete KRA');
    }
  };

  // KPI Handlers
  const handleSaveKPI = async () => {
    if (!addingKpiKraId || !newKpiName.trim() || !newKpiTarget.trim()) return;
    setSubmittingKpi(true);
    try {
      if (editingKpiObj) {
        await monthlyKPIsApi.update(editingKpiObj.id, {
          name: newKpiName.trim(),
          target_value: newKpiTarget.trim(),
          metric_type: newKpiType,
          weight_in_kra: parseFloat(newKpiWeight) || 100,
        });
        toast.success('KPI & Weight updated');
      } else {
        await monthlyKPIsApi.create({
          monthly_kra: addingKpiKraId,
          name: newKpiName.trim(),
          target_value: newKpiTarget.trim(),
          metric_type: newKpiType,
          weight_in_kra: parseFloat(newKpiWeight) || 100,
        });
        toast.success('KPI added');
      }
      setAddingKpiKraId(null);
      setEditingKpiObj(null);
      setNewKpiName('');
      setNewKpiTarget('');
      setNewKpiWeight('100');
      loadPlan();
    } catch {
      toast.error('Failed to save KPI');
    } finally {
      setSubmittingKpi(false);
    }
  };

  const handleDeleteKPI = async (kpiId: string, kpiName: string) => {
    if (!confirm(`Delete KPI "${kpiName}"?`)) return;
    try {
      await monthlyKPIsApi.delete(kpiId);
      toast.success('KPI deleted');
      loadPlan();
    } catch {
      toast.error('Failed to delete KPI');
    }
  };

  const handleSaveActual = async (kpiId: string, actual: string, comment: string) => {
    try {
      await monthlyKPIsApi.update(kpiId, {
        actual_value: actual,
        employee_comment: comment,
      });
      toast.success('Progress saved');
      loadPlan();
    } catch {
      toast.error('Failed to save progress');
    }
  };

  const handleSaveManagerReview = async (kpiId: string, actual: string, rating: number, comment: string) => {
    try {
      await monthlyKPIsApi.update(kpiId, {
        manager_actual: actual,
        manager_rating: rating,
        manager_comment: comment,
      });
      toast.success('Manager review saved');
      loadPlan();
    } catch {
      toast.error('Failed to save review');
    }
  };

  const handleUpdateStatus = async (newStatus: MonthlyPlanStatus) => {
    if (!currentMonthlyPlan) return;
    try {
      await monthlyPlansApi.update(currentMonthlyPlan.id, { status: newStatus });
      toast.success(`Plan status updated to ${newStatus}`);
      loadPlan();
    } catch {
      toast.error('Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (!annualPlan) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="mt-4 text-xl font-bold text-gray-900">No Annual Plan Found</h2>
            <p className="mt-2 text-sm text-gray-500">
              An annual performance plan has not been generated for FY 2026-27 yet.
            </p>
            {isManager && (
              <button
                onClick={() => navigate('/performance/annual-plans')}
                className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700"
              >
                Go to Plans Directory & Generate
              </button>
            )}
          </main>
        </div>
      </div>
    );
  }

  const totalMonthlyKpis = currentMonthlyPlan
    ? currentMonthlyPlan.kras.reduce((sum, kra) => sum + kra.kpis.length, 0)
    : 0;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Header Card */}
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="rounded-xl border p-2 hover:bg-gray-100">
                  <ArrowLeft className="h-5 w-5 text-gray-500" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      Annual Performance Plan ({annualPlan.financial_year})
                    </h1>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
                      {annualPlan.status_display}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Employee: <strong className="text-gray-900">{annualPlan.employee_name}</strong> ({annualPlan.employee_id_display})
                  </p>
                </div>
              </div>

              {annualPlan.annual_score !== null && (
                <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white shadow-sm">
                  <Award className="h-8 w-8" />
                  <div>
                    <div className="text-xs font-medium uppercase opacity-90">Annual Score</div>
                    <div className="text-2xl font-bold">{annualPlan.annual_score}%</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MONTH SELECTOR BAR */}
          <div className="mb-6 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-2 min-w-max">
              <button
                onClick={() => setActiveMonthNum(0)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  activeMonthNum === 0
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Target className="h-4 w-4" />
                Annual View
              </button>

              <div className="h-6 w-px bg-gray-200" />

              {MONTH_SEQUENCE.map((m) => {
                const isActive = activeMonthNum === m.num;
                let mPlan: MonthlyPerformancePlan | undefined;
                for (const qr of annualPlan.quarterly_reviews) {
                  const found = qr.monthly_plans.find((mp) => mp.month === m.num);
                  if (found) { mPlan = found; break; }
                }
                const badge = mPlan ? STATUS_BADGES[mPlan.status] : null;

                return (
                  <button
                    key={m.num}
                    onClick={() => setActiveMonthNum(m.num)}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                      isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{m.name}</span>
                    {badge && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${isActive ? 'bg-white/20 text-white' : badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ANNUAL VIEW TAB */}
          {activeMonthNum === 0 ? (
            <AnnualOverviewTab annualPlan={annualPlan} />
          ) : (
            /* MONTHLY WORKFLOW TABS */
            <div className="space-y-6">
              {/* Tab Navigation */}
              <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                {[
                  { id: 'KRAS', label: 'KRA & KPI', icon: Target },
                  { id: 'TARGETS', label: 'Targets', icon: Calendar },
                  { id: 'PROGRESS', label: 'Progress', icon: TrendingUp },
                  { id: 'REVIEW', label: 'Review', icon: CheckCircle2 },
                  { id: 'PLAN', label: 'Plan Info', icon: FileText },
                  { id: 'CARRY', label: 'Carry Forward', icon: RefreshCw },
                  { id: 'SCORE', label: 'Monthly Score', icon: Award },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isTabActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                        isTabActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: KRA & KPI CONFIGURATION */}
              {activeTab === 'KRAS' && currentMonthlyPlan && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Monthly KRA & KPI Assignments ({MONTH_SEQUENCE.find(m => m.num === activeMonthNum)?.label})
                      </h3>
                      <p className="text-xs text-gray-500">
                        Manage KRA weights and define KPI targets.
                      </p>
                    </div>

                   {(isManager || isOwner) && !currentMonthlyPlan.is_locked && (
                      <button
                        onClick={() => {
                          setEditingKra(null);
                          setNewKraName('');
                          setNewKraDesc('');
                          setNewKraWeight('20');
                          setNewKraPeerRequired(false);
                          setShowAddKraModal(true);
                        }}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
                      >
                        <Plus className="h-4 w-4" /> Add Individual KRA
                      </button>
                    )}
                  </div>

                  {currentMonthlyPlan.kras.length === 0 ? (
                    <div className="rounded-2xl bg-white p-12 text-center shadow-sm border text-gray-500">
                      <Target className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                      <p className="font-bold text-gray-900">No KRAs Assigned For This Month</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {['COMMON', 'DEPARTMENTAL', 'INDIVIDUAL'].map((type) => {
                        const filteredKras = currentMonthlyPlan.kras.filter((k) => k.kra_type === type);
                        if (filteredKras.length === 0 && type !== 'INDIVIDUAL') return null;

                        const typeLabels: Record<string, { label: string; badge: string }> = {
                          COMMON: { label: '📘 Common KRAs (Company-Wide)', badge: 'bg-blue-100 text-blue-800' },
                          DEPARTMENTAL: { label: '🏢 Departmental KRAs', badge: 'bg-purple-100 text-purple-800' },
                          INDIVIDUAL: { label: '👤 Individual Custom KRAs', badge: 'bg-indigo-100 text-indigo-800' },
                        };

                        return (
                          <div key={type} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
                              <h4 className="text-base font-bold text-gray-900">{typeLabels[type].label}</h4>
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${typeLabels[type].badge}`}>
                                {filteredKras.length} Assigned
                              </span>
                            </div>

                            {filteredKras.length === 0 ? (
                              <p className="text-xs italic text-gray-400">No individual KRAs added for this month yet.</p>
                            ) : (
                              <div className="space-y-4">
                                {filteredKras.map((kra) => {
                                  const kpiWeightSum = kra.kpis.reduce((sum, kpi) => sum + Number(kpi.weight_in_kra), 0);
                                  const isValidKpiWeight = Math.abs(kpiWeightSum - 100) < 0.01;

                                  return (
                                    <div key={kra.id} className="rounded-xl border border-gray-200 p-4 hover:border-indigo-300">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <h5 className="font-bold text-gray-900">{kra.name}</h5>
                                            {kra.peer_rating_required && (
                                              <span className="flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-bold text-pink-700">
                                                <Star className="h-3 w-3 fill-current" /> Peer Rating Required
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-gray-500 mt-1">{kra.description}</p>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                          <div className="flex items-center gap-2">
                                            <span className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                                              KRA Weight: {kra.weight}%
                                            </span>

                                            {/* KPI Weight Balance Badge */}
                                            <span
                                              className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${
                                                kra.kpis.length === 0
                                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                  : isValidKpiWeight
                                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                  : 'bg-red-50 text-red-700 border-red-200'
                                              }`}
                                            >
                                              {kra.kpis.length === 0
                                                ? '⚠️ No KPIs'
                                                : isValidKpiWeight
                                                ? 'KPI Weights: 100% ✓'
                                                : `⚠️ KPI Weights: ${kpiWeightSum}%`}
                                            </span>

                                            {/* Edit / Delete KRA Buttons */}
                                           {(isManager || isOwner) && !currentMonthlyPlan.is_locked && (
                                              <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
                                                <button
                                                  onClick={() => {
                                                    setEditingKra(kra);
                                                    setNewKraName(kra.name);
                                                    setNewKraDesc(kra.description);
                                                    setNewKraWeight(kra.weight.toString());
                                                    setNewKraPeerRequired(kra.peer_rating_required);
                                                    setShowAddKraModal(true);
                                                  }}
                                                  className="p-1.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"
                                                  title="Edit KRA"
                                                >
                                                  <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteKRA(kra.id, kra.name)}
                                                  className="p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg"
                                                  title="Delete KRA"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </button>
                                              </div>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-2">
                                            {kra.peer_rating_required && isManager && (
                                              <button
                                                onClick={() => setPeerNominateKra(kra)}
                                                className="flex items-center gap-1 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-pink-700"
                                              >
                                                <Users2 className="h-3.5 w-3.5" /> Select Peers
                                              </button>
                                            )}

                                            {(isManager || isOwner) && !currentMonthlyPlan.is_locked && (
                                              <button
                                                onClick={() => {
                                                  setAddingKpiKraId(kra.id);
                                                  setEditingKpiObj(null);
                                                  setNewKpiName('');
                                                  setNewKpiTarget('');
                                                  setNewKpiType('NUMERIC_UP');
                                                  setNewKpiWeight('100');
                                                }}
                                                className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100"
                                              >
                                                <Plus className="h-3.5 w-3.5" /> Add KPI
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Peer Feedback Summary Box */}
                                      <PeerFeedbackSummaryCard kra={kra} />

                                      {/* KPIs List */}
                                      <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                                        {kra.kpis.length === 0 ? (
                                          <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                                            <span>⚠️ No KPIs added under this KRA yet. Click <strong>+ Add KPI</strong>.</span>
                                          </div>
                                        ) : (
                                          kra.kpis.map((kpi) => (
                                            <div key={kpi.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-xs group hover:bg-gray-100">
                                              <div>
                                                <span className="font-semibold text-gray-900">{kpi.name}</span>
                                                <span className="ml-2 text-gray-500">({kpi.metric_type})</span>
                                              </div>
                                              <div className="flex items-center gap-3">
                                                <span className="font-bold text-indigo-600">Target: {kpi.target_value}</span>
                                                <span className="rounded bg-indigo-50 px-2 py-1 font-bold text-indigo-700">
                                                  Weight: {kpi.weight_in_kra}%
                                                </span>

                                                {/* Edit / Delete KPI Buttons */}
                                               {(isManager || isOwner) && !currentMonthlyPlan.is_locked && (
                                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 border-l pl-2 border-gray-200">
                                                    <button
                                                      onClick={() => {
                                                        setEditingKpiObj(kpi);
                                                        setAddingKpiKraId(kra.id);
                                                        setNewKpiName(kpi.name);
                                                        setNewKpiTarget(kpi.target_value);
                                                        setNewKpiType(kpi.metric_type as any);
                                                        setNewKpiWeight(kpi.weight_in_kra.toString());
                                                      }}
                                                      className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-white rounded"
                                                      title="Edit KPI & Weight"
                                                    >
                                                      <Edit2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                      onClick={() => handleDeleteKPI(kpi.id, kpi.name)}
                                                      className="p-1 text-gray-500 hover:text-red-600 hover:bg-white rounded"
                                                      title="Delete KPI"
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TARGETS */}
              {activeTab === 'TARGETS' && currentMonthlyPlan && (
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Monthly Targets Summary</h3>
                  {totalMonthlyKpis === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                      <Target className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                      <p className="font-semibold text-gray-700">No KPIs Configured for this Month</p>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
                          <tr>
                            <th className="p-3">KRA</th>
                            <th className="p-3">KPI Name</th>
                            <th className="p-3">Metric Type</th>
                            <th className="p-3">Target Value</th>
                            <th className="p-3">KPI Weightage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {currentMonthlyPlan.kras.flatMap((kra) =>
                            kra.kpis.map((kpi) => (
                              <tr key={kpi.id}>
                                <td className="p-3 font-semibold text-gray-900">{kra.name}</td>
                                <td className="p-3 text-gray-700">{kpi.name}</td>
                                <td className="p-3 text-gray-500">{kpi.metric_type}</td>
                                <td className="p-3 font-bold text-indigo-600">{kpi.target_value}</td>
                                <td className="p-3 font-bold text-indigo-700">{kpi.weight_in_kra}%</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PROGRESS */}
              {activeTab === 'PROGRESS' && currentMonthlyPlan && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">Enter Monthly Achievements</h3>
                    <p className="text-xs text-gray-500">
                      Update your actual numbers and notes for this month before submitting for review.
                    </p>
                  </div>

                  {totalMonthlyKpis === 0 ? (
                    <div className="rounded-2xl bg-white p-12 text-center shadow-sm text-sm text-gray-500">
                      <p className="font-semibold text-gray-700">No Measurable KPIs Available</p>
                    </div>
                  ) : (
                    currentMonthlyPlan.kras.map((kra) => (
                      <div key={kra.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                        <h4 className="font-bold text-gray-900">{kra.name}</h4>
                        <div className="mt-4 space-y-4">
                          {kra.kpis.map((kpi) => (
                            <ProgressInputRow
                              key={kpi.id}
                              kpi={kpi}
                              isLocked={currentMonthlyPlan.is_locked}
                              onSave={handleSaveActual}
                              onUploadSuccess={loadPlan}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: REVIEW */}
              {activeTab === 'REVIEW' && currentMonthlyPlan && (
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Monthly Review & Verification</h3>
                  <p className="text-xs text-gray-500 mb-4">Manager verifies employee progress, leaves comments, and provides a rating.</p>

                  {totalMonthlyKpis === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                      <p className="font-semibold text-gray-700">No KPIs to Review</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {currentMonthlyPlan.kras.map((kra) => (
                        <div key={kra.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between font-bold text-gray-900 mb-3">
                            <span>{kra.name}</span>
                            <span className="text-sm rounded-lg bg-indigo-100 text-indigo-700 px-3 py-1">
                              KRA Score: {kra.kra_score || 0}%
                            </span>
                          </div>

                          <PeerFeedbackSummaryCard kra={kra} />

                          <div className="space-y-3 mt-3">
                            {kra.kpis.map((kpi) => (
                              <ManagerReviewRow
                                key={kpi.id}
                                kpi={kpi}
                                isManager={isManager}
                                isLocked={currentMonthlyPlan.is_locked}
                                onSave={handleSaveManagerReview}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: PLAN INFO */}
              {activeTab === 'PLAN' && currentMonthlyPlan && (
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Monthly Plan Details & Lifecycle</h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Period</span>
                      <p className="mt-1 text-sm font-bold text-gray-900">
                        {currentMonthlyPlan.month_start_date} to {currentMonthlyPlan.month_end_date}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
                      <p className="mt-1 text-sm font-bold text-indigo-600">
                        {currentMonthlyPlan.status_display || currentMonthlyPlan.status}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Monthly Score</span>
                      <p className="mt-1 text-sm font-bold text-emerald-600">
                        {currentMonthlyPlan.monthly_score !== null ? `${currentMonthlyPlan.monthly_score}%` : 'Not computed yet'}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Weight Validation Warning */}
                  <div className="mt-6 border-t border-gray-100 pt-6 flex flex-col gap-4">
                    {currentMonthlyPlan.status === 'DRAFT' && isManager && (
                      <div>
                        <button
                          onClick={() => handleUpdateStatus('OPEN')}
                          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700"
                        >
                          Open Plan for Working
                        </button>
                      </div>
                    )}

                    {(currentMonthlyPlan.status === 'OPEN' || currentMonthlyPlan.status === 'DRAFT') && (
                      <div className="space-y-2">
                        <button
                          onClick={() => handleUpdateStatus('EMPLOYEE_SUBMITTED')}
                          disabled={!weightValidation.isValid}
                          className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Submit Monthly Review to Manager
                        </button>

                        {!weightValidation.isValid && (
                          <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-xs text-red-700 space-y-1">
                            <p className="font-bold flex items-center gap-1 text-red-800">
                              <AlertCircle className="h-4 w-4" /> Please fix the following errors before submitting:
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 pl-1">
                              {weightValidation.errors.map((err, idx) => (
                                <li key={idx}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {isManager && currentMonthlyPlan.status === 'EMPLOYEE_SUBMITTED' && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleUpdateStatus('APPROVED')}
                          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700"
                        >
                          Approve Monthly Plan
                        </button>
                        <button
                          onClick={() => handleUpdateStatus('RETURNED')}
                          className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-700"
                        >
                          Return for Revision
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: CARRY FORWARD */}
              {activeTab === 'CARRY' && currentMonthlyPlan && (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                    <div className="flex items-start gap-3">
                      <RefreshCw className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Carry Forward Management</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Transfer incomplete targets from this month to the next month.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                    <h4 className="font-bold text-gray-900 text-sm mb-3">
                      Incomplete KPIs for {MONTH_SEQUENCE.find((m) => m.num === activeMonthNum)?.label}
                    </h4>

                    {currentMonthlyPlan.kras.flatMap((k) => k.kpis).length === 0 ? (
                      <p className="text-xs italic text-gray-400">No KPIs in this month.</p>
                    ) : (
                      <div className="space-y-2">
                        {currentMonthlyPlan.kras.flatMap((kra) =>
                          kra.kpis.map((kpi) => {
                            const targetNum = parseFloat(kpi.target_value) || 0;
                            const actualNum = parseFloat(kpi.actual_value) || 0;
                            const defaultShortfall = targetNum > actualNum ? String(targetNum - actualNum) : '0';

                            return (
                              <div
                                key={kpi.id}
                                className="flex flex-wrap items-center justify-between rounded-xl bg-gray-50 p-3.5 border border-gray-200 text-xs"
                              >
                                <div>
                                  <p className="font-bold text-gray-900">{kpi.name}</p>
                                  <p className="text-gray-500 text-[11px] mt-0.5">Under KRA: {kra.name}</p>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <span className="text-gray-500">Target: <strong>{kpi.target_value}</strong></span>
                                    <span className="mx-2 text-gray-300">|</span>
                                    <span className="text-gray-500">Actual: <strong>{kpi.actual_value || '0'}</strong></span>
                                  </div>

                                  <button
                                    onClick={() => {
                                      setSelectedShortfallKpi(kpi);
                                      setShortfallAmountInput(defaultShortfall);
                                      setCarryReasonInput('');
                                    }}
                                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
                                  >
                                    Carry Forward →
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                                    {/* SECTION 2: CARRY FORWARD REQUEST RECORDS TABLE */}
                  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                    <div className="flex items-center justify-between mb-4 border-b pb-3">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Carry Forward Audit Trail & Approvals</h4>
                        <p className="text-xs text-gray-500">
                          {isHR 
                            ? "HR Admin can approve any carry forward request." 
                            : "Managers can approve Employee requests. HR Admin approves Manager requests."}
                        </p>
                      </div>
                      <button
                        onClick={loadCarryForwards}
                        className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh List
                      </button>
                    </div>

                    {loadingCarryForwards ? (
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto py-4" />
                    ) : carryForwards.length === 0 ? (
                      <p className="text-xs text-center text-gray-400 py-6">
                        No carry forward requests submitted yet for this annual plan.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 uppercase text-gray-500 font-semibold">
                            <tr>
                              <th className="p-3">KRA Name</th>
                              <th className="p-3">KPI Target</th>
                              <th className="p-3">Period Transfer</th>
                              <th className="p-3">Shortfall</th>
                              <th className="p-3">Requested By</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {carryForwards.map((cf: any) => {
                              // Approval Permission Rule:
                              // - HR Admin can approve anything
                              // - Manager can approve if they didn't request it themselves
                              const canApproveThis = isHR || (isManager && cf.requested_by !== user?.employee?.id);

                              return (
                                <tr key={cf.id}>
                                  <td className="p-3">
                                    <p className="font-bold text-gray-900">{cf.source_kra_name || 'KRA'}</p>
                                    <p className="text-[11px] text-gray-500">{cf.reason || 'No reason provided'}</p>
                                  </td>
                                  <td className="p-3 font-semibold text-gray-800">
                                    {cf.source_kpi_name || 'KPI'}
                                  </td>
                                  <td className="p-3 text-gray-600 font-medium">
                                    {cf.source_month_name} → <strong className="text-indigo-600">{cf.destination_month_name}</strong>
                                  </td>
                                  <td className="p-3 font-extrabold text-red-600">{cf.shortfall_amount}</td>
                                  <td className="p-3 text-gray-700 font-medium">
                                    {cf.requested_by_name || 'Employee'}
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 font-bold text-[10px] ${
                                        cf.status === 'APPROVED'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : cf.status === 'REJECTED'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {cf.status}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right">
                                    {cf.status === 'PENDING' && (
                                      canApproveThis ? (
                                        <div className="flex justify-end gap-1">
                                          <button
                                            onClick={async () => {
                                              try {
                                                await carryForwardApi.approve(cf.id);
                                                toast.success('Approved! Target carried forward to next month.');
                                                loadCarryForwards();
                                                loadPlan();
                                              } catch (err: any) {
                                                toast.error(err.response?.data?.detail || 'Approval failed');
                                              }
                                            }}
                                            className="bg-emerald-600 text-white px-2.5 py-1 rounded text-[11px] font-bold hover:bg-emerald-700"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={async () => {
                                              try {
                                                await carryForwardApi.reject(cf.id);
                                                toast.success('Carry forward rejected.');
                                                loadCarryForwards();
                                              } catch {
                                                toast.error('Rejection failed');
                                              }
                                            }}
                                            className="bg-red-600 text-white px-2.5 py-1 rounded text-[11px] font-bold hover:bg-red-700"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] italic text-gray-400">
                                          Awaiting HR Approval
                                        </span>
                                      )
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 7: MONTHLY SCORE */}
              {activeTab === 'SCORE' && currentMonthlyPlan && (
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 text-center">
                  <Award className="mx-auto h-12 w-12 text-indigo-600" />
                  <h3 className="mt-2 text-xl font-bold text-gray-900">
                    Monthly Performance Rollup
                  </h3>
                  <div className="mt-4 text-4xl font-extrabold text-indigo-600">
                    {currentMonthlyPlan.monthly_score !== null ? `${currentMonthlyPlan.monthly_score}%` : '—'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODALS */}
          {/* {showAddKraModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingKra ? 'Edit Individual KRA' : 'Add Individual KRA'}
                </h3>
                <input
                  type="text"
                  placeholder="KRA Name"
                  value={newKraName}
                  onChange={(e) => setNewKraName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                />
                <textarea
                  placeholder="Description"
                  value={newKraDesc}
                  onChange={(e) => setNewKraDesc(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                />
                <input
                  type="number"
                  placeholder="Weight %"
                  value={newKraWeight}
                  onChange={(e) => setNewKraWeight(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                />
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={newKraPeerRequired}
                    onChange={(e) => setNewKraPeerRequired(e.target.checked)}
                    className="h-4 w-4 rounded text-pink-600"
                  />
                  Require Peer Rating for this KRA
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => { setShowAddKraModal(false); setEditingKra(null); }} className="px-4 py-2 border rounded-xl text-sm">Cancel</button>
                  <button onClick={handleSaveKRA} disabled={submittingKra} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">
                    {submittingKra ? 'Saving...' : editingKra ? 'Update KRA' : 'Add KRA'}
                  </button>
                </div>
              </div>
            </div>
          )} */}

          {showAddKraModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingKra ? 'Edit Individual KRA' : 'Add Individual KRA'}
                </h3>

                <div className="space-y-1.5">
                  <label htmlFor="kra-name" className="block text-sm font-medium text-gray-700">
                    KRA Name
                  </label>
                  <input
                    id="kra-name"
                    type="text"
                    placeholder="KRA Name"
                    value={newKraName}
                    onChange={(e) => setNewKraName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="kra-desc" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="kra-desc"
                    placeholder="Description"
                    value={newKraDesc}
                    onChange={(e) => setNewKraDesc(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="kra-weight" className="block text-sm font-medium text-gray-700">
                    Weight %
                  </label>
                  <input
                    id="kra-weight"
                    type="number"
                    placeholder="Weight %"
                    value={newKraWeight}
                    onChange={(e) => setNewKraWeight(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={newKraPeerRequired}
                    onChange={(e) => setNewKraPeerRequired(e.target.checked)}
                    className="h-4 w-4 rounded text-pink-600"
                  />
                  Require Peer Rating for this KRA
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => { setShowAddKraModal(false); setEditingKra(null); }} className="px-4 py-2 border rounded-xl text-sm">Cancel</button>
                  <button onClick={handleSaveKRA} disabled={submittingKra} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">
                    {submittingKra ? 'Saving...' : editingKra ? 'Update KRA' : 'Add KRA'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {addingKpiKraId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="text-lg font-bold text-gray-900">
                    {editingKpiObj ? 'Edit KPI & Weightage' : 'Add KPI Target'}
                  </h3>
                  <button onClick={() => { setAddingKpiKraId(null); setEditingKpiObj(null); }}>
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase">KPI Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Complete 40 story points"
                    value={newKpiName}
                    onChange={(e) => setNewKpiName(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-gray-300 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase">Target Value *</label>
                  <input
                    type="text"
                    placeholder="e.g. 40 or 90%"
                    value={newKpiTarget}
                    onChange={(e) => setNewKpiTarget(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-gray-300 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase">Metric Type</label>
                  <select
                    value={newKpiType}
                    onChange={(e) => setNewKpiType(e.target.value as any)}
                    className="w-full mt-1 rounded-xl border border-gray-300 p-3 text-sm"
                  >
                    <option value="NUMERIC_UP">Numeric (Higher is better)</option>
                    <option value="NUMERIC_DOWN">Numeric (Lower is better)</option>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="BOOLEAN">Yes / No</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase">
                    KPI Weightage in KRA (%) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="e.g. 50"
                    value={newKpiWeight}
                    onChange={(e) => setNewKpiWeight(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-gray-300 p-3 text-sm"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-2 pt-3 border-t">
                  <button
                    onClick={() => { setAddingKpiKraId(null); setEditingKpiObj(null); }}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveKPI}
                    disabled={submittingKpi}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submittingKpi ? 'Saving...' : editingKpiObj ? 'Update KPI' : 'Add KPI'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {peerNominateKra && (
            <NominatePeersModal
              kra={peerNominateKra}
              excludeEmployeeId={annualPlan.employee}
              onClose={() => setPeerNominateKra(null)}
              onSuccess={() => {
                setPeerNominateKra(null);
                loadPlan();
              }}
            />
          )}

          {selectedShortfallKpi && currentMonthlyPlan && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-bold text-gray-900 text-base">Request Carry Forward</h3>
                  <button onClick={() => setSelectedShortfallKpi(null)}>
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                </div>

                <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900">
                  <p className="font-bold">{selectedShortfallKpi.name}</p>
                  <p className="mt-0.5">
                    Target: {selectedShortfallKpi.target_value} | Actual Achieved:{' '}
                    {selectedShortfallKpi.actual_value || '0'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-gray-700">
                    Shortfall Amount to Carry Over *
                  </label>
                  <input
                    type="text"
                    value={shortfallAmountInput}
                    onChange={(e) => setShortfallAmountInput(e.target.value)}
                    placeholder="e.g. 6"
                    className="w-full mt-1 border border-gray-300 rounded-xl p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-gray-700">
                    Destination Month
                  </label>
                  <input
                    type="text"
                    disabled
                    value={
                      MONTH_SEQUENCE.find(
                        (m) =>
                          m.num ===
                          (activeMonthNum === 12 ? 1 : activeMonthNum === 3 ? 4 : activeMonthNum + 1)
                      )?.label || 'Next Month'
                    }
                    className="w-full mt-1 border border-gray-200 bg-gray-50 rounded-xl p-2.5 text-sm font-bold text-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-gray-700">Reason</label>
                  <textarea
                    value={carryReasonInput}
                    onChange={(e) => setCarryReasonInput(e.target.value)}
                    placeholder="Reason for shortfall"
                    rows={3}
                    className="w-full mt-1 border border-gray-300 rounded-xl p-2.5 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t pt-3">
                  <button
                    onClick={() => setSelectedShortfallKpi(null)}
                    className="px-4 py-2 border rounded-xl text-xs text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!shortfallAmountInput.trim()) return toast.error('Enter shortfall amount');
                      setSubmittingCarry(true);
                      try {
                        const sourceMonthName = MONTH_SEQUENCE.find((m) => m.num === activeMonthNum)?.label || 'Current';
                        const destMonthName = MONTH_SEQUENCE.find(
                          (m) => m.num === (activeMonthNum === 12 ? 1 : activeMonthNum === 3 ? 4 : activeMonthNum + 1)
                        )?.label || 'Next';

                        await carryForwardApi.create({
                          annual_plan: annualPlan.id,
                          source_kpi: selectedShortfallKpi.id,
                          source_month_name: sourceMonthName,
                          shortfall_amount: shortfallAmountInput.trim(),
                          destination_month_name: destMonthName,
                          reason: carryReasonInput.trim(),
                          requested_by: user?.employee?.id,
                        });
                        toast.success('Carry forward requested');
                        setSelectedShortfallKpi(null);
                        loadCarryForwards();
                      } catch {
                        toast.error('Request failed');
                      } finally {
                        setSubmittingCarry(false);
                      }
                    }}
                    disabled={submittingCarry}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow hover:bg-indigo-700"
                  >
                    {submittingCarry ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Sub-component for Peer Feedback Summary Box
function PeerFeedbackSummaryCard({ kra }: { kra: MonthlyKRA }) {
  if (!kra.peer_rating_required) return null;

  const nominations = kra.peer_nominations || [];
  const submitted = nominations.filter((n) => n.rating && n.rating.status === 'SUBMITTED');

  const ratingsWithScore = submitted
    .map((n) => n.rating?.rating)
    .filter((r): r is number => r !== null && r !== undefined);

  const avgScore =
    ratingsWithScore.length > 0
      ? (ratingsWithScore.reduce((a, b) => a + b, 0) / ratingsWithScore.length).toFixed(1)
      : null;

  return (
    <div className="mt-3 rounded-xl border border-pink-200 bg-pink-50/60 p-4 text-xs">
      <div className="flex items-center justify-between border-b border-pink-200 pb-2 mb-3">
        <span className="flex items-center gap-1.5 font-bold text-pink-900">
          <Star className="h-4 w-4 fill-pink-600 text-pink-600" />
          Peer Feedback Summary ({submitted.length}/{nominations.length} Submitted)
        </span>
        {avgScore && (
          <span className="rounded-full bg-pink-600 px-3 py-0.5 text-xs font-bold text-white">
            Avg Rating: {avgScore} / 5 ★
          </span>
        )}
      </div>

      {nominations.length === 0 ? (
        <p className="italic text-pink-700">
          ⚠️ No peers nominated yet. Click <strong>"Select Peers"</strong> above to assign peers.
        </p>
      ) : (
        <div className="space-y-2">
          {nominations.map((nom) => (
            <div key={nom.id} className="rounded-lg bg-white p-3 border border-pink-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">
                  {nom.peer_name} <span className="text-gray-400 font-normal">({nom.peer_employee_id})</span>
                </span>
                {nom.rating?.status === 'SUBMITTED' ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                    Submitted: {nom.rating.rating} / 5 ★
                  </span>
                ) : nom.rating?.status === 'DECLINED' ? (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600">
                    Declined
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800">
                    Pending
                  </span>
                )}
              </div>

              {nom.rating?.status === 'SUBMITTED' && (
                <div className="mt-2 space-y-1 text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                  {nom.rating.strengths_comment && (
                    <p>
                      <strong className="text-emerald-700">Feedback:</strong> {nom.rating.strengths_comment}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Sub-component for Progress Input Row
function ProgressInputRow({
  kpi,
  isLocked,
  onSave,
  onUploadSuccess,
}: {
  kpi: MonthlyKPI;
  isLocked: boolean;
  onSave: (id: string, actual: string, comment: string) => Promise<void> | void;
  onUploadSuccess: () => void;
}) {
  const [actual, setActual] = useState(kpi.actual_value || '');
  const [comment, setComment] = useState(kpi.employee_comment || '');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setActual(kpi.actual_value || '');
    setComment(kpi.employee_comment || '');
  }, [kpi.actual_value, kpi.employee_comment]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const hasUnsavedActual = actual !== (kpi.actual_value || '');
      const hasUnsavedComment = comment !== (kpi.employee_comment || '');

      if (hasUnsavedActual || hasUnsavedComment) {
        await onSave(kpi.id, actual, comment);
      }

      const fd = new FormData();
      fd.append('kpi', kpi.id);
      fd.append('file', file);
      fd.append('file_name', file.name);

      await monthlyKPIsApi.uploadEvidence(fd);
      toast.success('Evidence file uploaded');
      onUploadSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to upload evidence');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    if (!confirm('Delete this evidence file?')) return;
    try {
      await monthlyKPIsApi.deleteEvidence(evidenceId);
      toast.success('Evidence deleted');
      onUploadSuccess();
    } catch {
      toast.error('Failed to delete evidence');
    }
  };

  return (
    <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="font-bold text-gray-900">{kpi.name}</h5>
          <span className="text-xs text-indigo-600 font-semibold">Target: {kpi.target_value}</span>
        </div>
        {kpi.achievement_percentage !== null && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
            {kpi.achievement_percentage}% Achieved
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          type="text"
          placeholder="Actual Value achieved"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          disabled={isLocked}
          className="rounded-xl border border-gray-300 p-2.5 text-xs bg-white focus:border-indigo-500 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Your comments / notes"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isLocked}
          className="rounded-xl border border-gray-300 p-2.5 text-xs bg-white focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Attached Evidence Files Section */}
      <div className="mt-3 border-t border-gray-200 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-gray-500" /> Attached Evidence ({kpi.evidences?.length || 0})
          </span>

          {!isLocked && (
            <label className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100 cursor-pointer transition">
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? 'Saving & Uploading...' : 'Upload Evidence'}
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading || isLocked}
              />
            </label>
          )}
        </div>

        {kpi.evidences && kpi.evidences.length > 0 ? (
          <div className="space-y-1.5">
            {kpi.evidences.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-gray-200 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                  <a
                    href={ev.file}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-gray-900 truncate hover:text-indigo-600 hover:underline"
                  >
                    {ev.file_name}
                  </a>
                  <span className="text-gray-400 text-[10px]">({ev.file_size_kb} KB)</span>
                </div>

                {!isLocked && (
                  <button
                    onClick={() => handleDeleteEvidence(ev.id)}
                    className="text-gray-400 hover:text-red-600 p-1 rounded"
                    title="Delete Evidence"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 italic">No evidence files uploaded yet.</p>
        )}
      </div>

      {!isLocked && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onSave(kpi.id, actual, comment)}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
          >
            <Check className="h-3.5 w-3.5" /> Save Progress
          </button>
        </div>
      )}
    </div>
  );
}

// Sub-component for Manager Review Input Row
function ManagerReviewRow({ kpi, isManager, isLocked, onSave }: any) {
  const [actual, setActual] = useState(kpi.manager_actual || kpi.actual_value || '');
  const [rating, setRating] = useState(kpi.manager_rating || 0);
  const [comment, setComment] = useState(kpi.manager_comment || '');

  return (
    <div className="rounded-xl bg-white p-4 border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-3 bg-gray-50 p-3 rounded-lg">
        <div>
          <h5 className="font-bold text-gray-900">{kpi.name}</h5>
          <p className="text-xs text-gray-600 mt-1"><strong className="text-gray-700">Emp Comment:</strong> {kpi.employee_comment || 'None'}</p>
          
          {kpi.evidences && kpi.evidences.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {kpi.evidences.map((ev: any) => (
                <a
                  key={ev.id}
                  href={ev.file}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:underline"
                >
                  <FileText className="h-3 w-3" /> View Evidence
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Target: {kpi.target_value}</div>
          <div className="text-xs text-gray-500">Emp Actual: <strong className="text-gray-900">{kpi.actual_value || '0'}</strong></div>
          {kpi.achievement_percentage !== null && (
            <div className="text-sm font-bold text-emerald-600 mt-1">Achieved: {kpi.achievement_percentage}%</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-bold text-gray-700 uppercase">Manager Verified Actual</label>
          <input
            type="text"
            placeholder="e.g. 34"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            disabled={!isManager || isLocked}
            className="w-full mt-1 border border-gray-200 rounded-lg p-2 text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-700 uppercase">Manager Rating (1-5)</label>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                disabled={!isManager || isLocked}
                onClick={() => setRating(n)}
                className={`h-8 w-8 rounded-lg font-bold text-xs border transition ${
                  rating >= n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="text-[10px] font-bold text-gray-700 uppercase">Manager Comment</label>
          <input
            type="text"
            placeholder="Feedback on this KPI..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={!isManager || isLocked}
            className="w-full mt-1 border border-gray-200 rounded-lg p-2 text-xs"
          />
        </div>
      </div>

      {isManager && !isLocked && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onSave(kpi.id, actual, rating, comment)}
            className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
          >
            Save Review
          </button>
        </div>
      )}
    </div>
  );
}

// Sub-component for Annual Overview Tab
// Complete 12-Month Year-End Summary Dashboard Component
function AnnualOverviewTab({ annualPlan }: { annualPlan: AnnualPerformancePlanDetail }) {
  // Collect all 12 monthly plans across the 4 quarters
  const allMonths = MONTH_SEQUENCE.map((m) => {
    let mPlan: MonthlyPerformancePlan | undefined;
    for (const qr of annualPlan.quarterly_reviews) {
      const match = qr.monthly_plans.find((mp) => mp.month === m.num);
      if (match) {
        mPlan = match;
        break;
      }
    }
    return {
      num: m.num,
      name: m.name,
      label: m.label,
      quarter: m.quarter,
      plan: mPlan,
    };
  });

  const closedCount = allMonths.filter((m) => m.plan?.status === 'APPROVED' || m.plan?.status === 'CLOSED').length;

  return (
    <div className="space-y-6">
      {/* Top Annual Score Header Card */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
              Financial Year {annualPlan.financial_year} Summary
            </span>
            <h2 className="text-2xl font-extrabold mt-1">{annualPlan.employee_name}</h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              Completed Months: <strong>{closedCount} / 12</strong>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white/10 backdrop-blur p-4 text-center ring-1 ring-white/20 min-w-[120px]">
              <div className="text-xs font-semibold uppercase text-indigo-200">Annual Score</div>
              <div className="text-3xl font-black text-amber-300">
                {annualPlan.annual_score !== null ? `${annualPlan.annual_score}%` : '—'}
              </div>
            </div>

            {annualPlan.annual_rating && (
              <div className="rounded-xl bg-white/10 backdrop-blur p-4 text-center ring-1 ring-white/20 min-w-[100px]">
                <div className="text-xs font-semibold uppercase text-indigo-200">Rating</div>
                <div className="text-3xl font-black text-emerald-300">
                  {annualPlan.annual_rating} / 5 ★
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4 Quarterly Rollup Cards */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Quarterly Performance Breakdown</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {annualPlan.quarterly_reviews.map((qr) => (
            <div key={qr.id} className="rounded-xl border border-gray-200 p-4 bg-gray-50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-gray-900 text-base">{qr.quarter}</span>
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                    {qr.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {qr.quarter === 'Q1' && 'Apr - Jun'}
                  {qr.quarter === 'Q2' && 'Jul - Sep'}
                  {qr.quarter === 'Q3' && 'Oct - Dec'}
                  {qr.quarter === 'Q4' && 'Jan - Mar'}
                </p>
              </div>

              <div className="mt-4 border-t border-gray-200 pt-3 flex items-end justify-between">
                <span className="text-xs text-gray-500 font-medium">Avg Score:</span>
                <span className="text-2xl font-black text-indigo-600">
                  {qr.quarterly_score !== null ? `${qr.quarterly_score}%` : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 12-Month Performance Grid */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">12-Month Execution Matrix</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {allMonths.map((m) => {
            const score = m.plan?.monthly_score;
            const status = m.plan?.status || 'DRAFT';

            return (
              <div
                key={m.num}
                className="rounded-xl border border-gray-200 p-3 bg-gray-50 hover:bg-indigo-50/50 transition cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>{m.label}</span>
                  <span className="text-[10px] text-gray-400">{m.quarter}</span>
                </div>

                <div className="mt-2 text-xl font-extrabold text-indigo-600">
                  {score !== null && score !== undefined ? `${score}%` : '—'}
                </div>

                <div className="mt-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      status === 'APPROVED' || status === 'CLOSED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : status === 'EMPLOYEE_SUBMITTED'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Sub-component for Nominate Peers Modal
function NominatePeersModal({
  kra,
  excludeEmployeeId,
  onClose,
  onSuccess,
}: {
  kra: MonthlyKRA;
  excludeEmployeeId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [employees, setEmployees] = useState<ManagerOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    employeesApi.getManagers(search).then((data) => {
      setEmployees(data.filter((e) => e.id !== excludeEmployeeId));
      setLoading(false);
    });
  }, [search, excludeEmployeeId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleNominate = async () => {
    if (selectedIds.length === 0) return toast.error('Please select at least one peer');
    setSubmitting(true);
    try {
      await peerNominationsApi.nominate({
        monthly_kra_id: kra.id,
        peer_ids: selectedIds,
      });
      toast.success('Peers nominated successfully');
      onSuccess();
    } catch {
      toast.error('Failed to nominate peers');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold text-gray-900">Nominate Peers for "{kra.name}"</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <input
          type="text"
          placeholder="Search peers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border p-2.5 text-xs"
        />

        <div className="max-h-60 overflow-y-auto space-y-2">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
          ) : (
            employees.map((emp) => (
              <label
                key={emp.id}
                className="flex items-center justify-between p-2.5 rounded-xl border hover:bg-gray-50 cursor-pointer text-xs"
              >
                <div>
                  <p className="font-bold text-gray-900">{emp.full_name}</p>
                  <p className="text-gray-500">{emp.official_email}</p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(emp.id)}
                  onChange={() => toggleSelect(emp.id)}
                  className="h-4 w-4 rounded text-pink-600"
                />
              </label>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
          <button
            onClick={handleNominate}
            disabled={submitting || selectedIds.length === 0}
            className="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold"
          >
            {submitting ? 'Saving...' : `Nominate ${selectedIds.length} Peer(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}