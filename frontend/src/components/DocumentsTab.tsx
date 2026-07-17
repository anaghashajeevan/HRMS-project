import { useEffect, useState, useRef } from 'react';
import { Upload, FileText, Trash2, Download, Loader2, X, AlertTriangle } from 'lucide-react';
import { documentsApi } from '../api/documents';
import type { EmployeeDocument } from '../types/documents';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

const DOCUMENT_TYPES = [
  { value: 'CONTRACT', label: 'Employment Contract' },
  { value: 'OFFER_LETTER', label: 'Offer Letter' },
  { value: 'ID_PROOF', label: 'ID Proof' },
  { value: 'ADDRESS_PROOF', label: 'Address Proof' },
  { value: 'EDUCATION', label: 'Education Certificate' },
  { value: 'EXPERIENCE', label: 'Experience Certificate' },
  { value: 'PAN', label: 'PAN Card' },
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'VISA', label: 'Visa' },
  { value: 'WORK_PERMIT', label: 'Work Permit' },
  { value: 'MEDICAL', label: 'Medical Certificate' },
  { value: 'OTHER', label: 'Other' },
];

interface Props {
  employeeId: string;
}

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.txt',
];

export default function DocumentsTab({ employeeId }: Props) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    file: null as File | null,
    document_type: 'OTHER',
    document_name: '',
    expiry_date: '',
  });

  const canUpload = true; // Everyone with access to page can upload own; HR can upload for others

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const data = await documentsApi.listByEmployee(employeeId);
      setDocuments(data.results);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // ---------- Size check ----------
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const actualMB = (file.size / (1024 * 1024)).toFixed(1);
    toast.error(`File too large (${actualMB} MB). Max size is ${MAX_FILE_SIZE_MB} MB.`);
    e.target.value = '';
    return;
  }

  // ---------- Empty file check ----------
  if (file.size === 0) {
    toast.error('This file is empty. Please choose a valid file.');
    e.target.value = '';
    return;
  }

  // ---------- Extension check ----------
  const fileName = file.name.toLowerCase();
  const ext = '.' + (fileName.split('.').pop() || '');
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    toast.error(
      `File type "${ext}" not allowed. Allowed: PDF, images, Word, Excel, TXT.`
    );
    e.target.value = '';
    return;
  }

  // ---------- Filename length ----------
  if (file.name.length > 255) {
    toast.error('File name too long (max 255 characters).');
    e.target.value = '';
    return;
  }

  // ---------- All checks passed ----------
  setForm((f) => ({
    ...f,
    file,
    document_name: f.document_name || file.name.replace(/\.[^.]+$/, ''),
  }));
};

  const handleUpload = async () => {
    if (!form.file) {
      toast.error('Please select a file');
      return;
    }
    if (!form.document_name.trim()) {
      toast.error('Document name is required');
      return;
    }

    setUploading(true);
    try {
      await documentsApi.upload(
        employeeId,
        form.file,
        form.document_type,
        form.document_name,
        form.expiry_date || undefined,
      );
      toast.success('Document uploaded');
      setUploadOpen(false);
      setForm({ file: null, document_type: 'OTHER', document_name: '', expiry_date: '' });
      fetchDocuments();
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    if (!confirm(`Delete "${doc.document_name}"?`)) return;
    try {
      await documentsApi.delete(doc.id);
      toast.success('Document deleted');
      fetchDocuments();
    } catch (err) {
      const error = err as AxiosError<{ detail?: string }>;
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const getExpiryBadge = (doc: EmployeeDocument) => {
    if (!doc.expiry_date) return null;
    const days = doc.days_until_expiry;
    if (days === null) return null;
    if (days < 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <AlertTriangle className="h-3 w-3" /> Expired
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          🔴 Expires in {days} days
        </span>
      );
    }
    if (days <= 90) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          ⚠️ Expires in {days} days
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        ✅ Valid ({days} days)
      </span>
    );
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
          <p className="mt-0.5 text-xs text-gray-500">
  {documents.length} document{documents.length !== 1 ? 's' : ''} • Max {MAX_FILE_SIZE_MB} MB per file
</p>
        </div>
        {canUpload && (
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Upload className="h-4 w-4" /> Upload
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-gray-500">
          <FileText className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm">No documents uploaded yet</p>
          {canUpload && (
            <button
              onClick={() => setUploadOpen(true)}
              className="mt-3 text-sm text-primary-600 hover:underline"
            >
              Upload the first document
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <FileText className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {doc.document_name}
                  </p>
                  {getExpiryBadge(doc)}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {doc.document_type_display} •{' '}
                  {(doc.file_size_kb / 1024).toFixed(2)} MB •{' '}
                  Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                  {doc.uploaded_by_name && ` by ${doc.uploaded_by_name}`}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => handleDelete(doc)}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Upload Document</h2>
              <button onClick={() => setUploadOpen(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Document Type *</label>
                <select
                  value={form.document_type}
                  onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Document Name *</label>
                <input
                  type="text"
                  value={form.document_name}
                  onChange={(e) => setForm({ ...form, document_name: e.target.value })}
                  placeholder="e.g., Employment Contract 2026"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Expiry Date (optional)</label>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  You'll get email alerts 90/60/30 days before expiry
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">File *</label>
                <div
  onClick={() => fileRef.current?.click()}
  className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-primary-500 hover:bg-primary-50 transition"
>
  <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
  <p className="text-sm text-gray-600">
    {form.file ? (
      <>
        <span className="font-medium text-primary-600">{form.file.name}</span>
        <span className="mt-1 block text-xs text-gray-500">
          {(form.file.size / (1024 * 1024)).toFixed(2)} MB
        </span>
      </>
    ) : (
      'Click to choose a file'
    )}
  </p>
  <p className="mt-1 text-xs text-gray-400">
    Max {MAX_FILE_SIZE_MB} MB • PDF, JPG, PNG, DOC, DOCX, XLS, XLSX
  </p>
</div>
                <input
  ref={fileRef}
  type="file"
  onChange={handleFileChange}
  className="hidden"
  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt"
/>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setUploadOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !form.file}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}