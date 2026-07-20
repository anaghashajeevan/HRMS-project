import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Edit,
  ChevronDown, ChevronRight, AlertCircle,
  Zap, Star, X, Trash2, Save, Users2,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import {
  employeeScorecardsApi,
  employeeKRAsApi,
  employeeKPIsApi,
  peerNominationsApi,
  peerSearchApi,
} from '../../api/performance';
import type {
  EmployeeScorecardDetail,
  EmployeeKRA,
  EmployeeKPI,
  ScorecardStatus,
  EmployeeForPeer,
  KRAPeerNomination,
} from '../../types/performance';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<ScorecardStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  SUBMITTED: { label: 'Submitted for Review', className: 'bg-amber-100 text-amber-700' },
  MANAGER_REVIEWING: { label: 'Under Review', className: 'bg-indigo-100 text-indigo-700' },
  SENT_BACK: { label: 'Sent Back', className: 'bg-red-100 text-red-700' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  SIGNED_OFF: { label: 'Signed Off', className: 'bg-emerald-100 text-emerald-700' },
  SELF_REVIEW_PENDING: { label: 'Self Review Pending', className: 'bg-purple-100 text-purple-700' },
  SELF_REVIEWED: { label: 'Self Reviewed', className: 'bg-orange-100 text-orange-700' },
  MANAGER_REVIEW_PENDING: { label: 'Final Review Pending', className: 'bg-orange-100 text-orange-700' },
  MANAGER_REVIEWED: { label: 'Final Review Done', className: 'bg-teal-100 text-teal-700' },
  FINALIZED: { label: 'Finalized', className: 'bg-green-100 text-green-700' },
};

const KPI_TYPE_ICONS: Record<string, string> = {
  NUMERIC_UP: '📈',
  NUMERIC_DOWN: '📉',
  PERCENTAGE: '%',
  RATING: '⭐',
  BOOLEAN: '✓',
  CURRENCY: '💰',
};

// ==============================================================================
// MAIN PAGE
// ==============================================================================

export default function ScorecardReviewPage() {
  const { scorecardId } = useParams<{ scorecardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [scorecard, setScorecard] = useState<EmployeeScorecardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [showPeerModal, setShowPeerModal] = useState(false);
  const [peerKRA, setPeerKRA] = useState<EmployeeKRA | null>(null);
  const [processing, setProcessing] = useState(false);

  const isHR =
    user?.role_codes.includes('HR_ADMIN') ||
    user?.role_codes.includes('SYSTEM_ADMIN');

  const fetchScorecard = async () => {
    if (!scorecardId) return;
    setLoading(true);
    try {
      const data = await employeeScorecardsApi.getById(scorecardId);
      setScorecard(data);
      // Auto-expand all KRAs
      setExpanded(new Set(data.kras.map((k) => k.id)));
    } catch (err) {
      toast.error('Failed to load scorecard');
      navigate('/team-performance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScorecard();
  }, [scorecardId]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isReviewable =
    scorecard?.status === 'SUBMITTED' || scorecard?.status === 'MANAGER_REVIEWING';

  const canEdit = isReviewable && (isHR || scorecard?.employee !== user?.employee?.id);

  const handleApprove = async () => {
    if (!scorecardId) return;
    setProcessing(true);
    try {
      await employeeScorecardsApi.approve(scorecardId);
      toast.success('Scorecard approved! Employee will be notified to sign off.');
      setShowApproveModal(false);
      fetchScorecard();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handleSendBack = async (reason: string) => {
    if (!scorecardId) return;
    setProcessing(true);
    try {
      await employeeScorecardsApi.sendBack(scorecardId, { reason });
      toast.success('Scorecard sent back for revision');
      setShowSendBackModal(false);
      fetchScorecard();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send back');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateKRAWeight = async (kraId: string, weight: number) => {
    try {
      await employeeKRAsApi.update(kraId, { weight });
      fetchScorecard();
    } catch {
      toast.error('Failed to update weight');
    }
  };

  const handleUpdateKPI = async (
    kpiId: string,
    field: string,
    value: string | number
  ) => {
    try {
      await employeeKPIsApi.update(kpiId, { [field]: value });
      fetchScorecard();
    } catch {
      toast.error('Failed to update KPI');
    }
  };

  const handleDeleteKRA = async (kra: EmployeeKRA) => {
    if (kra.kra_source === 'MANDATORY') {
      toast.error('Cannot remove mandatory KRAs');
      return;
    }
    if (!confirm(`Remove "${kra.name}" from this scorecard?`)) return;
    try {
      await employeeKRAsApi.delete(kra.id);
      toast.success('KRA removed');
      fetchScorecard();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const openPeerModal = (kra: EmployeeKRA) => {
    setPeerKRA(kra);
    setShowPeerModal(true);
  };

  if (loading || !scorecard) {
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

  const statusCfg = STATUS_CONFIG[scorecard.status];
  const totalWeight = scorecard.kras.reduce((sum, k) => sum + Number(k.weight), 0);
  const weightValid = Math.abs(totalWeight - 100) < 0.01;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Back button */}
          <button
            onClick={() => navigate('/team-performance')}
            className="mb-4 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Team Performance
          </button>

          {/* Employee Header */}
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                  {scorecard.employee_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {scorecard.employee_name}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {scorecard.employee_id_display}
                    {scorecard.employee_position && ` • ${scorecard.employee_position}`}
                    {scorecard.employee_department &&
                      ` • ${scorecard.employee_department}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusCfg.className}`}
                >
                  {statusCfg.label}
                </span>
                <p className="mt-2 text-xs text-gray-500">{scorecard.cycle.name}</p>
                <p className="text-xs text-gray-400">
                  {formatDate(scorecard.cycle.period_start)} →{' '}
                  {formatDate(scorecard.cycle.period_end)}
                </p>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {scorecard.status === 'SUBMITTED' && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Awaiting your review</p>
                <p className="mt-1 text-amber-700">
                  Review the KRAs and KPIs below. You can edit weights/targets, then
                  approve or send back for revision. For peer-rated KRAs (⭐), click
                  the pink icon to select peers.
                </p>
              </div>
            </div>
          )}

          {scorecard.status === 'SENT_BACK' && scorecard.sent_back_reason && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Sent back for revision</p>
                <p className="mt-1 text-red-700">Reason: {scorecard.sent_back_reason}</p>
              </div>
            </div>
          )}

          {scorecard.status === 'APPROVED' && scorecard.manager_signed_off_at && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-800 ring-1 ring-green-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Approved by you</p>
                <p className="mt-1 text-green-700">
                  Signed off on {formatDate(scorecard.manager_signed_off_at)}. Waiting
                  for employee sign-off.
                </p>
              </div>
            </div>
          )}

          {/* Weight Bar */}
          <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                KRA Weight Allocation
              </h2>
              <span
                className={`text-sm font-bold ${
                  weightValid
                    ? 'text-green-600'
                    : totalWeight > 100
                    ? 'text-red-600'
                    : 'text-amber-600'
                }`}
              >
                {totalWeight.toFixed(1)}% / 100%
                {weightValid && ' ✓'}
              </span>
            </div>
            <div className="h-3 rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all ${
                  weightValid
                    ? 'bg-green-500'
                    : totalWeight > 100
                    ? 'bg-red-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
          </div>

          {/* KRAs */}
          <div className="space-y-3">
            {scorecard.kras.map((kra) => (
              <KRAReviewBlock
                key={kra.id}
                kra={kra}
                expanded={expanded.has(kra.id)}
                canEdit={canEdit}
                onToggleExpand={() => toggleExpand(kra.id)}
                onWeightChange={(w) => handleUpdateKRAWeight(kra.id, w)}
                onKPIChange={handleUpdateKPI}
                onDelete={() => handleDeleteKRA(kra)}
                onManagePeers={() => openPeerModal(kra)}
              />
            ))}
          </div>

          {/* Action buttons */}
          {isReviewable && (
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSendBackModal(true)}
                className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" />
                Send Back for Revision
              </button>
                        <button
            onClick={() => {
              // Check if any peer-rated KRA has no peers selected
              const peerKRAsWithoutPeers = scorecard.kras.filter(
                (k) => k.peer_rating_required
              );
              // Note: we can't check peer count here without async call
              // The PeerRatingSummaryBlock handles the warning inline
              setShowApproveModal(true);
            }}
            disabled={!weightValid}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve Scorecard
          </button>
            </div>
          )}

          {/* Approve Modal */}
          {showApproveModal && (
            <ApproveModal
              onClose={() => setShowApproveModal(false)}
              onConfirm={handleApprove}
              processing={processing}
            />
          )}

          {/* Send Back Modal */}
          {showSendBackModal && (
            <SendBackModal
              onClose={() => setShowSendBackModal(false)}
              onSubmit={handleSendBack}
              processing={processing}
            />
          )}

          {/* Peer Selection Modal */}
          {showPeerModal && peerKRA && scorecard && (
            <PeerSelectionModal
              kra={peerKRA}
              employeeId={scorecard.employee}
              onClose={() => setShowPeerModal(false)}
              onSuccess={() => {
                setShowPeerModal(false);
                fetchScorecard();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// PEER RATING SUMMARY BLOCK (Manager sees peer ratings inline)
// ==============================================================================

function PeerRatingSummaryBlock({ kraId }: { kraId: string }) {
  const [nominations, setNominations] = useState<KRAPeerNomination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    peerNominationsApi.list({ employee_kra: kraId }).then((data) => {
      setNominations(data);
      setLoading(false);
    });
  }, [kraId]);

  if (loading) {
    return (
      <div className="mb-4 rounded-lg bg-pink-50 p-3 text-xs text-pink-700">
        Loading peer ratings...
      </div>
    );
  }

  if (nominations.length === 0) {
    return null;
  }

  const submitted = nominations.filter((n) => n.rating?.status === 'SUBMITTED');
  const pending = nominations.filter((n) => n.rating?.status === 'PENDING');
  const declined = nominations.filter((n) => n.rating?.status === 'DECLINED');
  const avgRating = submitted.length
    ? (submitted.reduce((s, n) => s + (n.rating?.rating || 0), 0) / submitted.length).toFixed(2)
    : null;

  return (
    <div className="mb-4 rounded-xl bg-pink-50 p-4 ring-1 ring-pink-100">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-pink-800">
          <Users2 className="h-3.5 w-3.5" />
          Peer Ratings ({submitted.length}/{nominations.length} submitted)
        </h4>
        {avgRating && (
          <span className="rounded-full bg-pink-600 px-3 py-0.5 text-xs font-bold text-white">
            Avg: {avgRating}/5
          </span>
        )}
      </div>

      <div className="space-y-2">
        {nominations.map((nom) => (
          <div
            key={nom.id}
            className="flex items-start gap-2 rounded-lg bg-white p-2.5 ring-1 ring-gray-100"
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
              {nom.peer.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-900">
                  {nom.peer.full_name}
                </span>
                <span className="text-xs text-gray-400">
                  {nom.peer.employee_id}
                </span>
                {/* Status badge */}
                {nom.rating?.status === 'SUBMITTED' && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    ✓ {nom.rating.rating}/5
                  </span>
                )}
                {nom.rating?.status === 'PENDING' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    ⏳ Pending
                  </span>
                )}
                {nom.rating?.status === 'DECLINED' && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Declined
                  </span>
                )}
              </div>

              {/* Comments (only visible to manager/HR) */}
              {nom.rating?.status === 'SUBMITTED' && (
                <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                  {nom.rating.strengths_comment && (
                    <p>
                      <span className="font-medium text-green-700">Strengths:</span>{' '}
                      {nom.rating.strengths_comment}
                    </p>
                  )}
                  {nom.rating.improvements_comment && (
                    <p>
                      <span className="font-medium text-amber-700">Improvements:</span>{' '}
                      {nom.rating.improvements_comment}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <p className="mt-2 text-xs text-pink-700">
          ⏳ {pending.length} peer(s) haven't submitted yet. You can approve when ready — peer ratings will be included in final scoring.
        </p>
      )}
    </div>
  );
}
// ==============================================================================
// KRA REVIEW BLOCK (Updated with peer status)
// ==============================================================================

function KRAReviewBlock({
  kra,
  expanded,
  canEdit,
  onToggleExpand,
  onWeightChange,
  onKPIChange,
  onDelete,
  onManagePeers,
}: {
  kra: EmployeeKRA;
  expanded: boolean;
  canEdit: boolean;
  onToggleExpand: () => void;
  onWeightChange: (w: number) => void;
  onKPIChange: (kpiId: string, field: string, value: string | number) => void;
  onDelete: () => void;
  onManagePeers: () => void;
}) {
  const [localWeight, setLocalWeight] = useState(String(kra.weight));
  const [peerSummary, setPeerSummary] = useState<{
    total: number;
    submitted: number;
    avg_rating: number | null;
  } | null>(null);
  const [loadingPeers, setLoadingPeers] = useState(false);

  // Load peer summary for peer-rated KRAs
  useEffect(() => {
    if (!kra.peer_rating_required) return;

    const loadPeerSummary = async () => {
      setLoadingPeers(true);
      try {
        const nominations = await peerNominationsApi.list({ employee_kra: kra.id });
        const submitted = nominations.filter(
          (n) => n.rating?.status === 'SUBMITTED'
        );
        const ratings = submitted
          .map((n) => n.rating?.rating)
          .filter((r): r is number => r !== null && r !== undefined);
        const avg = ratings.length
          ? ratings.reduce((s, r) => s + r, 0) / ratings.length
          : null;

        setPeerSummary({
          total: nominations.length,
          submitted: submitted.length,
          avg_rating: avg ? Math.round(avg * 100) / 100 : null,
        });
      } catch {
        // ignore
      } finally {
        setLoadingPeers(false);
      }
    };

    loadPeerSummary();
  }, [kra.id, kra.peer_rating_required]);

  const peerStatusColor = () => {
    if (!peerSummary) return 'bg-gray-100 text-gray-600';
    if (peerSummary.total === 0) return 'bg-red-100 text-red-700';
    if (peerSummary.submitted === peerSummary.total) return 'bg-green-100 text-green-700';
    return 'bg-amber-100 text-amber-700';
  };

  const peerStatusLabel = () => {
    if (!peerSummary) return 'Loading...';
    if (peerSummary.total === 0) return '⚠ No peers selected';
    return `${peerSummary.submitted}/${peerSummary.total} submitted`;
  };

  return (
    <div
      className={`rounded-2xl bg-white shadow-sm ring-1 transition ${
        kra.peer_rating_required && peerSummary?.total === 0
          ? 'ring-amber-300'
          : 'ring-gray-100'
      }`}
    >
      {/* KRA Header */}
      <div className="flex items-start gap-3 p-5">
        <button
          onClick={onToggleExpand}
          className="mt-1 rounded p-1 text-gray-400 hover:bg-gray-100"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{kra.name}</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {kra.kra_source_display}
            </span>
            {kra.peer_rating_required && (
              <span className="flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700 ring-1 ring-pink-200">
                <Star className="h-3 w-3 fill-current" />
                Peer Rating Required
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-gray-600">{kra.description}</p>

          {/* Weight + KPI count row */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {canEdit ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.01"
                  value={localWeight}
                  onChange={(e) => setLocalWeight(e.target.value)}
                  onBlur={() => {
                    const w = parseFloat(localWeight) || 0;
                    setLocalWeight(String(w));
                    if (w !== Number(kra.weight)) onWeightChange(w);
                  }}
                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-xs text-center focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-xs text-gray-500">% weight</span>
              </div>
            ) : (
              <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
                {kra.weight}% weight
              </span>
            )}

            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Zap className="h-3 w-3" />
              {kra.kpis.length} KPI{kra.kpis.length !== 1 ? 's' : ''}
            </span>

            {/* ⭐ PEER STATUS BADGE (always visible for peer-rated KRAs) */}
            {kra.peer_rating_required && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${peerStatusColor()}`}
              >
                <Users2 className="h-3 w-3" />
                {loadingPeers ? 'Loading...' : peerStatusLabel()}
                {peerSummary?.avg_rating !== null &&
                  peerSummary?.avg_rating !== undefined && (
                    <span className="ml-1 font-bold">
                      · Avg: {peerSummary.avg_rating}/5
                    </span>
                  )}
              </span>
            )}
          </div>

          {/* ⚠️ Warning if peer-rated but no peers selected */}
          {kra.peer_rating_required && peerSummary?.total === 0 && canEdit && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 ring-1 ring-amber-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <strong>Action needed:</strong> This KRA requires peer rating. Click the{' '}
                <span className="inline-flex items-center gap-0.5 rounded bg-pink-100 px-1 py-0.5 text-pink-700">
                  <Users2 className="h-3 w-3" /> Select Peers
                </span>{' '}
                button before approving.
              </span>
            </div>
          )}
        </div>

        {/* Actions — always visible for peer-rated KRAs */}
        <div className="flex flex-shrink-0 items-center gap-1">
          {/* PEER SELECTION button — visible for all managers on peer-rated KRAs */}
          {kra.peer_rating_required && (
            <button
              onClick={onManagePeers}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                peerSummary?.total === 0
                  ? 'bg-pink-600 text-white hover:bg-pink-700'
                  : 'bg-pink-50 text-pink-600 hover:bg-pink-100 ring-1 ring-pink-200'
              }`}
              title="Select peers for this KRA"
            >
              <Users2 className="h-3.5 w-3.5" />
              {peerSummary?.total === 0 ? 'Select Peers' : 'Manage Peers'}
            </button>
          )}

          {canEdit && kra.kra_source !== 'MANDATORY' && (
            <button
              onClick={onDelete}
              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded KPIs */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-5">
          {kra.rationale && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              <span className="font-medium">Employee's rationale:</span> {kra.rationale}
            </div>
          )}

          {/* Peer ratings summary (read-only, for manager to see) */}
          {kra.peer_rating_required &&
            peerSummary &&
            peerSummary.total > 0 && (
              <PeerRatingSummaryBlock kraId={kra.id} />
            )}

          <h4 className="mb-3 text-xs font-semibold uppercase text-gray-500">
            KPIs ({kra.kpis.length})
          </h4>

          {kra.kpis.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No KPIs added yet
            </div>
          ) : (
            <div className="space-y-2">
              {kra.kpis.map((kpi) => (
                <KPIReviewCard
                  key={kpi.id}
                  kpi={kpi}
                  canEdit={canEdit}
                  onChange={onKPIChange}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// KPI REVIEW CARD
// ==============================================================================

function KPIReviewCard({
  kpi,
  canEdit,
  onChange,
}: {
  kpi: EmployeeKPI;
  canEdit: boolean;
  onChange: (kpiId: string, field: string, value: string | number) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [localForm, setLocalForm] = useState({
    target_minimum: kpi.target_minimum,
    target_expected: kpi.target_expected,
    target_exceptional: kpi.target_exceptional,
    weight_in_kra: String(kpi.weight_in_kra),
  });

  const handleSave = () => {
    Object.entries(localForm).forEach(([field, value]) => {
      if (String(value) !== String(kpi[field as keyof EmployeeKPI])) {
        onChange(
          kpi.id,
          field,
          field === 'weight_in_kra' ? parseFloat(value as string) || 0 : (value as string)
        );
      }
    });
    setEditMode(false);
  };

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-gray-100">
      <div className="flex items-start gap-3">
        <span className="text-lg">{KPI_TYPE_ICONS[kpi.kpi_type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h5 className="text-sm font-medium text-gray-900">{kpi.name}</h5>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
              {kpi.weight_in_kra}%
            </span>
          </div>

          {/* Targets — Edit mode */}
          {editMode ? (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3">
              <div>
                <label className="mb-0.5 block text-xs text-gray-500">Min</label>
                <input
                  type="text"
                  value={localForm.target_minimum}
                  onChange={(e) =>
                    setLocalForm({ ...localForm, target_minimum: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-gray-500">Expected</label>
                <input
                  type="text"
                  value={localForm.target_expected}
                  onChange={(e) =>
                    setLocalForm({ ...localForm, target_expected: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-gray-500">Exceptional</label>
                <input
                  type="text"
                  value={localForm.target_exceptional}
                  onChange={(e) =>
                    setLocalForm({ ...localForm, target_exceptional: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-gray-500">Weight (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={localForm.weight_in_kra}
                  onChange={(e) =>
                    setLocalForm({ ...localForm, weight_in_kra: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditMode(false)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700"
                >
                  <Save className="h-3 w-3" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Targets — Read view */}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {kpi.baseline && (
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700">
                    Baseline: {kpi.baseline}
                  </span>
                )}
                {kpi.target_minimum && (
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800">
                    Min: {kpi.target_minimum}
                  </span>
                )}
                <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-800">
                  Expected: {kpi.target_expected}
                </span>
                {kpi.target_exceptional && (
                  <span className="rounded-md bg-green-50 px-2 py-0.5 text-green-800">
                    Exceptional: {kpi.target_exceptional}
                  </span>
                )}
              </div>

              {kpi.action_plan && (
                <div className="mt-2 rounded-md bg-gray-50 p-2 text-xs text-gray-700">
                  <span className="font-medium text-gray-500">Action Plan:</span>{' '}
                  {kpi.action_plan}
                </div>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{kpi.indicator_type_display}</span>
                {kpi.formula && <span>📊 {kpi.formula}</span>}
                {kpi.data_source && <span>Source: {kpi.data_source}</span>}
              </div>
            </>
          )}
        </div>

        {canEdit && !editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="rounded p-1.5 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
            title="Edit KPI"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ==============================================================================
// APPROVE MODAL
// ==============================================================================

function ApproveModal({
  onClose,
  onConfirm,
  processing,
}: {
  onClose: () => void;
  onConfirm: () => void;
  processing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Approve Scorecard</h3>
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Once approved, the employee will be notified to sign off on their
            commitment. After employee sign-off, the working phase begins.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={processing}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve
            </button>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

// ==============================================================================
// SEND BACK MODAL
// ==============================================================================

function SendBackModal({
  onClose,
  onSubmit,
  processing,
}: {
  onClose: () => void;
  onSubmit: (reason: string) => void;
  processing: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              Send Back for Revision
            </h3>
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Provide feedback so the employee knows what to fix and resubmit.
          </p>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="e.g. Add more specific KPIs under Code Quality KRA. Sprint velocity target should be more achievable..."
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
              onClick={() => onSubmit(reason)}
              disabled={processing || reason.trim().length < 5}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Send Back
            </button>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

// ==============================================================================
// PEER SELECTION MODAL
// ==============================================================================

function PeerSelectionModal({
  kra,
  employeeId,
  onClose,
  onSuccess,
}: {
  kra: EmployeeKRA;
  employeeId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [availablePeers, setAvailablePeers] = useState<EmployeeForPeer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [existingNoms, setExistingNoms] = useState<KRAPeerNomination[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [peers, noms] = await Promise.all([
        peerSearchApi.search({ exclude_employee: employeeId, search }),
        peerNominationsApi.list({ employee_kra: kra.id }),
      ]);
      setAvailablePeers(peers);
      setExistingNoms(noms);
      setSelectedIds(new Set(noms.map((n) => n.nominated_peer)));
    } catch {
      toast.error('Failed to load peers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggle = (peerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(peerId)) {
        next.delete(peerId);
      } else if (next.size < 5) {
        next.add(peerId);
      } else {
        toast.error('Maximum 5 peers allowed');
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedIds.size < 2) {
      toast.error('Please select at least 2 peers');
      return;
    }
    setSaving(true);
    try {
      await peerNominationsApi.nominate({
        employee_kra_id: kra.id,
        peer_ids: Array.from(selectedIds),
      });
      toast.success('Peers nominated. They will be notified.');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-100">
              <Users2 className="h-4 w-4 text-pink-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Select Peers</h3>
              <p className="text-xs text-gray-500">For KRA: {kra.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Select 2-5 peers. Selected:{' '}
            <span className="font-semibold">{selectedIds.size}/5</span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : availablePeers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No employees found</p>
          ) : (
            <div className="space-y-2">
              {availablePeers.map((peer) => {
                const selected = selectedIds.has(peer.id);
                const existingNom = existingNoms.find(
                  (n) => n.nominated_peer === peer.id
                );
                const hasSubmitted = existingNom?.rating?.status === 'SUBMITTED';

                return (
                  <label
                    key={peer.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      selected
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    } ${hasSubmitted ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggle(peer.id)}
                      disabled={hasSubmitted}
                      className="h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                      {peer.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {peer.full_name}
                        </p>
                        {hasSubmitted && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            ✓ Already rated
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {peer.employee_id}
                        {peer.position_title && ` • ${peer.position_title}`}
                        {peer.department_name && ` • ${peer.department_name}`}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedIds.size < 2}
            className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users2 className="h-4 w-4" />
            )}
            Save Peers
          </button>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}