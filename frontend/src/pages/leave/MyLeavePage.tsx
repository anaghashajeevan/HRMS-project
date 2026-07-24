import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Calendar, TrendingUp, AlertCircle, Loader2,
  CheckCircle2, XCircle, Clock, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { leaveBalancesApi, leaveApplicationsApi } from '../../api/leave';
import type { LeaveBalance, LeaveApplicationListItem } from '../../types/leave';

export default function MyLeavePage() {
  const navigate = useNavigate();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [applications, setApplications] = useState<LeaveApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [balanceData, appData] = await Promise.all([
        leaveBalancesApi.myBalance(),
        leaveApplicationsApi.myApplications(),
      ]);
      setBalances(balanceData);
      setApplications(appData.slice(0, 5)); // Recent 5
    } catch (error) {
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (app: LeaveApplicationListItem) => {
    const reason = window.prompt(`Cancel "${app.application_number}"?\nOptional reason:`);
    if (reason === null) return;

    try {
      await leaveApplicationsApi.cancel(app.id, reason);
      toast.success('Leave cancelled');
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to cancel');
    }
  };

  const totalAvailable = balances.reduce((sum, b) => sum + parseFloat(b.available || '0'), 0);
  const totalUsed = balances.reduce((sum, b) => sum + parseFloat(b.used || '0'), 0);
  const pendingCount = applications.filter(a => a.status === 'PENDING').length;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Leave</h1>
              <p className="mt-1 text-sm text-gray-600">
                View your leave balance and history
              </p>
            </div>
            <button
              onClick={() => navigate('/leave/apply')}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Apply Leave
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                  label="Total Available"
                  value={totalAvailable.toFixed(1)}
                  suffix="days"
                  icon={Calendar}
                  color="green"
                />
                <StatCard
                  label="Total Used This Year"
                  value={totalUsed.toFixed(1)}
                  suffix="days"
                  icon={TrendingUp}
                  color="blue"
                />
                <StatCard
                  label="Pending Approval"
                  value={pendingCount.toString()}
                  suffix={pendingCount === 1 ? "application" : "applications"}
                  icon={Clock}
                  color={pendingCount > 0 ? "amber" : "gray"}
                />
              </div>

              {/* Balance Cards */}
              <section className="mb-6">
                <h2 className="mb-3 text-lg font-semibold text-gray-900">Leave Balance</h2>
                {balances.length === 0 ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
                    <AlertCircle className="mx-auto h-10 w-10 text-blue-500" />
                    <p className="mt-3 text-blue-900 font-semibold">No balance allocated yet</p>
                    <p className="mt-1 text-sm text-blue-700">
                      Contact HR to set up your leave balances for {new Date().getFullYear()}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {balances.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: b.leave_type.color_code }}
                          >
                            {b.leave_type.code}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 truncate">{b.leave_type.name}</p>
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-gray-900">
                          {parseFloat(b.available).toFixed(1)}
                          <span className="text-sm text-gray-500 ml-1">days</span>
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-gray-500">
                          <span>Used: {b.used}</span>
                          <span>Total: {b.accrued_till_date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Recent Applications */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
                  <button
                    onClick={() => navigate('/leave/my-applications')}
                    className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                  >
                    View All →
                  </button>
                </div>
                {applications.length === 0 ? (
                  <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
                    <Calendar className="mx-auto h-10 w-10 text-gray-300" />
                    <p className="mt-3 text-gray-500">No leave applications yet</p>
                    <button
                      onClick={() => navigate('/leave/apply')}
                      className="mt-3 text-sm font-semibold text-primary-600 hover:text-primary-700"
                    >
                      Apply for leave →
                    </button>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Application</th>
                          <th className="px-4 py-3">Leave Type</th>
                          <th className="px-4 py-3">Dates</th>
                          <th className="px-4 py-3 text-center">Days</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {applications.map((app) => (
                          <tr key={app.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-gray-600">
                              {app.application_number}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                                style={{ backgroundColor: app.leave_type_color }}
                              >
                                {app.leave_type_code}
                              </span>
                              <span className="ml-2 text-gray-700">{app.leave_type_name}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {formatDate(app.start_date)}
                              {app.start_date !== app.end_date && ` → ${formatDate(app.end_date)}`}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold">
                              {app.total_days}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={app.status} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {app.status === 'PENDING' && (
                                <button
                                  onClick={() => handleCancel(app)}
                                  className="text-xs font-semibold text-red-600 hover:text-red-800"
                                >
                                  Cancel
                                </button>
                              )}
                              {app.status === 'APPROVED'
                                && new Date(app.start_date) > new Date() && (
                                <button
                                  onClick={() => handleCancel(app)}
                                  className="text-xs font-semibold text-amber-600 hover:text-amber-800"
                                >
                                  Withdraw
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix, icon: Icon, color }: any) {
  const colorMap: any = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    gray: 'bg-gray-100 text-gray-700',
  };
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {value} <span className="text-sm text-gray-500 font-normal">{suffix}</span>
          </p>
        </div>
        <div className={`rounded-lg p-3 ${colorMap[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: any = {
    PENDING: { label: 'Pending', class: 'bg-amber-100 text-amber-700', icon: Clock },
    APPROVED: { label: 'Approved', class: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    REJECTED: { label: 'Rejected', class: 'bg-red-100 text-red-700', icon: XCircle },
    CANCELLED: { label: 'Cancelled', class: 'bg-gray-100 text-gray-700', icon: X },
    WITHDRAWN: { label: 'Withdrawn', class: 'bg-gray-100 text-gray-700', icon: X },
  };
  const c = config[status] || config.PENDING;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.class}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}