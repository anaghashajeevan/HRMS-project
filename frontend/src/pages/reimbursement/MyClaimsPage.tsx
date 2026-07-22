// import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import {
//   FileSpreadsheet, Loader2, Search, Filter, Plus,
//   CheckCircle2, Clock, XCircle, AlertCircle, Eye,
//   ArrowRight, Receipt, DollarSign,
// } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { claimsApi } from '../../api/reimbursement';
// import type { ReimbursementClaim, ClaimStatus } from '../../types/reimbursement';
// import toast from 'react-hot-toast';

// const STATUS_CONFIG: Record<ClaimStatus, { label: string; className: string; icon: any }> = {
//   DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700', icon: Clock },
//   SUBMITTED: { label: 'Submitted', className: 'bg-blue-100 text-blue-700', icon: Clock },
//   REVIEWING: { label: 'Under Review', className: 'bg-indigo-100 text-indigo-700', icon: Clock },
//   APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
//   PARTIALLY_APPROVED: { label: 'Partially Approved', className: 'bg-amber-100 text-amber-700', icon: AlertCircle },
//   REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700', icon: XCircle },
// };

// export default function MyClaimsPage() {
//   const navigate = useNavigate();
//   const [claims, setClaims] = useState<ReimbursementClaim[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [search, setSearch] = useState('');
//   const [statusFilter, setStatusFilter] = useState<string>('');

//   useEffect(() => {
//     const fetchClaims = async () => {
//       setLoading(true);
//       try {
//         const params: any = { my_only: 'true' };
//         if (statusFilter) params.status = statusFilter;
//         const data = await claimsApi.list(params);
//         setClaims(data);
//       } catch (err) {
//         toast.error('Failed to load claims');
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchClaims();
//   }, [statusFilter]);

//   const filtered = claims.filter((c) => {
//     if (!search.trim()) return true;
//     const q = search.toLowerCase();
//     return (
//       c.employee_name?.toLowerCase().includes(q) ||
//       c.employee_code?.toLowerCase().includes(q) ||
//       c.remarks?.toLowerCase().includes(q)
//     );
//   });

//   const totalClaimed = filtered.reduce((sum, c) => sum + parseFloat(c.total_claimed_amount || '0'), 0);
//   const totalApproved = filtered.reduce((sum, c) => sum + parseFloat(c.total_approved_amount || '0'), 0);

//   const formatMoney = (val: string | number) => {
//     const num = typeof val === 'string' ? parseFloat(val) : val;
//     return `₹${(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
//   };

//   const formatDate = (dateStr: string) =>
//     new Date(dateStr).toLocaleDateString('en-IN', {
//       day: 'numeric',
//       month: 'short',
//       year: 'numeric',
//     });

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
//                 <FileSpreadsheet className="h-6 w-6 text-primary-600" />
//                 <h1 className="text-2xl font-bold text-gray-900">My Claims</h1>
//               </div>
//               <p className="mt-1 text-sm text-gray-500">
//                 Track your reimbursement claims and their approval status
//               </p>
//             </div>
//             <button
//               onClick={() => navigate('/reimbursements/smart-upload')}
//               className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
//             >
//               <Plus className="h-4 w-4" />
//               New Upload
//             </button>
//           </div>

//           {/* Stats */}
//           <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
//             <StatCard label="Total Claims" value={filtered.length} color="bg-primary-50 text-primary-700" icon={Receipt} />
//             <StatCard
//               label="Total Claimed"
//               value={formatMoney(totalClaimed)}
//               color="bg-blue-50 text-blue-700"
//               icon={DollarSign}
//             />
//             <StatCard
//               label="Total Approved"
//               value={formatMoney(totalApproved)}
//               color="bg-green-50 text-green-700"
//               icon={CheckCircle2}
//             />
//             <StatCard
//               label="Pending"
//               value={filtered.filter((c) => ['SUBMITTED', 'REVIEWING'].includes(c.status)).length}
//               color="bg-amber-50 text-amber-700"
//               icon={Clock}
//             />
//           </div>

//           {/* Filters */}
//           <div className="mb-4 flex flex-wrap items-center gap-3">
//             <div className="relative flex-1 min-w-[240px] max-w-md">
//               <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
//               <input
//                 type="text"
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//                 placeholder="Search claims..."
//                 className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//               />
//             </div>
//             <select
//               value={statusFilter}
//               onChange={(e) => setStatusFilter(e.target.value)}
//               className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//             >
//               <option value="">All Statuses</option>
//               {Object.entries(STATUS_CONFIG).map(([k, v]) => (
//                 <option key={k} value={k}>{v.label}</option>
//               ))}
//             </select>
//             <div className="flex items-center gap-1 text-xs text-gray-500">
//               <Filter className="h-3 w-3" />
//               {filtered.length} of {claims.length}
//             </div>
//           </div>

//           {/* Content */}
//           {loading ? (
//             <div className="flex justify-center py-16">
//               <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//             </div>
//           ) : filtered.length === 0 ? (
//             <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
//               <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-300" />
//               <h3 className="mt-4 text-base font-semibold text-gray-900">No claims yet</h3>
//               <p className="mt-1 text-sm text-gray-500">
//                 Upload your bills to create your first reimbursement claim.
//               </p>
//               <button
//                 onClick={() => navigate('/reimbursements/smart-upload')}
//                 className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
//               >
//                 <Plus className="h-4 w-4" />
//                 Upload Bills
//               </button>
//             </div>
//           ) : (
//             <div className="space-y-3">
//               {filtered.map((claim) => {
//                 const statusCfg = STATUS_CONFIG[claim.status];
//                 const StatusIcon = statusCfg.icon;
//                 const claimedNum = parseFloat(claim.total_claimed_amount || '0');
//                 const approvedNum = parseFloat(claim.total_approved_amount || '0');
//                 const approvalPct = claimedNum > 0 ? Math.round((approvedNum / claimedNum) * 100) : 0;

//                 return (
//                   <div
//                     key={claim.id}
//                     className="group cursor-pointer rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md"
//                     onClick={() => navigate(`/reimbursements/claims`)}
//                   >
//                     <div className="flex items-start justify-between">
//                       <div className="flex-1">
//                         {/* Header */}
//                         <div className="mb-2 flex flex-wrap items-center gap-2">
//                           <span className="font-mono text-xs font-semibold text-primary-700">
//                             Claim #{claim.id}
//                           </span>
//                           <span
//                             className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
//                           >
//                             <StatusIcon className="h-3 w-3" />
//                             {statusCfg.label}
//                           </span>
//                           {claim.source === 'QUICK_BULK_UPLOAD' && (
//                             <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
//                               Smart Upload
//                             </span>
//                           )}
//                         </div>

//                         {/* Employee */}
//                         <h3 className="text-base font-semibold text-gray-900">
//                           {claim.employee_name}
//                         </h3>
//                         <p className="mt-0.5 text-xs text-gray-500">
//                           {claim.employee_code} • Created {formatDate(claim.created_at)}
//                         </p>

//                         {/* Amounts */}
//                         <div className="mt-3 flex items-center gap-4">
//                           <div>
//                             <p className="text-xs text-gray-500">Claimed</p>
//                             <p className="text-sm font-bold text-gray-900">
//                               {formatMoney(claim.total_claimed_amount)}
//                             </p>
//                           </div>
//                           <div className="h-8 w-px bg-gray-200" />
//                           <div>
//                             <p className="text-xs text-gray-500">Approved</p>
//                             <p className="text-sm font-bold text-green-700">
//                               {formatMoney(claim.total_approved_amount)}
//                             </p>
//                           </div>
//                           {claimedNum > 0 && (
//                             <>
//                               <div className="h-8 w-px bg-gray-200" />
//                               <div>
//                                 <p className="text-xs text-gray-500">Approval %</p>
//                                 <p className={`text-sm font-bold ${
//                                   approvalPct >= 90 ? 'text-green-700' :
//                                   approvalPct >= 50 ? 'text-amber-700' : 'text-red-700'
//                                 }`}>
//                                   {approvalPct}%
//                                 </p>
//                               </div>
//                             </>
//                           )}
//                         </div>

//                         {/* Remarks */}
//                         {claim.remarks && (
//                           <p className="mt-2 text-xs text-gray-500 line-clamp-1">
//                             {claim.remarks}
//                           </p>
//                         )}
//                       </div>

//                       <ArrowRight className="h-5 w-5 text-gray-400 transition group-hover:text-primary-600" />
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

// function StatCard({ label, value, color, icon: Icon }: any) {
//   return (
//     <div className={`flex items-center gap-3 rounded-xl p-4 ${color}`}>
//       <Icon className="h-8 w-8 opacity-80" />
//       <div>
//         <div className="text-xs font-medium opacity-80">{label}</div>
//         <div className="mt-0.5 text-xl font-bold">{value}</div>
//       </div>
//     </div>
//   );
// }

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, Loader2, Search, Filter, Plus,
  CheckCircle2, Clock, XCircle, AlertCircle, Eye,
  ArrowRight, Receipt, DollarSign,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { claimsApi } from '../../api/reimbursement';
import type { ReimbursementClaim, ClaimStatus } from '../../types/reimbursement';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<ClaimStatus, { label: string; className: string; icon: any }> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700', icon: Clock },
  SUBMITTED: { label: 'Submitted', className: 'bg-blue-100 text-blue-700', icon: Clock },
  REVIEWING: { label: 'Under Review', className: 'bg-indigo-100 text-indigo-700', icon: Clock },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  PARTIALLY_APPROVED: { label: 'Partially Approved', className: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function MyClaimsPage() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<ReimbursementClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    const fetchClaims = async () => {
      setLoading(true);
      try {
        const params: any = { my_only: 'true' };
        if (statusFilter) params.status = statusFilter;
        const data = await claimsApi.list(params);
        setClaims(data);
      } catch (err) {
        toast.error('Failed to load claims');
      } finally {
        setLoading(false);
      }
    };
    fetchClaims();
  }, [statusFilter]);

  const filtered = claims.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.employee_name?.toLowerCase().includes(q) ||
      c.employee_code?.toLowerCase().includes(q) ||
      c.remarks?.toLowerCase().includes(q)
    );
  });

  const totalClaimed = filtered.reduce((sum, c) => sum + parseFloat(c.total_claimed_amount || '0'), 0);
  const totalApproved = filtered.reduce((sum, c) => sum + parseFloat(c.total_approved_amount || '0'), 0);

  const formatMoney = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return `₹${(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-10">
            {/* Header banner - rounded card */}
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-primary-600 to-violet-600 px-4 py-8 sm:px-6 lg:px-10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                    <FileSpreadsheet className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white sm:text-2xl">My Claims</h1>
                    <p className="mt-0.5 text-sm text-white/80">
                      Track your reimbursement claims and their approval status
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/reimbursements/smart-upload')}
                  className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 shadow-sm hover:bg-white/90"
                >
                  <Plus className="h-4 w-4" />
                  New Upload
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Total Claims" value={filtered.length} color="bg-indigo-50 text-indigo-700" icon={Receipt} />
              <StatCard
                label="Total Claimed"
                value={formatMoney(totalClaimed)}
                color="bg-blue-50 text-blue-700"
                icon={DollarSign}
              />
              <StatCard
                label="Total Approved"
                value={formatMoney(totalApproved)}
                color="bg-emerald-50 text-emerald-700"
                icon={CheckCircle2}
              />
              <StatCard
                label="Pending"
                value={filtered.filter((c) => ['SUBMITTED', 'REVIEWING'].includes(c.status)).length}
                color="bg-amber-50 text-amber-700"
                icon={Clock}
              />
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search claims..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Filter className="h-3 w-3" />
                {filtered.length} of {claims.length}
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-base font-semibold text-gray-900">No claims yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Upload your bills to create your first reimbursement claim.
                </p>
                <button
                  onClick={() => navigate('/reimbursements/smart-upload')}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" />
                  Upload Bills
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((claim) => {
                  const statusCfg = STATUS_CONFIG[claim.status];
                  const StatusIcon = statusCfg.icon;
                  const claimedNum = parseFloat(claim.total_claimed_amount || '0');
                  const approvedNum = parseFloat(claim.total_approved_amount || '0');
                  const approvalPct = claimedNum > 0 ? Math.round((approvedNum / claimedNum) * 100) : 0;

                  return (
                    <div
                      key={claim.id}
                      className="group cursor-pointer rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:ring-primary-200"
                      onClick={() => navigate(`/reimbursements/claims`)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-primary-700">
                              Claim #{claim.id}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {statusCfg.label}
                            </span>
                            {claim.source === 'QUICK_BULK_UPLOAD' && (
                              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                                Smart Upload
                              </span>
                            )}
                          </div>

                          {/* Employee */}
                          <h3 className="text-base font-semibold text-gray-900">
                            {claim.employee_name}
                          </h3>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {claim.employee_code} • Created {formatDate(claim.created_at)}
                          </p>

                          {/* Amounts */}
                          <div className="mt-3 flex flex-wrap items-center gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Claimed</p>
                              <p className="text-sm font-bold text-gray-900">
                                {formatMoney(claim.total_claimed_amount)}
                              </p>
                            </div>
                            <div className="h-8 w-px bg-gray-200" />
                            <div>
                              <p className="text-xs text-gray-500">Approved</p>
                              <p className="text-sm font-bold text-green-700">
                                {formatMoney(claim.total_approved_amount)}
                              </p>
                            </div>
                            {claimedNum > 0 && (
                              <>
                                <div className="h-8 w-px bg-gray-200" />
                                <div>
                                  <p className="text-xs text-gray-500">Approval %</p>
                                  <p className={`text-sm font-bold ${
                                    approvalPct >= 90 ? 'text-green-700' :
                                    approvalPct >= 50 ? 'text-amber-700' : 'text-red-700'
                                  }`}>
                                    {approvalPct}%
                                  </p>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Remarks */}
                          {claim.remarks && (
                            <p className="mt-2 text-xs text-gray-500 line-clamp-1">
                              {claim.remarks}
                            </p>
                          )}
                        </div>

                        <ArrowRight className="h-5 w-5 flex-shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon }: any) {
  return (
    <div className={`flex items-center gap-3 rounded-xl p-4 ${color}`}>
      <Icon className="h-8 w-8 opacity-80" />
      <div>
        <div className="text-xs font-medium opacity-80">{label}</div>
        <div className="mt-0.5 text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}