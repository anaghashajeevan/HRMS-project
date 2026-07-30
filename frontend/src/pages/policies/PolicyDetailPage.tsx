import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Send, CheckCircle2, XCircle, Clock,
  FileText, Users, BarChart3, Loader2, Download, History,
  MessageSquare, Eye, Shield,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { policiesApi } from '../../api/policy';
import { useAuth } from '../../context/AuthContext';
import type { PolicyDetail, ComplianceStats, PolicyDistribution } from '../../types/policy';
import { RotateCcw } from 'lucide-react';  // Add to icon imports

export default function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isHR = user?.role_codes?.includes('HR_ADMIN') || user?.role_codes?.includes('SYSTEM_ADMIN');

  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [compliance, setCompliance] = useState<ComplianceStats | null>(null);
  const [distributions, setDistributions] = useState<PolicyDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'compliance' | 'versions'>('content');
  const [isActualApprover, setIsActualApprover] = useState(false);
  const [myDist, setMyDist] = useState<any>(null);

  useEffect(() => {
    if (id) loadPolicy();
  }, [id]);

  const loadPolicy = async () => {
  setLoading(true);
  try {
    // Always fetch policy detail
    const policyData = await policiesApi.getById(id!);
    setPolicy(policyData);

    // Only fetch compliance and distributions for HR (employees don't need these)
    if (isHR) {
      try {
        const [compData, distData] = await Promise.all([
          policiesApi.getCompliance(id!),
          policiesApi.getDistributions(id!),
        ]);
        setCompliance(compData);
        setDistributions(distData);
      } catch {
        // Non-critical — page still works without these
      }
    }

    // Check if current user has a distribution (for acknowledge button)
    if (policyData.status === 'PUBLISHED' && policyData.requires_acknowledgment) {
      try {
        const myAcks = await policiesApi.myAcknowledgments();
        const myDistribution = myAcks.find(
          (d: any) => d.policy === id && !d.is_invalidated
        );
        setMyDist(myDistribution || null);
      } catch {
        setMyDist(null);
      }
    }

    // Check if current user is the assigned approver
    if (policyData.status === 'IN_REVIEW') {
      try {
        const pending = await policiesApi.pendingApprovals();
        const isPending = pending.some((p: any) => p.id === id);
        setIsActualApprover(isPending);
      } catch {
        setIsActualApprover(false);
      }
    } else {
      setIsActualApprover(false);
    }

    // Record view for non-HR users
    if (!isHR) {
      policiesApi.recordView(id!, 0).catch(() => {});
    }
  } catch (error) {
    toast.error('Failed to load policy');
    navigate(-1);
  } finally {
    setLoading(false);
  }
};

  const handleAction = async (action: string) => {
  if (!id) return;
  setActionLoading(action);
  try {
    let result;
    switch (action) {
      case 'submit':
        result = await policiesApi.submitForReview(id);
        break;
      case 'approve':
        const comments = window.prompt('Approval comments (optional):');
        if (comments === null) { setActionLoading(''); return; }
        result = await policiesApi.approve(id, comments);
        break;
      case 'reject':
        const reason = window.prompt('Rejection reason (required):');
        if (!reason || reason.length < 3) {
          if (reason !== null) toast.error('Reason is required');
          setActionLoading(''); return;
        }
        result = await policiesApi.reject(id, reason);
        break;
      case 'return':                                              // ← NEW
        const returnComments = window.prompt(
          'What changes are needed? (min 5 chars, be specific):'
        );
        if (!returnComments || returnComments.length < 5) {
          if (returnComments !== null) toast.error('Please provide detailed comments');
          setActionLoading(''); return;
        }
        result = await policiesApi.returnForChanges(id, returnComments);
        break;
      case 'publish':
        if (!window.confirm('Publish this policy and distribute to all applicable employees?')) {
          setActionLoading(''); return;
        }
        result = await policiesApi.publish(id);
        break;
      case 'acknowledge':
        result = await policiesApi.acknowledge(id);
        break;
    }
    if (result) toast.success(result.message);
    loadPolicy();
  } catch (error: any) {
    toast.error(error?.response?.data?.detail || `Failed to ${action}`);
  } finally {
    setActionLoading('');
  }
};

  if (loading || !policy) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  // Check if current user is an approver
  const isApprover = policy.status === 'IN_REVIEW';

  // Check employee ack status
  const myStatus = (policy as any).my_status;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate(isHR ? '/policies' : '/policies/library')}
              className="mb-3 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Policies
            </button>

            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold"
                    style={{ backgroundColor: policy.category?.color_code }}
                  >
                    {policy.category?.code?.slice(0, 2)}
                  </div>
                  <div>
                    <span className="text-xs font-mono text-gray-500">{policy.policy_number}</span>
                    <h1 className="text-2xl font-bold text-gray-900">{policy.title}</h1>
                  </div>
                </div>
                {policy.summary && (
                  <p className="text-sm text-gray-600 max-w-2xl">{policy.summary}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {isHR && policy.status === 'DRAFT' && (
  <button
    onClick={() => handleAction('submit')}
    disabled={actionLoading === 'submit'}
    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2
               text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
  >
    {actionLoading === 'submit'
      ? <Loader2 className="h-4 w-4 animate-spin" />
      : <Send className="h-4 w-4" />}
    {policy.return_count && policy.return_count > 0
      ? 'Resubmit for Approval'
      : 'Submit for Review'}
  </button>
)}
                {/* Only show approve/reject if user is the actual approver - checked via API */}
                {/* Only show approve/reject/return if user is the actual approver */}
{policy.status === 'IN_REVIEW' && isActualApprover && (
  <>
    <button
      onClick={() => handleAction('approve')}
      disabled={!!actionLoading}
      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2
                 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
    >
      <CheckCircle2 className="h-4 w-4" />
      Approve
    </button>

    {/* NEW: Return for Changes button */}
    <button
      onClick={() => handleAction('return')}
      disabled={!!actionLoading}
      className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2
                 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
    >
      <RotateCcw className="h-4 w-4" />
      Return for Changes
    </button>

    <button
      onClick={() => handleAction('reject')}
      disabled={!!actionLoading}
      className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2
                 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
    >
      <XCircle className="h-4 w-4" />
      Reject
    </button>
  </>
)}
                {isHR && policy.status === 'APPROVED' && (
                  <button
                    onClick={() => handleAction('publish')}
                    disabled={actionLoading === 'publish'}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actionLoading === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Publish & Distribute
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          {/* Tabs */}
<div className="mb-4 flex gap-1 border-b border-gray-200">
  <button
    onClick={() => setActiveTab('content')}
    className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
      activeTab === 'content'
        ? 'border-primary-600 text-primary-700'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`}
  >
    📄 Content
  </button>
  {policy.status === 'PUBLISHED' && isHR && (
  <button
    onClick={() => setActiveTab('compliance')}
    className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
      activeTab === 'compliance'
        ? 'border-primary-600 text-primary-700'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`}
  >
    📊 Compliance {compliance ? `(${compliance.percentage}%)` : ''}
  </button>
)}
  <button
    onClick={() => setActiveTab('versions')}
    className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
      activeTab === 'versions'
        ? 'border-primary-600 text-primary-700'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`}
  >
    📋 Versions ({policy.versions?.length || 0})
  </button>
</div>

          {/* Content Tab */}
         {/* Content Tab */}
{activeTab === 'content' && (
  <div className="space-y-6">
    {/* Content Card — Full Width */}
    {policy.status === 'DRAFT' && policy.return_comments && policy.returned_at && (
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center
                          rounded-full bg-amber-200">
            <RotateCcw className="h-5 w-5 text-amber-800" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-amber-900">🔄 Changes Requested</h3>
              {policy.return_count && policy.return_count > 1 && (
                <span className="rounded-full bg-amber-200 px-2 py-0.5
                                 text-xs font-semibold text-amber-900">
                  Returned {policy.return_count}× times
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-amber-800">
              Returned by <strong>{policy.returned_by_name}</strong> on{' '}
              {new Date(policy.returned_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
            <div className="mt-3 rounded-lg bg-white border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-900 mb-1">
                📝 Reviewer's Comments:
              </p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {policy.return_comments}
              </p>
            </div>
            {isHR && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => navigate(`/policies/${id}/create-version`)}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2
                             text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Upload Revised Version
                </button>
                <button
                  onClick={() => handleAction('submit')}
                  disabled={actionLoading === 'submit'}
                  className="flex items-center gap-2 rounded-lg border border-amber-600
                             bg-white px-4 py-2 text-xs font-semibold text-amber-700
                             hover:bg-amber-100 disabled:opacity-50"
                >
                  {actionLoading === 'submit'
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Send className="h-3 w-3" />}
                  Resubmit for Approval
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    {policy.current_version ? (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase">
            Policy Content — v{policy.current_version.version_number}
          </h3>
          {policy.current_version.content_file && policy.current_version.file_url && (
            <a
              href={policy.current_version.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download Document
            </a>
          )}
        </div>

        {policy.current_version.content_html ? (
          <div
            className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: policy.current_version.content_html }}
          />
        ) : policy.current_version.content_file ? (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-3 text-gray-600">
              This policy content is in an uploaded document.
            </p>
            {policy.current_version.file_url && (
              <a
                href={policy.current_version.file_url}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                <Download className="h-4 w-4" />
                View Document
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-6 text-center">
            <FileText className="mx-auto h-10 w-10 text-amber-400" />
            <p className="mt-3 text-amber-800 font-semibold">No content added yet</p>
            <p className="mt-1 text-sm text-amber-700">
              Edit this policy to add content before submitting for review.
            </p>
          </div>
        )}

        {/* Change Summary */}
        {policy.current_version.change_summary && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs font-semibold text-blue-900">📝 What Changed:</p>
            <p className="mt-1 text-sm text-blue-800">{policy.current_version.change_summary}</p>
          </div>
        )}
      </div>
    ) : (
      <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
        <FileText className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-gray-600">No version created yet</p>
      </div>
    )}

    {/* Policy Details Card (below content, not sidebar) */}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Details */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">📋 Policy Details</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Status</dt>
            <dd className="font-semibold">{policy.status_display}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Category</dt>
            <dd>{policy.category?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Version</dt>
            <dd>v{policy.current_version?.version_number || '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Priority</dt>
            <dd>{policy.priority_display}</dd>
          </div>
          {policy.effective_date && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Effective Date</dt>
              <dd>{new Date(policy.effective_date).toLocaleDateString('en-IN')}</dd>
            </div>
          )}
          {policy.expiry_date && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Expiry Date</dt>
              <dd>{new Date(policy.expiry_date).toLocaleDateString('en-IN')}</dd>
            </div>
          )}
          {policy.policy_owner_name && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Owner</dt>
              <dd>{policy.policy_owner_name}</dd>
            </div>
          )}
          {policy.created_by_name && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Created By</dt>
              <dd>{policy.created_by_name}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Applicability */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">👥 Applicability</h3>
        {policy.applies_to_all ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
            <Users className="h-5 w-5 text-green-600" />
            <span className="text-sm font-semibold text-green-800">All Employees</span>
          </div>
        ) : (
          <div className="space-y-2">
            {policy.applicable_department_names?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Departments:</p>
                <div className="flex flex-wrap gap-1">
                  {policy.applicable_department_names.map((d) => (
                    <span key={d.id} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{d.name}</span>
                  ))}
                </div>
              </div>
            )}
            {policy.applicable_position_titles?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Positions:</p>
                <div className="flex flex-wrap gap-1">
                  {policy.applicable_position_titles.map((p) => (
                    <span key={p.id} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{p.title}</span>
                  ))}
                </div>
              </div>
            )}
            {policy.applicable_department_names?.length === 0 && policy.applicable_position_titles?.length === 0 && (
              <p className="text-sm text-gray-500">No specific targets set</p>
            )}
          </div>
        )}
      </div>

      {/* Acknowledgment Settings */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">✅ Acknowledgment</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Required</dt>
            <dd>{policy.requires_acknowledgment ? '✅ Yes' : '❌ No'}</dd>
          </div>
          {policy.requires_acknowledgment && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Deadline</dt>
              <dd>{policy.acknowledgment_deadline_days} days</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500">Mandatory</dt>
            <dd>{policy.is_mandatory ? '✅ Yes (new hires)' : 'No'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Review Interval</dt>
            <dd>{policy.review_interval_months > 0 ? `${policy.review_interval_months} months` : 'No auto-review'}</dd>
          </div>
        </dl>
      </div>
    </div>

    {/* Employee Acknowledge Section */}
   {/* Acknowledge Section — for ANYONE with a distribution */}
{policy.status === 'PUBLISHED' && policy.requires_acknowledgment && myDist && (
  <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
    {myDist.acknowledged ? (
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
        <div>
          <h3 className="font-semibold text-green-900">Acknowledged ✅</h3>
          <p className="text-sm text-green-700">
            You acknowledged this policy on{' '}
            {myDist.acknowledged_at
              ? new Date(myDist.acknowledged_at).toLocaleDateString('en-IN')
              : ''
            }
          </p>
        </div>
      </div>
    ) : (
      <>
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          📋 Policy Acknowledgment Required
        </h3>
        <div className="rounded-lg bg-white p-4 mb-4 border border-blue-200">
          <p className="text-sm text-gray-700">{policy.acknowledgment_text}</p>
        </div>
        {myDist.deadline && (
          <p className={`text-sm mb-4 ${
            myDist.is_overdue ? 'text-red-700 font-bold' : 'text-blue-700'
          }`}>
            {myDist.is_overdue
              ? `⛔ OVERDUE — Deadline was ${new Date(myDist.deadline).toLocaleDateString('en-IN')}`
              : `⏰ Deadline: ${new Date(myDist.deadline).toLocaleDateString('en-IN')}`
            }
          </p>
        )}
        <button
          onClick={() => handleAction('acknowledge')}
          disabled={actionLoading === 'acknowledge'}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {actionLoading === 'acknowledge'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Shield className="h-4 w-4" />
          }
          I Acknowledge This Policy
        </button>
      </>
    )}
  </div>
)}
  </div>
)}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && compliance && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <StatCard label="Total Distributed" value={compliance.total} color="blue" />
                <StatCard label="Acknowledged" value={compliance.acknowledged} color="green" />
                <StatCard label="Pending" value={compliance.pending} color="amber" />
                <StatCard label="Overdue" value={compliance.overdue} color="red" />
              </div>

              {/* Progress */}
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">Overall Compliance</h3>
                  <span className="text-2xl font-bold text-primary-700">{compliance.percentage}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      compliance.percentage >= 90 ? 'bg-green-500' :
                      compliance.percentage >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${compliance.percentage}%` }}
                  />
                </div>
              </div>

              {/* By Department */}
              {compliance.by_department.length > 0 && (
                <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4">By Department</h3>
                  <div className="space-y-3">
                    {compliance.by_department.map((dept) => (
                      <div key={dept.department}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{dept.department}</span>
                          <span className="text-gray-500">{dept.acknowledged}/{dept.total} ({dept.percentage}%)</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${
                              dept.percentage >= 90 ? 'bg-green-500' :
                              dept.percentage >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${dept.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Distribution Table */}
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Employee Acknowledgments</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Acknowledged At</th>
                      <th className="px-4 py-3">Deadline</th>
                      <th className="px-4 py-3 text-center">Views</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {distributions.map((dist) => (
                      <tr key={dist.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{dist.employee_name}</div>
                          <div className="text-xs text-gray-500">{dist.employee_code}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{dist.employee_department || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {dist.acknowledged ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                              <CheckCircle2 className="h-3 w-3" /> Done
                            </span>
                          ) : dist.is_overdue ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                              ⛔ Overdue
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {dist.acknowledged_at
                            ? new Date(dist.acknowledged_at).toLocaleDateString('en-IN')
                            : '—'
                          }
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(dist.deadline).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">{dist.total_views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Versions Tab */}
          {activeTab === 'versions' && (
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Version History</h3>
                {isHR && policy.status !== 'IN_REVIEW' && (
                  <button
                    onClick={() => navigate(`/policies/${id}/create-version`)}
                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                  >
                    <Plus className="h-3 w-3" />
                    New Version
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {policy.versions?.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        v.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {v.is_published ? <CheckCircle2 className="h-4 w-4" /> : <History className="h-4 w-4" />}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">v{v.version_number}</span>
                        {v.is_published && (
                          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Current</span>
                        )}
                        <p className="text-xs text-gray-500">
                          Effective from {new Date(v.effective_from).toLocaleDateString('en-IN')}
                          {' • '}Created {new Date(v.created_at).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: any = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}