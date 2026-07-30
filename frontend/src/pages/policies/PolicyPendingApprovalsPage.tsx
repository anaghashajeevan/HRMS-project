import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, CheckCircle2, XCircle, FileText, Clock,RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { policiesApi } from '../../api/policy';
import type { PolicyListItem } from '../../types/policy';

export default function PolicyPendingApprovalsPage() {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<PolicyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const data = await policiesApi.pendingApprovals();
      setPolicies(data);
    } catch (error) {
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };
  const handleReturn = async (policy: PolicyListItem) => {
  const comments = window.prompt(
    `Return "${policy.title}" for changes?\n\nDescribe what needs to be changed (min 5 chars):`
  );
  if (!comments || comments.length < 5) {
    if (comments !== null) toast.error('Please provide detailed comments (min 5 chars)');
    return;
  }

  setActionId(policy.id);
  try {
    await policiesApi.returnForChanges(policy.id, comments);
    toast.success('Policy returned to creator for revisions');
    loadPending();
  } catch (error: any) {
    toast.error(error?.response?.data?.detail || 'Failed to return policy');
  } finally {
    setActionId(null);
  }
};

  const handleApprove = async (policy: PolicyListItem) => {
    const comments = window.prompt(`Approve "${policy.title}"?\nOptional comments:`);
    if (comments === null) return;

    setActionId(policy.id);
    try {
      await policiesApi.approve(policy.id, comments);
      toast.success('Policy approved!');
      loadPending();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (policy: PolicyListItem) => {
    const reason = window.prompt(`Reject "${policy.title}"?\nReason (required):`);
    if (!reason || reason.length < 3) {
      if (reason !== null) toast.error('Reason is required (min 3 chars)');
      return;
    }

    setActionId(policy.id);
    try {
      await policiesApi.reject(policy.id, reason);
      toast.success('Policy rejected');
      loadPending();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Policy Pending Approvals</h1>
            <p className="mt-1 text-sm text-gray-600">
              {policies.length} polic{policies.length !== 1 ? 'ies' : 'y'} awaiting your review
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : policies.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">All Caught Up! 🎉</h3>
              <p className="mt-2 text-sm text-gray-600">No policies pending your approval.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold"
                        style={{ backgroundColor: policy.category_color }}
                      >
                        {policy.category_code?.slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{policy.title}</h3>
                        <p className="text-sm text-gray-500">
                          {policy.policy_number} • {policy.category_name}
                          {policy.current_version_number && ` • v${policy.current_version_number}`}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      <Clock className="h-3 w-3" />
                      In Review
                    </span>
                  </div>

                  {policy.summary && (
                    <p className="text-sm text-gray-600 mb-4">{policy.summary}</p>
                  )}

                  <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
  <button
    onClick={() => navigate(`/policies/${policy.id}`)}
    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white
               px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
  >
    <FileText className="h-4 w-4" />
    Read Policy
  </button>

  <button
    onClick={() => handleApprove(policy)}
    disabled={actionId === policy.id}
    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2
               text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
  >
    {actionId === policy.id
      ? <Loader2 className="h-4 w-4 animate-spin" />
      : <CheckCircle2 className="h-4 w-4" />}
    Approve
  </button>

  {/* NEW: Return for Changes */}
  <button
    onClick={() => handleReturn(policy)}
    disabled={actionId === policy.id}
    className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2
               text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
  >
    <RotateCcw className="h-4 w-4" />
    Return
  </button>

  <button
    onClick={() => handleReject(policy)}
    disabled={actionId === policy.id}
    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2
               text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
  >
    <XCircle className="h-4 w-4" />
    Reject
  </button>
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