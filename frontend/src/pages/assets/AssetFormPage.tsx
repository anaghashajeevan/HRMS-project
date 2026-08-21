import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Package } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { assetsApi, assetCategoriesApi } from '../../api/assets';
import type { AssetCategory } from '../../types/asset';
import toast from 'react-hot-toast';

export default function AssetFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<AssetCategory[]>([]);

  const [form, setForm] = useState({
    asset_tag: '',
    name: '',
    category: '',
    brand: '',
    model_number: '',
    serial_number: '',
    purchase_date: '',
    purchase_cost: '',
    vendor: '',
    invoice_number: '',
    warranty_expiry: '',
    status: 'AVAILABLE',
    condition: 'NEW',
    condition_notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadCategories();
    if (isEdit) loadAsset();
  }, [id]);

  const loadCategories = async () => {
    try {
      const data = await assetCategoriesApi.list();
      setCategories(data.filter((c) => c.is_active));
    } catch {
      toast.error('Failed to load categories');
    }
  };

  const loadAsset = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await assetsApi.getById(id);
      setForm({
        asset_tag: data.asset_tag,
        name: data.name,
        category: data.category,
        brand: data.brand || '',
        model_number: data.model_number || '',
        serial_number: data.serial_number,
        purchase_date: data.purchase_date || '',
        purchase_cost: data.purchase_cost?.toString() || '',
        vendor: data.vendor || '',
        invoice_number: data.invoice_number || '',
        warranty_expiry: data.warranty_expiry || '',
        status: data.status,
        condition: data.condition,
        condition_notes: data.condition_notes || '',
      });
    } catch {
      toast.error('Failed to load asset');
      navigate('/assets');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.asset_tag.trim()) errs.asset_tag = 'Asset tag is required';
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.category) errs.category = 'Category is required';
    if (!form.serial_number.trim()) errs.serial_number = 'Serial number is required';
    if (form.purchase_cost && isNaN(parseFloat(form.purchase_cost))) {
      errs.purchase_cost = 'Must be a valid number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors below');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...form,
        purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
        purchase_date: form.purchase_date || null,
        warranty_expiry: form.warranty_expiry || null,
      };

      if (isEdit && id) {
        await assetsApi.update(id, payload);
        toast.success('Asset updated successfully');
      } else {
        await assetsApi.create(payload);
        toast.success('Asset created successfully');
      }
      navigate('/assets');
    } catch (err: any) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fieldErrors: Record<string, string> = {};
        Object.entries(data).forEach(([field, msg]) => {
          fieldErrors[field] = Array.isArray(msg) ? msg[0] : String(msg);
        });
        setErrors(fieldErrors);
      }
      toast.error(data?.detail || 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex flex-1 items-center justify-center">
            <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-4xl">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="rounded-lg p-2 hover:bg-gray-200"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isEdit ? 'Edit Asset' : 'Add New Asset'}
                </h1>
                <p className="text-sm text-gray-500">
                  {isEdit ? 'Update asset details' : 'Register a new asset in the inventory'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info Section */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Package className="h-4 w-4 text-indigo-500" />
                  Basic Information
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    label="Asset Tag"
                    required
                    value={form.asset_tag}
                    onChange={(v: string) => setForm({ ...form, asset_tag: v })}
                    error={errors.asset_tag}
                    placeholder="AST-LAP-001"
                    mono
                  />
                  <FormField
                    label="Asset Name"
                    required
                    value={form.name}
                    onChange={(v: string) => setForm({ ...form, name: v })}
                    error={errors.name}
                    placeholder="MacBook Pro 16 Inch"
                  />
                  <FormSelect
                    label="Category"
                    required
                    value={form.category}
                    onChange={(v: string) => setForm({ ...form, category: v })}
                    error={errors.category}
                    options={[
                      { value: '', label: 'Select category...' },
                      ...categories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                  <FormField
                    label="Serial Number"
                    required
                    value={form.serial_number}
                    onChange={(v: string) => setForm({ ...form, serial_number: v })}
                    error={errors.serial_number}
                    placeholder="C02XG2MDMD6T"
                    mono
                  />
                  <FormField
                    label="Brand"
                    value={form.brand}
                    onChange={(v: string) => setForm({ ...form, brand: v })}
                    placeholder="Apple, Dell, HP..."
                  />
                  <FormField
                    label="Model Number"
                    value={form.model_number}
                    onChange={(v: string) => setForm({ ...form, model_number: v })}
                    placeholder="MBP16-M3-2024"
                  />
                </div>
              </div>

              {/* Financial Section */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">
                  Purchase & Warranty
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    label="Purchase Date"
                    type="date"
                    value={form.purchase_date}
                    onChange={(v: string) => setForm({ ...form, purchase_date: v })}
                  />
                  <FormField
                    label="Purchase Cost (₹)"
                    type="number"
                    value={form.purchase_cost}
                    onChange={(v: string) => setForm({ ...form, purchase_cost: v })}
                    error={errors.purchase_cost}
                    placeholder="245000"
                  />
                  <FormField
                    label="Vendor"
                    value={form.vendor}
                    onChange={(v: string) => setForm({ ...form, vendor: v })}
                    placeholder="Apple India, Dell India..."
                  />
                  <FormField
                    label="Invoice Number"
                    value={form.invoice_number}
                    onChange={(v: string) => setForm({ ...form, invoice_number: v })}
                    placeholder="INV-2024-8812"
                  />
                  <FormField
                    label="Warranty Expiry"
                    type="date"
                    value={form.warranty_expiry}
                    onChange={(v: string) => setForm({ ...form, warranty_expiry: v })}
                  />
                </div>
              </div>

              {/* Status & Condition Section */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">
                  Status & Condition
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormSelect
                    label="Status"
                    value={form.status}
                    onChange={(v: string) => setForm({ ...form, status: v })}
                    options={[
                      { value: 'AVAILABLE', label: 'Available' },
                      { value: 'MAINTENANCE', label: 'Under Maintenance' },
                      { value: 'DISPOSED', label: 'Disposed' },
                    ]}
                    helpText="To allocate, use the Allocate button on asset directory."
                  />
                  <FormSelect
                    label="Condition"
                    value={form.condition}
                    onChange={(v: string) => setForm({ ...form, condition: v })}
                    options={[
                      { value: 'NEW', label: 'New' },
                      { value: 'GOOD', label: 'Good' },
                      { value: 'FAIR', label: 'Fair' },
                      { value: 'POOR', label: 'Poor' },
                    ]}
                  />
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Condition Notes
                    </label>
                    <textarea
                      value={form.condition_notes}
                      onChange={(e) => setForm({ ...form, condition_notes: e.target.value })}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Any specific condition notes about the asset..."
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/assets')}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Saving...' : isEdit ? 'Update Asset' : 'Create Asset'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// TYPED FORM HELPERS
// ==============================================================================

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  mono?: boolean;
}

function FormField({
  label, value, onChange, error, placeholder, required, type = 'text', mono,
}: FormFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          mono ? 'font-mono' : ''
        } ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: FormSelectOption[];
  error?: string;
  required?: boolean;
  helpText?: string;
}

function FormSelect({
  label, value, onChange, options, error, required, helpText,
}: FormSelectProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {helpText && !error && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}