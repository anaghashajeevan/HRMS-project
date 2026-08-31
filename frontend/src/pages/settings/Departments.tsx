// import { useEffect, useState } from 'react';
// import { Plus, Edit, Trash2, Loader2, Building2, X } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { structuresApi } from '../../api/masterData';
// import type { CompanyStructure } from '../../types/masterData';
// import toast from 'react-hot-toast';
// import { AxiosError } from 'axios';

// const TYPE_OPTIONS = [
//   { value: 'DEPARTMENT', label: 'Department' },
//   { value: 'BUSINESS_UNIT', label: 'Business Unit' },
//   { value: 'LOCATION', label: 'Location' },
//   { value: 'COST_CENTER', label: 'Cost Center' },
//   { value: 'COMPANY', label: 'Company' },
// ];

// export default function DepartmentsPage() {
//   const [items, setItems] = useState<CompanyStructure[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [modalOpen, setModalOpen] = useState(false);
//   const [editing, setEditing] = useState<CompanyStructure | null>(null);
//   const [form, setForm] = useState({
//     name: '',
//     type: 'DEPARTMENT',
//     parent: '',
//     cost_center_code: '',
//     is_active: true,
//   });

//   const fetchItems = async () => {
//     setLoading(true);
//     try {
//       const data = await structuresApi.list();
//       setItems(data.results);
//     } catch {
//       toast.error('Failed to load');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchItems();
//   }, []);

//   const openAdd = () => {
//     setEditing(null);
//     setForm({ name: '', type: 'DEPARTMENT', parent: '', cost_center_code: '', is_active: true });
//     setModalOpen(true);
//   };

//   const openEdit = (item: CompanyStructure) => {
//     setEditing(item);
//     setForm({
//       name: item.name,
//       type: item.type,
//       parent: item.parent || '',
//       cost_center_code: item.cost_center_code || '',
//       is_active: item.is_active,
//     });
//     setModalOpen(true);
//   };

//   const handleSave = async () => {
//     if (!form.name.trim()) {
//       toast.error('Name is required');
//       return;
//     }
//     try {
//       const payload = {
//         ...form,
//         parent: form.parent || null,
//         cost_center_code: form.cost_center_code || null,
//       };
//       if (editing) {
//         await structuresApi.update(editing.id, payload as never);
//         toast.success('Updated');
//       } else {
//         await structuresApi.create(payload as never);
//         toast.success('Created');
//       }
//       setModalOpen(false);
//       fetchItems();
//     } catch (err) {
//       const error = err as AxiosError<{ detail?: string }>;
//       toast.error(error.response?.data?.detail || 'Save failed');
//     }
//   };

//   const handleDelete = async (item: CompanyStructure) => {
//     if (!confirm(`Delete "${item.name}"?`)) return;
//     try {
//       await structuresApi.delete(item.id);
//       toast.success('Deleted');
//       fetchItems();
//     } catch (err) {
//       const error = err as AxiosError<{ detail?: string }>;
//       toast.error(error.response?.data?.detail || 'Delete failed');
//     }
//   };

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           <div className="mb-6 flex items-center justify-between">
//             <div>
//               <h1 className="text-2xl font-bold">Departments & Locations</h1>
//               <p className="mt-1 text-sm text-gray-600">Manage company structure</p>
//             </div>
//             <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
//               <Plus className="h-4 w-4" /> Add
//             </button>
//           </div>

//           <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
//             {loading ? (
//               <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
//             ) : items.length === 0 ? (
//               <div className="flex flex-col items-center py-16 text-gray-500">
//                 <Building2 className="mb-3 h-12 w-12 text-gray-300" />
//                 <p>No entries yet</p>
//               </div>
//             ) : (
//               <table className="w-full">
//                 <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
//                   <tr>
//                     <th className="px-4 py-3">Name</th>
//                     <th className="px-4 py-3">Type</th>
//                     <th className="px-4 py-3">Parent</th>
//                     <th className="px-4 py-3">Cost Center</th>
//                     <th className="px-4 py-3">Employees</th>
//                     <th className="px-4 py-3">Status</th>
//                     <th className="px-4 py-3 text-right">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y text-sm">
//                   {items.map((it) => (
//                     <tr key={it.id} className="hover:bg-gray-50">
//                       <td className="px-4 py-3 font-medium">{it.name}</td>
//                       <td className="px-4 py-3"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{it.type}</span></td>
//                       <td className="px-4 py-3 text-gray-600">{it.parent_name || '—'}</td>
//                       <td className="px-4 py-3 font-mono text-xs text-gray-600">{it.cost_center_code || '—'}</td>
//                       <td className="px-4 py-3">{it.employee_count}</td>
//                       <td className="px-4 py-3">
//                         <span className={`rounded-full px-2 py-0.5 text-xs ${it.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
//                           {it.is_active ? 'Active' : 'Inactive'}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 text-right">
//                         <button onClick={() => openEdit(it)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"><Edit className="h-4 w-4" /></button>
//                         <button onClick={() => handleDelete(it)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             )}
//           </div>
//         </main>
//       </div>

//       {modalOpen && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
//           <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
//             <div className="mb-4 flex items-center justify-between">
//               <h2 className="text-lg font-bold">{editing ? 'Edit' : 'Add'} Structure</h2>
//               <button onClick={() => setModalOpen(false)} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
//             </div>
//             <div className="space-y-4">
//               <div>
//                 <label className="mb-1 block text-sm font-medium">Name *</label>
//                 <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
//               </div>
//               <div>
//                 <label className="mb-1 block text-sm font-medium">Type *</label>
//                 <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
//                   {TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
//                 </select>
//               </div>
//               <div>
//                 <label className="mb-1 block text-sm font-medium">Parent (optional)</label>
//                 <select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
//                   <option value="">— None —</option>
//                   {items.filter((i) => i.id !== editing?.id).map((i) => (
//                     <option key={i.id} value={i.id}>{i.name} ({i.type})</option>
//                   ))}
//                 </select>
//               </div>
//               <div>
//                 <label className="mb-1 block text-sm font-medium">Cost Center Code</label>
//                 <input type="text" value={form.cost_center_code} onChange={(e) => setForm({ ...form, cost_center_code: e.target.value })} placeholder="e.g., CC-IT-001" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
//               </div>
//               <label className="flex items-center gap-2 text-sm">
//                 <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded" />
//                 Active
//               </label>
//             </div>
//             <div className="mt-6 flex justify-end gap-2">
//               <button onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
//               <button onClick={handleSave} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">{editing ? 'Update' : 'Create'}</button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import {
  Plus, Edit, Trash2, Loader2, Building2, X, ChevronRight, ChevronDown,
  MapPin, Users, Briefcase, Landmark, Crown, Target, Network,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { structuresApi } from '../../api/masterData';
import type { CompanyStructure } from '../../types/masterData';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';
import { employeesApi, type ManagerOption } from '../../api/employees';

const TYPE_OPTIONS = [
  { value: 'COMPANY', label: 'Company', level: 1, icon: Crown, color: '#1E40AF' },
  { value: 'HQ', label: 'Headquarters', level: 2, icon: Building2, color: '#7C3AED' },
  { value: 'BUSINESS_UNIT', label: 'Business Unit', level: 3, icon: Briefcase, color: '#0891B2' },
  { value: 'LOCATION', label: 'Location / Branch', level: 4, icon: MapPin, color: '#059669' },
  { value: 'DEPARTMENT', label: 'Department', level: 5, icon: Users, color: '#D97706' },
  { value: 'TEAM', label: 'Team / Sub-Dept', level: 6, icon: Target, color: '#DC2626' },
  { value: 'COST_CENTER', label: 'Cost Center', level: 7, icon: Landmark, color: '#6B7280' },
];

const TYPE_MAP = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t]));

interface TreeNode extends CompanyStructure {
  children_nodes: TreeNode[];
}

function buildTree(items: CompanyStructure[]): TreeNode[] {
  const map: Record<string, TreeNode> = {};
  items.forEach((item) => {
    map[item.id] = { ...item, children_nodes: [] };
  });
  const roots: TreeNode[] = [];
  items.forEach((item) => {
    if (item.parent && map[item.parent]) {
      map[item.parent].children_nodes.push(map[item.id]);
    } else {
      roots.push(map[item.id]);
    }
  });
  return roots;
}

export default function DepartmentsPage() {
  const [items, setItems] = useState<CompanyStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyStructure | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [hods, setHods] = useState<ManagerOption[]>([]);
  const [form, setForm] = useState({
    name: '',
    type: 'DEPARTMENT',
    parent: '',
    cost_center_code: '',
    department_head: '', 
    is_active: true,
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await structuresApi.list();
      setItems(data.results || data as any);
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // 👇 Fetch employees with HOD role for dropdown
    employeesApi.getManagers('', 'HOD').then(setHods).catch(() => {});
  }, []);

  const openAdd = (parentId?: string, suggestedType?: string) => {
    setEditing(null);
    setForm({
      name: '',
      type: suggestedType || 'DEPARTMENT',
      parent: parentId || '',
      cost_center_code: '',
      department_head: '',  // 👈 ADD
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (item: CompanyStructure) => {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      parent: item.parent || '',
      cost_center_code: item.cost_center_code || '',
      department_head: (item as any).department_head || '',  // 👈 ADD
      is_active: item.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const payload = {
        ...form,
        parent: form.parent || null,
        cost_center_code: form.cost_center_code || null,
        department_head: form.department_head || null,  
      };
      if (editing) {
        await structuresApi.update(editing.id, payload as never);
        toast.success('Updated');
      } else {
        await structuresApi.create(payload as never);
        toast.success('Created');
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      toast.error(error.response?.data?.detail || 'Save failed');
    }
  };

  const handleDelete = async (item: CompanyStructure) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await structuresApi.delete(item.id);
      toast.success('Deleted');
      fetchItems();
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const tree = buildTree(items);

  // Suggest child type based on parent
  const suggestChildType = (parentType: string): string => {
    const currentLevel = TYPE_MAP[parentType]?.level || 1;
    const nextType = TYPE_OPTIONS.find((t) => t.level > currentLevel);
    return nextType?.value || 'DEPARTMENT';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100">
                <Network className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Company Structure</h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  {items.length} node{items.length !== 1 ? 's' : ''} in hierarchy
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex rounded-lg border border-gray-300 bg-white p-1">
                <button
                  onClick={() => setViewMode('tree')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === 'tree'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Tree View
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === 'table'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Table View
                </button>
              </div>
              <button
                onClick={() => openAdd()}
                className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          {/* Hierarchy Level Guide */}
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <span className="text-xs font-semibold text-gray-500 uppercase mr-2">Levels:</span>
            {TYPE_OPTIONS.map((t, i) => {
              const Icon = t.icon;
              return (
                <span key={t.value} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-gray-300" />}
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {t.label}
                  </span>
                </span>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <Building2 className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-3 text-lg font-semibold text-gray-900">No Structure Yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Start by adding your company, then locations and departments.
              </p>
              <button
                onClick={() => openAdd(undefined, 'COMPANY')}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
              >
                <Plus className="h-4 w-4" />
                Add Company
              </button>
            </div>
          ) : viewMode === 'tree' ? (
            /* TREE VIEW */
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              {tree.map((node) => (
                <TreeNodeComponent
                  key={node.id}
                  node={node}
                  depth={0}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onAddChild={(parentId, parentType) =>
                    openAdd(parentId, suggestChildType(parentType))
                  }
                />
              ))}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
              <table className="w-full">
                <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Parent</th>
                    <th className="px-4 py-3">Path</th>
                    <th className="px-4 py-3">Employees</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {items
                    .sort((a, b) => (a.path || '').localeCompare(b.path || ''))
                    .map((it) => {
                      const typeConfig = TYPE_MAP[it.type];
                      const Icon = typeConfig?.icon || Building2;
                      return (
                        <tr key={it.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="flex h-7 w-7 items-center justify-center rounded-md text-white"
                                style={{ backgroundColor: typeConfig?.color || '#6B7280' }}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <span className="font-medium">{it.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                              style={{ backgroundColor: typeConfig?.color || '#6B7280' }}
                            >
                              {it.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{it.level}</td>
                          <td className="px-4 py-3 text-gray-600">{it.parent_name || '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{it.path || '—'}</td>
                          <td className="px-4 py-3">{it.employee_count}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openEdit(it)}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(it)}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? 'Edit' : 'Add'} Structure</h2>
              <button onClick={() => setModalOpen(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Engineering"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      L{opt.level} — {opt.label}
                    </option>
                  ))}
                </select>
                {form.type && (
                  <p className="mt-1 text-xs text-gray-500">
                    Level {TYPE_MAP[form.type]?.level} in hierarchy
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Parent (optional)</label>
                <select
                  value={form.parent}
                  onChange={(e) => setForm({ ...form, parent: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                >
                  <option value="">— None (Root) —</option>
                  {items
                    .filter((i) => i.id !== editing?.id)
                    .sort((a, b) => (a.path || '').localeCompare(b.path || ''))
                    .map((i) => {
                      const indent = '  '.repeat((i.level || 1) - 1);
                      return (
                        <option key={i.id} value={i.id}>
                          {indent}{i.name} ({i.type})
                        </option>
                      );
                    })}
                </select>
              </div>
              {form.type === 'COST_CENTER' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Cost Center Code</label>
                  <input
                    type="text"
                    value={form.cost_center_code}
                    onChange={(e) => setForm({ ...form, cost_center_code: e.target.value })}
                    placeholder="e.g., CC-IT-001"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>
              )}
                          
              {form.type === 'DEPARTMENT' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Department Head (HOD)
                  </label>
                  <select
                    value={form.department_head}
                    onChange={(e) =>
                      setForm({ ...form, department_head: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  >
                    <option value="">— No HOD Assigned —</option>
                    {hods.map((hod) => (
                      <option key={hod.id} value={hod.id}>
                        {hod.full_name} ({hod.employee_id})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Only employees with the <strong>HOD</strong> role appear here.
                  </p>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                Active
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
              >
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TREE NODE COMPONENT
// ============================================================================

function TreeNodeComponent({
  node,
  depth,
  onEdit,
  onDelete,
  onAddChild,
}: {
  node: TreeNode;
  depth: number;
  onEdit: (item: CompanyStructure) => void;
  onDelete: (item: CompanyStructure) => void;
  onAddChild: (parentId: string, parentType: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 3);
  const hasChildren = node.children_nodes.length > 0;
  const typeConfig = TYPE_MAP[node.type];
  const Icon = typeConfig?.icon || Building2;
  const color = typeConfig?.color || '#6B7280';

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-gray-50"
        style={{ paddingLeft: `${depth * 28 + 8}px` }}
      >
        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded transition ${
            hasChildren ? 'text-gray-500 hover:bg-gray-200' : 'text-transparent'
          }`}
        >
          {hasChildren && (
            expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Type Icon */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-4 w-4" />
        </div>

        {/* Name + Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{node.name}</span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {node.type}
            </span>
          </div>
          {node.path && (
            <p className="truncate font-mono text-[10px] text-gray-400">{node.path}</p>
          )}
        </div>

        {/* Employee count */}
        {(node.employee_count || 0) > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
            {node.employee_count} emp
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={() => onAddChild(node.id, node.type)}
            className="rounded p-1.5 text-gray-400 hover:bg-green-100 hover:text-green-700"
            title="Add child"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(node)}
            className="rounded p-1.5 text-gray-400 hover:bg-blue-100 hover:text-blue-700"
            title="Edit"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(node)}
            className="rounded p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-700"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute top-0 bottom-0 border-l border-gray-200"
            style={{ left: `${depth * 28 + 22}px` }}
          />
          {node.children_nodes.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}