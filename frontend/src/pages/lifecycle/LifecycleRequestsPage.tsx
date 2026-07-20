import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Loader2, Workflow, Search, Filter, Eye,
  CheckCircle2, XCircle, Clock, AlertCircle,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { lifecycleRequestsApi } from '../../api/workflow';
import type {
  LifecycleRequestListItem,
  RequestStatus,
  ChangeType,
} from '../../types/workflow';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const statusConfig: Record<
  RequestStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-700',
    icon: Clock,
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-green-100 text-green-700',
    icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-700',
    icon: XCircle,
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-600',
    icon: AlertCircle,
  },
};

const changeTypeColors: Record<ChangeType, string> = {
  PROMOTION: 'bg-green-50 text-green-700 border-green-200',
  TRANSFER: 'bg-blue-50 text-blue-700 border-blue-200',
  REDESIGNATION: 'bg-purple-50 text-purple-700 border-purple-200',
  MANAGER_CHANGE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  CONFIRMATION: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function LifecycleRequestsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState<LifecycleRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('');

  const isHRAdmin: boolean = !!(
  user?.role_codes.includes('HR_ADMIN') ||
  user?.role_codes.includes('SYSTEM_ADMIN')
);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (changeTypeFilter) params.change_type = changeTypeFilter;

      const data = await lifecycleRequestsApi.list(params);
      setRequests(data.results);
    } catch (err) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, changeTypeFilter]);

  const filtered = requests.filter(
    (r) =>
      r.request_number.toLowerCase().includes(search.toLowerCase()) ||
      r.employee_name.toLowerCase().includes(search.toLowerCase()) ||
      r.employee_id_display.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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
              <h1 className="text-2xl font-bold text-gray-900">
                Lifecycle Requests
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Track promotions, transfers, re-designations, and status changes
              </p>
            </div>
            {isHRAdmin && (
              <button
                onClick={() => navigate('/lifecycle-requests/new')}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                New Request
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by request #, employee name..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={changeTypeFilter}
              onChange={(e) => setChangeTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="PROMOTION">Promotion</option>
              <option value="TRANSFER">Transfer</option>
              <option value="REDESIGNATION">Re-designation</option>
              <option value="MANAGER_CHANGE">Manager Change</option>
              <option value="CONFIRMATION">Confirmation</option>
            </select>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Filter className="h-3 w-3" />
              {filtered.length} of {requests.length}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              isHRAdmin={isHRAdmin}
              onNew={() => navigate('/lifecycle-requests/new')}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Request #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Effective Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Requested By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((req) => {
                    const Status = statusConfig[req.status];
                    return (
                      <tr
                        key={req.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          navigate(`/lifecycle-requests/${req.id}`)
                        }
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-medium text-primary-700">
                            {req.request_number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {req.employee_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {req.employee_id_display}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                              changeTypeColors[req.change_type]
                            }`}
                          >
                            {req.change_type_display}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${Status.className}`}
                          >
                            <Status.icon className="h-3 w-3" />
                            {Status.label}
                            {req.status === 'IN_PROGRESS' && (
                              <span className="ml-1 text-[10px] opacity-75">
                                (Step {req.current_step_number})
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(req.effective_date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {req.requested_by_name}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatDateTime(req.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/lifecycle-requests/${req.id}`);
                            }}
                            className="rounded p-1.5 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
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

// ==============================================================================
// EMPTY STATE
// ==============================================================================

function EmptyState({
  isHRAdmin,
  onNew,
}: {
  isHRAdmin: boolean;
  onNew: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
      <Workflow className="mx-auto h-12 w-12 text-gray-300" />
      <h3 className="mt-4 text-base font-semibold text-gray-900">
        No lifecycle requests
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        {isHRAdmin
          ? 'Create your first request to promote, transfer, or re-designate an employee.'
          : 'You have no lifecycle requests. HR will notify you if any changes are proposed.'}
      </p>
      {isHRAdmin && (
        <button
          onClick={onNew}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Create Request
        </button>
      )}
    </div>
  );
}