import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, FileText, CheckCircle2, Clock, AlertCircle, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { policiesApi } from '../../api/policy';
import type { PolicyListItem } from '../../types/policy';

export default function PolicyLibraryPage() {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<PolicyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'acknowledged'>('all');

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const data = await policiesApi.library();
      setPolicies(data);
    } catch (error) {
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const filtered = policies.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      if (!p.title.toLowerCase().includes(s) && !p.policy_number.toLowerCase().includes(s)) return false;
    }
    if (filter === 'pending' && p.my_status?.acknowledged) return false;
    if (filter === 'acknowledged' && !p.my_status?.acknowledged) return false;
    return true;
  });

  const pendingCount = policies.filter(p => p.my_status?.distributed && !p.my_status?.acknowledged).length;
  const overdueCount = policies.filter(p => p.my_status?.is_overdue).length;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Policy Library</h1>
            <p className="mt-1 text-sm text-gray-600">
              {policies.length} published policies
              {pendingCount > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {pendingCount} pending acknowledgment
                </span>
              )}
              {overdueCount > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {overdueCount} overdue!
                </span>
              )}
            </p>
          </div>

          {/* Overdue Banner */}
          {overdueCount > 0 && (
            <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                <div>
                  <h3 className="font-bold text-red-900">⛔ {overdueCount} Overdue Policy Acknowledgment{overdueCount > 1 ? 's' : ''}</h3>
                  <p className="mt-1 text-sm text-red-800">Please read and acknowledge overdue policies immediately.</p>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search policies..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="flex gap-2 rounded-lg border border-gray-300 bg-white p-1">
              {[
                { value: 'all', label: 'All' },
                { value: 'pending', label: `Pending (${pendingCount})` },
                { value: 'acknowledged', label: 'Acknowledged' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value as any)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    filter === f.value ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Policies */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((policy) => (
                <div
                  key={policy.id}
                  onClick={() => navigate(`/policies/${policy.id}`)}
                  className={`cursor-pointer rounded-xl bg-white p-5 shadow-sm ring-1 transition hover:shadow-md ${
                    policy.my_status?.is_overdue ? 'ring-red-300 bg-red-50' :
                    !policy.my_status?.acknowledged && policy.my_status?.distributed ? 'ring-amber-200' :
                    'ring-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold"
                        style={{ backgroundColor: policy.category_color }}
                      >
                        {policy.category_code?.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{policy.title}</h3>
                        <p className="text-sm text-gray-500">
                          {policy.policy_number} • {policy.category_name}
                          {policy.current_version_number && ` • v${policy.current_version_number}`}
                        </p>
                        {policy.summary && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-1">{policy.summary}</p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="ml-4">
                      {policy.my_status?.acknowledged ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Acknowledged
                        </span>
                      ) : policy.my_status?.is_overdue ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                          ⛔ Overdue
                        </span>
                      ) : policy.my_status?.distributed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                          <FileText className="h-3 w-3" />
                          Read
                        </span>
                      )}
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