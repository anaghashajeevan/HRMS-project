import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Loader2, Workflow, Eye, CheckCircle2, XCircle,
  Clock, AlertCircle, ExternalLink,
} from 'lucide-react';
import { lifecycleRequestsApi } from '../api/workflow';
import type {
  LifecycleRequestListItem,
  RequestStatus,
} from '../types/workflow';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface Props {
  employeeId: string;
}

const statusConfig: Record<
  RequestStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-100 text-blue-700', icon: Clock },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600', icon: AlertCircle },
};

export default function LifecycleTab({ employeeId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState<LifecycleRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isHRAdmin: boolean = !!(
  user?.role_codes.includes('HR_ADMIN') ||
  user?.role_codes.includes('SYSTEM_ADMIN')
);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await lifecycleRequestsApi.list({ employee: employeeId });
        setRequests(data.results);
      } catch (err) {
        toast.error('Failed to load lifecycle requests');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [employeeId]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header + Actions */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Lifecycle Change Requests
          </h3>
          <p className="text-xs text-gray-500">
            All promotion, transfer, and status change requests for this employee
          </p>
        </div>
        {isHRAdmin && (
          <button
            onClick={() =>
              navigate(`/lifecycle-requests/new?employee=${employeeId}`)
            }
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Request Change
          </button>
        )}
      </div>

      {/* Empty State */}
      {requests.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
          <Workflow className="mx-auto h-10 w-10 text-gray-300" />
          <h4 className="mt-3 text-sm font-medium text-gray-900">
            No lifecycle changes yet
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            {isHRAdmin
              ? 'Click "Request Change" to promote, transfer, or update this employee.'
              : 'No lifecycle change requests have been made for this employee.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const Status = statusConfig[req.status];
            return (
              <div
                key={req.id}
                onClick={() => navigate(`/lifecycle-requests/${req.id}`)}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary-200 hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary-700">
                        {req.request_number}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-sm font-medium text-gray-900">
                        {req.change_type_display}
                      </span>
                      <span
                        className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${Status.className}`}
                      >
                        <Status.icon className="h-3 w-3" />
                        {Status.label}
                        {req.status === 'IN_PROGRESS' && (
                          <span className="ml-0.5 text-[10px] opacity-75">
                            (Step {req.current_step_number})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 md:grid-cols-3">
                      <span>
                        <span className="font-medium">Effective:</span>{' '}
                        {formatDate(req.effective_date)}
                      </span>
                      <span>
                        <span className="font-medium">By:</span>{' '}
                        {req.requested_by_name}
                      </span>
                      <span>
                        <span className="font-medium">Created:</span>{' '}
                        {formatDate(req.created_at)}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}