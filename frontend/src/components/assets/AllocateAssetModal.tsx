import { useEffect, useState, type FormEvent } from 'react';
import { X, Loader2, Search, User, Package, CheckCircle2 } from 'lucide-react';
import { assetAllocationsApi } from '../../api/assets';
import { employeesApi } from '../../api/employees';
import type { ManagerOption } from '../../api/employees';
import toast from 'react-hot-toast';

interface Props {
  asset: {
    id: string;
    asset_tag: string;
    name: string;
    category_name: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function AllocateAssetModal({ asset, onClose, onSuccess }: Props) {
  const [employees, setEmployees] = useState<ManagerOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<ManagerOption | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    allocated_date: new Date().toISOString().split('T')[0],
    expected_return_date: '',
    handover_notes: '',
  });

  useEffect(() => {
    // Load initial employees
    loadEmployees('');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) loadEmployees(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadEmployees = async (search: string) => {
    setSearching(true);
    try {
      const data = await employeesApi.getManagers(search);
      setEmployees(data);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectEmployee = (emp: ManagerOption) => {
    setSelectedEmployee(emp);
    setSearchTerm(emp.full_name);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    setSaving(true);
    try {
      await assetAllocationsApi.allocate({
        asset_id: asset.id,
        employee_id: selectedEmployee.id,
        allocated_date: form.allocated_date,
        expected_return_date: form.expected_return_date || undefined,
        handover_notes: form.handover_notes || undefined,
      });
      toast.success(`Asset allocated to ${selectedEmployee.full_name}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to allocate asset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 p-2 text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Allocate Asset</h2>
              <p className="text-xs text-gray-500">
                Assign this asset to an employee
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Asset Info */}
        <div className="mb-4 rounded-xl bg-indigo-50 p-4">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-xs font-mono text-indigo-700">{asset.asset_tag}</p>
              <p className="font-semibold text-gray-900">{asset.name}</p>
              <p className="text-xs text-gray-600">{asset.category_name}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Search */}
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Employee <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                  if (!e.target.value) setSelectedEmployee(null);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search employee by name or ID..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-500" />
              )}
            </div>

            {/* Dropdown Results */}
            {showDropdown && employees.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectEmployee(emp)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-indigo-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      {emp.full_name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {emp.full_name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {emp.employee_id} · {emp.official_email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Employee Preview */}
          {selectedEmployee && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="flex items-center gap-2 text-sm text-green-800">
                <User className="h-4 w-4" />
                Assigning to <strong>{selectedEmployee.full_name}</strong> ({selectedEmployee.employee_id})
              </p>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Allocated Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.allocated_date}
                onChange={(e) => setForm({ ...form, allocated_date: e.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Expected Return
              </label>
              <input
                type="date"
                value={form.expected_return_date}
                onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Handover Notes
            </label>
            <textarea
              value={form.handover_notes}
              onChange={(e) => setForm({ ...form, handover_notes: e.target.value })}
              rows={3}
              placeholder="e.g., New joiner Day 1 kit. Charger and bag included."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !selectedEmployee}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {saving ? 'Allocating...' : 'Allocate Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}