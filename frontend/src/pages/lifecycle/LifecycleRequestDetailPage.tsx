import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock,
  AlertCircle, Download, User, Calendar, MessageSquare,
  ArrowRight, FileText, Sparkles, Ban,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { lifecycleRequestsApi, letterTemplatesApi } from '../../api/workflow';
import type {
  LifecycleRequestDetail,
  LetterTemplate,
  RequestStatus,
  ActionStatus,
} from '../../types/workflow';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const requestStatusConfig: Record<
  RequestStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-100 text-blue-700 ring-blue-200', icon: Clock },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700 ring-green-200', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700 ring-red-200', icon: XCircle },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600 ring-gray-200', icon: Ban },
};

const actionStatusConfig: Record<
  ActionStatus,
  { className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: { className: 'text-blue-600 bg-blue-100', icon: Clock },
  APPROVED: { className: 'text-green-600 bg-green-100', icon: CheckCircle2 },
  REJECTED: { className: 'text-red-600 bg-red-100', icon: XCircle },
};

export default function LifecycleRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [request, setRequest] = useState<LifecycleRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const fetchRequest = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await lifecycleRequestsApi.getById(id);
      setRequest(data);
    } catch (err) {
      toast.error('Failed to load request');
      navigate('/lifecycle-requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();
  }, [id]);

  // ---------- Find MY pending action ----------
  const myPendingAction = request?.approval_actions.find(
    (a) => a.status === 'PENDING' && a.assigned_to === user?.employee?.id
  );

  const isMyFinalStep =
  myPendingAction &&
  request &&
  myPendingAction.step_number === request.workflow_total_steps;

  const formatDate = (dateStr: string | null) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '—';

  const formatDateTime = (dateStr: string | null) =>
    dateStr
      ? new Date(dateStr).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : '—';

  if (loading || !request) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  const StatusIcon = requestStatusConfig[request.status].icon;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Back button */}
          <button
            onClick={() => navigate('/lifecycle-requests')}
            className="mb-4 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Requests
          </button>

          {/* Header Card */}
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {request.request_number}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ${
                      requestStatusConfig[request.status].className
                    }`}
                  >
                    <StatusIcon className="h-4 w-4" />
                    {requestStatusConfig[request.status].label}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{request.change_type_display}</span>
                  {' • '}
                  <span>{request.employee_name}</span>
                  {' • '}
                  <span className="text-gray-500">
                    Effective {formatDate(request.effective_date)}
                  </span>
                </p>
                {request.workflow_name && (
                  <p className="mt-2 text-xs text-gray-500">
                    Workflow: <span className="font-medium">{request.workflow_name}</span>
                    {request.status === 'IN_PROGRESS' && (
                      <span className="ml-2">
                        (Current step: {request.current_step_number})
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Download letter button (if approved + has PDF) */}
              {request.letter_url && (
                <a
                  href={request.letter_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100"
                >
                  <Download className="h-4 w-4" />
                  Download Letter
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* LEFT: Details */}
            <div className="space-y-4 lg:col-span-2">
              {/* Employee Info */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-3 text-sm font-semibold text-gray-900">
                  Employee
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                    {request.employee_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {request.employee_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {request.employee_id_display}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/employees/${request.employee}`)}
                    className="ml-auto text-xs text-primary-600 hover:underline"
                  >
                    View profile →
                  </button>
                </div>
              </div>

              {/* Changes Comparison */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">
                  Proposed Changes
                </h2>
                <div className="space-y-3">
                  <ChangeRow
                      label="Position"
                      from={request.current_position_title}
                      to={request.proposed_position_title}
                  />
                  <ChangeRow
                      label="Reporting Manager"
                      from={request.current_manager_name}
                      to={request.proposed_manager_name}
                  />
                  <ChangeRow
                      label="Department"
                      from={(request as any).current_department_name || request.current_location_name}
                      to={(request as any).proposed_department_name || request.proposed_location_name}
                  />
                  <ChangeRow
                      label="Location"
                      from={(request as any).current_location_display}
                      to={(request as any).proposed_location_display}
                  />
                  <ChangeRow
                      label="Status"
                      from={request.current_status || null}
                      to={request.proposed_status || null}
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-2 text-sm font-semibold text-gray-900">
                  Reason
                </h2>
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {request.reason}
                </p>
              </div>

              {/* Rejection reason (if rejected) */}
              {request.status === 'REJECTED' && request.rejection_reason && (
                <div className="rounded-2xl bg-red-50 p-5 ring-1 ring-red-100">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-900">
                    <XCircle className="h-4 w-4" />
                    Rejection Reason
                  </h2>
                  <p className="whitespace-pre-wrap text-sm text-red-800">
                    {request.rejection_reason}
                  </p>
                </div>
              )}

              {/* Generated Letter Info */}
              {request.status === 'APPROVED' && request.letter_url && (
                <div className="rounded-2xl bg-green-50 p-5 ring-1 ring-green-100">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-900">
                    <FileText className="h-4 w-4" />
                    Letter Generated
                  </h2>
                  <p className="text-sm text-green-800">
                    A PDF letter has been generated, emailed to the employee, and
                    saved to their documents.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: Approval Timeline + Actions */}
            <div className="space-y-4">
              {/* Action Buttons (if I can approve/reject) */}
              {myPendingAction && (
                <div className="rounded-2xl bg-amber-50 p-5 ring-2 ring-amber-200">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <AlertCircle className="h-4 w-4" />
                    Action Required
                  </div>
                  <p className="mb-4 text-xs text-amber-800">
                    You are assigned as the approver for{' '}
                    <span className="font-medium">{myPendingAction.step_name}</span>.
                    {isMyFinalStep &&
                      ' As this is the final step, you will need to select a letter template.'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowApproveModal(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Approval Timeline */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">
                  Approval Timeline
                </h2>
                <div className="space-y-4">
                  {/* Created event */}
                  <TimelineItem
                    icon={<User className="h-3 w-3" />}
                    iconClassName="bg-primary-100 text-primary-700"
                    title="Request Created"
                    subtitle={`by ${request.requested_by_name}`}
                    time={formatDateTime(request.created_at)}
                  />

                  {/* Approval actions */}
                  {request.approval_actions
                    .sort((a, b) => a.step_number - b.step_number || a.created_at.localeCompare(b.created_at))
                    .map((action) => {
                      const ActionIcon = actionStatusConfig[action.status].icon;
                      return (
                        <TimelineItem
                          key={action.id}
                          icon={<ActionIcon className="h-3 w-3" />}
                          iconClassName={actionStatusConfig[action.status].className}
                          title={
                            <>
                              <span className="font-medium">
                                Step {action.step_number}: {action.step_name}
                              </span>
                              <span className="ml-2 text-xs font-normal text-gray-500">
                                {action.status === 'PENDING' && `Waiting on ${action.assigned_to_name}`}
                                {action.status === 'APPROVED' && `Approved by ${action.assigned_to_name}`}
                                {action.status === 'REJECTED' && `Rejected by ${action.assigned_to_name}`}
                              </span>
                            </>
                          }
                          subtitle={action.assigned_to_employee_id}
                          time={
                            action.acted_at
                              ? formatDateTime(action.acted_at)
                              : `Due by ${formatDateTime(action.due_at)}`
                          }
                          comments={action.comments}
                        />
                      );
                    })}

                  {/* Completed event */}
                  {request.completed_at && (
                    <TimelineItem
                      icon={
                        request.status === 'APPROVED' ? (
                          <Sparkles className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )
                      }
                      iconClassName={
                        request.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }
                      title={
                        request.status === 'APPROVED'
                          ? 'Request Approved & Applied'
                          : 'Request Rejected'
                      }
                      subtitle={
                        request.status === 'APPROVED'
                          ? 'Changes applied to employee record'
                          : ''
                      }
                      time={formatDateTime(request.completed_at)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Approve Modal */}
          {showApproveModal && myPendingAction && (
            <ApproveModal
              requestId={request.id}
              isFinalStep={!!isMyFinalStep}
              onClose={() => setShowApproveModal(false)}
              onSuccess={() => {
                setShowApproveModal(false);
                fetchRequest();
              }}
            />
          )}

          {/* Reject Modal */}
          {showRejectModal && myPendingAction && (
            <RejectModal
              requestId={request.id}
              onClose={() => setShowRejectModal(false)}
              onSuccess={() => {
                setShowRejectModal(false);
                fetchRequest();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// CHANGE ROW COMPONENT (shows from → to)
// ==============================================================================

function ChangeRow({
  label,
  from,
  to,
}: {
  label: string;
  from: string | null;
  to: string | null;
}) {
  const hasChange = to && to !== from;

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <p className="mb-1 text-xs font-medium uppercase text-gray-500">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">{from || '—'}</span>
        {hasChange ? (
          <>
            <ArrowRight className="h-4 w-4 text-primary-500" />
            <span className="text-sm font-medium text-primary-700">{to}</span>
          </>
        ) : (
          <span className="text-xs text-gray-400">(no change)</span>
        )}
      </div>
    </div>
  );
}

// ==============================================================================
// TIMELINE ITEM COMPONENT
// ==============================================================================

function TimelineItem({
  icon,
  iconClassName,
  title,
  subtitle,
  time,
  comments,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  title: React.ReactNode;
  subtitle?: string;
  time: string;
  comments?: string | null;
}) {
  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      {/* Vertical line */}
      <div className="absolute left-3 top-6 bottom-0 w-px bg-gray-200" />

      {/* Icon */}
      <div
        className={`relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${iconClassName}`}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 pb-1">
        <div className="text-sm text-gray-900">{title}</div>
        {subtitle && (
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        )}
        <p className="mt-0.5 text-xs text-gray-400">{time}</p>
        {comments && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-gray-50 p-2 text-xs text-gray-700">
            <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
            <p className="italic">{comments}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==============================================================================
// APPROVE MODAL
// ==============================================================================

function ApproveModal({
  requestId,
  isFinalStep,
  onClose,
  onSuccess,
}: {
  requestId: string;
  isFinalStep: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [comments, setComments] = useState('');
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(isFinalStep);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isFinalStep) return;
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const data = await letterTemplatesApi.list({ is_active: true });
        setTemplates(data);
        // Auto-select default template if any
        const defaultTemplate = data.find((t) => t.is_default);
        if (defaultTemplate) setSelectedTemplateId(defaultTemplate.id);
      } catch (err) {
        toast.error('Failed to load letter templates');
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, [isFinalStep]);

  const handleSubmit = async () => {
    if (isFinalStep && !selectedTemplateId) {
      toast.error('Please select a letter template');
      return;
    }

    setSubmitting(true);
    try {
      const result = await lifecycleRequestsApi.approve(requestId, {
        comments,
        letter_template_id: isFinalStep ? selectedTemplateId : undefined,
      });

      if (result.status === 'completed') {
        toast.success('Request fully approved! Letter is being generated.');
      } else if (result.status === 'moved_next') {
        toast.success('Approved. Moving to next step.');
      } else if (result.status === 'step_pending') {
        toast.success('Approved. Waiting for other approvers.');
      } else {
        toast.success('Approved successfully');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Approval failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            Approve Request
          </h3>
        </div>

        {isFinalStep && (
          <>
            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
              <p className="font-medium">Final Step</p>
              <p className="mt-1">
                This is the last approval. After you approve, the changes will
                be applied and a PDF letter will be generated using the selected
                template.
              </p>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Letter Template <span className="text-red-500">*</span>
              </label>
              {loadingTemplates ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  ⚠️ No letter templates available. Please create one in
                  Settings → Letter Templates before approving.
                </div>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Select template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.template_type_display})
                      {t.is_default ? ' — Default' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            Comments (optional)
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Add any comments..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (isFinalStep && !selectedTemplateId)}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Approve
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ==============================================================================
// REJECT MODAL
// ==============================================================================

function RejectModal({
  requestId,
  onClose,
  onSuccess,
}: {
  requestId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 5) {
      toast.error('Reason must be at least 5 characters');
      return;
    }

    setSubmitting(true);
    try {
      await lifecycleRequestsApi.reject(requestId, { reason: reason.trim() });
      toast.success('Request rejected');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Rejection failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-5 w-5 text-red-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            Reject Request
          </h3>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Once rejected, the entire request will be cancelled. The requester
          will be notified with your reason.
        </p>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            Reason for Rejection <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            placeholder="Explain why this request is being rejected..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || reason.trim().length < 5}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Reject
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ==============================================================================
// MODAL WRAPPER
// ==============================================================================

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}