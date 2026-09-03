// import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { Search, Filter, Plus, Eye, Loader2, Users } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { employeesApi } from '../../api/employees';
// import type { EmployeeListItem } from '../../types/employee';
// import { useAuth } from '../../context/AuthContext';
// import toast from 'react-hot-toast';

// const statusStyles: Record<string, string> = {
//   ACTIVE: 'bg-green-100 text-green-700',
//   PROBATION: 'bg-amber-100 text-amber-700',
//   SUSPENDED: 'bg-orange-100 text-orange-700',
//   TERMINATED: 'bg-red-100 text-red-700',
// };

// export default function EmployeeList() {
//   const navigate = useNavigate();
//   const { user } = useAuth();

//   const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
//   const [count, setCount] = useState(0);
//   const [page, setPage] = useState(1);
//   const [search, setSearch] = useState('');
//   const [status, setStatus] = useState('');
//   const [loading, setLoading] = useState(true);

//   const pageSize = 20;
//   const totalPages = Math.ceil(count / pageSize);
//   const isHRAdmin = user?.role_codes.includes('HR_ADMIN') || user?.role_codes.includes('SYSTEM_ADMIN');

//   const fetchEmployees = async () => {
//     setLoading(true);
//     try {
//       const data = await employeesApi.list({
//         page,
//         search: search || undefined,
//         status: status || undefined,
//       });
//       setEmployees(data.results);
//       setCount(data.count);
//     } catch {
//       toast.error('Failed to load employees');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     const timer = setTimeout(fetchEmployees, 300);
//     return () => clearTimeout(timer);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [page, search, status]);

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6 flex items-center justify-between">
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
//               <p className="mt-1 text-sm text-gray-600">
//                 {count} employee{count !== 1 ? 's' : ''} found
//               </p>
//             </div>
//             {isHRAdmin && (
//               <button
//                 onClick={() => navigate('/employees/new')}
//                 className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
//               >
//                 <Plus className="h-4 w-4" />
//                 Add Employee
//               </button>
//             )}
//           </div>

//           {/* Filters */}
//           <div className="mb-4 flex flex-wrap gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
//             <div className="relative flex-1 min-w-[240px]">
//               <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
//               <input
//                 type="text"
//                 value={search}
//                 onChange={(e) => {
//                   setSearch(e.target.value);
//                   setPage(1);
//                 }}
//                 placeholder="Search by name, ID, email..."
//                 className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//               />
//             </div>

//             <div className="relative">
//               <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
//               <select
//                 value={status}
//                 onChange={(e) => {
//                   setStatus(e.target.value);
//                   setPage(1);
//                 }}
//                 className="rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//               >
//                 <option value="">All Status</option>
//                 <option value="ACTIVE">Active</option>
//                 <option value="PROBATION">Probation</option>
//                 <option value="SUSPENDED">Suspended</option>
//                 <option value="TERMINATED">Terminated</option>
//               </select>
//             </div>
//           </div>

//           {/* Table */}
//           <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
//             {loading ? (
//               <div className="flex items-center justify-center py-16">
//                 <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//               </div>
//             ) : employees.length === 0 ? (
//               <div className="flex flex-col items-center justify-center py-16 text-gray-500">
//                 <Users className="mb-3 h-12 w-12 text-gray-300" />
//                 <p>No employees found</p>
//               </div>
//             ) : (
//               <table className="w-full">
//                 <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
//                   <tr>
//                     <th className="px-4 py-3">Employee ID</th>
//                     <th className="px-4 py-3">Name</th>
//                     <th className="px-4 py-3">Email</th>
//                     <th className="px-4 py-3">Position</th>
//                     <th className="px-4 py-3">Department</th>
//                     <th className="px-4 py-3">Status</th>
//                     <th className="px-4 py-3 text-right">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-gray-100 text-sm">
//                   {employees.map((emp) => (
//                     <tr
//                       key={emp.id}
//                       className="cursor-pointer transition hover:bg-gray-50"
//                       onClick={() => navigate(`/employees/${emp.id}`)}
//                     >
//                       <td className="px-4 py-3 font-mono text-xs text-gray-600">
//                         {emp.employee_id}
//                       </td>
//                       <td className="px-4 py-3">
//                         <div className="flex items-center gap-3">
//                           <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
//                             {emp.first_name[0]}
//                             {emp.last_name[0]}
//                           </div>
//                           <span className="font-medium text-gray-900">
//                             {emp.full_name}
//                           </span>
//                         </div>
//                       </td>
//                       <td className="px-4 py-3 text-gray-600">{emp.official_email}</td>
//                       <td className="px-4 py-3 text-gray-600">
//                         {emp.position_title || '—'}
//                       </td>
//                       <td className="px-4 py-3 text-gray-600">
//                         {emp.department_name || '—'}
//                       </td>
//                       <td className="px-4 py-3">
//                         <span
//                           className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
//                             statusStyles[emp.status] || 'bg-gray-100 text-gray-700'
//                           }`}
//                         >
//                           {emp.status}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 text-right">
//                         <button
//                           onClick={(e) => {
//                             e.stopPropagation();
//                             navigate(`/employees/${emp.id}`);
//                           }}
//                           className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
//                           title="View"
//                         >
//                           <Eye className="h-4 w-4" />
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             )}

//             {/* Pagination */}
//             {!loading && employees.length > 0 && totalPages > 1 && (
//               <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
//                 <p className="text-sm text-gray-600">
//                   Page {page} of {totalPages}
//                 </p>
//                 <div className="flex gap-2">
//                   <button
//                     onClick={() => setPage((p) => Math.max(1, p - 1))}
//                     disabled={page === 1}
//                     className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
//                   >
//                     Previous
//                   </button>
//                   <button
//                     onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
//                     disabled={page === totalPages}
//                     className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
//                   >
//                     Next
//                   </button>
//                 </div>
//               </div>
//             )}
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, Eye, Loader2, Users, Upload } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import BulkImportModal from '../../components/BulkImportModal';
import { employeesApi } from '../../api/employees';
import type { EmployeeListItem } from '../../types/employee';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PROBATION: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  TERMINATED: 'bg-red-100 text-red-700',
};

export default function EmployeeList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBulkImport, setShowBulkImport] = useState(false);   // ⬅️ NEW

  const pageSize = 20;
  const totalPages = Math.ceil(count / pageSize);
  const isHRAdmin = user?.role_codes.includes('HR_ADMIN') || user?.role_codes.includes('SYSTEM_ADMIN');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const data = await employeesApi.list({
        page,
        search: search || undefined,
        status: status || undefined,
      });
      setEmployees(data.results);
      setCount(data.count);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
              <p className="mt-1 text-sm text-gray-600">
                {count} employee{count !== 1 ? 's' : ''} found
              </p>
            </div>
            {isHRAdmin && (
              <div className="flex gap-3">
                {/* ⬅️ NEW: Import CSV button */}
                <button
                  onClick={() => setShowBulkImport(true)}
                  className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
                >
                  <Upload className="h-4 w-4" />
                  Import CSV
                </button>
                <button
                  onClick={() => navigate('/employees/new')}
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Employee
                </button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, ID, email..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="PROBATION">Probation</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Users className="mb-3 h-12 w-12 text-gray-300" />
                <p>No employees found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Position</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="cursor-pointer transition hover:bg-gray-50"
                      onClick={() => navigate(`/employees/${emp.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {emp.employee_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                            {emp.first_name[0]}
                            {emp.last_name[0]}
                          </div>
                          <span className="font-medium text-gray-900">
                            {emp.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{emp.official_email}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {emp.position_title || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {emp.department_name || '—'}
                      </td>
                      {/* Role Column Cell */}
<td className="px-4 py-3 text-gray-600">
  {emp.role_names && emp.role_names.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {emp.role_names.map((roleName: string) => (
        <span
          key={roleName}
          className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200"
        >
          {roleName}
        </span>
      ))}
    </div>
  ) : emp.role_codes && emp.role_codes.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {emp.role_codes.map((code: string) => (
        <span
          key={code}
          className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold uppercase text-indigo-700 ring-1 ring-inset ring-indigo-200"
        >
          {code.replace('_', ' ')}
        </span>
      ))}
    </div>
  ) : (
    <span className="text-gray-400">—</span>
  )}
</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            statusStyles[emp.status] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/employees/${emp.id}`);
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {!loading && employees.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ⬅️ NEW: Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSuccess={() => {
          setShowBulkImport(false);
          fetchEmployees(); // Reload the employee list
        }}
      />
    </div>
  );
}