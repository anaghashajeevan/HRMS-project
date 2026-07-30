import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Filter, Loader2, FileText, Eye, Edit2,
  Send, CheckCircle2, Clock, Archive, AlertCircle,
  Sparkles, BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { policiesApi, policyCategoriesApi } from '../../api/policy';
import { useAuth } from '../../context/AuthContext';
import type { PolicyListItem, PolicyCategory } from '../../types/policy';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  IN_REVIEW: { label: 'In Review', color: 'bg-blue-100 text-blue-700', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  PUBLISHED: { label: 'Published', color: 'bg-emerald-100 text-emerald-700', icon: Send },
  ARCHIVED: { label: 'Archived', color: 'bg-amber-100 text-amber-700', icon: Archive },
  EXPIRED: { label: 'Expired', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default function PolicyListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isHR = user?.role_codes?.includes('HR_ADMIN') || user?.role_codes?.includes('SYSTEM_ADMIN');

  const [policies, setPolicies] = useState<PolicyListItem[]>([]);
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [policiesData, catsData] = await Promise.all([
        policiesApi.list(),
        policyCategoriesApi.list(),
      ]);
      setPolicies(policiesData);
      setCategories(catsData);
    } catch (error) {
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedCategories = async () => {
    try {
      await policyCategoriesApi.seedDefaults();
      toast.success('Default categories created');
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to seed');
    }
  };

  const filtered = policies.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      if (!p.title.toLowerCase().includes(s) &&
          !p.policy_number.toLowerCase().includes(s) &&
          !(p.tags || '').toLowerCase().includes(s)) return false;
    }
    if (statusFilter && p.status !== statusFilter) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Policy Management</h1>
              <p className="mt-1 text-sm text-gray-600">
                {policies.length} polic{policies.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
            <div className="flex gap-3">
              {categories.length === 0 && (
                <button
                  onClick={handleSeedCategories}
                  className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100"
                >
                  <Sparkles className="h-4 w-4" />
                  Load Categories
                </button>
              )}
              {isHR && (
                <>
                  <button
                    onClick={() => navigate('/policies/compliance')}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Compliance
                  </button>
                  <button
                    onClick={() => navigate('/policies/create')}
                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create Policy
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, number, or tags..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 py-2 px-3 text-sm"
            >
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-300 py-2 px-3 text-sm"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Policy Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-3 text-lg font-semibold text-gray-900">No policies found</h3>
              <p className="mt-1 text-sm text-gray-600">
                {policies.length === 0 ? 'Create your first policy to get started.' : 'Try different filters.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((policy) => {
                const sc = statusConfig[policy.status] || statusConfig.DRAFT;
                const StatusIcon = sc.icon;
                return (
                  <div
                    key={policy.id}
                    onClick={() => navigate(`/policies/${policy.id}`)}
                    className="cursor-pointer rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:ring-primary-200"
                  >
                    {/* Header */}
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold"
                          style={{ backgroundColor: policy.category_color }}
                        >
                          {policy.category_code?.slice(0, 2)}
                        </div>
                        <span className="text-xs text-gray-500 font-mono">{policy.policy_number}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${sc.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {sc.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-gray-900 mb-1">{policy.title}</h3>
                    {policy.summary && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{policy.summary}</p>
                    )}

                    {/* Meta */}
                    {/* Meta */}
<div className="flex flex-wrap gap-1.5 mb-3">
  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
    {policy.category_name}
  </span>
  {policy.is_mandatory && (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 font-semibold">
      Mandatory
    </span>
  )}
  {policy.current_version_number && (
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
      v{policy.current_version_number}
    </span>
  )}

  {/* NEW: Changes Requested badge */}
  {policy.return_count && policy.return_count > 0 && policy.status === 'DRAFT' && (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs
                     text-amber-700 font-semibold">
      🔄 Changes Requested
    </span>
  )}
</div>

                    {/* Ack Stats */}
                    {policy.ack_stats && policy.status === 'PUBLISHED' && (
                      <div className="border-t border-gray-100 pt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">Acknowledged</span>
                          <span className="font-bold text-gray-900">{policy.ack_stats.percentage}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              policy.ack_stats.percentage >= 90 ? 'bg-green-500' :
                              policy.ack_stats.percentage >= 50 ? 'bg-blue-500' :
                              'bg-amber-500'
                            }`}
                            style={{ width: `${policy.ack_stats.percentage}%` }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between text-xs text-gray-500">
                          <span>{policy.ack_stats.acknowledged}/{policy.ack_stats.total}</span>
                          {policy.ack_stats.overdue > 0 && (
                            <span className="text-red-600 font-semibold">
                              {policy.ack_stats.overdue} overdue
                            </span>
                          )}
                        </div>
                      </div>
                    )}
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