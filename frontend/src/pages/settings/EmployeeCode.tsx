import { useEffect, useState } from 'react';
import { Loader2, Save, IdCard, Sparkles } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { employeeIdSettingsApi } from '../../api/masterData';
import type { EmployeeIdSetting } from '../../types/masterData';
import toast from 'react-hot-toast';

export default function EmployeeCodeSettingsPage() {
  const [settings, setSettings] = useState<EmployeeIdSetting[]>([]);
  const [prefix, setPrefix] = useState('');
  const [includeYear, setIncludeYear] = useState(true);
  const [padding, setPadding] = useState(4);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await employeeIdSettingsApi.list();
      setSettings(data.results);

      const prefixSetting = data.results.find((s) => s.key === 'EMPLOYEE_ID_PREFIX');
      const yearSetting = data.results.find((s) => s.key === 'EMPLOYEE_ID_INCLUDE_YEAR');
      const paddingSetting = data.results.find((s) => s.key === 'EMPLOYEE_ID_PADDING');

      if (prefixSetting) setPrefix(prefixSetting.value);
      if (yearSetting) setIncludeYear(yearSetting.value.toLowerCase() === 'true');
      if (paddingSetting) setPadding(parseInt(paddingSetting.value) || 4);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Fetch live preview when form values change
  useEffect(() => {
    if (!prefix) return;
    const timer = setTimeout(async () => {
      try {
        const data = await employeeIdSettingsApi.preview({
          prefix,
          include_year: includeYear,
          padding,
        });
        setPreview(data.preview);
      } catch {
        setPreview('Invalid settings');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [prefix, includeYear, padding]);

  const handleSave = async () => {
    if (!prefix.trim()) {
      toast.error('Prefix is required');
      return;
    }
    if (padding < 1 || padding > 8) {
      toast.error('Padding must be between 1 and 8');
      return;
    }

    setSaving(true);
    try {
      const prefixSetting = settings.find((s) => s.key === 'EMPLOYEE_ID_PREFIX');
      const yearSetting = settings.find((s) => s.key === 'EMPLOYEE_ID_INCLUDE_YEAR');
      const paddingSetting = settings.find((s) => s.key === 'EMPLOYEE_ID_PADDING');

      const updates = [];
      if (prefixSetting) updates.push(employeeIdSettingsApi.update(prefixSetting.id, prefix.toUpperCase()));
      if (yearSetting) updates.push(employeeIdSettingsApi.update(yearSetting.id, String(includeYear)));
      if (paddingSetting) updates.push(employeeIdSettingsApi.update(paddingSetting.id, String(padding)));

      await Promise.all(updates);
      toast.success('Employee ID format updated');
      fetchSettings();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employee Code Settings</h1>
              <p className="mt-1 text-sm text-gray-600">
                Configure the format of auto-generated employee IDs
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="max-w-3xl">
              {/* Preview Card */}
              <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 p-6 text-white shadow-lg">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6" />
                  <div>
                    <p className="text-xs uppercase opacity-80">Next Employee ID will look like</p>
                    <p className="mt-1 font-mono text-3xl font-bold">
                      {preview || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Card */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <div className="mb-4 flex items-center gap-2">
                  <IdCard className="h-5 w-5 text-primary-600" />
                  <h3 className="text-lg font-semibold">Configuration</h3>
                </div>

                <div className="space-y-6">
                  {/* Prefix */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Prefix *
                    </label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                      maxLength={10}
                      placeholder="e.g., NL, NLT, EMP"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The letters at the start of every employee ID (e.g., <code className="rounded bg-gray-100 px-1">NL</code> → <code className="rounded bg-gray-100 px-1">NL-2026-0001</code>)
                    </p>
                  </div>

                  {/* Include Year */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Include Year in ID
                    </label>
                    <div className="flex gap-4">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          checked={includeYear === true}
                          onChange={() => setIncludeYear(true)}
                          className="h-4 w-4 text-primary-600"
                        />
                        <span className="text-sm">
                          Yes — <code className="rounded bg-gray-100 px-1 text-xs">{prefix}-2026-0001</code>
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          checked={includeYear === false}
                          onChange={() => setIncludeYear(false)}
                          className="h-4 w-4 text-primary-600"
                        />
                        <span className="text-sm">
                          No — <code className="rounded bg-gray-100 px-1 text-xs">{prefix}-0001</code>
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Padding */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Sequence Padding
                    </label>
                    <select
                      value={padding}
                      onChange={(e) => setPadding(parseInt(e.target.value))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 md:w-1/2"
                    >
                      <option value="3">3 digits (001, 002 ... 999)</option>
                      <option value="4">4 digits (0001, 0002 ... 9999)</option>
                      <option value="5">5 digits (00001, 00002 ... 99999)</option>
                      <option value="6">6 digits (000001, 000002 ...)</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      How many digits the sequential number should have
                    </p>
                  </div>
                </div>

                {/* Warning */}
                <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-800">
                    ⚠️ Changing these settings only affects <strong>new</strong> employees created after saving.
                    Existing employee IDs will not be modified.
                  </p>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={fetchSettings}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}