// import { useEffect, useState } from 'react';
// import { Plus, Edit, Trash2, Loader2, Shield, X } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { rolesApi } from '../../api/masterData';
// import type { Role } from '../../types/masterData';
// import toast from 'react-hot-toast';
// import { AxiosError } from 'axios';

// export default function RolesPage() {
//   const [roles, setRoles] = useState<Role[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [modalOpen, setModalOpen] = useState(false);
//   const [editingRole, setEditingRole] = useState<Role | null>(null);

//   const [form, setForm] = useState({
//     role_name: '',
//     code: '',
//     description: '',
//     level: 10,
//     is_active: true,
//   });

//   const fetchRoles = async () => {
//     setLoading(true);
//     try {
//       const data = await rolesApi.list();
//       setRoles(data.results);
//     } catch {
//       toast.error('Failed to load roles');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchRoles();
//   }, []);

//   const openAdd = () => {
//     setEditingRole(null);
//     setForm({ role_name: '', code: '', description: '', level: 10, is_active: true });
//     setModalOpen(true);
//   };

//   const openEdit = (role: Role) => {
//     setEditingRole(role);
//     setForm({
//       role_name: role.role_name,
//       code: role.code,
//       description: role.description || '',
//       level: role.level,
//       is_active: role.is_active,
//     });
//     setModalOpen(true);
//   };

//   const handleSave = async () => {
//     if (!form.role_name.trim() || !form.code.trim()) {
//       toast.error('Role name and code are required');
//       return;
//     }
//     try {
//       if (editingRole) {
//         await rolesApi.update(editingRole.id, form);
//         toast.success('Role updated');
//       } else {
//         await rolesApi.create(form);
//         toast.success('Role created');
//       }
//       setModalOpen(false);
//       fetchRoles();
//     } catch (err) {
//       const error = err as AxiosError<{ detail?: string }>;
//       toast.error(error.response?.data?.detail || 'Failed to save role');
//     }
//   };

//   const handleDelete = async (role: Role) => {
//     if (!confirm(`Delete role "${role.role_name}"?`)) return;
//     try {
//       await rolesApi.delete(role.id);
//       toast.success('Role deleted');
//       fetchRoles();
//     } catch (err) {
//       const error = err as AxiosError<{ detail?: string }>;
//       toast.error(error.response?.data?.detail || 'Failed to delete');
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
//               <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
//               <p className="mt-1 text-sm text-gray-600">Manage user roles and permissions</p>
//             </div>
//             <button
//               onClick={openAdd}
//               className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
//             >
//               <Plus className="h-4 w-4" /> Add Role
//             </button>
//           </div>

//           <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
//             {loading ? (
//               <div className="flex justify-center py-16">
//                 <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//               </div>
//             ) : roles.length === 0 ? (
//               <div className="flex flex-col items-center py-16 text-gray-500">
//                 <Shield className="mb-3 h-12 w-12 text-gray-300" />
//                 <p>No roles yet</p>
//               </div>
//             ) : (
//               <table className="w-full">
//                 <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
//                   <tr>
//                     <th className="px-4 py-3">Role Name</th>
//                     <th className="px-4 py-3">Code</th>
//                     <th className="px-4 py-3">Level</th>
//                     <th className="px-4 py-3">Users</th>
//                     <th className="px-4 py-3">Status</th>
//                     <th className="px-4 py-3 text-right">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y text-sm">
//                   {roles.map((role) => (
//                     <tr key={role.id} className="hover:bg-gray-50">
//                       <td className="px-4 py-3 font-medium">{role.role_name}</td>
//                       <td className="px-4 py-3 font-mono text-xs text-gray-600">{role.code}</td>
//                       <td className="px-4 py-3">{role.level}</td>
//                       <td className="px-4 py-3">{role.user_count || 0}</td>
//                       <td className="px-4 py-3">
//                         <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
//                           role.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
//                         }`}>
//                           {role.is_active ? 'Active' : 'Inactive'}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 text-right">
//                         <button onClick={() => openEdit(role)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600">
//                           <Edit className="h-4 w-4" />
//                         </button>
//                         <button onClick={() => handleDelete(role)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600">
//                           <Trash2 className="h-4 w-4" />
//                         </button>
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
//               <h2 className="text-lg font-bold">{editingRole ? 'Edit Role' : 'Add Role'}</h2>
//               <button onClick={() => setModalOpen(false)} className="rounded p-1 hover:bg-gray-100">
//                 <X className="h-4 w-4" />
//               </button>
//             </div>

//             <div className="space-y-4">
//               <div>
//                 <label className="mb-1 block text-sm font-medium">Role Name *</label>
//                 <input
//                   type="text"
//                   value={form.role_name}
//                   onChange={(e) => setForm({ ...form, role_name: e.target.value })}
//                   placeholder="e.g., FINANCE_MANAGER"
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
//                 />
//               </div>
//               <div>
//                 <label className="mb-1 block text-sm font-medium">Code *</label>
//                 <input
//                   type="text"
//                   value={form.code}
//                   onChange={(e) => setForm({ ...form, code: e.target.value })}
//                   placeholder="e.g., finance_manager"
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
//                 />
//               </div>
//               <div>
//                 <label className="mb-1 block text-sm font-medium">Description</label>
//                 <textarea
//                   value={form.description}
//                   onChange={(e) => setForm({ ...form, description: e.target.value })}
//                   rows={2}
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
//                 />
//               </div>
//               <div>
//                 <label className="mb-1 block text-sm font-medium">Level (higher = more privileges)</label>
//                 <input
//                   type="number"
//                   value={form.level}
//                   onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) || 0 })}
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
//                 />
//               </div>
//               <label className="flex items-center gap-2 text-sm">
//                 <input
//                   type="checkbox"
//                   checked={form.is_active}
//                   onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
//                   className="h-4 w-4 rounded"
//                 />
//                 Active
//               </label>
//             </div>

//             <div className="mt-6 flex justify-end gap-2">
//               <button onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
//                 Cancel
//               </button>
//               <button onClick={handleSave} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
//                 {editingRole ? 'Update' : 'Create'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Loader2, Shield, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { rolesApi } from '../../api/masterData';
import type { Role } from '../../types/masterData';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

// Matches the ROLE_CHOICES in Django models.py
const ROLE_OPTIONS = [
  { value: 'SYSTEM_ADMIN', label: 'System Administrator', defaultCode: 'system_admin' },
  { value: 'HR_ADMIN', label: 'HR Administrator', defaultCode: 'hr_admin' },
  { value: 'REPORTING_MANAGER', label: 'Reporting Manager', defaultCode: 'reporting_manager' }, // 👈 ADDED
  { value: 'HOD', label: 'Department Head (HOD)', defaultCode: 'hod' },                         // 👈 ADDED
  { value: 'MANAGER', label: 'Manager (General)', defaultCode: 'manager' },
  { value: 'EMPLOYEE', label: 'Employee', defaultCode: 'employee' },
  { value: 'KIOSK', label: 'Kiosk Terminal', defaultCode: 'kiosk' },
];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    role_name: 'EMPLOYEE',
    code: 'employee',
    description: '',
    level: 10,
    is_active: true,
  });

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const data = await rolesApi.list();
      setRoles(data.results || data);
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const openAdd = () => {
    setEditingRole(null);
    setForm({ role_name: 'EMPLOYEE', code: 'employee', description: '', level: 10, is_active: true });
    setModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setForm({
      role_name: role.role_name,
      code: role.code,
      description: role.description || '',
      level: role.level,
      is_active: role.is_active,
    });
    setModalOpen(true);
  };

  // Auto-fill the code when role_name changes (only for new roles)
  const handleRoleChange = (selectedRole: string) => {
    const config = ROLE_OPTIONS.find((r) => r.value === selectedRole);
    setForm((prev) => ({
      ...prev,
      role_name: selectedRole,
      code: !editingRole && config ? config.defaultCode : prev.code, // auto-update code if adding new
    }));
  };

  const handleSave = async () => {
    if (!form.role_name.trim() || !form.code.trim()) {
      toast.error('Role name and code are required');
      return;
    }
    setSaving(true);
    try {
      if (editingRole) {
        await rolesApi.update(editingRole.id, form);
        toast.success('Role updated');
      } else {
        await rolesApi.create(form);
        toast.success('Role created');
      }
      setModalOpen(false);
      fetchRoles();
    } catch (err) {
      const error = err as AxiosError<{ detail?: string; role_name?: string[]; code?: string[] }>;
      const data = error.response?.data;
      const errorMsg = data?.detail || data?.role_name?.[0] || data?.code?.[0] || 'Failed to save role';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Delete role "${role.role_name}"?`)) return;
    try {
      await rolesApi.delete(role.id);
      toast.success('Role deleted');
      fetchRoles();
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
              <p className="mt-1 text-sm text-gray-600">Manage user roles and permissions</p>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add Role
            </button>
          </div>

          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : roles.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-500">
                <Shield className="mb-3 h-12 w-12 text-gray-300" />
                <p>No roles yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Role Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Users</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {roles.map((role) => {
                    const label = ROLE_OPTIONS.find((r) => r.value === role.role_name)?.label || role.role_name;
                    return (
                      <tr key={role.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-gray-900">{label}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{role.code}</td>
                        <td className="px-4 py-3">{role.level}</td>
                        <td className="px-4 py-3">{role.user_count || 0}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            role.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {role.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEdit(role)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(role)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">{editingRole ? 'Edit Role' : 'Add Role'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
                <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role Name *</label>
                                <select
                  value={ROLE_OPTIONS.some((o) => o.value === form.role_name) ? form.role_name : 'CUSTOM'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'CUSTOM') {
                      setForm((prev) => ({ ...prev, role_name: '', code: '' }));
                    } else {
                      const config = ROLE_OPTIONS.find((r) => r.value === val);
                      setForm((prev) => ({
                        ...prev,
                        role_name: val,
                        code: config ? config.defaultCode : prev.code,
                      }));
                    }
                  }}
                  disabled={!!editingRole}
                  className="w-full mb-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="CUSTOM">➕ Create Custom Role...</option>
                </select>

                {(!ROLE_OPTIONS.some(o => o.value === form.role_name) || form.role_name === '') && (
                  <input
                    type="text"
                    value={form.role_name}
                    onChange={(e) => setForm({ 
                      ...form, 
                      role_name: e.target.value.toUpperCase(), 
                      code: e.target.value.toLowerCase().replace(/\s+/g, '_') 
                    })}
                    disabled={!!editingRole}
                    placeholder="Type custom role name"
                    className="w-full rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="e.g., system_admin"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Privilege Level (Higher = more access)</label>
                <input
                  type="number"
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 pt-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                Active Role
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t pt-4">
              <button onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 text-gray-700 font-medium">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}