import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MonitorCheck, Loader2, Search, Filter,
  CheckCircle2, Clock, XCircle, AlertCircle,
  DollarSign, Eye, ArrowRight,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { claimsApi } from '../../api/reimbursement';
import type { ReimbursementClaim, ClaimStatus } from '../../types/reimbursement';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<ClaimStatus, { label: string; className: string; icon: any }> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700', icon: Clock },
  SUBMITTED: { label: 'Submitted', className: 'bg-blue-100 text-blue-700', icon: Clock },
  REVIEWING: { label: 'Reviewing', className: 'bg-indigo-100 text-indigo-700', icon: Clock },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  PARTIALLY_APPROVED: { label: 'Partial', className: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function ClaimMonitorPage() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<ReimbursementClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    const fetchClaims = async () => {
      setLoading(true);
      try {
        const params: any = {};
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

  const filtered = useMemo(() => {
    if (!search.trim()) return claims;
    const q = search.toLowerCase();
    return claims.filter(
      (c) =>
        c.employee_name?.toLowerCase().includes(q) ||
        c.employee_code?.toLowerCase().includes(q)
    );
  }, [claims, search]);

  const formatMoney = (val: string) =>
    `₹${(parseFloat(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <MonitorCheck className="h-6 w-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">Claim Monitor</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Review employee-level submissions and keep an eye on claim volumes and status
            </p>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ID..."
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
              {filtered.length} claims
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <MonitorCheck className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-base font-semibold text-gray-900">No claims</h3>
              <p className="mt-1 text-sm text-gray-500">No reimbursement claims found.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Claimed</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Approved</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((claim) => {
                    const statusCfg = STATUS_CONFIG[claim.status];
                    const StatusIcon = statusCfg.icon;
                    return (
                      <tr key={claim.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                              {(claim.employee_name || '?')
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{claim.employee_name}</p>
                              <p className="text-xs text-gray-500">{claim.employee_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatMoney(claim.total_claimed_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-green-700">
                          {formatMoney(claim.total_approved_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                            {claim.source === 'QUICK_BULK_UPLOAD' ? 'Smart' : 'Form'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatDate(claim.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate(`/reimbursements/finance-review`)}
                            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                          >
                            <Eye className="inline h-3 w-3 mr-1" />
                            Review
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
    </div>
  );
}