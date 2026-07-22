import { useEffect, useState } from 'react';
import {
  FileText, Loader2, Download, FileSpreadsheet, File,
  Calendar, Users, RefreshCw, Sparkles, Info,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import {
  reimbursementReportsApi, batchesApi, claimsApi,
} from '../../api/reimbursement';
import type {
  GeneratedReport, MonthlyBatch, ReimbursementClaim,
} from '../../types/reimbursement';
import toast from 'react-hot-toast';

const REPORT_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  COMBINED_EXCEL: { label: 'Combined Excel', icon: FileSpreadsheet, color: 'bg-green-100 text-green-700' },
  COMBINED_PDF: { label: 'Combined PDF', icon: FileText, color: 'bg-red-100 text-red-700' },
  EMPLOYEE_EXCEL: { label: 'Employee Excel', icon: FileSpreadsheet, color: 'bg-blue-100 text-blue-700' },
  EMPLOYEE_PDF: { label: 'Employee PDF', icon: FileText, color: 'bg-purple-100 text-purple-700' },
  QUICK_CLAIM_EXCEL: { label: 'Quick Claim Excel', icon: FileSpreadsheet, color: 'bg-teal-100 text-teal-700' },
  QUICK_CLAIM_PDF: { label: 'Quick Claim PDF', icon: FileText, color: 'bg-pink-100 text-pink-700' },
};

export default function ReimbursementReportsPage() {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [batches, setBatches] = useState<MonthlyBatch[]>([]);
  const [claims, setClaims] = useState<ReimbursementClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  // Selectors for generation
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedClaim, setSelectedClaim] = useState<string>('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [reportsData, batchesData, claimsData] = await Promise.all([
        reimbursementReportsApi.list(),
        batchesApi.list(),
        claimsApi.list(),
      ]);
      setReports(reportsData);
      setBatches(batchesData);
      setClaims(claimsData);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleGenerateBatchExcel = async () => {
    if (!selectedBatch) return toast.error('Select a batch first');
    setGenerating('batch-excel');
    try {
      await batchesApi.generateCombinedExcel(Number(selectedBatch));
      toast.success('Combined Excel report generated');
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Generation failed');
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateBatchPdf = async () => {
    if (!selectedBatch) return toast.error('Select a batch first');
    setGenerating('batch-pdf');
    try {
      await batchesApi.generateCombinedPdf(Number(selectedBatch));
      toast.success('Combined PDF report generated');
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Generation failed');
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateClaimExcel = async () => {
    if (!selectedClaim) return toast.error('Select a claim first');
    setGenerating('claim-excel');
    try {
      await claimsApi.generateEmployeeExcel(Number(selectedClaim));
      toast.success('Employee Excel report generated');
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Generation failed');
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateClaimPdf = async () => {
    if (!selectedClaim) return toast.error('Select a claim first');
    setGenerating('claim-pdf');
    try {
      await claimsApi.generateEmployeePdf(Number(selectedClaim));
      toast.success('Employee PDF report generated');
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Generation failed');
    } finally {
      setGenerating(null);
    }
  };

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
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">
                  Reimbursement Reports
                </h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Generate and download Excel + PDF reports
              </p>
            </div>
            <button
              onClick={fetchAll}
              className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Report Generation Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Batch Reports */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Users className="h-4 w-4 text-primary-600" />
                Combined Batch Reports
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                Generate a report for all claims in a monthly batch
              </p>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select a batch...</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title || `Batch ${b.month}/${b.year}`}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateBatchExcel}
                  disabled={!selectedBatch || generating === 'batch-excel'}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {generating === 'batch-excel' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  Excel
                </button>
                <button
                  onClick={handleGenerateBatchPdf}
                  disabled={!selectedBatch || generating === 'batch-pdf'}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {generating === 'batch-pdf' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  PDF
                </button>
              </div>
            </div>

            {/* Employee Reports */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <File className="h-4 w-4 text-primary-600" />
                Employee Claim Reports
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                Generate a report for a single employee's claim
              </p>
              <select
                value={selectedClaim}
                onChange={(e) => setSelectedClaim(e.target.value)}
                className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select a claim...</option>
                {claims.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.employee_name} ({c.employee_code}) — ₹{parseFloat(c.total_claimed_amount).toLocaleString()}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateClaimExcel}
                  disabled={!selectedClaim || generating === 'claim-excel'}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {generating === 'claim-excel' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  Excel
                </button>
                <button
                  onClick={handleGenerateClaimPdf}
                  disabled={!selectedClaim || generating === 'claim-pdf'}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {generating === 'claim-pdf' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  PDF
                </button>
              </div>
            </div>
          </div>

          {/* Generated Reports List */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="border-b border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900">
                Generated Reports ({reports.length})
              </h3>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              </div>
            ) : reports.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">No reports generated yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {reports.map((report) => {
                  const typeCfg = REPORT_TYPE_CONFIG[report.report_type] || {
                    label: report.report_type,
                    icon: File,
                    color: 'bg-gray-100 text-gray-700',
                  };
                  const TypeIcon = typeCfg.icon;

                  return (
                    <div
                      key={report.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50"
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${typeCfg.color}`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {report.original_filename}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeCfg.color}`}>
                            {typeCfg.label}
                          </span>
                          {report.batch_title && <span>Batch: {report.batch_title}</span>}
                          {report.claim_employee_name && (
                            <span>Employee: {report.claim_employee_name}</span>
                          )}
                          <span>{formatDate(report.generated_at)}</span>
                        </div>
                      </div>
                      <a
                        href={report.file}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}