// import { useEffect, useMemo, useState } from 'react';
// import {
//   Users, Plus, Trash2, Edit, Loader2, Info, X, Save,
//   Calendar, CheckCircle2,
// } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { commonKRAApi } from '../../api/performance';
// import type { CommonKRAMaster } from '../../types/performance';
// import toast from 'react-hot-toast';

// function generateFYOptions(): string[] {
//   const currentYear = new Date().getFullYear();
//   const options: string[] = [];
//   for (let i = -2; i <= 2; i++) {
//     const y = currentYear + i;
//     options.push(`20${y.toString().slice(-2)}-${(y + 1).toString().slice(-2)}`); // Format: 2026-27
//   }
//   return options;
// }

// export default function CommonKRAMasterPage() {
//   const [kras, setKras] = useState<CommonKRAMaster[]>([]);
//   const [loading, setLoading] = useState(true);

//   // Modal State
//   const [showModal, setShowModal] = useState(false);
//   const [editingKRA, setEditingKRA] = useState<CommonKRAMaster | null>(null);

//   // Filter State
//   const fyOptions = useMemo(() => generateFYOptions(), []);
//   const [selectedFY, setSelectedFY] = useState<string>('2026-27');

//   const fetchKRAs = async () => {
//     setLoading(true);
//     try {
//       const data = await commonKRAApi.list({ financial_year: selectedFY });
//       setKras(data);
//     } catch (err) {
//       toast.error('Failed to load Common KRAs');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchKRAs();
//   }, [selectedFY]);

//   const handleDelete = async (kra: CommonKRAMaster) => {
//     if (!confirm(`Delete Common KRA "${kra.name}"?`)) return;
//     try {
//       await commonKRAApi.delete(kra.id);
//       toast.success('Deleted successfully');
//       fetchKRAs();
//     } catch {
//       toast.error('Failed to delete');
//     }
//   };

//   const openCreate = () => {
//     setEditingKRA(null);
//     setShowModal(true);
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
//                 <Users className="h-6 w-6 text-primary-600" />
//                 <h1 className="text-2xl font-bold text-gray-900">Common KRAs (Master)</h1>
//               </div>
//               <p className="mt-1 text-sm text-gray-500">
//                 KRAs defined here will auto-inject into every employee's monthly plan.
//               </p>
//             </div>
//             <button
//               onClick={openCreate}
//               className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
//             >
//               <Plus className="h-4 w-4" /> New Common KRA
//             </button>
//           </div>

//           <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 border border-blue-100">
//             <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
//             <div>
//               <p className="font-medium">Company-Wide Application</p>
//               <p className="mt-1 text-blue-700">
//                 Examples: <strong>Attendance, Policy Compliance, Core Values</strong>. When you generate an annual plan for any employee, these KRAs will automatically be added to all 12 of their monthly plans.
//               </p>
//             </div>
//           </div>

//           {/* Filters */}
//           <div className="mb-6 flex items-center gap-3">
//             <div className="flex items-center gap-2">
//               <Calendar className="h-4 w-4 text-gray-400" />
//               <select
//                 value={selectedFY}
//                 onChange={(e) => setSelectedFY(e.target.value)}
//                 className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500"
//               >
//                 {fyOptions.map((fy) => (
//                   <option key={fy} value={fy}>FY {fy}</option>
//                 ))}
//               </select>
//             </div>
//             <span className="text-xs text-gray-500">{kras.length} items found</span>
//           </div>

//           {/* List */}
//           {loading ? (
//             <div className="flex justify-center py-16">
//               <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//             </div>
//           ) : kras.length === 0 ? (
//             <div className="rounded-2xl bg-white p-12 text-center shadow-sm border border-gray-200">
//               <Users className="mx-auto h-12 w-12 text-gray-300" />
//               <p className="mt-4 font-semibold text-gray-900">No Common KRAs found for {selectedFY}</p>
//             </div>
//           ) : (
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//               {kras.map((kra) => (
//                 <div key={kra.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition">
//                   <div className="flex justify-between items-start mb-2">
//                     <h3 className="font-bold text-gray-900 text-lg">{kra.name}</h3>
//                     <div className="flex gap-1">
//                       <button onClick={() => { setEditingKRA(kra); setShowModal(true); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
//                         <Edit className="h-4 w-4" />
//                       </button>
//                       <button onClick={() => handleDelete(kra)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
//                         <Trash2 className="h-4 w-4" />
//                       </button>
//                     </div>
//                   </div>
//                   <p className="text-sm text-gray-600 mb-4 h-10 overflow-hidden">{kra.description}</p>
//                   <div className="flex items-center justify-between border-t border-gray-100 pt-3">
//                     <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold">
//                       Weight: {kra.default_weight}%
//                     </span>
//                     {kra.is_active ? (
//                       <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
//                         <CheckCircle2 className="h-3.5 w-3.5" /> Active
//                       </span>
//                     ) : (
//                       <span className="text-xs font-medium text-gray-400">Inactive</span>
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </main>
//       </div>

//       {showModal && (
//         <CommonKRAModal
//           kra={editingKRA}
//           defaultFY={selectedFY}
//           onClose={() => setShowModal(false)}
//           onSuccess={() => {
//             setShowModal(false);
//             fetchKRAs();
//           }}
//         />
//       )}
//     </div>
//   );
// }

// // ==============================================================================
// // MODAL COMPONENT
// // ==============================================================================

// function CommonKRAModal({ kra, defaultFY, onClose, onSuccess }: any) {
//   const isEdit = !!kra;
//   const [saving, setSaving] = useState(false);
//   const [form, setForm] = useState<Partial<CommonKRAMaster>>({
//     financial_year: kra?.financial_year || defaultFY,
//     name: kra?.name || '',
//     description: kra?.description || '',
//     default_weight: kra ? Number(kra.default_weight) : 5,
//     applies_to_all: kra?.applies_to_all ?? true,
//     is_active: kra?.is_active ?? true,
//   });

//   const handleSave = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSaving(true);
//     try {
//       if (isEdit) await commonKRAApi.update(kra.id, form);
//       else await commonKRAApi.create(form);
//       toast.success(isEdit ? 'Updated successfully' : 'Created successfully');
//       onSuccess();
//     } catch (err: any) {
//       toast.error(err.response?.data?.detail || 'Failed to save');
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//       <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
//         <div className="flex justify-between items-center mb-5 border-b pb-3">
//           <h3 className="font-bold text-lg text-gray-900">{isEdit ? 'Edit Common KRA' : 'New Common KRA'}</h3>
//           <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
//         </div>
        
//         <form onSubmit={handleSave} className="space-y-4">
//           <div>
//             <label className="text-xs font-bold text-gray-600 uppercase">Financial Year</label>
//             <input type="text" disabled value={form.financial_year} className="w-full mt-1 border border-gray-200 bg-gray-50 rounded-lg p-2.5 text-sm" />
//           </div>
          
//           <div>
//             <label className="text-xs font-bold text-gray-600 uppercase">KRA Name *</label>
//             <input required type="text" placeholder="e.g. Compliance & Attendance" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full mt-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
//           </div>

//           <div>
//             <label className="text-xs font-bold text-gray-600 uppercase">Description *</label>
//             <textarea required placeholder="What does this cover?" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full mt-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
//           </div>

//           <div>
//             <label className="text-xs font-bold text-gray-600 uppercase">Default Weight (%) *</label>
//             <input required type="number" min="0" max="100" value={form.default_weight} onChange={e => setForm({...form, default_weight: Number(e.target.value)})} className="w-full mt-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
//           </div>
          
//           <label className="flex items-center gap-2 text-sm text-gray-700 pt-2">
//             <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded text-primary-600 w-4 h-4" />
//             Active (will be injected into new plans)
//           </label>
          
//           <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
//             <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl text-sm font-medium text-gray-600">Cancel</button>
//             <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
//               {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
//               {isEdit ? 'Update' : 'Save'}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }


import { useEffect, useMemo, useState } from 'react';
import {
  Users, Plus, Trash2, Edit, Loader2, Info, X, Save,
  Calendar, CheckCircle2, Zap,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { commonKRAApi, monthlyKPIsApi } from '../../api/performance';
import type { CommonKRAMaster, CommonKPIMaster } from '../../types/performance';
import api from '../../api/axios';
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

export default function CommonKRAMasterPage() {
  const [kras, setKras] = useState<CommonKRAMaster[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showKraModal, setShowKraModal] = useState(false);
  const [showKpiModal, setShowKpiModal] = useState(false);
  
  const [editingKRA, setEditingKRA] = useState<CommonKRAMaster | null>(null);
  const [parentKraId, setParentKraId] = useState<string | null>(null);

  const fyOptions = useMemo(() => generateFYOptions(), []);
  const [selectedFY, setSelectedFY] = useState<string>('2026-27');

  const fetchKRAs = async () => {
    setLoading(true);
    try {
      const data = await commonKRAApi.list({ financial_year: selectedFY });
      setKras(data);
    } catch {
      toast.error('Failed to load Common KRAs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKRAs();
  }, [selectedFY]);

  const handleDelete = async (kra: CommonKRAMaster) => {
    if (!confirm(`Delete Common KRA "${kra.name}"?`)) return;
    try {
      await commonKRAApi.delete(kra.id);
      toast.success('Deleted successfully');
      fetchKRAs();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleDeleteKPI = async (kpiId: string) => {
    if (!confirm('Delete this KPI template?')) return;
    try {
      // Direct axios call since we don't have a dedicated API service mapped for this yet
      await api.delete(`/common-kpis/${kpiId}/`);
      toast.success('KPI deleted');
      fetchKRAs();
    } catch {
      toast.error('Failed to delete KPI');
    }
  };

  const openCreateKRA = () => {
    setEditingKRA(null);
    setShowKraModal(true);
  };

  const openAddKPI = (kraId: string) => {
    setParentKraId(kraId);
    setShowKpiModal(true);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">Common KRAs (Master)</h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                These auto-inject into every employee's monthly plan.
              </p>
            </div>
            <button onClick={openCreateKRA} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
              <Plus className="h-4 w-4" /> New Common KRA
            </button>
          </div>

          <div className="mb-6 flex items-center gap-3">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500"
            >
              {fyOptions.map((fy) => <option key={fy} value={fy}>FY {fy}</option>)}
            </select>
            <span className="text-xs text-gray-500">{kras.length} items found</span>
          </div>

          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin mx-auto mt-10 text-primary-600" />
          ) : kras.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm border border-gray-200">
              <Users className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 font-semibold text-gray-900">No Common KRAs found for {selectedFY}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kras.map((kra) => (
                <div key={kra.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900 text-lg">{kra.name}</h3>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingKRA(kra); setShowKraModal(true); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(kra)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{kra.description}</p>
                  
                  <div className="mt-auto border-t border-gray-100 pt-3">
                    <div className="flex justify-between items-center mb-3">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold">Weight: {kra.default_weight}%</span>
                      <button onClick={() => openAddKPI(kra.id)} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded-lg">
                        <Plus className="h-3.5 w-3.5" /> Add KPI Default
                      </button>
                    </div>

                    {kra.kpis && kra.kpis.length > 0 ? (
                      <div className="space-y-2">
                        {kra.kpis.map(kpi => (
                          <div key={kpi.id} className="bg-gray-50 p-2 rounded-lg text-xs flex justify-between items-center">
                            <span><strong className="text-gray-900">{kpi.name}</strong> ({kpi.metric_type})</span>
                            <div className="flex items-center gap-3">
                              <span className="text-indigo-700 font-bold">Target: {kpi.default_target}</span>
                              <button onClick={() => handleDeleteKPI(kpi.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">⚠️ No default KPIs added. Add one to measure this KRA.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {showKraModal && (
        <CommonKRAModal kra={editingKRA} defaultFY={selectedFY} onClose={() => setShowKraModal(false)} onSuccess={() => { setShowKraModal(false); fetchKRAs(); }} />
      )}

      {showKpiModal && parentKraId && (
        <CommonKPIModal kraId={parentKraId} onClose={() => setShowKpiModal(false)} onSuccess={() => { setShowKpiModal(false); fetchKRAs(); }} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------
// COMMON KRA MODAL (Same as before)
// ------------------------------------------------------------------------------
function CommonKRAModal({ kra, defaultFY, onClose, onSuccess }: any) {
  const isEdit = !!kra;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CommonKRAMaster>>({
    financial_year: kra?.financial_year || defaultFY,
    name: kra?.name || '',
    description: kra?.description || '',
    default_weight: kra ? Number(kra.default_weight) : 5,
    applies_to_all: kra?.applies_to_all ?? true,
    is_active: kra?.is_active ?? true,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) await commonKRAApi.update(kra.id, form);
      else await commonKRAApi.create(form);
      toast.success(isEdit ? 'Updated' : 'Created');
      onSuccess();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
        <h3 className="font-bold text-lg mb-4">{isEdit ? 'Edit Common KRA' : 'New Common KRA'}</h3>
        <form onSubmit={handleSave} className="space-y-3">
          <input type="text" disabled value={form.financial_year} className="w-full border bg-gray-50 rounded-lg p-2 text-sm" />
          <input required type="text" placeholder="KRA Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
          <textarea required placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full border rounded-lg p-2 text-sm" />
          <input required type="number" placeholder="Default Weight %" value={form.default_weight} onChange={e => setForm({...form, default_weight: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------
// NEW: KPI MODAL
// ------------------------------------------------------------------------------
function CommonKPIModal({ kraId, onClose, onSuccess }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    common_kra: kraId,
    name: '',
    metric_type: 'PERCENTAGE',
    default_target: '100',
    weight_in_kra: 100,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/common-kpis/', form);
      toast.success('KPI default added');
      onSuccess();
    } catch {
      toast.error('Failed to add KPI');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl">
        <h3 className="font-bold text-lg mb-4 text-gray-900"><Zap className="inline h-5 w-5 text-indigo-600 mr-2"/>Add KPI Default</h3>
        <form onSubmit={handleSave} className="space-y-3">
          <input required type="text" placeholder="KPI Name (e.g. Present Days)" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm" />
          <select required value={form.metric_type} onChange={e => setForm({...form, metric_type: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm">
            <option value="NUMERIC_UP">Numeric (Higher is better)</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="BOOLEAN">Yes / No</option>
          </select>
          <input required type="text" placeholder="Default Target (e.g. 95)" value={form.default_target} onChange={e => setForm({...form, default_target: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm" />
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Save KPI</button>
          </div>
        </form>
      </div>
    </div>
  );
}