import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Save, Send, Upload, X,
  Star, Zap, Info, CheckCircle2, Trash2, FileText,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import {
  employeeScorecardsApi,
  employeeKPIsApi,
  kpiEvidencesApi,
} from '../../api/performance';
import type {
  EmployeeScorecardDetail,
  EmployeeKPI,
} from '../../types/performance';
import toast from 'react-hot-toast';

const KPI_TYPE_ICONS: Record<string, string> = {
  NUMERIC_UP: '📈',
  NUMERIC_DOWN: '📉',
  PERCENTAGE: '%',
  RATING: '⭐',
  BOOLEAN: '✓',
  CURRENCY: '💰',
};

export default function SelfReviewPage() {
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
      navigate('/my-performance');
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

  const handleUpdateKPI = async (
    kpiId: string,
    field: string,
    value: string | number
  ) => {
    try {
      await employeeKPIsApi.update(kpiId, { [field]: value });
    } catch {
      toast.error('Save failed');
    }
  };

  const handleSubmit = async () => {
    if (!scorecardId) return;
    if (!confirm('Submit self-review to manager?')) return;
    setSubmitting(true);
    try {
      await employeeScorecardsApi.submitSelfReview(scorecardId);
      toast.success('Self-review submitted to manager!');
      navigate('/my-performance');
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

  const canEdit = ['SIGNED_OFF', 'SELF_REVIEW_PENDING'].includes(scorecard.status);
  const filledCount = scorecard.kras.reduce(
    (sum, kra) => sum + kra.kpis.filter((k) => k.self_actual.trim()).length,
    0
  );
  const totalKPIs = scorecard.kras.reduce((sum, kra) => sum + kra.kpis.length, 0);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <button
            onClick={() => navigate('/my-performance')}
            className="mb-4 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Self Review</h1>
            <p className="mt-1 text-sm text-gray-500">
              {scorecard.cycle.name} • Fill in your actuals + upload evidence
            </p>
            <div className="mt-3 rounded-lg bg-primary-50 p-3 text-sm text-primary-800">
              <span className="font-medium">Progress:</span>{' '}
              {filledCount} / {totalKPIs} KPIs filled
            </div>
          </div>

          <div className="mb-4 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">How to self-review</p>
              <p className="mt-1 text-blue-700">
                Enter your actual results for each KPI, rate yourself (1-5), add
                comments, and optionally upload evidence (screenshots, reports).
                Your manager will verify and add their assessment.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {scorecard.kras.map((kra) => (
              <KRABlock
                key={kra.id}
                kra={kra}
                expanded={expanded.has(kra.id)}
                canEdit={canEdit}
                onToggle={() => toggleExpand(kra.id)}
                onUpdate={handleUpdateKPI}
                onEvidenceChange={fetchScorecard}
              />
            ))}
          </div>

          {canEdit && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={submitting || filledCount === 0}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Self Review to Manager
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function KRABlock({
  kra,
  expanded,
  canEdit,
  onToggle,
  onUpdate,
  onEvidenceChange,
}: any) {
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
          </div>
          <p className="mt-1 text-xs text-gray-600">{kra.description}</p>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-5 space-y-3">
          {kra.kpis.map((kpi: EmployeeKPI) => (
            <KPISelfCard
              key={kpi.id}
              kpi={kpi}
              canEdit={canEdit}
              onUpdate={onUpdate}
              onEvidenceChange={onEvidenceChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KPISelfCard({
  kpi,
  canEdit,
  onUpdate,
  onEvidenceChange,
}: {
  kpi: EmployeeKPI;
  canEdit: boolean;
  onUpdate: (id: string, field: string, val: string | number) => void;
  onEvidenceChange: () => void;
}) {
  const [actual, setActual] = useState(kpi.self_actual);
  const [rating, setRating] = useState(kpi.self_rating || 0);
  const [comment, setComment] = useState(kpi.self_comment);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('kpi', kpi.id);
      fd.append('file', file);
      fd.append('file_name', file.name);
      await kpiEvidencesApi.upload(fd);
      toast.success('Evidence uploaded');
      onEvidenceChange();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    if (!confirm('Delete this evidence?')) return;
    try {
      await kpiEvidencesApi.delete(id);
      toast.success('Deleted');
      onEvidenceChange();
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-gray-100">
      <div className="flex items-start gap-3">
        <span className="text-lg">{KPI_TYPE_ICONS[kpi.kpi_type]}</span>
        <div className="flex-1">
          <h5 className="text-sm font-semibold text-gray-900">{kpi.name}</h5>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {kpi.target_minimum && (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800">
                Min: {kpi.target_minimum}
              </span>
            )}
            <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-800">
              Target: {kpi.target_expected}
            </span>
            {kpi.target_exceptional && (
              <span className="rounded-md bg-green-50 px-2 py-0.5 text-green-800">
                Exceptional: {kpi.target_exceptional}
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Your Actual
              </label>
              <input
                type="text"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                onBlur={() => actual !== kpi.self_actual && onUpdate(kpi.id, 'self_actual', actual)}
                disabled={!canEdit}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50"
                placeholder="e.g. 85%, 42 pts, ₹12L"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Self Rating (1-5)
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      setRating(n);
                      onUpdate(kpi.id, 'self_rating', n);
                    }}
                    className={`h-10 w-10 rounded-lg border-2 text-sm font-bold transition ${
                      rating >= n
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-gray-200 bg-white text-gray-400 hover:border-primary-300'
                    } disabled:opacity-50`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
              Comments
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => comment !== kpi.self_comment && onUpdate(kpi.id, 'self_comment', comment)}
              disabled={!canEdit}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50"
              placeholder="Explain how you achieved this..."
            />
          </div>

          {/* Evidence */}
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium uppercase text-gray-500">
                Evidence ({kpi.evidences.length})
              </label>
              {canEdit && (
                <label className="flex cursor-pointer items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100">
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  Upload File
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
            {kpi.evidences.length > 0 && (
              <div className="space-y-1">
                {kpi.evidences.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1 text-xs"
                  >
                    <FileText className="h-3 w-3 text-gray-500" />
                    <a
                      href={ev.file_url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 truncate text-primary-600 hover:underline"
                    >
                      {ev.file_name}
                    </a>
                    <span className="text-gray-400">{ev.file_size_kb} KB</span>
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteEvidence(ev.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}