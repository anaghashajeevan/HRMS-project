import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck, Loader2, Calendar, TrendingUp,
  ArrowRight, CheckCircle2, Clock, AlertCircle,
  Edit, Eye, Award, Send, XCircle,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { employeeScorecardsApi } from '../../api/performance';
import type { EmployeeScorecardListItem, ScorecardStatus } from '../../types/performance';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<
  ScorecardStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700', icon: Edit },
  SUBMITTED: { label: 'Submitted', className: 'bg-blue-100 text-blue-700', icon: Send },
  MANAGER_REVIEWING: { label: 'Manager Reviewing', className: 'bg-indigo-100 text-indigo-700', icon: Clock },
  SENT_BACK: { label: 'Sent Back', className: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  SIGNED_OFF: { label: 'Signed Off', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  SELF_REVIEW_PENDING: { label: 'Self Review Pending', className: 'bg-purple-100 text-purple-700', icon: Edit },
  SELF_REVIEWED: { label: 'Self Reviewed', className: 'bg-purple-100 text-purple-700', icon: CheckCircle2 },
  MANAGER_REVIEW_PENDING: { label: 'Final Review Pending', className: 'bg-orange-100 text-orange-700', icon: Clock },
  MANAGER_REVIEWED: { label: 'Final Review Done', className: 'bg-teal-100 text-teal-700', icon: CheckCircle2 },
  FINALIZED: { label: 'Finalized', className: 'bg-green-100 text-green-700', icon: Award },
};

export default function MyPerformancePage() {
  const navigate = useNavigate();
  const [scorecards, setScorecards] = useState<EmployeeScorecardListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScorecards = async () => {
    setLoading(true);
    try {
      const data = await employeeScorecardsApi.myScorecards();
      setScorecards(data);
    } catch (err) {
      toast.error('Failed to load scorecards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScorecards();
  }, []);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const getActionButton = (sc: EmployeeScorecardListItem) => {
    switch (sc.status) {
      case 'DRAFT':
      case 'SENT_BACK':
        return {
          label: 'Build Scorecard',
          icon: Edit,
          action: () => navigate(`/my-performance/build/${sc.id}`),
          className: 'bg-primary-600 text-white hover:bg-primary-700',
        };
      case 'APPROVED':
        return {
          label: 'Sign Off',
          icon: CheckCircle2,
          action: () => navigate(`/my-performance/build/${sc.id}`),
          className: 'bg-green-600 text-white hover:bg-green-700',
        };
      case 'SIGNED_OFF':
case 'SELF_REVIEW_PENDING':
  return {
    label: 'Self Review',
    icon: Edit,
    action: () => navigate(`/my-performance/self-review/${sc.id}`),
    className: 'bg-purple-600 text-white hover:bg-purple-700',
  };
      default:
        return {
          label: 'View',
          icon: Eye,
          action: () => navigate(`/my-performance/build/${sc.id}`),
          className: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        };
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">My Performance</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Build your scorecard, track KRAs/KPIs, and review your performance across cycles
            </p>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : scorecards.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <ClipboardCheck className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                No scorecards yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Your scorecard will appear here once HR activates a performance cycle.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scorecards.map((sc) => {
                const statusCfg = STATUS_CONFIG[sc.status];
                const StatusIcon = statusCfg.icon;
                const action = getActionButton(sc);
                const ActionIcon = action.icon;

                return (
                  <div
                    key={sc.id}
                    className="group flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md"
                  >
                    {/* Status + Type */}
                    <div className="mb-3 flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                        {sc.cycle_type}
                      </span>
                    </div>

                    {/* Cycle name */}
                    <h3 className="text-base font-semibold text-gray-900">
                      {sc.cycle_name}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Created {formatDate(sc.created_at)}
                    </p>

                    {/* Stats */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-gray-50 p-2 text-center">
                        <div className="text-lg font-bold text-gray-900">
                          {sc.kra_count}
                        </div>
                        <div className="text-xs text-gray-500">KRAs</div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-2 text-center">
                        <div className="text-lg font-bold text-gray-900">
                          {sc.total_weight}%
                        </div>
                        <div className="text-xs text-gray-500">Weight</div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-2 text-center">
                        {sc.final_score != null ? (
                          <>
                            <div className="text-lg font-bold text-primary-700">
                              {sc.final_score}%
                            </div>
                            <div className="text-xs text-gray-500">Score</div>
                          </>
                        ) : (
                          <>
                            <div className="text-lg font-bold text-gray-400">—</div>
                            <div className="text-xs text-gray-500">Score</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Weight progress bar */}
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                        <span>Weight allocation</span>
                        <span
                          className={
                            Math.abs(Number(sc.total_weight) - 100) < 0.01
                              ? 'font-medium text-green-600'
                              : 'font-medium text-amber-600'
                          }
                        >
                          {sc.total_weight}% / 100%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full transition-all ${
                            Math.abs(Number(sc.total_weight) - 100) < 0.01
                              ? 'bg-green-500'
                              : Number(sc.total_weight) > 100
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                          }`}
                          style={{
                            width: `${Math.min(Number(sc.total_weight), 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Sent back warning */}
                    {sc.status === 'SENT_BACK' && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 ring-1 ring-amber-100">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        Manager has sent this back for revision
                      </div>
                    )}

                    {/* Action button */}
                    <div className="mt-auto pt-4">
                      <button
                        onClick={action.action}
                        className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${action.className}`}
                      >
                        <ActionIcon className="h-4 w-4" />
                        {action.label}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}