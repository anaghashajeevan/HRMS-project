import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { createProfile, getPayrollEmployees, getProfile, updateProfile } from '../../../api/payrollApi';
import SearchableSelect from '../../../components/SearchableSelect';

const inputCls =
  'block w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500 transition';
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

interface Props {
  initial: any | null;
  employeeId?: string;
  employeeLabel?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProfileFormModal({ initial, employeeId, employeeLabel, onClose, onSaved }: Props) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({
    employee: initial?.employee?.id || initial?.employee || employeeId || '',
    bank_name: initial?.bank_name || '',
    bank_account: '',
    ifsc_code: initial?.ifsc_code || '',
    account_holder_name: initial?.account_holder_name || '',
    pan: '',
    uan: initial?.uan || '',
    pf_number: initial?.pf_number || '',
    esi_number: initial?.esi_number || '',
    tax_regime: initial?.tax_regime || 'NEW',
    tax_resident: initial?.tax_resident === true ? 'true' : initial?.tax_resident === false ? 'false' : '',
    effective_from: today(),
    is_active: initial?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(Boolean(initial?.id));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initial && !employeeId) {
      getPayrollEmployees()
        .then(setEmployees)
        .catch(() => {});
    }
    if (initial?.id) {
      setLoadingProfile(true);
      getProfile(initial.id).then(({ data }) => {
        setForm((current) => ({
          ...current,
          tax_regime: data.tax_regime || initial.tax_regime || 'NEW',
          bank_name: data.bank_name || initial.bank_name || '',
          ifsc_code: (data.ifsc_code || initial.ifsc_code || '').trim().toUpperCase(),
          account_holder_name: data.account_holder_name || initial.account_holder_name || '',
          tax_resident: data.tax_resident === true ? 'true' : data.tax_resident === false ? 'false' : '',
        }));
      }).catch((err: any) => {
        const data = err?.response?.data;
        const message = data && typeof data === 'object'
          ? Object.values(data).flatMap((value: any) => Array.isArray(value) ? value : [value]).join(' ')
          : 'Could not load the saved profile details.';
        setError(String(message || 'Could not load the saved profile details.'));
      }).finally(() => setLoadingProfile(false));
    }
  }, [initial?.id, employeeId]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedIfsc = form.ifsc_code.trim().toUpperCase();
    if (normalizedIfsc && normalizedIfsc.length !== 11) {
      setError(`IFSC must contain exactly 11 characters (currently ${normalizedIfsc.length}).`);
      return;
    }
    if (normalizedIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizedIfsc)) {
      setError('IFSC format: 4 letters, then 0, then 6 letters or digits (for example ABCD0123456).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: any = { ...form, ifsc_code: normalizedIfsc };
      payload.tax_resident = form.tax_resident === '' ? null : form.tax_resident === 'true';
      // Don't send empty encrypted fields on update (avoids overwriting)
      if (initial) {
        for (const field of ['bank_account', 'pan', 'uan', 'pf_number', 'esi_number']) {
          if (!payload[field]) delete payload[field];
        }
      }
      if (!payload.effective_from) delete payload.effective_from;

      if (initial) {
        await updateProfile(initial.id, payload);
      } else {
        await createProfile(payload);
      }
      onSaved();
    } catch (err: any) {
      const data = err?.response?.data;
      const messages = data && typeof data === 'object'
        ? Object.entries(data).flatMap(([field, value]) => (Array.isArray(value) ? value : [value]).map((message) => `${field}: ${String(message)}`))
        : [];
      setError(messages.join('\n') || (typeof data === 'string' ? data : 'Save failed.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
        <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-4 flex shrink-0 items-center justify-between bg-white px-6 pb-3 pt-6">
          <h3 className="text-lg font-semibold text-gray-900">{initial ? 'Edit Employee Tax & Bank Profile' : 'New Employee Tax & Bank Profile'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition">
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {error && <div className="mb-4 shrink-0 whitespace-pre-line rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {!initial && employeeId && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Employee</label>
              <div className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-700">{employeeLabel || employeeId}</div>
            </div>
          )}
          {!initial && !employeeId && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Employee *</label>
              <SearchableSelect
                className={inputCls}
                value={form.employee}
                options={employees.map((emp: any) => ({
                  value: emp.id,
                  label: `${emp.employee_id} — ${emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()}`,
                }))}
                placeholder="Search employee ID or name…"
                required
                noOptionsMessage="No employees match your search."
                onChange={(employeeId) => set('employee', employeeId)}
              />
            </div>
          )}

          <section className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
            <h4 className="text-sm font-semibold text-purple-900">Income tax settings</h4>
            <p className="mt-1 text-xs text-purple-800">Payroll uses the selected regime to find the matching effective TDS rule. Resident status controls resident-only tax rebates. Set Effective From below to a date on or before the payroll month you want this profile to apply to.</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Tax regime *</label>
                <select required className={inputCls} value={form.tax_regime} onChange={(e) => set('tax_regime', e.target.value)}>
                  <option value="NEW">New Regime</option>
                  <option value="OLD">Old Regime</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Indian tax resident status</label>
                <select className={inputCls} value={form.tax_resident} onChange={(e) => set('tax_resident', e.target.value)}>
                  <option value="">Not confirmed</option>
                  <option value="true">Resident</option>
                  <option value="false">Non-resident</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">If a rule grants a resident-only rebate, it is not applied until Resident is confirmed.</p>
              </div>
            </div>
          </section>

          {loadingProfile && <p className="text-sm text-gray-500">Loading saved bank details…</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Bank Name</label>
              <input className={inputCls} value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} placeholder="HDFC Bank" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">IFSC Code</label>
              <input className={inputCls} value={form.ifsc_code} onChange={(e) => set('ifsc_code', e.target.value.trim().toUpperCase())} placeholder="ABCD0123456" maxLength={11} aria-describedby="ifsc-format-help" />
              <p id="ifsc-format-help" className="mt-1 text-xs text-gray-500">11 characters: 4 letters, then 0, then 6 letters or digits.</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Bank Account {initial ? '(leave blank to keep existing)' : '*'}
            </label>
            {initial?.masked_account && <p className="mb-1 text-xs text-gray-500">Saved account: {initial.masked_account}. The full number is hidden; leave this blank to keep it, or enter a replacement number.</p>}
            <input className={inputCls} value={form.bank_account} onChange={(e) => set('bank_account', e.target.value)} placeholder={initial?.masked_account ? 'Leave blank to keep the saved account' : 'Enter account number'} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Account Holder Name</label>
            <input className={inputCls} value={form.account_holder_name} onChange={(e) => set('account_holder_name', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                PAN {initial ? '(leave blank to keep)' : ''}
              </label>
              <input className={inputCls} value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">UAN</label>
              <input className={inputCls} value={form.uan} onChange={(e) => set('uan', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">PF Number</label>
              <input className={inputCls} value={form.pf_number} onChange={(e) => set('pf_number', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">ESI Number</label>
              <input className={inputCls} value={form.esi_number} onChange={(e) => set('esi_number', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Effective From</label>
              <input type="date" className={inputCls} value={form.effective_from} onChange={(e) => set('effective_from', e.target.value)} />
              <p className="mt-1 text-xs text-gray-500">The profile and tax regime are selected as of the payroll period end date.</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Active
          </label>

          <div className="sticky bottom-0 -mx-1 flex justify-end gap-3 bg-white py-3">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
            <button type="submit" disabled={saving || loadingProfile} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
