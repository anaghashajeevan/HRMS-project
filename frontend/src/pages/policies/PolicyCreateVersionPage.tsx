import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Upload, X, FileText, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { policiesApi } from '../../api/policy';
import type { PolicyDetail } from '../../types/policy';

export default function PolicyCreateVersionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (id) loadPolicy();
  }, [id]);

  const loadPolicy = async () => {
    try {
      const data = await policiesApi.getById(id!);
      setPolicy(data);
    } catch {
      toast.error('Failed to load policy');
      navigate('/policies');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF or Word documents are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10 MB allowed');
      return;
    }
    setContentFile(file);
  };

  const handleSave = async () => {
    if (!contentFile) return toast.error('Please upload the updated policy document');
    if (!changeSummary.trim()) return toast.error('Please describe what changed in this version');

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('content_file', contentFile);
      formData.append('content_html', '');
      formData.append(
        'content_type',
        contentFile.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCX'
      );
      formData.append('change_summary', changeSummary.trim());
      formData.append('effective_from', effectiveFrom);

      await policiesApi.createVersion(id!, formData);

      toast.success('New version created! Submit for approval to publish.', {
        duration: 4000,
      });
      navigate(`/policies/${id}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to create version');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !policy) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  const currentVersion = policy.current_version?.version_number || '1.0';
const wasPublished = policy.current_version?.is_published || false;

let nextVersion: string;
if (!wasPublished) {
  // Never published → same version replaced
  nextVersion = currentVersion;
} else {
  // Published → bump version
  const [major, minor] = currentVersion.split('.').map(Number);
  nextVersion = `${major}.${minor + 1}`;
}

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">

          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => navigate(`/policies/${id}`)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Create New Version</h1>
              <p className="mt-1 text-sm text-gray-500">
                Upload updated document for <strong>{policy.title}</strong>
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5
                         text-sm font-semibold text-white hover:bg-primary-700
                         disabled:opacity-50"
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              Save New Version
            </button>
          </div>

          {/* Info Banner */}
          {/* Info Banner */}
<div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
  <div className="flex items-start gap-3">
    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
    <div className="text-sm text-amber-900">
      <p className="font-semibold">
        {wasPublished ? '⚠️ Updating Published Policy' : '📝 Revising Draft Policy'}
      </p>
      <ol className="mt-2 ml-4 list-decimal space-y-1 text-amber-800">
        {wasPublished ? (
          <>
            <li>New version <strong>v{nextVersion}</strong> will be created</li>
            <li>Policy status changes to DRAFT — submit for approval again</li>
            <li>Once published, all applicable employees will need to <strong>re-acknowledge</strong></li>
            <li>Previous acknowledgments become invalid</li>
          </>
        ) : (
          <>
            <li>Current version <strong>v{currentVersion}</strong> will be replaced (no version bump)</li>
            <li>Policy status changes to DRAFT — submit for approval again</li>
            <li>No acknowledgments affected (policy was never published)</li>
          </>
        )}
      </ol>
    </div>
  </div>
</div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* ── LEFT — Main ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Current Version Info */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Current Version
                </h2>
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                  <div className="flex h-12 w-12 items-center justify-center
                                  rounded-lg bg-blue-100">
                    <FileText className="h-6 w-6 text-blue-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {policy.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      v{currentVersion} • Published{' '}
                      {policy.published_at
                        ? new Date(policy.published_at).toLocaleDateString('en-IN')
                        : '—'}
                    </p>
                  </div>
                  {policy.current_version?.file_url && (
                    <a
                      href={policy.current_version.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5
                                 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      View Current
                    </a>
                  )}
                </div>
              </div>

              {/* Upload New Document */}
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-1 text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  New Document <span className="text-red-500">*</span>
                </h2>
                <p className="mb-4 text-xs text-gray-500">
                  Upload the updated policy document (PDF or Word). Max 10 MB.
                </p>

                {!contentFile ? (
                  <label className="flex cursor-pointer flex-col items-center justify-center
                                    rounded-xl border-2 border-dashed border-gray-300 bg-gray-50
                                    py-12 transition hover:border-primary-400 hover:bg-primary-50">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center
                                    rounded-full bg-gray-100">
                      <Upload className="h-7 w-7 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">
                      Click to upload updated document
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      PDF or Word (.docx) • Max 10 MB
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between rounded-xl
                                  border border-green-200 bg-green-50 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center
                                      rounded-lg bg-green-100">
                        <FileText className="h-6 w-6 text-green-700" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-900">
                          {contentFile.name}
                        </p>
                        <p className="text-xs text-green-700">
                          {(contentFile.size / 1024 / 1024).toFixed(2)} MB •{' '}
                          {contentFile.name.toLowerCase().endsWith('.pdf')
                            ? 'PDF Document'
                            : 'Word Document'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setContentFile(null)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-green-100
                                 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Change Summary */}
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-1 text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  What Changed? <span className="text-red-500">*</span>
                </h2>
                <p className="mb-3 text-xs text-gray-500">
                  Briefly describe changes. Shown to employees when they view the policy.
                </p>
                <textarea
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  rows={5}
                  placeholder={`Example:
- Updated remote work eligibility criteria
- Added new equipment reimbursement section
- Revised VPN usage guidelines
- Clarified working hours for different time zones`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                             outline-none focus:border-primary-500 focus:ring-2
                             focus:ring-primary-100"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {changeSummary.length} characters
                </p>
              </div>
            </div>

            {/* ── RIGHT — Sidebar ── */}
            <div className="space-y-4">

              {/* Version Info */}
<div className="rounded-xl border-2 border-primary-200 bg-primary-50 p-5">
  <h3 className="mb-3 text-sm font-semibold text-primary-900">
    Version Information
  </h3>
  <div className="space-y-3 text-sm">
    <div className="flex justify-between">
      <span className="text-primary-700">Current</span>
      <span className="font-mono font-bold text-gray-700">
        v{currentVersion}
      </span>
    </div>
    <div className="flex justify-between">
      <span className="text-primary-700">
        {wasPublished ? 'New Version' : 'Will Replace'}
      </span>
      <span className="font-mono font-bold text-primary-900">
        v{nextVersion}
      </span>
    </div>
    {!wasPublished && (
      <p className="text-xs text-primary-700 italic">
        Since the policy was never published, this upload replaces the current draft.
      </p>
    )}
  </div>
</div>

              {/* Effective Date */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  Effective From <span className="text-red-500">*</span>
                </h3>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             outline-none focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  When the new version takes effect
                </p>
              </div>

              {/* Impact Preview */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <h3 className="mb-2 text-sm font-semibold text-blue-900">
                  📢 Impact
                </h3>
                <ul className="space-y-2 text-xs text-blue-800">
                  <li>• All applicable employees will receive an email</li>
                  <li>• In-app notifications will be sent</li>
                  <li>• Previous acknowledgments become invalid</li>
                  <li>• New acknowledgment deadline will apply</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}