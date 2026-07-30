import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, CheckCircle2, Clock, AlertCircle, FileText, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { policiesApi } from '../../api/policy';
import type { PolicyDistribution } from '../../types/policy';

export default function MyAcknowledgmentsPage() {
  const navigate = useNavigate();
  const [distributions, setDistributions] = useState<PolicyDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await policiesApi.myAcknowledgments();
      setDistributions(data);
    } catch (error) {
      toast.error('Failed to load acknowledgments');
    } finally {
      setLoading(false);
    }
  };

  const pending = distributions.filter(d => !d.acknowledged);
  const completed = distributions.filter(d => d.acknowledged);
  const overdue = pending.filter(d => d.is_overdue);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Policy Acknowledgments</h1>
            <p className="mt-1 text-sm text-gray-600">
              {pending.length} pending • {completed.length} completed
              {overdue.length > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {overdue.length} overdue!
                </span>
              )}
            </p>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold text-amber-900">{pending.length}</p>
                  <p className="text-sm text-amber-700">Pending</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-900">{overdue.length}</p>
                  <p className="text-sm text-red-700">Overdue</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-green-50 border border-green-200 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-900">{completed.length}</p>
                  <p className="text-sm text-green-700">Completed</p>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              {/* Pending Section */}
              {pending.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    ⏳ Pending Acknowledgment ({pending.length})
                  </h2>
                  <div className="space-y-3">
                    {pending.map((dist) => (
                      <div
                        key={dist.id}
                        onClick={() => navigate(`/policies/${dist.policy}`)}
                        className={`cursor-pointer rounded-xl bg-white p-5 shadow-sm ring-1 transition hover:shadow-md ${
                          dist.is_overdue ? 'ring-red-300 bg-red-50' : 'ring-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className={`h-8 w-8 ${dist.is_overdue ? 'text-red-500' : 'text-amber-500'}`} />
                            <div>
                              <h3 className="font-semibold text-gray-900">{dist.policy_title}</h3>
                              <p className="text-sm text-gray-500">
                                {dist.policy_number} • v{dist.version_number}
                              </p>
                              <p className={`text-xs mt-1 ${dist.is_overdue ? 'text-red-700 font-bold' : 'text-amber-700'}`}>
                                {dist.is_overdue
                                  ? `⛔ OVERDUE — Deadline was ${new Date(dist.deadline).toLocaleDateString('en-IN')}`
                                  : `Deadline: ${new Date(dist.deadline).toLocaleDateString('en-IN')}`
                                }
                              </p>
                            </div>
                          </div>
                          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                            <Shield className="h-4 w-4" />
                            Read & Acknowledge
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Completed Section */}
              {completed.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    ✅ Completed ({completed.length})
                  </h2>
                  <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Policy</th>
                          <th className="px-4 py-3">Version</th>
                          <th className="px-4 py-3">Acknowledged On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {completed.map((dist) => (
                          <tr
                            key={dist.id}
                            onClick={() => navigate(`/policies/${dist.policy}`)}
                            className="cursor-pointer hover:bg-gray-50"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{dist.policy_title}</div>
                              <div className="text-xs text-gray-500">{dist.policy_number}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">v{dist.version_number}</td>
                            <td className="px-4 py-3 text-gray-600">
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                {dist.acknowledged_at
                                  ? new Date(dist.acknowledged_at).toLocaleDateString('en-IN', {
                                      day: '2-digit', month: 'short', year: 'numeric'
                                    })
                                  : '—'
                                }
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {distributions.length === 0 && (
                <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                  <h3 className="mt-3 text-lg font-semibold text-gray-900">All Caught Up!</h3>
                  <p className="mt-1 text-sm text-gray-600">No policies assigned to you right now.</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}