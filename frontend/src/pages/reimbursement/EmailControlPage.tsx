import { useEffect, useState } from 'react';
import {
  Mail, Loader2, Send, Eye, Clock, CheckCircle2, XCircle,
  FileText, RefreshCw, AlertCircle, Info,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import {
  reimbursementEmailApi, batchesApi, reimbursementReportsApi,
} from '../../api/reimbursement';
import type {
  EmailDispatchLog, MonthlyBatch, GeneratedReport, EmailStatus,
} from '../../types/reimbursement';
import toast from 'react-hot-toast';

const EMAIL_STATUS_CONFIG: Record<EmailStatus, { label: string; className: string; icon: any }> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700', icon: Clock },
  SENT: { label: 'Sent', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function EmailControlPage() {
  const [logs, setLogs] = useState<EmailDispatchLog[]>([]);
  const [batches, setBatches] = useState<MonthlyBatch[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Compose form
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedReports, setSelectedReports] = useState<number[]>([]);
  const [toEmail, setToEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateType, setTemplateType] = useState('CTO_EXECUTIVE');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [logsData, batchesData, reportsData] = await Promise.all([
        reimbursementEmailApi.logs(),
        batchesApi.list(),
        reimbursementReportsApi.list(),
      ]);
      setLogs(logsData);
      setBatches(batchesData);
      setReports(reportsData);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handlePreview = async () => {
    if (!selectedBatch) return toast.error('Select a batch first');
    try {
      const preview = await reimbursementEmailApi.preview(
        Number(selectedBatch),
        templateType
      );
      setToEmail(preview.to_email || '');
      setCcEmail(preview.cc_email || '');
      setSubject(preview.subject || '');
      setBody(preview.body || '');
      setSelectedReports(preview.report_ids || []);
      toast.success('Preview loaded');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Preview failed');
    }
  };

  const handleSend = async () => {
    if (!selectedBatch) return toast.error('Select a batch');
    if (!toEmail) return toast.error('To email is required');
    if (selectedReports.length === 0) return toast.error('Select at least one report');
    if (!subject) return toast.error('Subject is required');

    setSending(true);
    try {
      const result = await reimbursementEmailApi.send({
        batch: Number(selectedBatch),
        report_ids: selectedReports,
        to_email: toEmail,
        cc_email: ccEmail,
        subject,
        body,
      });

      if (result.status === 'SENT') {
        toast.success('Email sent successfully');
      } else {
        toast.error(`Email failed: ${result.error_message}`);
      }
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const toggleReport = (reportId: number) => {
    setSelectedReports((prev) =>
      prev.includes(reportId)
        ? prev.filter((id) => id !== reportId)
        : [...prev, reportId]
    );
  };

  const batchReports = reports.filter(
    (r) => r.batch === Number(selectedBatch)
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">Email Control</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Compose, preview, and send reimbursement emails with report attachments
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* LEFT: Compose */}
            <div className="space-y-4">
              {/* Batch + Template Selection */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">
                  Compose Email
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                      Select Batch
                    </label>
                    <select
                      value={selectedBatch}
                      onChange={(e) => setSelectedBatch(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">Select batch...</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title || `Batch ${b.month}/${b.year}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                      Email Template
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={templateType}
                        onChange={(e) => setTemplateType(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="CTO_EXECUTIVE">CTO Executive Summary</option>
                        <option value="FORMAL_SUMMARY">Formal Summary</option>
                        <option value="FINANCE_APPROVAL">Finance Approval</option>
                      </select>
                      <button
                        onClick={handlePreview}
                        disabled={!selectedBatch}
                        className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Fields */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500">To</label>
                    <input
                      type="email"
                      value={toEmail}
                      onChange={(e) => setToEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="recipient@company.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500">CC</label>
                    <input
                      type="email"
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="cc@company.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Body</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {/* Attach Reports */}
                {batchReports.length > 0 && (
                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-medium uppercase text-gray-500">
                      Attach Reports
                    </label>
                    <div className="space-y-1">
                      {batchReports.map((r) => (
                        <label
                          key={r.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedReports.includes(r.id)}
                            onChange={() => toggleReport(r.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {r.original_filename}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={sending || !toEmail || selectedReports.length === 0}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send Email
                </button>
              </div>
            </div>

            {/* RIGHT: Email History */}
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900">
                  Email History ({logs.length})
                </h3>
                <button
                  onClick={fetchAll}
                  className="text-xs text-primary-600 hover:underline"
                >
                  <RefreshCw className="inline h-3 w-3 mr-1" />
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                </div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center">
                  <Mail className="mx-auto h-10 w-10 text-gray-300" />
                  <p className="mt-3 text-sm text-gray-500">No emails sent yet</p>
                </div>
              ) : (
                <div className="max-h-[600px] divide-y divide-gray-100 overflow-y-auto">
                  {logs.map((log) => {
                    const statusCfg = EMAIL_STATUS_CONFIG[log.status];
                    const StatusIcon = statusCfg.icon;

                    return (
                      <div key={log.id} className="p-4 hover:bg-gray-50">
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusCfg.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">
                          {log.subject}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          To: {log.to_email}
                          {log.cc_email && ` • CC: ${log.cc_email}`}
                        </p>
                        {log.error_message && (
                          <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
                            <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                            {log.error_message}
                          </p>
                        )}
                        {log.sent_at && (
                          <p className="mt-1 text-xs text-green-600">
                            Sent: {formatDate(log.sent_at)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}