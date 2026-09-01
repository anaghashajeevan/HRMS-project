import { useState, useEffect, useRef } from 'react';
import {
  Upload, Edit2, Trash2, Building2, Image as ImageIcon,
  CheckCircle2, AlertCircle, X, Loader2, Save, Star,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { companyLogoApi, type CompanyLogo } from '../../api/companyLogo';
import toast from 'react-hot-toast';

// ----------------------------------------------------------------------
// HELPER: Forces images to load from Django backend instead of React dev server
// ----------------------------------------------------------------------
const getAbsoluteUrl = (url: string | null | undefined) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Prepend your backend Django server address
  return `http://127.0.0.1:8000${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function CompanyLogoPage() {
  const [logos, setLogos] = useState<CompanyLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLogo, setEditingLogo] = useState<CompanyLogo | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formLogo, setFormLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLogos = async () => {
    setLoading(true);
    try {
      const data = await companyLogoApi.list();
      // Normalize all URLs immediately upon fetching
      const normalizedData = data.map((item) => ({
        ...item,
        logo_url: getAbsoluteUrl(item.logo_url || item.logo),
      }));
      setLogos(normalizedData);
    } catch {
      toast.error('Failed to load logos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogos();
  }, []);

  const openCreateModal = () => {
    setEditingLogo(null);
    setFormName('');
    setFormTagline('');
    setFormUrl('');
    setFormIsActive(true);
    setFormLogo(null);
    setPreview(null);
    setShowModal(true);
  };

  const openEditModal = (logo: CompanyLogo) => {
    setEditingLogo(logo);
    setFormName(logo.name);
    setFormTagline(logo.tagline);
    setFormUrl(logo.company_url);
    setFormIsActive(logo.is_active);
    setFormLogo(null);
    
    // Set preview to the normalized absolute URL
    setPreview(getAbsoluteUrl(logo.logo_url || logo.logo));
    setShowModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo file must be under 5 MB');
      return;
    }

    setFormLogo(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!editingLogo && !formLogo) {
      toast.error('Please select a logo file');
      return;
    }

    const formData = new FormData();
    formData.append('name', formName.trim());
    formData.append('tagline', formTagline.trim());
    formData.append('company_url', formUrl.trim());
    formData.append('is_active', String(formIsActive));
    if (formLogo) {
      formData.append('logo', formLogo);
    }

    setSaving(true);
    try {
      if (editingLogo) {
        await companyLogoApi.update(editingLogo.id, formData);
        toast.success('Logo updated successfully! Refresh your browser to see changes everywhere.');
      } else {
        await companyLogoApi.create(formData);
        toast.success('Logo uploaded successfully! Refresh your browser to see changes everywhere.');
      }
      setShowModal(false);
      fetchLogos();
    } catch (err: any) {
      const msg = err?.response?.data?.detail 
        || Object.values(err?.response?.data || {}).flat().join(', ')
        || 'Failed to save logo';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (logo: CompanyLogo) => {
    if (!confirm(`Delete logo "${logo.name}"?`)) return;
    try {
      await companyLogoApi.delete(logo.id);
      toast.success('Logo deleted');
      fetchLogos();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleSetActive = async (logo: CompanyLogo) => {
    try {
      await companyLogoApi.setActive(logo.id);
      toast.success(`"${logo.name}" is now the active logo. Refresh your browser.`);
      fetchLogos();
    } catch {
      toast.error('Failed to activate');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Company Logo</h1>
                <p className="text-sm text-gray-500">
                  Manage your organization's brand identity across the entire HRMS portal
                </p>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Upload className="h-4 w-4" />
              Upload New Logo
            </button>
          </div>

          {/* Info Banner */}
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="font-semibold text-blue-900">How it works</p>
              <p className="mt-1 text-blue-700">
                Only ONE logo can be active at a time. The active logo will appear on the Login page, Sidebar, Topbar, and Footer.
                After changing the active logo, <strong>users need to refresh their browser</strong> to see the update.
              </p>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : logos.length === 0 ? (
            <div className="rounded-2xl bg-white p-16 text-center shadow-sm ring-1 ring-gray-100">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Building2 className="h-8 w-8 text-gray-400" />
              </div>
              <p className="mt-4 text-lg font-semibold text-gray-900">
                No company logo uploaded yet
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Upload your first logo to personalize the entire HRMS portal
              </p>
              <button
                onClick={openCreateModal}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Upload className="h-4 w-4" />
                Upload First Logo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {logos.map((logo) => (
                <div
                  key={logo.id}
                  className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition ${
                    logo.is_active
                      ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-100'
                      : 'ring-gray-200 hover:shadow-md'
                  }`}
                >
                  {/* Active Badge */}
                  {logo.is_active && (
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1.5 text-xs font-bold text-white">
                      <Star className="h-3 w-3 fill-white" />
                      ACTIVE LOGO
                    </div>
                  )}

                  {/* Logo Preview */}
                  <div className="flex h-40 items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6 relative">
                    {logo.logo_url ? (
                      <img
                        src={logo.logo_url}
                        alt={logo.name}
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                           // Fallback if image still breaks
                           (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Building2 className="h-16 w-16 text-gray-300" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900">{logo.name}</h3>
                    {logo.tagline && (
                      <p className="mt-1 text-xs italic text-gray-500 line-clamp-2">
                        {logo.tagline}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      Uploaded:{' '}
                      {new Date(logo.uploaded_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>

                    {/* Actions */}
                    <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                      {!logo.is_active && (
                        <button
                          onClick={() => handleSetActive(logo)}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          title="Set as Active"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(logo)}
                        className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        title="Edit"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(logo)}
                        className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Upload/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingLogo ? 'Edit Logo' : 'Upload New Logo'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              {/* Company Name */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. NL Technologies Pvt Ltd"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Tagline
                </label>
                <input
                  type="text"
                  value={formTagline}
                  onChange={(e) => setFormTagline(e.target.value)}
                  placeholder="e.g. Empowering Digital Transformation"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Company URL */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Company Website URL
                </label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://www.example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Logo Image {!editingLogo && <span className="text-red-500">*</span>}
                </label>

                {/* Preview Box */}
                {preview && (
                  <div className="mb-3 relative flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4">
                    {editingLogo && !formLogo && (
                      <span className="absolute top-2 left-2 bg-indigo-600 text-[10px] font-bold text-white px-2 py-0.5 rounded shadow-sm">
                        Currently Uploaded File
                      </span>
                    )}
                    <img
                      src={preview}
                      alt="Logo Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                  <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                  PNG, JPG, or SVG (max 5 MB). Leaving browse empty keeps your current file.
                </p>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 cursor-pointer hover:bg-emerald-100 transition">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="font-medium">Set as active logo (visible everywhere)</span>
              </label>

              {/* Buttons */}
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingLogo ? 'Update Logo' : 'Upload Logo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}