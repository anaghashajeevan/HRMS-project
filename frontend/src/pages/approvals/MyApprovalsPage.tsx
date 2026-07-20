import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, CheckSquare, Clock, ExternalLink, User,
  Calendar, AlertCircle,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { lifecycleRequestsApi } from '../../api/workflow';
import type { LifecycleRequestListItem, ChangeType } from '../../types/workflow';
import toast from 'react-hot-toast';

const changeTypeColors: Record<ChangeType, string> = {
  PROMOTION: 'bg-green-50 text-green-700 border-green-200',
  TRANSFER: 'bg-blue-50 text-blue-700 border-blue-200',
  REDESIGNATION: 'bg-purple-50 text-purple-700 border-purple-200',
  MANAGER_CHANGE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  CONFIRMATION: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function MyApprovalsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LifecycleRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const data = await lifecycleRequestsApi.myPendingApprovals();
      setRequests(data);
    } catch (err) {
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
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
                <h1 className="text-2xl font-bold text-gray-900">
                  My Approvals
                </h1>
                {requests.length > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    {requests.length}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Requests waiting for your approval
              </p>
            </div>
            <button
              onClick={fetchApprovals}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Refresh
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : requests.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => navigate(`/lifecycle-requests/${req.id}`)}
                  className="group cursor-pointer rounded-2xl border-2 border-amber-200 bg-white p-5 shadow-sm ring-1 ring-amber-100 transition hover:border-amber-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Row 1: Badge + Request # + Type */}
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          <Clock className="h-3 w-3" />
                          Action Required
                        </span>
                        <span className="font-mono text-xs font-semibold text-primary-700">
                          {req.request_number}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                            changeTypeColors[req.change_type]
                          }`}
                        >
                          {req.change_type_display}
                        </span>
                        <span className="ml-auto text-xs text-gray-500">
                          Step {req.current_step_number}
                        </span>
                      </div>

                      {/* Row 2: Employee Name */}
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                          {req.employee_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {req.employee_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {req.employee_id_display}
                          </p>
                        </div>
                      </div>

                      {/* Row 3: Meta */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Effective {formatDate(req.effective_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          By {req.requested_by_name}
                        </span>
                        <span>Received {formatRelativeTime(req.created_at)}</span>
                      </div>
                    </div>

                    {/* Right side action indicator */}
                    <div className="ml-4 flex flex-col items-end gap-1">
                      <ExternalLink className="h-4 w-4 text-gray-400 transition group-hover:text-primary-600" />
                      <span className="text-xs text-primary-600 opacity-0 transition group-hover:opacity-100">
                        Review →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckSquare className="h-8 w-8 text-green-600" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">
        All caught up!
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        You have no pending approvals. New requests will appear here when
        assigned to you.
      </p>
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-left text-xs text-blue-800 ring-1 ring-blue-100">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <span>
          You'll receive email + in-app notifications when a request needs your
          approval.
        </span>
      </div>
    </div>
  );
}