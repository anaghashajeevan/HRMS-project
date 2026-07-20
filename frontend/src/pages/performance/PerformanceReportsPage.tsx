import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Loader2, Calendar, Building2, Users,
  TrendingUp, TrendingDown, Minus, Trophy, AlertTriangle,
  Target, PieChart, Award, ArrowUp, ArrowDown,Download, FileSpreadsheet, FileText as FilePdf
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { performanceReportsApi, performanceCyclesApi } from '../../api/performance';
import type { PerformanceCycle } from '../../types/performance';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

type ReportTab = 'company' | 'department' | 'team' | 'individual' | 'kra' | 'cycle_comparison';

const RATING_COLORS: Record<number, string> = {
  1: '#EF4444',
  2: '#F59E0B',
  3: '#3B82F6',
  4: '#22C55E',
  5: '#16A34A',
};

const RATING_LABELS: Record<number, string> = {
  1: 'Unsatisfactory',
  2: 'Needs Improvement',
  3: 'Meets',
  4: 'Exceeds',
  5: 'Outstanding',
};

export default function PerformanceReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('company');
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [selectedCycles, setSelectedCycles] = useState<string[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const isHR =
    user?.role_codes.includes('HR_ADMIN') ||
    user?.role_codes.includes('SYSTEM_ADMIN');
  const isManager = user?.role_codes.includes('MANAGER');

  // Available tabs by role
  const availableTabs: ReportTab[] = useMemo(() => {
    const tabs: ReportTab[] = [];
    if (isHR) tabs.push('company', 'department', 'kra', 'cycle_comparison');
    if (isManager || isHR) tabs.push('team');
    tabs.push('individual');
    return tabs;
  }, [isHR, isManager]);

  // Load cycles
  useEffect(() => {
    performanceCyclesApi
      .list()
      .then((data) => {
        setCycles(data);
        const activeCycle = data.find((c) => c.status === 'ACTIVE');
        if (activeCycle) setSelectedCycle(activeCycle.id);
        else if (data.length > 0) setSelectedCycle(data[0].id);
      })
      .catch(() => toast.error('Failed to load cycles'));
  }, []);

  // Load report data when tab or cycle changes
  useEffect(() => {
    if (activeTab === 'individual') {
      fetchIndividual();
    } else if (activeTab === 'team') {
      fetchTeam();
    } else if (activeTab === 'cycle_comparison') {
      fetchCycleComparison();
    } else if (selectedCycle) {
      fetchByTab();
    }
  }, [activeTab, selectedCycle, selectedCycles]);

 const handleDownload = async (format: 'excel' | 'pdf') => {
  try {
    // Build params based on active tab
    const params: any = { type: activeTab, format };

    if (activeTab === 'team' && selectedCycle) {
      params.cycle_id = selectedCycle;
    } else if (['company', 'department', 'kra'].includes(activeTab)) {
      if (!selectedCycle) {
        toast.error('Please select a cycle first');
        return;
      }
      params.cycle_id = selectedCycle;
    }

    toast.loading('Preparing download...', { id: 'download' });

    // ✅ Uses the axios-based performanceReportsApi.export()
    const { blob, filename } = await performanceReportsApi.export(params);

    // Trigger browser download
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);

    toast.success(`${format.toUpperCase()} downloaded`, { id: 'download' });
  } catch (err: any) {
    // Handle blob error response (backend returns JSON error even for blob requests)
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        toast.error(json.detail || 'Download failed', { id: 'download' });
      } catch {
        toast.error('Download failed', { id: 'download' });
      }
    } else {
      toast.error(
        err.response?.data?.detail || err.message || 'Download failed',
        { id: 'download' }
      );
    }
  }
};



  const fetchByTab = async () => {
    if (!selectedCycle) return;
    setLoading(true);
    try {
      let result;
      if (activeTab === 'company') result = await performanceReportsApi.company(selectedCycle);
      else if (activeTab === 'department') result = await performanceReportsApi.department(selectedCycle);
      else if (activeTab === 'kra') result = await performanceReportsApi.kra(selectedCycle);
      setData(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load report');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchIndividual = async () => {
    setLoading(true);
    try {
      const result = await performanceReportsApi.individual();
      setData(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const result = await performanceReportsApi.team(undefined, selectedCycle || undefined);
      setData(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load team report');
    } finally {
      setLoading(false);
    }
  };

  const fetchCycleComparison = async () => {
    if (selectedCycles.length === 0) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const result = await performanceReportsApi.cycleComparison(selectedCycles);
      setData(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
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
      <BarChart3 className="h-6 w-6 text-primary-600" />
      <h1 className="text-2xl font-bold text-gray-900">
        Performance Reports
      </h1>
    </div>
    <p className="mt-1 text-sm text-gray-500">
      Analytics and insights on KRAs, KPIs, and performance across cycles
    </p>
  </div>
  
  {/* Download buttons — hidden for cycle_comparison (no export) */}
  {activeTab !== 'cycle_comparison' && data && (
    <div className="flex gap-2">
      <button
        onClick={() => handleDownload('excel')}
        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        title="Download as Excel"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </button>
      <button
        onClick={() => handleDownload('pdf')}
        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        title="Download as PDF"
      >
        <FilePdf className="h-4 w-4" />
        PDF
      </button>
    </div>
  )}
</div>

          {/* Tabs */}
          <div className="mb-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="flex flex-wrap gap-1 border-b border-gray-100 p-2">
              {availableTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab === 'company' && <PieChart className="h-4 w-4" />}
                  {tab === 'department' && <Building2 className="h-4 w-4" />}
                  {tab === 'team' && <Users className="h-4 w-4" />}
                  {tab === 'individual' && <Target className="h-4 w-4" />}
                  {tab === 'kra' && <Award className="h-4 w-4" />}
                  {tab === 'cycle_comparison' && <Calendar className="h-4 w-4" />}
                  {tab === 'company' && 'Company'}
                  {tab === 'department' && 'By Department'}
                  {tab === 'team' && 'My Team'}
                  {tab === 'individual' && 'My History'}
                  {tab === 'kra' && 'KRA Achievement'}
                  {tab === 'cycle_comparison' && 'Cycle Comparison'}
                </button>
              ))}
            </div>

            {/* Cycle selector */}
            {activeTab !== 'individual' && activeTab !== 'cycle_comparison' && (
              <div className="border-b border-gray-100 p-4">
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Select Cycle
                </label>
                <select
                  value={selectedCycle}
                  onChange={(e) => setSelectedCycle(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Select cycle...</option>
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.cycle_type_display})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Multi-cycle selector for comparison */}
            {activeTab === 'cycle_comparison' && (
              <div className="border-b border-gray-100 p-4">
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Select Cycles to Compare (2 or more)
                </label>
                <div className="flex flex-wrap gap-2">
                  {cycles.map((c) => {
                    const isSelected = selectedCycles.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCycles((prev) =>
                            prev.includes(c.id)
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id]
                          );
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : !data ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Select filters to view report</p>
            </div>
          ) : (
            <>
              {activeTab === 'company' && <CompanyReport data={data} />}
              {activeTab === 'department' && <DepartmentReport data={data} />}
              {activeTab === 'team' && <TeamReport data={data} />}
              {activeTab === 'individual' && <IndividualReport data={data} />}
              {activeTab === 'kra' && <KRAReport data={data} />}
              {activeTab === 'cycle_comparison' && <CycleComparisonReport data={data} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// COMPANY REPORT
// ==============================================================================

function CompanyReport({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Scorecards" value={data.total_scorecards} color="bg-primary-50 text-primary-700" />
        <StatCard label="Completed" value={`${data.completed} (${data.completion_pct}%)`} color="bg-green-50 text-green-700" />
        <StatCard label="Avg Score" value={`${data.avg_score}%`} color="bg-blue-50 text-blue-700" />
        <StatCard label="Ratings Distribution" value={Object.keys(data.rating_distribution || {}).length} color="bg-purple-50 text-purple-700" />
      </div>

      {/* Bell curve */}
      {Object.keys(data.rating_distribution || {}).length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Rating Distribution</h3>
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((r) => {
              const count = data.rating_distribution[r] || 0;
              const total = Object.values(data.rating_distribution).reduce(
                (s: number, c: any) => s + c,
                0
              ) as number;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={r} className="flex flex-col items-center">
                  <div className="mb-2 h-24 w-full rounded-md bg-gray-100 relative overflow-hidden flex items-end">
                    <div
                      className="w-full transition-all"
                      style={{
                        height: `${Math.max(pct, 5)}%`,
                        backgroundColor: RATING_COLORS[r],
                      }}
                    />
                  </div>
                  <div className="text-xs font-bold text-gray-700">Rating {r}</div>
                  <div className="text-[10px] text-gray-500">{RATING_LABELS[r]}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{count}</div>
                  <div className="text-xs text-gray-500">({pct}%)</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top + Low performers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PerformersList
          title="🏆 Top Performers"
          performers={data.top_performers || []}
          bgColor="bg-green-50"
          borderColor="ring-green-200"
        />
        <PerformersList
          title="⚠️ Needs Improvement (PIP Candidates)"
          performers={data.low_performers || []}
          bgColor="bg-red-50"
          borderColor="ring-red-200"
        />
      </div>
    </div>
  );
}

// ==============================================================================
// DEPARTMENT REPORT
// ==============================================================================

function DepartmentReport({ data }: { data: any[] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">No department data available.</div>;
  }

  const maxScore = Math.max(...data.map((d) => d.avg_score));

  return (
    <div className="space-y-3">
      {data.map((dept) => (
        <div key={dept.department_id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{dept.department_name}</h3>
              <p className="text-xs text-gray-500">{dept.employee_count} employees</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-700">{dept.avg_score}%</div>
              <div className="text-xs text-gray-500">Average</div>
            </div>
          </div>

          {/* Score bar */}
          <div className="mt-3">
            <div className="h-3 rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-primary-600"
                style={{ width: `${(dept.avg_score / (maxScore || 1)) * 100}%` }}
              />
            </div>
          </div>

          {/* Meta */}
          <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
            <div>
              <div className="text-gray-500">Min</div>
              <div className="font-semibold text-gray-900">{dept.min_score}%</div>
            </div>
            <div>
              <div className="text-gray-500">Max</div>
              <div className="font-semibold text-gray-900">{dept.max_score}%</div>
            </div>
            <div>
              <div className="text-gray-500">Top Perf.</div>
              <div className="font-semibold text-green-700">{dept.top_performer_count}</div>
            </div>
            <div>
              <div className="text-gray-500">Needs Improve</div>
              <div className="font-semibold text-red-700">{dept.poor_performer_count}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==============================================================================
// TEAM REPORT
// ==============================================================================

function TeamReport({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Team Size" value={data.team_size} color="bg-primary-50 text-primary-700" />
        <StatCard label="Reviewed" value={data.reviewed_count} color="bg-green-50 text-green-700" />
        <StatCard label="Team Avg" value={`${data.team_avg_score}%`} color="bg-blue-50 text-blue-700" />
        <StatCard label="Ratings" value={Object.keys(data.rating_distribution || {}).length} color="bg-purple-50 text-purple-700" />
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Position</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Cycle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Score</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Rating</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">KRAs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data.members || []).map((m: any) => (
              <tr key={m.employee_id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                      {m.employee_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{m.employee_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{m.position}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{m.cycle_name}</td>
                <td className="px-4 py-3">
                  {m.final_score !== null ? (
                    <span className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
                      {m.final_score}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {m.final_rating ? (
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: RATING_COLORS[m.final_rating] }}
                    >
                      {m.final_rating}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{m.kra_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==============================================================================
// INDIVIDUAL REPORT
// ==============================================================================

function IndividualReport({ data }: { data: any }) {
  const trendIcon = () => {
    if (data.trend === 'IMPROVING') return <TrendingUp className="h-6 w-6 text-green-600" />;
    if (data.trend === 'DECLINING') return <TrendingDown className="h-6 w-6 text-red-600" />;
    return <Minus className="h-6 w-6 text-gray-500" />;
  };

  const trendColor = () => {
    if (data.trend === 'IMPROVING') return 'bg-green-50 text-green-700';
    if (data.trend === 'DECLINING') return 'bg-red-50 text-red-700';
    return 'bg-gray-50 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Total Cycles" value={data.total_cycles} color="bg-primary-50 text-primary-700" />
        <StatCard label="Average Score" value={`${data.avg_score}%`} color="bg-blue-50 text-blue-700" />
        <div className={`flex items-center gap-3 rounded-xl p-4 ${trendColor()}`}>
          {trendIcon()}
          <div>
            <div className="text-lg font-bold">{data.trend}</div>
            <div className="text-xs opacity-80">Trend</div>
          </div>
        </div>
      </div>

      {/* Line chart (simple bars) */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Score History</h3>
        {data.history?.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">No historical data yet</p>
        ) : (
          <div className="space-y-3">
            {data.history?.map((h: any) => (
              <div key={h.cycle_id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-gray-900">{h.cycle_name}</span>
                    <span className="ml-2 text-gray-500">({h.cycle_type})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary-50 px-2 py-0.5 font-bold text-primary-700">
                      {h.final_score}%
                    </span>
                    {h.final_rating && (
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: RATING_COLORS[h.final_rating] }}
                      >
                        {h.final_rating}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-3 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(h.final_score, 100)}%`,
                      backgroundColor: RATING_COLORS[h.final_rating] || '#3B82F6',
                    }}
                  />
                </div>
                {(h.self_score || h.peer_score || h.manager_score) && (
                  <div className="mt-1 flex gap-3 text-xs text-gray-500">
                    {h.self_score && <span>Self: {h.self_score}%</span>}
                    {h.peer_score && <span>Peer: {h.peer_score}%</span>}
                    {h.manager_score && <span>Manager: {h.manager_score}%</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==============================================================================
// KRA REPORT
// ==============================================================================

function KRAReport({ data }: { data: any[] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">No KRA data.</div>;
  }

  return (
    <div className="space-y-3">
      {data.map((kra) => (
        <div key={kra.kra_id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">{kra.kra_name}</h3>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {kra.kra_source}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {kra.employee_count} employees • {kra.achievement_pct}% achieving ≥90%
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-primary-700">{kra.avg_score}%</div>
              <div className="text-xs text-gray-500">Avg Score</div>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-3 rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-primary-600"
                style={{ width: `${Math.min(kra.avg_score, 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-gray-500">Min Score</div>
              <div className="font-semibold text-gray-900">{kra.min_score}%</div>
            </div>
            <div>
              <div className="text-gray-500">Max Score</div>
              <div className="font-semibold text-gray-900">{kra.max_score}%</div>
            </div>
            <div>
              <div className="text-gray-500">Achievement</div>
              <div className={`font-semibold ${kra.achievement_pct >= 70 ? 'text-green-700' : 'text-amber-700'}`}>
                {kra.achievement_pct}%
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==============================================================================
// CYCLE COMPARISON REPORT
// ==============================================================================

function CycleComparisonReport({ data }: { data: any[] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">Select 2 or more cycles to compare.</div>;
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">Cycle Comparison</h3>
      <div className="space-y-4">
        {data.map((c, idx) => {
          const prev = idx > 0 ? data[idx - 1] : null;
          const trend = prev ? c.avg_score - prev.avg_score : 0;
          return (
            <div key={c.cycle_id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{c.cycle_name}</h4>
                  <p className="text-xs text-gray-500">
                    {c.total_scored} scored • Avg: {c.avg_score}%
                  </p>
                </div>
                {trend !== 0 && (
                  <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                    trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {trend > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(trend).toFixed(2)}%
                  </div>
                )}
              </div>
              {/* Rating distribution bar */}
              <div className="mt-3 flex gap-1 overflow-hidden rounded-full h-3">
                {[1, 2, 3, 4, 5].map((r) => {
                  const count = c.rating_distribution?.[r] || 0;
                  const pct = c.total_scored > 0 ? (count / c.total_scored) * 100 : 0;
                  return pct > 0 ? (
                    <div
                      key={r}
                      style={{ width: `${pct}%`, backgroundColor: RATING_COLORS[r] }}
                      title={`Rating ${r}: ${count} (${pct.toFixed(1)}%)`}
                    />
                  ) : null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==============================================================================
// HELPERS
// ==============================================================================

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function PerformersList({
  title,
  performers,
  bgColor,
  borderColor,
}: {
  title: string;
  performers: any[];
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div className={`rounded-2xl ${bgColor} p-5 ring-1 ${borderColor}`}>
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
      {performers.length === 0 ? (
        <p className="text-xs text-gray-500">No data</p>
      ) : (
        <div className="space-y-2">
          {performers.map((p) => (
            <div key={p.employee_id} className="flex items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-gray-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">{p.emp_code}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-primary-700">{p.score}%</div>
                <div className="text-xs text-gray-500">Rating {p.rating}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}