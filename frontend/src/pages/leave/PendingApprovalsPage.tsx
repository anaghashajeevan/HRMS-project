import { useEffect, useState } from 'react';
import {
  Loader2, CheckCircle2, XCircle, User, Calendar, MessageSquare, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { leaveApplicationsApi } from '../../api/leave';
import type { LeaveApplicationListItem } from '../../types/leave';

export default function PendingApprovalsPage() {
  const [applications, setApplications] = useState<LeaveApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const data = await leaveApplicationsApi.pendingApprovals();
      setApplications(data);
    } catch (error) {
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (app: LeaveApplicationListItem) => {
  const comments = window.prompt(
    `Approve leave for ${app.employee_name}?\nOptional comments:`
  );
  if (comments === null) return;   // User cancelled

  setActioningId(app.id);
  try {
    // First attempt — normal approval
    await leaveApplicationsApi.approve(app.id, comments);
    toast.success(`Approved leave for ${app.employee_name}`);
    loadPending();
  } catch (error: any) {
    const errMsg = error?.response?.data?.detail || 'Failed to approve';
    console.log('Approval error:', errMsg);  // 🔍 Debug log
    
    // 🆕 Check if it's a critical clash error
    if (errMsg.includes('CRITICAL CLASH')) {
      const proceed = window.confirm(
        `⚠️ CRITICAL TEAM CLASH DETECTED\n\n` +
        `${errMsg}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Do you want to APPROVE ANYWAY?\n\n` +
        `You should only do this if you have:\n` +
        `• Arranged coverage from another team\n` +
        `• Confirmed critical work is handled\n` +
        `• Approval from higher management\n\n` +
        `Click OK to override and approve, or Cancel to reject/reschedule.`
      );
      
      if (proceed) {
        try {
          // Second attempt with override flag
          await leaveApplicationsApi.approve(app.id, comments, true);
          toast.success(`✅ Approved with override for ${app.employee_name}`);
          loadPending();
        } catch (err: any) {
          const overrideErr = err?.response?.data?.detail || 'Failed to approve';
          toast.error(overrideErr);
        }
      } else {
        toast('Approval cancelled — consider rejecting or asking employee to reschedule', {
          icon: 'ℹ️',
        });
      }
    } else {
      // Not a clash error — show as regular error
      toast.error(errMsg);
    }
  } finally {
    setActioningId(null);
  }
};

  const handleReject = async (app: LeaveApplicationListItem) => {
    const reason = window.prompt(`Reject leave for ${app.employee_name}?\nReason (required):`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) toast.error('Rejection reason is required');
      return;
    }

    setActioningId(app.id);
    try {
      await leaveApplicationsApi.reject(app.id, reason);
      toast.success(`Rejected leave for ${app.employee_name}`);
      loadPending();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to reject');
    } finally {
      setActioningId(null);
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
            <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
            <p className="mt-1 text-sm text-gray-600">
              {applications.length} leave request{applications.length !== 1 ? 's' : ''} awaiting your action
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : applications.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">All Caught Up! 🎉</h3>
              <p className="mt-2 text-sm text-gray-600">No pending leave approvals right now.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100"
                >
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                          {app.employee_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{app.employee_name}</h3>
                          <p className="text-sm text-gray-500">
                            {app.employee_code} • {app.application_number}
                          </p>
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white"
                        style={{ backgroundColor: app.leave_type_color }}
                      >
                        {app.leave_type_code}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4 mb-4 md:grid-cols-4">
                      <InfoItem icon={Calendar} label="Start Date" value={formatDate(app.start_date)} />
                      <InfoItem icon={Calendar} label="End Date" value={formatDate(app.end_date)} />
                      <InfoItem icon={User} label="Days" value={`${app.total_days} ${app.is_half_day ? 'half day' : 'days'}`} />
                      <InfoItem
                        icon={MessageSquare}
                        label="Applied"
                        value={formatDate(app.applied_at)}
                      />
                    </div>

                    {/* Reason */}
                    <div className="mb-4 rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Reason</p>
                      <p className="text-sm text-gray-800">{app.reason}</p>
                    </div>

                    {/* LOP Warning */}
                    {app.is_lop && parseFloat(app.lop_days) > 0 && (
                      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <p className="text-xs font-semibold text-amber-900">
                          ⚠️ {app.lop_days} days will be Loss of Pay (insufficient balance)
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleApprove(app)}
                        disabled={actioningId === app.id}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {actioningId === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(app)}
                        disabled={actioningId === app.id}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: any) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-gray-500 uppercase mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}