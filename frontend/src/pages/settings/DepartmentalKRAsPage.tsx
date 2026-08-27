// import { useEffect, useMemo, useState } from 'react';
// import {
//   Building2, Plus, Trash2, Edit, Loader2, Info, X, Save,
//   Target, ChevronDown, ChevronRight, Filter, Zap, Calendar,
//   User, Link2, BarChart3,
// } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { deptKRAsApi, deptKPIsApi, orgPrioritiesApi } from '../../api/performance';
// import { structuresApi } from '../../api/masterData';
// import { employeesApi } from '../../api/employees';
// import type {
//   DepartmentalKRA, DeptKRACreatePayload,
//   DepartmentalKPI, DepartmentalKPICreatePayload,
//   KPIType, OrganizationalPriority,
// } from '../../types/performance';
// import type { CompanyStructure } from '../../types/masterData';
// import type { ManagerOption } from '../../api/employees';
// import toast from 'react-hot-toast';

// const KPI_TYPE_OPTIONS: { value: KPIType; label: string; icon: string }[] = [
//   { value: 'NUMERIC_UP', label: 'Numeric ↑ (Higher is Better)', icon: '📈' },
//   { value: 'NUMERIC_DOWN', label: 'Numeric ↓ (Lower is Better)', icon: '📉' },
//   { value: 'PERCENTAGE', label: 'Percentage', icon: '%' },
//   { value: 'RATING', label: 'Rating (1-5)', icon: '⭐' },
//   { value: 'BOOLEAN', label: 'Yes/No', icon: '✓' },
//   { value: 'CURRENCY', label: 'Currency', icon: '💰' },
// ];

// function generateFYOptions(): string[] {
//   const currentYear = new Date().getFullYear();
//   const options: string[] = [];
//   for (let i = -2; i <= 2; i++) {
//     const y = currentYear + i;
//     options.push(`FY ${y}-${(y + 1).toString().slice(-2)}`);
//   }
//   return options;
// }

// export default function DepartmentalKRAsPage() {
//   const [kras, setKras] = useState<DepartmentalKRA[]>([]);
//   const [departments, setDepartments] = useState<CompanyStructure[]>([]);
//   const [priorities, setPriorities] = useState<OrganizationalPriority[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [expanded, setExpanded] = useState<Set<string>>(new Set());

//   // Modals
//   const [showKRAModal, setShowKRAModal] = useState(false);
//   const [editingKRA, setEditingKRA] = useState<DepartmentalKRA | null>(null);
//   const [showKPIModal, setShowKPIModal] = useState(false);
//   const [editingKPI, setEditingKPI] = useState<DepartmentalKPI | null>(null);
//   const [kpiParentKRA, setKpiParentKRA] = useState<string | null>(null);

//   // Filters
//   const fyOptions = useMemo(() => generateFYOptions(), []);
//   const defaultFY = useMemo(() => {
//     const now = new Date();
//     const y = now.getFullYear();
//     return `FY ${y}-${(y + 1).toString().slice(-2)}`;
//   }, []);
//   const [selectedFY, setSelectedFY] = useState<string>(defaultFY);
//   const [selectedDept, setSelectedDept] = useState<string>('');
//   const [showInactive, setShowInactive] = useState(false);

//   const fetchAll = async () => {
//     setLoading(true);
//     try {
//       const [krasData, deptsData, prioritiesData] = await Promise.all([
//         deptKRAsApi.list({ financial_year: selectedFY }),
//         structuresApi.list({ type: 'DEPARTMENT' }),
//         orgPrioritiesApi.list({ financial_year: selectedFY }),
//       ]);
//       setKras(krasData);
//       setDepartments(deptsData.results || []);
//       setPriorities(prioritiesData);
//     } catch (err) {
//       toast.error('Failed to load data');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchAll();
//   }, [selectedFY]);

//   const filteredKRAs = useMemo(() => {
//     let list = [...kras];
//     if (!showInactive) list = list.filter((k) => k.is_active);
//     if (selectedDept) list = list.filter((k) => k.department === selectedDept);
//     return list;
//   }, [kras, showInactive, selectedDept]);

//   const krasByDept = useMemo(() => {
//     const grouped: Record<string, DepartmentalKRA[]> = {};
//     filteredKRAs.forEach((kra) => {
//       if (!grouped[kra.department_name]) grouped[kra.department_name] = [];
//       grouped[kra.department_name].push(kra);
//     });
//     return grouped;
//   }, [filteredKRAs]);

//   const toggleExpand = (kraId: string) => {
//     setExpanded((prev) => {
//       const next = new Set(prev);
//       if (next.has(kraId)) next.delete(kraId);
//       else next.add(kraId);
//       return next;
//     });
//   };

//   const handleDeleteKRA = async (kra: DepartmentalKRA) => {
//     if (!confirm(`Delete KRA "${kra.name}"? This will delete all its KPIs too.`)) return;
//     try {
//       await deptKRAsApi.delete(kra.id);
//       toast.success('KRA deleted');
//       fetchAll();
//     } catch {
//       toast.error('Failed to delete KRA');
//     }
//   };

//   const handleDeleteKPI = async (kpi: DepartmentalKPI) => {
//     if (!confirm(`Delete KPI "${kpi.name}"?`)) return;
//     try {
//       await deptKPIsApi.delete(kpi.id);
//       toast.success('KPI deleted');
//       fetchAll();
//     } catch {
//       toast.error('Failed to delete KPI');
//     }
//   };

//   const openCreateKRA = () => {
//     setEditingKRA(null);
//     setShowKRAModal(true);
//   };

//   const openEditKRA = (kra: DepartmentalKRA) => {
//     setEditingKRA(kra);
//     setShowKRAModal(true);
//   };

//   const openCreateKPI = (kraId: string) => {
//     setEditingKPI(null);
//     setKpiParentKRA(kraId);
//     setShowKPIModal(true);
//   };

//   const openEditKPI = (kpi: DepartmentalKPI) => {
//     setEditingKPI(kpi);
//     setKpiParentKRA(kpi.dept_kra);
//     setShowKPIModal(true);
//   };

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6 flex items-start justify-between">
//             <div>
//               <div className="flex items-center gap-2">
//                 <Building2 className="h-6 w-6 text-primary-600" />
//                 <h1 className="text-2xl font-bold text-gray-900">Departmental KRAs</h1>
//               </div>
//               <p className="mt-1 text-sm text-gray-500">
//                 Department-level KRAs that cascade from organizational priorities
//               </p>
//             </div>
//             <button
//               onClick={openCreateKRA}
//               className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
//             >
//               <Plus className="h-4 w-4" />
//               New Department KRA
//             </button>
//           </div>

//           {/* Info banner */}
//           <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
//             <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
//             <div>
//               <p className="font-medium">Cascading from Organizational Priorities</p>
//               <p className="mt-1 text-blue-700">
//                 Department heads translate CEO priorities into actionable department KRAs.
//                 Each KRA can link to an org priority and have 1-3 measurable KPIs.
//                 {priorities.length === 0 && (
//                   <span className="mt-1 block font-medium text-amber-700">
//                     ⚠️ No organizational priorities set for {selectedFY} yet.{' '}
//                     <a href="/settings/organizational-priorities" className="underline">
//                       Set them first →
//                     </a>
//                   </span>
//                 )}
//               </p>
//             </div>
//           </div>

//           {/* Filters */}
//           <div className="mb-4 flex flex-wrap items-center gap-3">
//             <div className="flex items-center gap-2">
//               <Calendar className="h-4 w-4 text-gray-400" />
//               <select
//                 value={selectedFY}
//                 onChange={(e) => setSelectedFY(e.target.value)}
//                 className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//               >
//                 {fyOptions.map((fy) => (
//                   <option key={fy} value={fy}>
//                     {fy}
//                   </option>
//                 ))}
//               </select>
//             </div>
//             <select
//               value={selectedDept}
//               onChange={(e) => setSelectedDept(e.target.value)}
//               className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//             >
//               <option value="">All Departments</option>
//               {departments.map((d) => (
//                 <option key={d.id} value={d.id}>
//                   {d.name}
//                 </option>
//               ))}
//             </select>
//             <label className="flex items-center gap-2 text-sm text-gray-700">
//               <input
//                 type="checkbox"
//                 checked={showInactive}
//                 onChange={(e) => setShowInactive(e.target.checked)}
//                 className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
//               />
//               Show inactive
//             </label>
//             <div className="flex items-center gap-1 text-xs text-gray-500">
//               <Filter className="h-3 w-3" />
//               {filteredKRAs.length} KRAs
//             </div>
//           </div>

//           {/* Content */}
//           {loading ? (
//             <div className="flex justify-center py-16">
//               <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//             </div>
//           ) : filteredKRAs.length === 0 ? (
//             <EmptyState fy={selectedFY} onNew={openCreateKRA} />
//           ) : (
//             <div className="space-y-6">
//               {Object.entries(krasByDept).map(([deptName, deptKras]) => (
//                 <div key={deptName}>
//                   <div className="mb-3 flex items-center gap-2">
//                     <Building2 className="h-4 w-4 text-gray-500" />
//                     <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">
//                       {deptName}
//                     </h2>
//                     <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
//                       {deptKras.length} KRA{deptKras.length > 1 ? 's' : ''}
//                     </span>
//                   </div>
//                   <div className="space-y-3">
//                     {deptKras.map((kra) => (
//                       <KRACard
//                         key={kra.id}
//                         kra={kra}
//                         expanded={expanded.has(kra.id)}
//                         onToggleExpand={() => toggleExpand(kra.id)}
//                         onEdit={() => openEditKRA(kra)}
//                         onDelete={() => handleDeleteKRA(kra)}
//                         onAddKPI={() => openCreateKPI(kra.id)}
//                         onEditKPI={openEditKPI}
//                         onDeleteKPI={handleDeleteKPI}
//                       />
//                     ))}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* KRA Modal */}
//           {showKRAModal && (
//             <KRAModal
//               kra={editingKRA}
//               defaultFY={selectedFY}
//               defaultDept={selectedDept}
//               departments={departments}
//               priorities={priorities}
//               onClose={() => setShowKRAModal(false)}
//               onSuccess={() => {
//                 setShowKRAModal(false);
//                 fetchAll();
//               }}
//             />
//           )}

//           {/* KPI Modal */}
//           {showKPIModal && kpiParentKRA && (
//             <KPIModal
//               kpi={editingKPI}
//               deptKraId={kpiParentKRA}
//               onClose={() => setShowKPIModal(false)}
//               onSuccess={() => {
//                 setShowKPIModal(false);
//                 fetchAll();
//               }}
//             />
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

// // ==============================================================================
// // EMPTY STATE
// // ==============================================================================

// function EmptyState({ fy, onNew }: { fy: string; onNew: () => void }) {
//   return (
//     <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
//       <Building2 className="mx-auto h-12 w-12 text-gray-300" />
//       <h3 className="mt-4 text-base font-semibold text-gray-900">
//         No departmental KRAs for {fy}
//       </h3>
//       <p className="mt-1 text-sm text-gray-500">
//         Department heads translate org priorities into department-specific KRAs.
//       </p>
//       <button
//         onClick={onNew}
//         className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
//       >
//         <Plus className="h-4 w-4" />
//         Create First Department KRA
//       </button>
//     </div>
//   );
// }

// // ==============================================================================
// // KRA CARD (with nested KPIs)
// // ==============================================================================

// function KRACard({
//   kra,
//   expanded,
//   onToggleExpand,
//   onEdit,
//   onDelete,
//   onAddKPI,
//   onEditKPI,
//   onDeleteKPI,
// }: {
//   kra: DepartmentalKRA;
//   expanded: boolean;
//   onToggleExpand: () => void;
//   onEdit: () => void;
//   onDelete: () => void;
//   onAddKPI: () => void;
//   onEditKPI: (kpi: DepartmentalKPI) => void;
//   onDeleteKPI: (kpi: DepartmentalKPI) => void;
// }) {
//   return (
//     <div className="group rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-md">
//       {/* KRA Header */}
//       <div className="flex items-start gap-3 p-5">
//         <button
//           onClick={onToggleExpand}
//           className="mt-1 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
//         >
//           {expanded ? (
//             <ChevronDown className="h-4 w-4" />
//           ) : (
//             <ChevronRight className="h-4 w-4" />
//           )}
//         </button>

//         <div className="flex-1 min-w-0">
//           {/* Title row */}
//           <div className="flex items-start justify-between gap-2">
//             <div className="flex-1">
//               <div className="flex items-center gap-2">
//                 <h3 className="text-base font-semibold text-gray-900">{kra.name}</h3>
//                 {!kra.is_active && (
//                   <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
//                     Inactive
//                   </span>
//                 )}
//               </div>
//               <p className="mt-1 text-sm text-gray-600">{kra.description}</p>
//             </div>

//             {/* Actions */}
//             <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
//               <button
//                 onClick={onEdit}
//                 className="rounded-lg p-2 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
//                 title="Edit"
//               >
//                 <Edit className="h-4 w-4" />
//               </button>
//               <button
//                 onClick={onDelete}
//                 className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
//                 title="Delete"
//               >
//                 <Trash2 className="h-4 w-4" />
//               </button>
//             </div>
//           </div>

//           {/* Meta row */}
//           <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
//             {/* Weight */}
//             <span className="flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 font-medium text-primary-700">
//               <BarChart3 className="h-3 w-3" />
//               {kra.weight_in_dept}% weight
//             </span>

//             {/* Owner */}
//             {kra.owner_name && (
//               <span className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-gray-700">
//                 <User className="h-3 w-3" />
//                 {kra.owner_name}
//               </span>
//             )}

//             {/* Linked Priority */}
//             {kra.linked_priority_title && (
//               <span className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 font-medium text-purple-700">
//                 <Link2 className="h-3 w-3" />
//                 {kra.linked_priority_title}
//               </span>
//             )}

//             {/* KPI count */}
//             <span className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 font-medium text-green-700">
//               <Target className="h-3 w-3" />
//               {kra.kpis.length} KPI{kra.kpis.length !== 1 ? 's' : ''}
//             </span>
//           </div>
//         </div>
//       </div>

//       {/* Expanded KPIs */}
//       {expanded && (
//         <div className="border-t border-gray-100 bg-gray-50/50 p-5">
//           <div className="mb-3 flex items-center justify-between">
//             <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
//               KPIs under this KRA
//             </h4>
//             <button
//               onClick={onAddKPI}
//               className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700"
//             >
//               <Plus className="h-3 w-3" />
//               Add KPI
//             </button>
//           </div>

//           {kra.kpis.length === 0 ? (
//             <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
//               <Zap className="mx-auto h-8 w-8 text-gray-300" />
//               <p className="mt-2 text-sm font-medium text-gray-700">No KPIs yet</p>
//               <p className="text-xs text-gray-500">
//                 Add measurable KPIs to define how this KRA is evaluated
//               </p>
//             </div>
//           ) : (
//             <div className="space-y-2">
//               {kra.kpis.map((kpi) => (
//                 <KPIRow
//                   key={kpi.id}
//                   kpi={kpi}
//                   onEdit={() => onEditKPI(kpi)}
//                   onDelete={() => onDeleteKPI(kpi)}
//                 />
//               ))}
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// // ==============================================================================
// // KPI ROW
// // ==============================================================================

// function KPIRow({
//   kpi,
//   onEdit,
//   onDelete,
// }: {
//   kpi: DepartmentalKPI;
//   onEdit: () => void;
//   onDelete: () => void;
// }) {
//   const typeConfig = KPI_TYPE_OPTIONS.find((t) => t.value === kpi.kpi_type);

//   return (
//     <div className="group flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-gray-100 transition hover:ring-primary-200">
//       <span className="text-lg" title={typeConfig?.label}>
//         {typeConfig?.icon}
//       </span>
//       <div className="flex-1 min-w-0">
//         <div className="flex items-center gap-2">
//           <h5 className="text-sm font-medium text-gray-900">{kpi.name}</h5>
//           <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
//             Target: {kpi.target}
//           </span>
//         </div>
//         {kpi.formula && (
//           <p className="mt-0.5 truncate text-xs italic text-gray-500">
//             📊 {kpi.formula}
//           </p>
//         )}
//         <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
//           <span>{kpi.kpi_type_display}</span>
//           {kpi.data_source && (
//             <>
//               <span className="text-gray-300">•</span>
//               <span>Source: {kpi.data_source}</span>
//             </>
//           )}
//           <span className="text-gray-300">•</span>
//           <span>Weight: {kpi.weight}%</span>
//         </div>
//       </div>
//       <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
//         <button
//           onClick={onEdit}
//           className="rounded p-1.5 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
//           title="Edit KPI"
//         >
//           <Edit className="h-3.5 w-3.5" />
//         </button>
//         <button
//           onClick={onDelete}
//           className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
//           title="Delete KPI"
//         >
//           <Trash2 className="h-3.5 w-3.5" />
//         </button>
//       </div>
//     </div>
//   );
// }

// // ==============================================================================
// // KRA CREATE / EDIT MODAL
// // ==============================================================================

// function KRAModal({
//   kra,
//   defaultFY,
//   defaultDept,
//   departments,
//   priorities,
//   onClose,
//   onSuccess,
// }: {
//   kra: DepartmentalKRA | null;
//   defaultFY: string;
//   defaultDept: string;
//   departments: CompanyStructure[];
//   priorities: OrganizationalPriority[];
//   onClose: () => void;
//   onSuccess: () => void;
// }) {
//   const isEdit = !!kra;

//   const [form, setForm] = useState<DeptKRACreatePayload>({
//     department: kra?.department ?? defaultDept ?? '',
//     financial_year: kra?.financial_year ?? defaultFY,
//     linked_priority: kra?.linked_priority ?? null,
//     name: kra?.name ?? '',
//     description: kra?.description ?? '',
//     weight_in_dept: kra ? Number(kra.weight_in_dept) : 10,
//     owner: kra?.owner ?? null,
//     is_active: kra?.is_active ?? true,
//   });

//   const [saving, setSaving] = useState(false);
//   const [ownerOptions, setOwnerOptions] = useState<ManagerOption[]>([]);
//   const fyOptions = useMemo(() => generateFYOptions(), []);

//   useEffect(() => {
//     employeesApi.getManagers().then(setOwnerOptions).catch(() => {});
//   }, []);

//   const update = <K extends keyof DeptKRACreatePayload>(
//     field: K,
//     value: DeptKRACreatePayload[K]
//   ) => setForm((prev) => ({ ...prev, [field]: value }));

//   const handleSave = async () => {
//     if (!form.department) return toast.error('Department is required');
//     if (!form.name.trim()) return toast.error('Name is required');
//     if (!form.description.trim()) return toast.error('Description is required');

//     setSaving(true);
//     try {
//       if (isEdit) {
//         await deptKRAsApi.update(kra!.id, form);
//         toast.success('KRA updated');
//       } else {
//         await deptKRAsApi.create(form);
//         toast.success('KRA created');
//       }
//       onSuccess();
//     } catch (err: any) {
//       const detail =
//         err?.response?.data?.detail ||
//         err?.response?.data?.non_field_errors?.[0] ||
//         'Save failed';
//       toast.error(detail);
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//       <div
//         className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
//         onClick={(e) => e.stopPropagation()}
//       >
//         {/* Header */}
//         <div className="flex items-center justify-between border-b border-gray-100 p-5">
//           <div className="flex items-center gap-2">
//             <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100">
//               <Building2 className="h-4 w-4 text-primary-600" />
//             </div>
//             <h3 className="text-base font-semibold text-gray-900">
//               {isEdit ? 'Edit Department KRA' : 'New Department KRA'}
//             </h3>
//           </div>
//           <button
//             onClick={onClose}
//             className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
//           >
//             <X className="h-4 w-4" />
//           </button>
//         </div>

//         {/* Body */}
//         <div className="max-h-[70vh] overflow-y-auto p-5">
//           <div className="grid grid-cols-1 gap-4">
//             {/* Department + FY */}
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                   Department <span className="text-red-500">*</span>
//                 </label>
//                 <select
//                   value={form.department}
//                   onChange={(e) => update('department', e.target.value)}
//                   disabled={isEdit}
//                   className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50"
//                 >
//                   <option value="">Select department...</option>
//                   {departments.map((d) => (
//                     <option key={d.id} value={d.id}>
//                       {d.name}
//                     </option>
//                   ))}
//                 </select>
//               </div>
//               <div>
//                 <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                   Financial Year <span className="text-red-500">*</span>
//                 </label>
//                 <select
//                   value={form.financial_year}
//                   onChange={(e) => update('financial_year', e.target.value)}
//                   className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                 >
//                   {fyOptions.map((fy) => (
//                     <option key={fy} value={fy}>
//                       {fy}
//                     </option>
//                   ))}
//                 </select>
//               </div>
//             </div>

//             {/* Linked Priority */}
//             <div>
//               <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                 Linked Organizational Priority
//               </label>
//               <select
//                 value={form.linked_priority || ''}
//                 onChange={(e) => update('linked_priority', e.target.value || null)}
//                 className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//               >
//                 <option value="">— Not linked —</option>
//                 {priorities.map((p) => (
//                   <option key={p.id} value={p.id}>
//                     #{p.priority_number} - {p.title}
//                   </option>
//                 ))}
//               </select>
//               <p className="mt-1 text-xs text-gray-500">
//                 Which CEO priority does this KRA support?
//               </p>
//             </div>

//             {/* Name */}
//             <div>
//               <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                 KRA Name <span className="text-red-500">*</span>
//               </label>
//               <input
//                 type="text"
//                 value={form.name}
//                 onChange={(e) => update('name', e.target.value)}
//                 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                 placeholder="e.g. Ship 3 platform features in FY26"
//               />
//             </div>

//             {/* Description */}
//             <div>
//               <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                 Description <span className="text-red-500">*</span>
//               </label>
//               <textarea
//                 value={form.description}
//                 onChange={(e) => update('description', e.target.value)}
//                 rows={3}
//                 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                 placeholder="What does this department need to achieve?"
//               />
//             </div>

//             {/* Weight + Owner */}
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                   Weight in Department (%)
//                 </label>
//                 <input
//                   type="number"
//                   step="0.01"
//                   min="0"
//                   max="100"
//                   value={form.weight_in_dept}
//                   onChange={(e) => update('weight_in_dept', parseFloat(e.target.value) || 0)}
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                 />
//               </div>
//               <div>
//                 <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                   Owner (Dept Head)
//                 </label>
//                 <select
//                   value={form.owner || ''}
//                   onChange={(e) => update('owner', e.target.value || null)}
//                   className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                 >
//                   <option value="">— No owner —</option>
//                   {ownerOptions.map((opt) => (
//                     <option key={opt.id} value={opt.id}>
//                       {opt.full_name} ({opt.employee_id})
//                     </option>
//                   ))}
//                 </select>
//               </div>
//             </div>

//             <label className="flex items-center gap-2 text-sm pt-2">
//               <input
//                 type="checkbox"
//                 checked={form.is_active}
//                 onChange={(e) => update('is_active', e.target.checked)}
//                 className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
//               />
//               <span className="text-gray-700">Active</span>
//             </label>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
//           <button
//             onClick={onClose}
//             className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={handleSave}
//             disabled={saving}
//             className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
//           >
//             {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
//             {isEdit ? 'Update' : 'Create'}
//           </button>
//         </div>
//       </div>
//       <div className="absolute inset-0 -z-10" onClick={onClose} />
//     </div>
//   );
// }

// // ==============================================================================
// // KPI CREATE / EDIT MODAL
// // ==============================================================================

// function KPIModal({
//   kpi,
//   deptKraId,
//   onClose,
//   onSuccess,
// }: {
//   kpi: DepartmentalKPI | null;
//   deptKraId: string;
//   onClose: () => void;
//   onSuccess: () => void;
// }) {
//   const isEdit = !!kpi;

//   const [form, setForm] = useState<DepartmentalKPICreatePayload>({
//     dept_kra: kpi?.dept_kra ?? deptKraId,
//     name: kpi?.name ?? '',
//     kpi_type: kpi?.kpi_type ?? 'NUMERIC_UP',
//     formula: kpi?.formula ?? '',
//     target: kpi?.target ?? '',
//     data_source: kpi?.data_source ?? '',
//     weight: kpi ? Number(kpi.weight) : 100,
//   });

//   const [saving, setSaving] = useState(false);

//   const update = <K extends keyof DepartmentalKPICreatePayload>(
//     field: K,
//     value: DepartmentalKPICreatePayload[K]
//   ) => setForm((prev) => ({ ...prev, [field]: value }));

//   const handleSave = async () => {
//     if (!form.name.trim()) return toast.error('Name is required');
//     if (!form.target.trim()) return toast.error('Target is required');

//     setSaving(true);
//     try {
//       if (isEdit) {
//         await deptKPIsApi.update(kpi!.id, form);
//         toast.success('KPI updated');
//       } else {
//         await deptKPIsApi.create(form);
//         toast.success('KPI created');
//       }
//       onSuccess();
//     } catch (err: any) {
//       const detail = err?.response?.data?.detail || 'Save failed';
//       toast.error(detail);
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//       <div
//         className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
//         onClick={(e) => e.stopPropagation()}
//       >
//         <div className="flex items-center justify-between border-b border-gray-100 p-5">
//           <div className="flex items-center gap-2">
//             <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
//               <Zap className="h-4 w-4 text-green-600" />
//             </div>
//             <h3 className="text-base font-semibold text-gray-900">
//               {isEdit ? 'Edit KPI' : 'New KPI'}
//             </h3>
//           </div>
//           <button
//             onClick={onClose}
//             className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
//           >
//             <X className="h-4 w-4" />
//           </button>
//         </div>

//         <div className="max-h-[70vh] overflow-y-auto p-5">
//           <div className="grid grid-cols-1 gap-4">
//             {/* Name */}
//             <div>
//               <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                 KPI Name <span className="text-red-500">*</span>
//               </label>
//               <input
//                 type="text"
//                 value={form.name}
//                 onChange={(e) => update('name', e.target.value)}
//                 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                 placeholder="e.g. Sprint commitment success rate"
//               />
//             </div>

//             {/* KPI Type */}
//             <div>
//               <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                 KPI Type <span className="text-red-500">*</span>
//               </label>
//               <div className="grid grid-cols-2 gap-2">
//                 {KPI_TYPE_OPTIONS.map((opt) => (
//                   <button
//                     key={opt.value}
//                     type="button"
//                     onClick={() => update('kpi_type', opt.value)}
//                     className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
//                       form.kpi_type === opt.value
//                         ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-500'
//                         : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
//                     }`}
//                   >
//                     <span className="text-base">{opt.icon}</span>
//                     <span className="truncate">{opt.label}</span>
//                   </button>
//                 ))}
//               </div>
//             </div>

//             {/* Target */}
//             <div>
//               <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                 Target <span className="text-red-500">*</span>
//               </label>
//               <input
//                 type="text"
//                 value={form.target}
//                 onChange={(e) => update('target', e.target.value)}
//                 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                 placeholder="e.g. ≥ 90%, 100 clients, ₹50L"
//               />
//             </div>

//             {/* Formula */}
//             <div>
//               <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                 Formula / Calculation
//               </label>
//               <textarea
//                 value={form.formula}
//                 onChange={(e) => update('formula', e.target.value)}
//                 rows={2}
//                 className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                 placeholder="e.g. (Sprints completed on time / Total sprints) × 100"
//               />
//             </div>

//             {/* Data Source + Weight */}
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                   Data Source
//                 </label>
//                 <input
//                   type="text"
//                   value={form.data_source}
//                   onChange={(e) => update('data_source', e.target.value)}
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                   placeholder="e.g. Jira, CRM"
//                 />
//               </div>
//               <div>
//                 <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//                   Weight in KRA (%)
//                 </label>
//                 <input
//                   type="number"
//                   step="0.01"
//                   min="0"
//                   max="100"
//                   value={form.weight}
//                   onChange={(e) => update('weight', parseFloat(e.target.value) || 0)}
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                 />
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
//           <button
//             onClick={onClose}
//             className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={handleSave}
//             disabled={saving}
//             className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
//           >
//             {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
//             {isEdit ? 'Update' : 'Create'}
//           </button>
//         </div>
//       </div>
//       <div className="absolute inset-0 -z-10" onClick={onClose} />
//     </div>
//   );
// }

// import { useEffect, useMemo, useState } from 'react';
// import {
//   Building2, Plus, Trash2, Edit, Loader2, Info, X, Save,
//   Target, ChevronDown, ChevronRight, Filter, Zap, Calendar,
// } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { deptKRAApi } from '../../api/performance';
// import { structuresApi } from '../../api/masterData';
// import type { DepartmentalKRAMaster, DepartmentalKPIMaster, KPIMetricType } from '../../types/performance';
// import type { CompanyStructure } from '../../types/masterData';
// import toast from 'react-hot-toast';

// const KPI_TYPE_OPTIONS: { value: KPIMetricType; label: string; icon: string }[] = [
//   { value: 'NUMERIC_UP', label: 'Numeric ↑', icon: '📈' },
//   { value: 'NUMERIC_DOWN', label: 'Numeric ↓', icon: '📉' },
//   { value: 'PERCENTAGE', label: 'Percentage', icon: '%' },
//   { value: 'RATING', label: 'Rating (1-5)', icon: '⭐' },
//   { value: 'BOOLEAN', label: 'Yes/No', icon: '✓' },
// ];

// function generateFYOptions(): string[] {
//   const currentYear = new Date().getFullYear();
//   const options: string[] = [];
//   for (let i = -2; i <= 2; i++) {
//     const y = currentYear + i;
//     options.push(`20${y.toString().slice(-2)}-${(y + 1).toString().slice(-2)}`); // Format: 2026-27
//   }
//   return options;
// }

// export default function DepartmentalKRAsPage() {
//   const [kras, setKras] = useState<DepartmentalKRAMaster[]>([]);
//   const [departments, setDepartments] = useState<CompanyStructure[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [expanded, setExpanded] = useState<Set<string>>(new Set());

//   // Modals
//   const [showKRAModal, setShowKRAModal] = useState(false);
//   const [editingKRA, setEditingKRA] = useState<DepartmentalKRAMaster | null>(null);

//   // Filters
//   const fyOptions = useMemo(() => generateFYOptions(), []);
//   const defaultFY = '2026-27';
//   const [selectedFY, setSelectedFY] = useState<string>(defaultFY);
//   const [selectedDept, setSelectedDept] = useState<string>('');

//   const fetchAll = async () => {
//     setLoading(true);
//     try {
//       const [krasData, deptsData] = await Promise.all([
//         deptKRAApi.list({ financial_year: selectedFY }),
//         structuresApi.list({ type: 'DEPARTMENT' }),
//       ]);
//       setKras(krasData);
//       setDepartments(deptsData.results || []);
//     } catch (err) {
//       toast.error('Failed to load data');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchAll();
//   }, [selectedFY]);

//   const filteredKRAs = useMemo(() => {
//     let list = [...kras];
//     if (selectedDept) list = list.filter((k) => k.department === selectedDept);
//     return list;
//   }, [kras, selectedDept]);

//   const toggleExpand = (kraId: string) => {
//     setExpanded((prev) => {
//       const next = new Set(prev);
//       if (next.has(kraId)) next.delete(kraId);
//       else next.add(kraId);
//       return next;
//     });
//   };

//   const handleDeleteKRA = async (kra: DepartmentalKRAMaster) => {
//     if (!confirm(`Delete Master KRA "${kra.name}"?`)) return;
//     try {
//       await deptKRAApi.delete(kra.id);
//       toast.success('KRA deleted');
//       fetchAll();
//     } catch {
//       toast.error('Failed to delete');
//     }
//   };

//   const openCreateKRA = () => {
//     setEditingKRA(null);
//     setShowKRAModal(true);
//   };

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6 flex items-start justify-between">
//             <div>
//               <div className="flex items-center gap-2">
//                 <Building2 className="h-6 w-6 text-primary-600" />
//                 <h1 className="text-2xl font-bold text-gray-900">Departmental KRAs (Master)</h1>
//               </div>
//               <p className="mt-1 text-sm text-gray-500">
//                 KRAs defined here will auto-inject into every employee's monthly plan within that department.
//               </p>
//             </div>
//             <button
//               onClick={openCreateKRA}
//               className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
//             >
//               <Plus className="h-4 w-4" /> New Dept KRA
//             </button>
//           </div>

//           {/* Filters */}
//           <div className="mb-6 flex flex-wrap items-center gap-3">
//             <div className="flex items-center gap-2">
//               <Calendar className="h-4 w-4 text-gray-400" />
//               <select
//                 value={selectedFY}
//                 onChange={(e) => setSelectedFY(e.target.value)}
//                 className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500"
//               >
//                 {fyOptions.map((fy) => (
//                   <option key={fy} value={fy}>{fy}</option>
//                 ))}
//               </select>
//             </div>
//             <select
//               value={selectedDept}
//               onChange={(e) => setSelectedDept(e.target.value)}
//               className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500"
//             >
//               <option value="">All Departments</option>
//               {departments.map((d) => (
//                 <option key={d.id} value={d.id}>{d.name}</option>
//               ))}
//             </select>
//             <div className="flex items-center gap-1 text-xs text-gray-500">
//               <Filter className="h-3 w-3" />
//               {filteredKRAs.length} KRAs found
//             </div>
//           </div>

//           {/* Content */}
//           {loading ? (
//             <div className="flex justify-center py-16">
//               <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//             </div>
//           ) : filteredKRAs.length === 0 ? (
//             <div className="rounded-2xl bg-white p-12 text-center shadow-sm border">
//               <Building2 className="mx-auto h-12 w-12 text-gray-300" />
//               <p className="mt-4 font-semibold text-gray-900">No Departmental KRAs found for {selectedFY}</p>
//             </div>
//           ) : (
//             <div className="space-y-4">
//               {filteredKRAs.map((kra) => (
//                 <div key={kra.id} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
//                   <div className="flex items-start justify-between p-5">
//                     <button onClick={() => toggleExpand(kra.id)} className="mt-1 p-1 text-gray-400">
//                       {expanded.has(kra.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
//                     </button>
//                     <div className="flex-1 ml-3">
//                       <div className="flex items-center gap-2">
//                         <h3 className="font-bold text-gray-900">{kra.name}</h3>
//                         <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
//                           {kra.department_name}
//                         </span>
//                         {!kra.is_active && (
//                           <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Inactive</span>
//                         )}
//                       </div>
//                       <p className="text-sm text-gray-600 mt-1">{kra.description}</p>
//                       <p className="text-xs font-bold text-indigo-600 mt-2">Default Weight: {kra.default_weight}%</p>
//                     </div>
//                     <div className="flex gap-1">
//                       <button onClick={() => { setEditingKRA(kra); setShowKRAModal(true); }} className="p-2 text-gray-500 hover:bg-gray-50">
//                         <Edit className="h-4 w-4" />
//                       </button>
//                       <button onClick={() => handleDeleteKRA(kra)} className="p-2 text-red-500 hover:bg-red-50">
//                         <Trash2 className="h-4 w-4" />
//                       </button>
//                     </div>
//                   </div>

//                   {expanded.has(kra.id) && (
//                     <div className="border-t border-gray-100 bg-gray-50 p-5">
//                       <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Default KPIs</h4>
//                       {kra.kpis.length === 0 ? (
//                         <p className="text-xs text-gray-400 italic">No default KPIs defined.</p>
//                       ) : (
//                         <div className="space-y-2">
//                           {kra.kpis.map((kpi) => (
//                             <div key={kpi.id} className="bg-white p-3 rounded-lg border flex justify-between items-center text-sm">
//                               <div>
//                                 <span className="font-semibold">{kpi.name}</span>
//                                 <span className="ml-2 text-xs text-gray-500">({kpi.metric_type})</span>
//                               </div>
//                               <div className="flex gap-4 font-bold text-indigo-700 text-xs">
//                                 <span>Target: {kpi.default_target}</span>
//                                 <span>Weight: {kpi.weight_in_kra}%</span>
//                               </div>
//                             </div>
//                           ))}
//                         </div>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* Modal */}
//           {showKRAModal && (
//             <KRAModal
//               kra={editingKRA}
//               defaultFY={selectedFY}
//               departments={departments}
//               onClose={() => setShowKRAModal(false)}
//               onSuccess={() => { setShowKRAModal(false); fetchAll(); }}
//             />
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

// // ==============================================================================
// // CREATE / EDIT MODAL
// // ==============================================================================

// function KRAModal({ kra, defaultFY, departments, onClose, onSuccess }: any) {
//   const isEdit = !!kra;
//   const [saving, setSaving] = useState(false);
//   const [form, setForm] = useState<Partial<DepartmentalKRAMaster>>({
//     department: kra?.department || '',
//     financial_year: kra?.financial_year || defaultFY,
//     name: kra?.name || '',
//     description: kra?.description || '',
//     default_weight: kra?.default_weight || 10,
//     is_active: kra?.is_active ?? true,
//   });

//   const handleSave = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSaving(true);
//     try {
//       if (isEdit) await deptKRAApi.update(kra.id, form);
//       else await deptKRAApi.create(form);
//       toast.success(isEdit ? 'Updated' : 'Created');
//       onSuccess();
//     } catch {
//       toast.error('Failed to save');
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//       <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
//         <div className="flex justify-between items-center mb-4">
//           <h3 className="font-bold text-lg">{isEdit ? 'Edit Master KRA' : 'New Master KRA'}</h3>
//           <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
//         </div>
//         <form onSubmit={handleSave} className="space-y-4">
//           <select required value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="w-full border p-2 rounded-lg text-sm">
//             <option value="">Select Department...</option>
//             {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
//           </select>
//           <input required type="text" placeholder="KRA Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-2 rounded-lg text-sm" />
//           <textarea required placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full border p-2 rounded-lg text-sm" rows={3} />
//           <input required type="number" placeholder="Default Weight %" value={form.default_weight} onChange={e => setForm({...form, default_weight: Number(e.target.value)})} className="w-full border p-2 rounded-lg text-sm" />
          
//           <label className="flex items-center gap-2 text-sm">
//             <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded text-indigo-600" />
//             Active
//           </label>
          
//           <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
//             <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
//             <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">
//               {saving ? 'Saving...' : 'Save KRA'}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }


import { useEffect, useMemo, useState } from 'react';
import {
  Building2, Plus, Trash2, Edit, Loader2, Info, X, Save,
  Calendar, CheckCircle2,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { deptKRAApi } from '../../api/performance';
import { structuresApi } from '../../api/masterData';
import type { DepartmentalKRAMaster } from '../../types/performance';
import type { CompanyStructure } from '../../types/masterData';
import toast from 'react-hot-toast';

function generateFYOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  for (let i = -2; i <= 2; i++) {
    const y = currentYear + i;
    options.push(`20${y.toString().slice(-2)}-${(y + 1).toString().slice(-2)}`); 
  }
  return options;
}

export default function DepartmentalKRAsPage() {
  const [kras, setKras] = useState<DepartmentalKRAMaster[]>([]);
  const [departments, setDepartments] = useState<CompanyStructure[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingKRA, setEditingKRA] = useState<DepartmentalKRAMaster | null>(null);

  // Filter State
  const fyOptions = useMemo(() => generateFYOptions(), []);
  const [selectedFY, setSelectedFY] = useState<string>('2026-27');
  const [selectedDept, setSelectedDept] = useState<string>('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [krasData, deptsData] = await Promise.all([
        deptKRAApi.list({ financial_year: selectedFY }),
        structuresApi.list({ type: 'DEPARTMENT' }),
      ]);
      setKras(krasData);
      setDepartments(deptsData.results || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [selectedFY]);

  const filteredKRAs = useMemo(() => {
    if (!selectedDept) return kras;
    return kras.filter(k => k.department === selectedDept);
  }, [kras, selectedDept]);

  const handleDelete = async (kra: DepartmentalKRAMaster) => {
    if (!confirm(`Delete Departmental KRA "${kra.name}"?`)) return;
    try {
      await deptKRAApi.delete(kra.id);
      toast.success('Deleted successfully');
      fetchAll();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const openCreate = () => {
    setEditingKRA(null);
    setShowModal(true);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-6 w-6 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">Departmental KRAs (Master)</h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Department-specific KRAs that auto-inject into monthly plans.
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" /> New Dept KRA
            </button>
          </div>

          <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 border border-blue-100">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Departmental Injection</p>
              <p className="mt-1 text-blue-700">
                If an employee belongs to the Engineering department, the system will look here and automatically inject all active Engineering KRAs into their 12 monthly performance plans.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500"
              >
                {fyOptions.map((fy) => (
                  <option key={fy} value={fy}>FY {fy}</option>
                ))}
              </select>
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500">{filteredKRAs.length} items found</span>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filteredKRAs.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm border border-gray-200">
              <Building2 className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 font-semibold text-gray-900">No Departmental KRAs found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredKRAs.map((kra) => (
                <div key={kra.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{kra.name}</h3>
                      <span className="inline-block mt-1 bg-purple-100 text-purple-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md">
                        {kra.department_name}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingKRA(kra); setShowModal(true); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(kra)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 mt-2 h-10 overflow-hidden">{kra.description}</p>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold">
                      Weight: {kra.default_weight}%
                    </span>
                    {kra.is_active ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Active
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-400">Inactive</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {showModal && (
        <DepartmentalKRAModal
          kra={editingKRA}
          defaultFY={selectedFY}
          departments={departments}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchAll();
          }}
        />
      )}
    </div>
  );
}

// ==============================================================================
// MODAL COMPONENT
// ==============================================================================

function DepartmentalKRAModal({ kra, defaultFY, departments, onClose, onSuccess }: any) {
  const isEdit = !!kra;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<DepartmentalKRAMaster>>({
    department: kra?.department || '',
    financial_year: kra?.financial_year || defaultFY,
    name: kra?.name || '',
    description: kra?.description || '',
    default_weight: kra ? Number(kra.default_weight) : 10,
    is_active: kra?.is_active ?? true,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) await deptKRAApi.update(kra.id, form);
      else await deptKRAApi.create(form);
      toast.success(isEdit ? 'Updated successfully' : 'Created successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5 border-b pb-3">
          <h3 className="font-bold text-lg text-gray-900">{isEdit ? 'Edit Dept KRA' : 'New Dept KRA'}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase">Department *</label>
            <select required value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="w-full mt-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              <option value="">Select Department...</option>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 uppercase">KRA Name *</label>
            <input required type="text" placeholder="e.g. Code Quality" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full mt-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 uppercase">Description *</label>
            <textarea required placeholder="What does this cover?" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full mt-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 uppercase">Default Weight (%) *</label>
            <input required type="number" min="0" max="100" value={form.default_weight} onChange={e => setForm({...form, default_weight: Number(e.target.value)})} className="w-full mt-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          
          <label className="flex items-center gap-2 text-sm text-gray-700 pt-2">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded text-primary-600 w-4 h-4" />
            Active (will be injected into new plans)
          </label>
          
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl text-sm font-medium text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}