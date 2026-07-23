import { useState } from 'react';
import { X, Upload, Download, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeesApi } from '../api/employees';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  ok: boolean;
  message: string;
  total_rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  warnings?: string[]; 
  created_employees: Array<{ employee_id: string; full_name: string; email: string }>;
}

export default function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [skipExisting, setSkipExisting] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      const blob = await employeesApi.bulkImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee_import_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum 5 MB allowed.');
      return;
    }
    setFile(selected);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const response = await employeesApi.bulkImport(file, skipExisting);
      setResult(response);
      if (response.created > 0 || response.updated > 0) {
        toast.success(response.message);
        onSuccess();
      } else if (response.errors.length > 0) {
        toast.error(`Import completed with ${response.errors.length} error(s)`);
      } else {
        toast(response.message);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Import failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-600">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bulk Import Employees</h2>
              <p className="text-sm text-gray-500">Upload CSV or XLSX to create multiple employees</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Step 1: Download template */}
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">Step 1: Download Template</h3>
                <p className="mt-1 text-sm text-blue-700">
                  Download the CSV template with the correct format and sample data.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: Required columns */}
          {/* <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="font-semibold text-gray-900">Step 2: Required Columns</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-700">
              <div>✅ Employee Code (e.g., NL001)</div>
              <div>✅ First Name</div>
              <div>✅ Last Name</div>
              <div>✅ Email</div>
              <div>✅ Phone</div>
              <div>✅ Date of Joining (YYYY-MM-DD)</div>
              <div>✅ Date of Birth (YYYY-MM-DD)</div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Optional: Department, Gender (MALE/FEMALE/OTHER), Personal Email, Position
            </p>
          </div> */}
          {/* Step 2: Required columns */}
<div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
  <h3 className="font-semibold text-gray-900">Step 2: Choose Your Format</h3>

  <div className="mt-3 space-y-3">
    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
      <p className="text-sm font-semibold text-green-900">✅ Simple Format (Quick)</p>
      <p className="mt-1 text-xs text-green-700">
        <strong>Columns:</strong> Employee Code, Employee Name, Department, Email, Status
      </p>
      <p className="mt-1 text-xs text-green-700">
        Missing fields (phone, DOB, DOJ) will use placeholder values. HR can update later.
      </p>
    </div>

    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <p className="text-sm font-semibold text-blue-900">📋 Full Format (Complete)</p>
      <p className="mt-1 text-xs text-blue-700">
        <strong>Columns:</strong> Employee Code, First Name, Last Name, Email, Phone, Date of Joining, Date of Birth, Department, Gender
      </p>
    </div>
  </div>
</div>

          {/* Step 3: Upload */}
          <div className="mb-6">
            <h3 className="mb-2 font-semibold text-gray-900">Step 3: Upload File</h3>
            <label
              htmlFor="bulk-import-file"
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center hover:border-blue-400 hover:bg-blue-50"
            >
              <Upload className="h-10 w-10 text-gray-400" />
              <p className="mt-2 text-sm font-semibold text-gray-900">
                {file ? file.name : 'Click to select CSV or XLSX'}
              </p>
              <p className="mt-1 text-xs text-gray-500">Max 5 MB</p>
              <input
                id="bulk-import-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Options */}
          <label className="mb-6 flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">
              Skip employees that already exist (by code or email)
            </span>
          </label>

          {/* Results */}
          {result && (
            <div className="mb-6 rounded-xl border border-gray-200 p-4">
              <h3 className="mb-3 font-semibold text-gray-900">Import Results</h3>
              {(result as any).template_format && (
        <span className={`text-xs px-2 py-1 rounded-full ${
          (result as any).template_format === 'FULL'
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {(result as any).template_format} template
        </span>
      )}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="text-2xl font-bold text-blue-600">{result.total_rows}</div>
                  <div className="text-xs text-blue-700">Total Rows</div>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="text-2xl font-bold text-green-600">{result.created}</div>
                  <div className="text-xs text-green-700">Created</div>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <div className="text-2xl font-bold text-amber-600">{result.updated + result.skipped}</div>
                  <div className="text-xs text-amber-700">Skipped/Updated</div>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
                  <div className="text-xs text-red-700">Errors</div>
                </div>
              </div>
               {(result as any).warnings && (result as any).warnings.length > 0 && (
      <div className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-amber-50 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AlertCircle className="h-4 w-4" />
          Warnings ({(result as any).warnings.length}):
        </div>
        <ul className="space-y-1 text-xs text-amber-800">
          {(result as any).warnings.map((warn: string, idx: number) => (
            <li key={idx}>• {warn}</li>
          ))}
        </ul>
      </div>
    )}
              {result.errors.length > 0 && (
                <div className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-red-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-900">
                    <AlertCircle className="h-4 w-4" />
                    Errors:
                  </div>
                  <ul className="space-y-1 text-xs text-red-800">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.created_employees.length > 0 && (
                <div className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-green-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-900">
                    <CheckCircle2 className="h-4 w-4" />
                    Created ({result.created_employees.length}):
                  </div>
                  <ul className="space-y-1 text-xs text-green-800">
                    {result.created_employees.map((emp) => (
                      <li key={emp.employee_id}>
                        • <strong>{emp.employee_id}</strong> — {emp.full_name} ({emp.email})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import Employees
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}