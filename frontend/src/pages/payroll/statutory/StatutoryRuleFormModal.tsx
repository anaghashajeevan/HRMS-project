import { useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { createStatutoryRule, updateStatutoryRule } from '../../../api/payrollApi';

const inputCls =
  'block w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500 transition';
const TYPES = ['PF', 'ESI', 'PT', 'TDS', 'GRATUITY'];
const REGIMES = ['ALL', 'OLD', 'NEW'];

type Band = { min: string; max: string; rate: string };
type TdsConfig = {
  slabs: Band[];
  standardDeduction: string;
  rebateEnabled: boolean;
  rebateThreshold: string;
  rebateMaximum: string;
  residentOnly: boolean;
  marginalRelief: boolean;
  surchargeEnabled: boolean;
  surcharge: Band[];
  surchargeCap: string;
  cessRate: string;
  ageBandsEnabled: boolean;
  seniorSlabs: Band[];
  superSeniorSlabs: Band[];
};

const emptyBand = (): Band => ({ min: '', max: '', rate: '' });
const emptyBands = (): Band[] => [emptyBand()];

const emptyTdsConfig = (): TdsConfig => ({
  slabs: emptyBands(),
  standardDeduction: '',
  rebateEnabled: false,
  rebateThreshold: '',
  rebateMaximum: '',
  residentOnly: false,
  marginalRelief: false,
  surchargeEnabled: false,
  surcharge: emptyBands(),
  surchargeCap: '',
  cessRate: '',
  ageBandsEnabled: false,
  seniorSlabs: emptyBands(),
  superSeniorSlabs: emptyBands(),
});

function bandsFromJson(value: any): Band[] {
  if (!Array.isArray(value) || value.length === 0) return emptyBands();
  return value.map((band: any) => ({
    min: String(band.min ?? 0),
    max: band.max == null ? '' : String(band.max),
    rate: String(band.rate ?? 0),
  }));
}

function configFromJson(payload: any): TdsConfig {
  const defaults = emptyTdsConfig();
  if (!payload || Array.isArray(payload)) return defaults;
  return {
    ...defaults,
    slabs: bandsFromJson(payload.slabs),
    standardDeduction: payload.standard_deduction == null ? '' : String(payload.standard_deduction),
    rebateEnabled: Boolean(payload.rebate),
    rebateThreshold: payload.rebate?.threshold == null ? '' : String(payload.rebate.threshold),
    rebateMaximum: payload.rebate?.max_amount == null ? '' : String(payload.rebate.max_amount),
    residentOnly: payload.rebate?.resident_only ?? false,
    marginalRelief: payload.rebate?.marginal_relief ?? false,
    surchargeEnabled: Array.isArray(payload.surcharge) && payload.surcharge.length > 0,
    surcharge: bandsFromJson(payload.surcharge),
    surchargeCap: payload.surcharge_cap_rate == null ? '' : String(payload.surcharge_cap_rate),
    cessRate: payload.cess_rate == null ? '' : String(payload.cess_rate),
    ageBandsEnabled: Boolean(payload.age_slabs),
    seniorSlabs: bandsFromJson(payload.age_slabs?.senior),
    superSeniorSlabs: bandsFromJson(payload.age_slabs?.super_senior),
  };
}

interface Props {
  initial: any | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StatutoryRuleFormModal({ initial, onClose, onSaved }: Props) {
  const initialRegime = initial?.tax_regime === 'OLD' || initial?.tax_regime === 'NEW'
    ? initial.tax_regime
    : initial?.statutory_type === 'TDS' ? 'NEW' : 'ALL';
  const [form, setForm] = useState({
    statutory_type: initial?.statutory_type || 'PF',
    name: initial?.name || '',
    jurisdiction: initial?.jurisdiction || 'ALL',
    tax_regime: initialRegime,
    employee_rate: initial?.employee_rate || '',
    employer_rate: initial?.employer_rate || '',
    employer_pension_rate: initial?.employer_pension_rate ?? '8.33',
    wage_ceiling: initial?.wage_ceiling || '',
    threshold: initial?.threshold || '',
    slabs: initial?.slabs ? JSON.stringify(initial.slabs, null, 2) : '',
    effective_from: initial?.effective_from || '',
    effective_to: initial?.effective_to || '',
    is_active: initial?.is_active ?? true,
  });
  const [tds, setTds] = useState<TdsConfig>(() => configFromJson(initial?.slabs));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const setTdsValue = (key: keyof TdsConfig, value: any) => setTds((current) => ({ ...current, [key]: value }));
  const updateBand = (key: 'slabs' | 'surcharge' | 'seniorSlabs' | 'superSeniorSlabs', index: number, field: keyof Band, value: string) => {
    setTds((current) => ({
      ...current,
      [key]: current[key].map((band, bandIndex) => bandIndex === index ? { ...band, [field]: value } : band),
    }));
  };
  const addBand = (key: 'slabs' | 'surcharge' | 'seniorSlabs' | 'superSeniorSlabs') => {
    setTds((current) => {
      const bands = current[key];
      return {
        ...current,
        [key]: [...bands, emptyBand()],
      };
    });
  };
  const removeBand = (key: 'slabs' | 'surcharge' | 'seniorSlabs' | 'superSeniorSlabs', index: number) => {
    setTds((current) => ({ ...current, [key]: current[key].filter((_, bandIndex) => bandIndex !== index) }));
  };

  const handleTypeChange = (type: string) => {
    setForm((current) => ({
      ...current,
      statutory_type: type,
      tax_regime: type === 'TDS' ? (current.tax_regime === 'OLD' ? 'OLD' : 'NEW') : current.tax_regime,
    }));
  };

  const handleRegimeChange = (regime: string) => {
    setForm((current) => ({ ...current, tax_regime: regime }));
    if (regime === 'OLD' || regime === 'NEW') setTds(emptyTdsConfig());
  };

  const asApiBands = (bands: Band[]) => bands.map((band) => ({
    min: Number(band.min || 0),
    max: band.max.trim() === '' ? null : Number(band.max),
    rate: Number(band.rate || 0),
  }));

  const validateBands = (title: string, bands: Band[], requireStartAtZero = true) => {
    if (bands.length === 0) return `${title} needs at least one band.`;
    for (let index = 0; index < bands.length; index += 1) {
      const band = bands[index];
      const min = Number(band.min);
      const rate = Number(band.rate);
      const max = band.max.trim() === '' ? null : Number(band.max);
      if (band.min.trim() === '' || band.rate.trim() === '' || !Number.isFinite(min) || min < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) {
        return `${title}, band ${index + 1}: enter non-negative limits and a rate from 0 to 100.`;
      }
      if (max !== null && (!Number.isFinite(max) || max <= min)) {
        return `${title}, band ${index + 1}: the upper limit must be greater than the lower limit.`;
      }
      if (index < bands.length - 1 && max === null) {
        return `${title}: only the final band can have no upper limit.`;
      }
      if (index > 0 && min !== Number(bands[index - 1].max)) {
        return `${title}: each band must start where the previous band ends.`;
      }
    }
    if (requireStartAtZero && Number(bands[0].min) !== 0) return `${title}: the first band must start at ₹0.`;
    if (bands[bands.length - 1].max.trim() !== '') return `${title}: leave the final upper limit blank for no upper limit.`;
    return '';
  };

  const buildTdsPayload = () => {
    const slabs: Record<string, any> = {
      slabs: asApiBands(tds.slabs),
      standard_deduction: Number(tds.standardDeduction || 0),
      ...(tds.rebateEnabled ? { rebate: {
        threshold: Number(tds.rebateThreshold || 0),
        max_amount: Number(tds.rebateMaximum || 0),
        resident_only: tds.residentOnly,
        marginal_relief: tds.marginalRelief,
      } } : {}),
      surcharge: tds.surchargeEnabled ? asApiBands(tds.surcharge) : [],
      cess_rate: Number(tds.cessRate || 0),
    };
    if (tds.surchargeCap !== '') slabs.surcharge_cap_rate = Number(tds.surchargeCap);
    if (form.tax_regime === 'OLD' && tds.ageBandsEnabled) {
      slabs.age_slabs = {
        senior: asApiBands(tds.seniorSlabs),
        super_senior: asApiBands(tds.superSeniorSlabs),
      };
    }
    return slabs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.statutory_type === 'TDS') {
      if (form.tax_regime !== 'OLD' && form.tax_regime !== 'NEW') {
        setError('Choose either the Old or New tax regime for a TDS rule.');
        return;
      }
      const bandError = validateBands('Income tax bands', tds.slabs)
        || (!tds.standardDeduction.trim() || !Number.isFinite(Number(tds.standardDeduction)) || Number(tds.standardDeduction) < 0 ? 'Enter a valid standard deduction (use 0 if it does not apply).' : '')
        || (!tds.cessRate.trim() || !Number.isFinite(Number(tds.cessRate)) || Number(tds.cessRate) < 0 ? 'Enter a valid cess rate (use 0 if it does not apply).' : '')
        || (tds.rebateEnabled && (!tds.rebateThreshold.trim() || !tds.rebateMaximum.trim() || !Number.isFinite(Number(tds.rebateThreshold)) || !Number.isFinite(Number(tds.rebateMaximum)) || Number(tds.rebateThreshold) < 0 || Number(tds.rebateMaximum) < 0) ? 'Enter a valid rebate income limit and maximum rebate, or turn rebate off.' : '')
        || (form.tax_regime === 'OLD' && tds.ageBandsEnabled && validateBands('Senior citizen bands', tds.seniorSlabs))
        || (form.tax_regime === 'OLD' && tds.ageBandsEnabled && validateBands('Super senior citizen bands', tds.superSeniorSlabs))
        || (tds.surchargeEnabled && validateBands('Surcharge bands', tds.surcharge, false));
      if (bandError) {
        setError(bandError);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        ...form,
        employee_rate: form.statutory_type === 'TDS' ? '0' : form.employee_rate || null,
        employer_rate: form.statutory_type === 'TDS' ? '0' : form.employer_rate || null,
        employer_pension_rate: form.statutory_type === 'TDS' ? '0' : form.employer_pension_rate || null,
        wage_ceiling: form.statutory_type === 'TDS' ? '0' : form.wage_ceiling || null,
        threshold: form.statutory_type === 'TDS' ? '0' : form.threshold || '0',
        effective_to: form.effective_to || null,
        slabs: form.statutory_type === 'TDS' ? buildTdsPayload() : form.slabs ? JSON.parse(form.slabs) : [],
      };
      if (initial) await updateStatutoryRule(initial.id, payload);
      else await createStatutoryRule(payload);
      onSaved();
    } catch (err: any) {
      if (err instanceof SyntaxError) setError('Invalid JSON in slabs field.');
      else setError(JSON.stringify(err?.response?.data) || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const renderBands = (title: string, key: 'slabs' | 'surcharge' | 'seniorSlabs' | 'superSeniorSlabs', description: string) => (
    <section className="space-y-2 rounded-xl border border-gray-200 p-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(3.5rem,0.7fr)_auto] gap-1 px-1 text-[11px] font-medium text-gray-500 sm:gap-2">
        <span>From (₹)</span><span>Up to (₹)</span><span>Rate (%)</span><span />
      </div>
      {tds[key].map((band, index) => (
        <div key={`${key}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(3.5rem,0.7fr)_auto] gap-1 sm:gap-2">
          <input aria-label={`${title} band ${index + 1} minimum`} type="number" min="0" className={`${inputCls} min-w-0 px-2 sm:px-4`} value={band.min} onChange={(e) => updateBand(key, index, 'min', e.target.value)} />
          <input aria-label={`${title} band ${index + 1} maximum`} type="number" min="0" placeholder="No limit" className={`${inputCls} min-w-0 px-2 sm:px-4`} value={band.max} onChange={(e) => updateBand(key, index, 'max', e.target.value)} />
          <input aria-label={`${title} band ${index + 1} rate`} type="number" min="0" max="100" step="0.01" className={`${inputCls} min-w-0 px-2 sm:px-4`} value={band.rate} onChange={(e) => updateBand(key, index, 'rate', e.target.value)} />
          <button type="button" aria-label={`Remove ${title} band ${index + 1}`} onClick={() => removeBand(key, index)} disabled={tds[key].length <= 1} className="rounded-lg px-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">×</button>
        </div>
      ))}
      <button type="button" onClick={() => addBand(key)} className="text-xs font-medium text-blue-700 hover:text-blue-900">+ Add tax band</button>
    </section>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex h-[100dvh] items-start justify-center overflow-hidden bg-black/40 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex w-full max-w-2xl min-w-0 min-h-0 max-h-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-100">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
          <h3 className="text-lg font-semibold text-gray-900">{initial ? 'Edit Rule' : 'New Rule'}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition"><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-gray-600">Rule type *</label><select className={inputCls} value={form.statutory_type} onChange={(e) => handleTypeChange(e.target.value)}>{TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-gray-600">Rule name *</label><input required className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={form.statutory_type === 'TDS' ? 'TDS New Regime 2026–27' : 'PF Standard 2026'} /></div>
          </div>

          {form.statutory_type === 'PF' && <div><label className="mb-1 block text-xs font-medium text-gray-600">Employer EPS share (%)</label><input type="number" step="0.001" className={inputCls} value={form.employer_pension_rate} onChange={(e) => set('employer_pension_rate', e.target.value)} /><p className="mt-1 text-xs text-gray-500">The remaining employer PF contribution is allocated to EPF.</p></div>}

          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-gray-600">Jurisdiction</label><input className={inputCls} value={form.jurisdiction} onChange={(e) => set('jurisdiction', e.target.value)} placeholder="ALL / KARNATAKA" /></div>
            <div><label className="mb-1 block text-xs font-medium text-gray-600">Tax regime</label><select className={inputCls} value={form.tax_regime} onChange={(e) => form.statutory_type === 'TDS' ? handleRegimeChange(e.target.value) : set('tax_regime', e.target.value)}>{REGIMES.map((regime) => <option key={regime} value={regime}>{regime === 'ALL' && form.statutory_type === 'TDS' ? 'Choose a regime' : regime}</option>)}</select></div>
          </div>

          {form.statutory_type === 'TDS' ? (
            <>
              <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">TDS does not use employee or employer contribution rates, a wage ceiling, or the separate threshold field. These are saved as zero. Use the guided tax bands and rebate settings below.</div>
              <div className="rounded-xl border border-gray-200 p-3">
                <h4 className="mb-2 text-sm font-semibold text-gray-800">Standard deduction and rebate</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="min-w-0 text-xs text-gray-600">Standard deduction<input type="number" min="0" className={`${inputCls} mt-1`} value={tds.standardDeduction} onChange={(e) => setTdsValue('standardDeduction', e.target.value)} placeholder="Enter amount; use 0 if none" /></label>
                  <label className="min-w-0 text-xs text-gray-600">Health and education cess (%)<input type="number" min="0" max="100" step="0.01" className={`${inputCls} mt-1`} value={tds.cessRate} onChange={(e) => setTdsValue('cessRate', e.target.value)} placeholder="Enter rate; use 0 if none" /></label>
                </div>
                <div className="mt-3 space-y-3 text-xs text-gray-700">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={tds.rebateEnabled} onChange={(e) => setTdsValue('rebateEnabled', e.target.checked)} /> This rule includes a tax rebate</label>
                  {tds.rebateEnabled && <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="min-w-0 text-xs text-gray-600">Maximum total income for rebate<input type="number" min="0" className={`${inputCls} mt-1`} value={tds.rebateThreshold} onChange={(e) => setTdsValue('rebateThreshold', e.target.value)} /></label>
                      <label className="min-w-0 text-xs text-gray-600">Maximum rebate amount<input type="number" min="0" className={`${inputCls} mt-1`} value={tds.rebateMaximum} onChange={(e) => setTdsValue('rebateMaximum', e.target.value)} /></label>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={tds.residentOnly} onChange={(e) => setTdsValue('residentOnly', e.target.checked)} /> Resident taxpayers only</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={tds.marginalRelief} onChange={(e) => setTdsValue('marginalRelief', e.target.checked)} /> Apply marginal relief above rebate limit</label>
                    </div>
                  </>}
                </div>
              </div>
              {renderBands('Income tax bands', 'slabs', 'Tax is applied progressively to the income falling within each band. Leave “Up to” blank for the final open-ended band.')}
              {form.tax_regime === 'OLD' && <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                <div><h4 className="text-sm font-semibold text-gray-800">Optional age-based bands</h4><p className="text-xs text-gray-500">Enable only when your rule has separate rates for resident employees aged 60 or older.</p></div>
                <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={tds.ageBandsEnabled} onChange={(e) => setTdsValue('ageBandsEnabled', e.target.checked)} /> Configure age-based bands</label>
                {tds.ageBandsEnabled && <div className="space-y-3">{renderBands('Senior citizen (age 60 to 79)', 'seniorSlabs', 'Enter progressive bands for this age group.')}{renderBands('Super senior citizen (age 80+)', 'superSeniorSlabs', 'Enter progressive bands for this age group.')}</div>}
              </section>}
              <section className="space-y-3 rounded-xl border border-gray-200 p-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800"><input type="checkbox" checked={tds.surchargeEnabled} onChange={(e) => setTdsValue('surchargeEnabled', e.target.checked)} /> Configure surcharge for high annual incomes</label>
                {tds.surchargeEnabled && <>{renderBands('Surcharge bands', 'surcharge', 'Surcharge rate is applied to calculated income tax when income reaches a band. Leave the last “Up to” blank if there is no upper limit.')}<label className="block max-w-xs text-xs text-gray-600">Maximum surcharge cap (%) — optional<input type="number" min="0" max="100" step="0.01" className={`${inputCls} mt-1`} value={tds.surchargeCap} onChange={(e) => setTdsValue('surchargeCap', e.target.value)} placeholder="No special cap" /></label></>}
              </section>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4"><div><label className="mb-1 block text-xs font-medium text-gray-600">Employee rate (%)</label><input type="number" step="0.01" className={inputCls} value={form.employee_rate} onChange={(e) => set('employee_rate', e.target.value)} /></div><div><label className="mb-1 block text-xs font-medium text-gray-600">Employer rate (%)</label><input type="number" step="0.01" className={inputCls} value={form.employer_rate} onChange={(e) => set('employer_rate', e.target.value)} /></div></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="mb-1 block text-xs font-medium text-gray-600">Wage ceiling</label><input type="number" step="0.01" className={inputCls} value={form.wage_ceiling} onChange={(e) => set('wage_ceiling', e.target.value)} /></div><div><label className="mb-1 block text-xs font-medium text-gray-600">Threshold</label><input type="number" step="0.01" className={inputCls} value={form.threshold} onChange={(e) => set('threshold', e.target.value)} /></div></div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4"><div><label className="mb-1 block text-xs font-medium text-gray-600">Effective from *</label><input required type="date" className={inputCls} value={form.effective_from} onChange={(e) => set('effective_from', e.target.value)} /></div><div><label className="mb-1 block text-xs font-medium text-gray-600">Effective to</label><input type="date" className={inputCls} value={form.effective_to} onChange={(e) => set('effective_to', e.target.value)} /></div></div>

          {form.statutory_type !== 'TDS' && <div><label className="mb-1 block text-xs font-medium text-gray-600">Slabs (JSON, for PT)</label><textarea className={`${inputCls} h-24 font-mono text-xs`} value={form.slabs} onChange={(e) => set('slabs', e.target.value)} placeholder="Enter professional tax slabs if applicable" /></div>}

          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />Active</label>
          <div className="sticky bottom-0 -mx-5 flex justify-end gap-3 border-t border-gray-100 bg-white/95 px-5 py-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">{saving ? 'Saving…' : initial ? 'Update' : 'Create'}</button></div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
