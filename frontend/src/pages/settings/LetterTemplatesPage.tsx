import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, FileText, Sparkles, Edit, Trash2, Loader2,
  Search, CheckCircle2, XCircle, Star,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { letterTemplatesApi } from '../../api/workflow';
import type { LetterTemplate, LetterTemplateType } from '../../types/workflow';
import toast from 'react-hot-toast';

const templateTypeColors: Record<LetterTemplateType, string> = {
  PROMOTION: 'bg-green-100 text-green-700',
  TRANSFER: 'bg-blue-100 text-blue-700',
  REDESIGNATION: 'bg-purple-100 text-purple-700',
  CONFIRMATION: 'bg-amber-100 text-amber-700',
  MANAGER_CHANGE: 'bg-indigo-100 text-indigo-700',
  PERFORMANCE_RATING: 'bg-primary-100 text-primary-700',
  APPRAISAL_LETTER: 'bg-teal-100 text-teal-700',
  PIP_LETTER: 'bg-red-100 text-red-700',
};

const templateTypeLabels: Record<LetterTemplateType, string> = {
  PROMOTION: 'Promotion',
  TRANSFER: 'Transfer',
  REDESIGNATION: 'Re-designation',
  CONFIRMATION: 'Confirmation',
  MANAGER_CHANGE: 'Manager Change',
  PERFORMANCE_RATING: 'Performance Rating',
  APPRAISAL_LETTER: 'Appraisal',
  PIP_LETTER: 'PIP',
};

export default function LetterTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await letterTemplatesApi.list(
        filterType ? { template_type: filterType } : {}
      );
      setTemplates(data);
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [filterType]);

  const handleDelete = async (template: LetterTemplate) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      await letterTemplatesApi.delete(template.id);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Letter Templates
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage AI-generated and manual letter templates for lifecycle
                changes
              </p>
            </div>
            <button
              onClick={() => navigate('/settings/letter-templates/new')}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              New Template
            </button>
          </div>

          {/* Filters */}
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
             <option value="">All Types</option>
  <optgroup label="🔄 Lifecycle">
    <option value="PROMOTION">Promotion</option>
    <option value="TRANSFER">Transfer</option>
    <option value="REDESIGNATION">Re-designation</option>
    <option value="CONFIRMATION">Confirmation</option>
    <option value="MANAGER_CHANGE">Manager Change</option>
  </optgroup>
  <optgroup label="🎯 Performance">
    <option value="PERFORMANCE_RATING">Performance Rating</option>
    <option value="APPRAISAL_LETTER">Appraisal</option>
    <option value="PIP_LETTER">PIP</option>
  </optgroup>
            </select>
          </div>

          {/* Templates Grid */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onNew={() => navigate('/settings/letter-templates/new')} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((template) => (
                <div
                  key={template.id}
                  className="group flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md"
                >
                  {/* Type badge + default star */}
                  <div className="mb-3 flex items-start justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        templateTypeColors[template.template_type]
                      }`}
                    >
                      {templateTypeLabels[template.template_type]}
                    </span>
                    {template.is_default && (
                      <span
                        className="flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700"
                        title="Default template for this type"
                      >
                        <Star className="h-3 w-3 fill-current" />
                        Default
                      </span>
                    )}
                  </div>

                  {/* Name + Subject */}
                  <h3 className="mb-1 text-base font-semibold text-gray-900">
                    {template.name}
                  </h3>
                  <p className="mb-3 text-xs text-gray-500 line-clamp-1">
                    {template.subject}
                  </p>

                  {/* Method badge */}
                  <div className="mb-4 flex items-center gap-2">
                    {template.creation_method.startsWith('AI') ? (
                      <span className="flex items-center gap-1 text-xs text-purple-600">
                        <Sparkles className="h-3 w-3" />
                        {template.creation_method === 'AI_EDITED'
                          ? 'AI + Edited'
                          : 'AI Generated'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <FileText className="h-3 w-3" />
                        Manual
                      </span>
                    )}
                    <span className="text-xs text-gray-400">•</span>
                    {template.is_active ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Footer meta */}
                  <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
                    <span className="text-xs text-gray-500">
                      {template.created_by_name || 'System'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() =>
                          navigate(`/settings/letter-templates/${template.id}`)
                        }
                        className="rounded p-1.5 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template)}
                        className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
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

// ==============================================================================
// EMPTY STATE
// ==============================================================================

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
      <FileText className="mx-auto h-12 w-12 text-gray-300" />
      <h3 className="mt-4 text-base font-semibold text-gray-900">
        No templates yet
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Create your first letter template to enable auto-generation of lifecycle
        letters.
      </p>
      <button
        onClick={onNew}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        <Sparkles className="h-4 w-4" />
        Create with AI
      </button>
    </div>
  );
}