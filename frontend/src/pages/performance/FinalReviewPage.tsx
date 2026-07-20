import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Send, ChevronDown, ChevronRight,
  Star, FileText, Info, Award, Trophy,
  CheckCircle2,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { employeeScorecardsApi, employeeKPIsApi, peerRatingsApi } from '../../api/performance';
import type { EmployeeScorecardDetail, EmployeeKPI, PeerRating } from '../../types/performance';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const KPI_TYPE_ICONS: Record<string, string> = {
  NUMERIC_UP: '📈', NUMERIC_DOWN: '📉', PERCENTAGE: '%',
  RATING: '⭐', BOOLEAN: '✓', CURRENCY: '💰',
};

export default function FinalReviewPage() {
  const { scorecardId } = useParams<{ scorecardId: string }>();
  const navigate = useNavigate();

  const [scorecard, setScorecard] = useState<EmployeeScorecardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchScorecard = async () => {
    if (!scorecardId) return;
    setLoading(true);
    try {
      const data = await employeeScorecardsApi.getById(scorecardId);
      setScorecard(data);
      setExpanded(new Set(data.kras.map((k) => k.id)));
    } catch {
      toast.error('Failed to load');
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

  const handleUpdateKPI = async (kpiId: string, field: string, val: string | number) => {
    try {
      await employeeKPIsApi.update(kpiId, { [field]: val });
    } catch {
      toast.error('Save failed');
    }
  };

  const handleSubmitFinalReview = async () => {
    if (!scorecardId) return;
    if (!confirm('Submit final review? This will calculate the final score.')) return;
    setSubmitting(true);
    try {
      const result = await employeeScorecardsApi.submitFinalReview(scorecardId);
      toast.success(
        `Final review submitted! Score: ${result.final_score}% (Rating ${result.final_rating})`
      );
      fetchScorecard();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
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

  const canEdit = ['SELF_REVIEWED', 'MANAGER_REVIEW_PENDING'].includes(scorecard.status);
  const showScore = scorecard.final_score !== null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <button
            onClick={() => navigate('/team-performance')}
            className="mb-4 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {/* Employee Header */}
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Final Review</h1>
            <p className="mt-1 text-sm text-gray-500">
              {scorecard.employee_name} • {scorecard.cycle.name}
            </p>
          </div>

          {/* Final Score Card */}
          {showScore && (
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-700 p-6 text-white shadow-lg">
              <div className="flex items-center gap-4">
                <Trophy className="h-12 w-12" />
                <div>
                  <p className="text-sm opacity-80">Final Score</p>
                  <h2 className="text-4xl font-bold">{scorecard.final_score}%</h2>
                  <p className="text-sm">Rating: {scorecard.final_rating}/5</p>
                </div>
                <div className="ml-auto space-y-1 text-right text-sm">
                  {scorecard.self_score && <div>Self: {scorecard.self_score}%</div>}
                  {scorecard.peer_score && <div>Peer: {scorecard.peer_score}%</div>}
                  <div>Manager: {scorecard.manager_score}%</div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Manager Final Review</p>
              <p className="mt-1 text-blue-700">
                Review the employee's self-assessment + peer ratings (if applicable).
                Enter your final actuals and rating. On submit, system calculates
                the final weighted score.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {scorecard.kras.map((kra) => (
              <KRAFinalBlock
                key={kra.id}
                kra={kra}
                expanded={expanded.has(kra.id)}
                canEdit={canEdit}
                onToggle={() => toggleExpand(kra.id)}
                onUpdate={handleUpdateKPI}
              />
            ))}
          </div>

          {canEdit && (
  <div className="mt-6 flex justify-end">
    <button
      onClick={handleSubmitFinalReview}
      disabled={submitting}
      className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
    >
      {submitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Award className="h-4 w-4" />
      )}
      Submit Final Review & Calculate Score
    </button>
  </div>
)}

{/* ⬇️ NEW: HR-only Finalize button for MANAGER_REVIEWED scorecards */}
{scorecard.status === 'MANAGER_REVIEWED' && (
  <div className="mt-6 rounded-2xl bg-gradient-to-r from-purple-600 to-primary-600 p-6 text-white shadow-lg">
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6" />
          <h3 className="text-lg font-bold">Ready for Finalization</h3>
        </div>
        <p className="mt-1 text-sm opacity-90">
          HR can now lock this scorecard and generate the rating letter.
        </p>
      </div>
      <FinalizeButton scorecardId={scorecard.id} onSuccess={fetchScorecard} />
    </div>
  </div>
)}

{scorecard.status === 'FINALIZED' && (
  <div className="mt-6 rounded-2xl bg-green-50 p-6 ring-1 ring-green-200">
    <div className="flex items-center gap-3">
      <CheckCircle2 className="h-8 w-8 text-green-600" />
      <div>
        <h3 className="text-lg font-bold text-green-900">Finalized ✓</h3>
        <p className="text-sm text-green-700">
          Scorecard is locked. Rating letter has been generated and emailed to the employee.
        </p>
      </div>
    </div>
  </div>
)}
        </main>
      </div>
    </div>
  );
}

function KRAFinalBlock({ kra, expanded, canEdit, onToggle, onUpdate }: any) {
  const [peerRatings, setPeerRatings] = useState<PeerRating[]>([]);

  useEffect(() => {
    if (kra.peer_rating_required && expanded) {
      peerRatingsApi.list({ nomination: kra.id }).then(setPeerRatings).catch(() => {});
    }
  }, [kra.id, kra.peer_rating_required, expanded]);

  const peerAvg = peerRatings.filter((p) => p.status === 'SUBMITTED' && p.rating);
  const avgRating = peerAvg.length
    ? peerAvg.reduce((s, p) => s + (p.rating || 0), 0) / peerAvg.length
    : null;

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start gap-3 p-5">
        <button onClick={onToggle} className="mt-1 rounded p-1 text-gray-400 hover:bg-gray-100">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{kra.name}</h3>
            <span className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
              {kra.weight}%
            </span>
            {kra.peer_rating_required && (
              <span className="flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700">
                <Star className="h-3 w-3 fill-current" />
                Peer
              </span>
            )}
            {kra.kra_score !== null && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                Score: {kra.kra_score}%
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-5">
          {kra.peer_rating_required && (
            <div className="mb-4 rounded-lg bg-pink-50 p-3 text-sm ring-1 ring-pink-100">
              <div className="flex items-center justify-between">
                <span className="font-medium text-pink-800">Peer Feedback Summary</span>
                {avgRating !== null && (
                  <span className="rounded-full bg-pink-600 px-3 py-1 text-xs font-bold text-white">
                    Avg: {avgRating.toFixed(2)}/5
                  </span>
                )}
              </div>
              {peerRatings.length > 0 && (
                <div className="mt-2 space-y-2">
                  {peerRatings
                    .filter((p) => p.status === 'SUBMITTED')
                    .map((p) => (
                      <div
                        key={p.id}
                        className="rounded-md bg-white p-2 text-xs text-gray-700"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.peer_name}</span>
                          <span className="rounded bg-pink-100 px-2 py-0.5 text-pink-700">
                            {p.rating}/5
                          </span>
                        </div>
                        {p.strengths_comment && (
                          <p className="mt-1">
                            <strong>Strengths:</strong> {p.strengths_comment}
                          </p>
                        )}
                        {p.improvements_comment && (
                          <p className="mt-1">
                            <strong>Improvements:</strong> {p.improvements_comment}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {kra.kpis.map((kpi: EmployeeKPI) => (
              <KPIFinalCard key={kpi.id} kpi={kpi} canEdit={canEdit} onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPIFinalCard({
  kpi,
  canEdit,
  onUpdate,
}: {
  kpi: EmployeeKPI;
  canEdit: boolean;
  onUpdate: (id: string, field: string, val: string | number) => void;
}) {
  const [mgrActual, setMgrActual] = useState(kpi.manager_actual || kpi.self_actual);
  const [mgrRating, setMgrRating] = useState(kpi.manager_rating || kpi.self_rating || 0);
  const [mgrComment, setMgrComment] = useState(kpi.manager_comment);
  const [overrideReason, setOverrideReason] = useState(kpi.manager_override_reason);

  const isOverriding = mgrActual !== kpi.self_actual && kpi.self_actual;

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-gray-100">
      <div className="flex items-start gap-3">
        <span className="text-lg">{KPI_TYPE_ICONS[kpi.kpi_type]}</span>
        <div className="flex-1">
          <h5 className="text-sm font-semibold text-gray-900">{kpi.name}</h5>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-800">
              Target: {kpi.target_expected}
            </span>
            {kpi.weighted_score !== null && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 font-bold text-green-800">
                Score: {kpi.weighted_score}%
              </span>
            )}
          </div>

          {/* Self review */}
          <div className="mt-3 rounded-lg bg-gray-100 p-3">
            <p className="mb-1 text-xs font-medium uppercase text-gray-500">
              Employee's Self Review
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Actual:</span>{' '}
                <strong>{kpi.self_actual || '—'}</strong>
              </div>
              <div>
                <span className="text-gray-500">Rating:</span>{' '}
                <strong>{kpi.self_rating || '—'}/5</strong>
              </div>
              {kpi.self_comment && (
                <div className="col-span-2">
                  <span className="text-gray-500">Comment:</span>{' '}
                  <span className="italic">{kpi.self_comment}</span>
                </div>
              )}
              {kpi.evidences.length > 0 && (
                <div className="col-span-2 flex flex-wrap gap-1 mt-1">
                  {kpi.evidences.map((ev) => (
                    <a
                      key={ev.id}
                      href={ev.file_url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 rounded-md bg-primary-50 px-2 py-0.5 text-xs text-primary-700 hover:bg-primary-100"
                    >
                      <FileText className="h-3 w-3" />
                      {ev.file_name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Manager assessment */}
          <div className="mt-3 rounded-lg bg-primary-50 p-3 ring-1 ring-primary-100">
            <p className="mb-2 text-xs font-medium uppercase text-primary-700">
              Your Assessment (Manager)
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-600">
                  Manager Actual
                </label>
                <input
                  type="text"
                  value={mgrActual}
                  onChange={(e) => setMgrActual(e.target.value)}
                  onBlur={() =>
                    mgrActual !== kpi.manager_actual &&
                    onUpdate(kpi.id, 'manager_actual', mgrActual)
                  }
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">
                  Manager Rating (1-5)
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => {
                        setMgrRating(n);
                        onUpdate(kpi.id, 'manager_rating', n);
                      }}
                      className={`h-9 w-9 rounded-lg border-2 text-xs font-bold ${
                        mgrRating >= n
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-200 bg-white text-gray-400'
                      } disabled:opacity-50`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs text-gray-600">Manager Comments</label>
              <textarea
                value={mgrComment}
                onChange={(e) => setMgrComment(e.target.value)}
                onBlur={() =>
                  mgrComment !== kpi.manager_comment &&
                  onUpdate(kpi.id, 'manager_comment', mgrComment)
                }
                disabled={!canEdit}
                rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50"
                placeholder="Your feedback..."
              />
            </div>

            {isOverriding && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-red-600">
                  Override Reason (required — differs from employee)
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  onBlur={() =>
                    overrideReason !== kpi.manager_override_reason &&
                    onUpdate(kpi.id, 'manager_override_reason', overrideReason)
                  }
                  disabled={!canEdit}
                  rows={2}
                  className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50"
                  placeholder="Why did you change the employee's actual?"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// FINALIZE BUTTON (HR-only)
// ==============================================================================

function FinalizeButton({
  scorecardId,
  onSuccess,
}: {
  scorecardId: string;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);

  const isHR =
    user?.role_codes.includes('HR_ADMIN') ||
    user?.role_codes.includes('SYSTEM_ADMIN');

  if (!isHR) {
    return (
      <div className="rounded-lg bg-white/20 px-4 py-2 text-xs text-white">
        Waiting for HR to finalize
      </div>
    );
  }

  const handleFinalize = async () => {
    if (
      !confirm(
        'Finalize this scorecard? This will lock it and generate the rating letter. This cannot be undone.'
      )
    )
      return;
    setProcessing(true);
    try {
      await employeeScorecardsApi.finalize(scorecardId);
      toast.success('Scorecard finalized! Letter is being generated.');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Finalization failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <button
      onClick={handleFinalize}
      disabled={processing}
      className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {processing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trophy className="h-4 w-4" />
      )}
      Finalize & Generate Letter
    </button>
  );
}