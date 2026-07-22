import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Loader2, Receipt, DollarSign, Users,
  CheckCircle2, XCircle, Clock, AlertCircle, TrendingUp,
  FileText, Eye,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { reimbursementDashboardApi } from '../../api/reimbursement';
import type { ReimbursementDashboardSummary } from '../../types/reimbursement';
import toast from 'react-hot-toast';

export default function ReimbursementDashboardPage() {
  const [summary, setSummary] = useState<ReimbursementDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reimbursementDashboardApi
      .summary()
      .then(setSummary)
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const formatMoney = (val: number) =>
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  if (loading) {
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

  if (!summary) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6">
            <p className="text-gray-500">No data available</p>
          </main>
        </div>
      </div>
    );
  }

  const approvalRate = summary.total_claimed_amount > 0
    ? Math.round((summary.total_approved_amount / summary.total_claimed_amount) * 100)
    : 0;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                Reimbursement Dashboard
              </h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Overview of all reimbursement activity
            </p>
          </div>

          {/* Top Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Total Claims"
              value={summary.total_claims}
              icon={Receipt}
              color="bg-primary-50 text-primary-700"
            />
            <StatCard
              label="Total Employees"
              value={summary.total_employees}
              icon={Users}
              color="bg-blue-50 text-blue-700"
            />
            <StatCard
              label="Total Claimed"
              value={formatMoney(summary.total_claimed_amount)}
              icon={DollarSign}
              color="bg-indigo-50 text-indigo-700"
            />
            <StatCard
              label="Total Approved"
              value={formatMoney(summary.total_approved_amount)}
              icon={CheckCircle2}
              color="bg-green-50 text-green-700"
            />
          </div>

          {/* Approval Rate */}
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <TrendingUp className="h-4 w-4 text-primary-600" />
                Approval Rate
              </h3>
              <span className="text-2xl font-bold text-primary-700">{approvalRate}%</span>
            </div>
            <div className="h-4 rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all ${
                  approvalRate >= 80 ? 'bg-green-500' :
                  approvalRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${approvalRate}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>Claimed: {formatMoney(summary.total_claimed_amount)}</span>
              <span>Approved: {formatMoney(summary.total_approved_amount)}</span>
            </div>
          </div>

          {/* Review Status Cards */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Expense Item Status
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatusCard
                label="Pending Review"
                value={summary.pending_review_count}
                icon={Clock}
                color="bg-amber-50 text-amber-700"
                highlight={summary.pending_review_count > 0}
              />
              <StatusCard
                label="Approved"
                value={summary.approved_count}
                icon={CheckCircle2}
                color="bg-green-50 text-green-700"
              />
              <StatusCard
                label="Rejected"
                value={summary.rejected_count}
                icon={XCircle}
                color="bg-red-50 text-red-700"
              />
              <StatusCard
                label="Mismatch"
                value={summary.mismatch_count}
                icon={AlertCircle}
                color="bg-orange-50 text-orange-700"
              />
            </div>
          </div>

          {/* Summary Table */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Quick Summary
            </h3>
            <div className="space-y-3">
              <SummaryRow
                label="Total Batches"
                value={summary.total_batches}
                icon={FileText}
              />
              <SummaryRow
                label="Total Claims"
                value={summary.total_claims}
                icon={Receipt}
              />
              <SummaryRow
                label="Total Expense Items"
                value={summary.total_expense_items}
                icon={Eye}
              />
              <SummaryRow
                label="Total Employees"
                value={summary.total_employees}
                icon={Users}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// COMPONENTS
// ==============================================================================

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className={`flex items-center gap-3 rounded-xl p-4 ${color}`}>
      <Icon className="h-8 w-8 opacity-80" />
      <div>
        <div className="text-xs font-medium opacity-80">{label}</div>
        <div className="mt-0.5 text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function StatusCard({ label, value, icon: Icon, color, highlight }: any) {
  return (
    <div className={`rounded-xl p-4 ${color} ${highlight ? 'ring-2 ring-amber-400' : ''}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 opacity-80" />
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value, icon: Icon }: any) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  );
}