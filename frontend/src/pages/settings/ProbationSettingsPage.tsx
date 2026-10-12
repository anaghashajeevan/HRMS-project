import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2, Clock } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { positionsApi, probationPoliciesApi, structuresApi } from '../../api/masterData';
import type { CompanyStructure, JobPosition, ProbationPolicy } from '../../types/masterData';
import toast from 'react-hot-toast';

export default function ProbationSettingsPage() {
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [departments, setDepartments] = useState<CompanyStructure[]>([]);
  const [policies, setPolicies] = useState<ProbationPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [months, setMonths] = useState(6);
  const [leadDays, setLeadDays] = useState(7);
  const [edits, setEdits] = useState<Record<string, { months: number; leadDays: number }>>({});

  const availableDepartments = useMemo(() => departments.filter((item) => item.is_active && ['DEPARTMENT', 'TEAM'].includes(item.type)), [departments]);

  const load = async () => {
    setLoading(true);
    try {
      const [positionData, policyData, structureData] = await Promise.all([
        positionsApi.list(), probationPoliciesApi.list(), structuresApi.list(),
      ]);
      setPositions(positionData.results || []);
      setDepartments(structureData.results || []);
      setPolicies(policyData.results || []);
      setEdits(Object.fromEntries((policyData.results || []).map((item) => [item.id, {
        months: item.probation_months, leadDays: item.reminder_days_before,
      }])));
    } catch {
      toast.error('Failed to load probation settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const addPolicy = async () => {
    if (!position || months < 1 || leadDays < 1) return;
    setSaving(true);
    try {
      await probationPoliciesApi.create({ department, position, probation_months: months, reminder_days_before: leadDays });
      toast.success('Probation policy added');
      setPosition('');
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.position?.[0] || 'Could not add probation policy');
    } finally {
      setSaving(false);
    }
  };

  const savePolicy = async (policy: ProbationPolicy) => {
    const value = edits[policy.id];
    if (!value || value.months < 1 || value.leadDays < 1) return;
    setSaving(true);
    try {
      await probationPoliciesApi.update(policy.id, {
        probation_months: value.months, reminder_days_before: value.leadDays,
      });
      toast.success('Probation policy updated');
      await load();
    } catch {
      toast.error('Could not update probation policy');
    } finally {
      setSaving(false);
    }
  };

  const removePolicy = async (policy: ProbationPolicy) => {
    if (!window.confirm(`Remove probation policy for ${policy.department_name} / ${policy.position_name}?`)) return;
    try {
      await probationPoliciesApi.delete(policy.id);
      toast.success('Probation policy removed');
      await load();
    } catch {
      toast.error('Could not remove probation policy');
    }
  };

  const numberInput = 'w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm';

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center gap-3">
            <Clock className="h-7 w-7 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Probation Settings</h1>
              <p className="mt-1 text-sm text-gray-600">Set probation length and the one-time reminder lead time by department and position.</p>
            </div>
          </div>

          {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div> : (
            <div className="max-w-5xl space-y-6">
              <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 font-semibold text-gray-900">Add a policy</h2>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="min-w-52 flex-1 text-sm text-gray-700">Department
                    <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={department} onChange={(e) => setDepartment(e.target.value)}>
                      <option value="">Select department</option>
                      {availableDepartments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="min-w-52 flex-1 text-sm text-gray-700">Position
                    <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={position} onChange={(e) => setPosition(e.target.value)}>
                      <option value="">Select position</option>
                      {positions.filter((item) => item.is_active).map((item) => <option value={item.id} key={item.id}>{item.title} ({item.grade_band}) · {item.department_name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm text-gray-700">Probation (months)<input type="number" min={1} max={60} className={`${numberInput} mt-1 block`} value={months} onChange={(e) => setMonths(Number(e.target.value))} /></label>
                  <label className="text-sm text-gray-700">Reminder (days before)<input type="number" min={1} max={365} className={`${numberInput} mt-1 block`} value={leadDays} onChange={(e) => setLeadDays(Number(e.target.value))} /></label>
                  <button disabled={saving || !department || !position || policies.some((item) => item.department === department && item.position === position)} onClick={addPolicy} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" />Add policy</button>
                </div>
                {availableDepartments.length === 0 && <p className="mt-3 text-sm text-gray-500">No active departments or positions are configured.</p>}
              </section>

              <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <h2 className="border-b border-gray-100 px-5 py-4 font-semibold text-gray-900">Configured policies</h2>
                {policies.length === 0 ? <p className="p-5 text-sm text-gray-500">No probation policies configured.</p> : (
                  <div className="divide-y divide-gray-100">
                    {policies.map((policy) => <div key={policy.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                      <div className="min-w-56 flex-1"><p className="font-medium text-gray-900">{policy.position_name}</p><p className="text-sm text-gray-500">{policy.department_name}</p></div>
                      <label className="text-sm text-gray-600">Probation months<input type="number" min={1} max={60} className={`${numberInput} mt-1 block`} value={edits[policy.id]?.months ?? policy.probation_months} onChange={(e) => setEdits((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], months: Number(e.target.value) } }))} /></label>
                      <label className="text-sm text-gray-600">Reminder days before<input type="number" min={1} max={365} className={`${numberInput} mt-1 block`} value={edits[policy.id]?.leadDays ?? policy.reminder_days_before} onChange={(e) => setEdits((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], leadDays: Number(e.target.value) } }))} /></label>
                      <button disabled={saving} onClick={() => savePolicy(policy)} className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50" title="Save"><Save className="h-4 w-4" /></button>
                      <button disabled={saving} onClick={() => removePolicy(policy)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" title="Remove"><Trash2 className="h-4 w-4" /></button>
                    </div>)}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
