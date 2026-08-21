import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, CheckCircle2, AlertTriangle, XCircle,
  TrendingUp, DollarSign, ShieldAlert, Loader2,
  ArrowRight, Laptop, Monitor, Smartphone, IdCard, Key,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { assetsApi } from '../../api/assets';
import type { AssetStats } from '../../types/asset';
import toast from 'react-hot-toast';

const iconMap: Record<string, any> = {
  laptop: Laptop,
  monitor: Monitor,
  phone: Smartphone,
  smartphone: Smartphone,
  'id-card': IdCard,
  key: Key,
  package: Package,
};

function getCategoryIcon(iconName: string) {
  return iconMap[iconName?.toLowerCase()] || Package;
}

export default function AssetDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await assetsApi.getStats();
      setStats(data);
    } catch {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Asset Dashboard</h1>
              <p className="text-sm text-gray-500">
                Overview of company-wide asset inventory
              </p>
            </div>
            <button
              onClick={() => navigate('/assets')}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              View All Assets <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
            </div>
          ) : stats ? (
            <>
              {/* Summary Stats */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Assets"
                  value={stats.summary.total}
                  icon={Package}
                  color="blue"
                />
                <StatCard
                  label="Allocated"
                  value={stats.summary.allocated}
                  subtext={`${stats.summary.utilization_rate}% utilization`}
                  icon={CheckCircle2}
                  color="green"
                />
                <StatCard
                  label="Available"
                  value={stats.summary.available}
                  subtext="Ready to allocate"
                  icon={TrendingUp}
                  color="indigo"
                />
                <StatCard
                  label="Under Maintenance"
                  value={stats.summary.maintenance}
                  subtext={`${stats.summary.disposed} disposed`}
                  icon={AlertTriangle}
                  color="amber"
                />
              </div>

              {/* Financial Overview */}
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm ring-1 ring-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-2.5 text-white">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Asset Value</p>
                      <p className="text-lg font-bold text-gray-900">
                        ₹{stats.financial.total_asset_value.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm ring-1 ring-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 text-white">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Allocated Value</p>
                      <p className="text-lg font-bold text-gray-900">
                        ₹{stats.financial.allocated_asset_value.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm ring-1 ring-amber-100">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-2.5 text-white">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Warranty Expiring</p>
                      <p className="text-lg font-bold text-gray-900">
                        {stats.financial.warranty_expiring_soon} <span className="text-xs font-normal">in 90 days</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Breakdown + Recent Activity */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Category Breakdown */}
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Package className="h-4 w-4 text-indigo-500" />
                    By Category
                  </h3>
                  {stats.by_category.length === 0 ? (
                    <p className="text-sm text-gray-500">No categories yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.by_category.map((cat) => {
                        const Icon = getCategoryIcon(cat.icon);
                        const util = cat.total > 0 ? (cat.allocated / cat.total) * 100 : 0;
                        return (
                          <div key={cat.id}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2 font-medium text-gray-700">
                                <Icon className="h-4 w-4 text-indigo-500" />
                                {cat.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {cat.allocated}/{cat.total} allocated
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                                style={{ width: `${util}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Recent Activity
                  </h3>
                  {stats.recent_activity.length === 0 ? (
                    <p className="text-sm text-gray-500">No recent activity.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.recent_activity.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50"
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${
                              activity.status === 'ALLOCATED'
                                ? 'bg-green-500'
                                : activity.status === 'RETURNED'
                                ? 'bg-blue-500'
                                : activity.status === 'DAMAGED'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          >
                            {activity.status === 'ALLOCATED' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : activity.status === 'RETURNED' ? (
                              <ArrowRight className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {activity.asset_name}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {activity.status === 'ALLOCATED' ? 'Allocated to' : 'Returned from'}{' '}
                              <span className="font-medium">{activity.employee_name}</span>
                            </p>
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(activity.allocated_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, icon: Icon, color }: any) {
  const colorMap: any = {
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-emerald-500 to-teal-500',
    indigo: 'from-indigo-500 to-purple-500',
    amber: 'from-amber-500 to-orange-500',
  };
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
        </div>
        <div className={`rounded-xl bg-gradient-to-br p-2.5 text-white shadow-md ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}