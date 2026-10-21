import { useEffect, useState, useCallback } from 'react';
import { ClockIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getProfileOverview } from '../../../api/payrollApi';
import ProfileFormModal from './ProfileFormModal';

export default function PayrollProfilesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [createForEmployee, setCreateForEmployee] = useState<{ id: string; label: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getProfileOverview(1);
      setItems(data.results || []);
      setTotalEmployees(data.count || 0);
      setNextPage(data.next ? 2 : null);
    } catch (error) {
      console.error('Could not load employee bank profiles', error);
    } finally { setLoading(false); }
  }, []);

  const loadMore = async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await getProfileOverview(nextPage);
      setItems((current) => [...current, ...(data.results || [])]);
      setNextPage(data.next ? nextPage + 1 : null);
    } catch (error) {
      console.error('Could not load more employee bank profiles', error);
    } finally { setLoadingMore(false); }
  };

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Bank & Payroll Profiles</h2>
          <p className="text-sm text-gray-500">One row per employee, including employees without bank profiles. Edit the current details or open History to review previous versions.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No employees found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Bank</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Account Holder</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">IFSC</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Tax Regime</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Version</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((p: any) => (
                  <tr key={p.employee} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <div>{p.employee_name || p.employee}</div>
                      <div className="mt-0.5 font-mono text-xs font-normal text-gray-500">ID: {p.employee_code || p.employee}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.bank_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.account_holder_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{p.masked_account || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.ifsc_code || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex rounded-md px-2 py-1 text-xs font-medium bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200">
                        {p.tax_regime || 'NEW'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className={p.has_current_profile ? 'text-green-700' : 'text-gray-500'}>{p.has_current_profile ? 'Current' : p.has_profile_history ? 'No current profile' : 'No profile'}</span>
                      <div className="mt-0.5 text-xs text-gray-400">
                        {p.effective_from ? `${p.effective_from}${p.effective_to ? ` – ${p.effective_to}` : ' – present'}` : 'Bank profile not created'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.has_current_profile ? <button
                          onClick={() => { setEditing({ ...p, id: p.profile_id, employee: p.employee }); setModalOpen(true); }}
                          title={`Edit current bank profile for ${p.employee_code}`}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"
                        ><PencilSquareIcon className="h-4 w-4" /></button> : <button
                          onClick={() => {
                            setEditing(null);
                            setCreateForEmployee({ id: p.employee, label: `${p.employee_code} — ${p.employee_name}` });
                            setModalOpen(true);
                          }}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >{p.has_profile_history ? 'Add current' : 'Add bank details'}</button>}
                        {p.has_profile_history && <button
                          onClick={() => setHistoryFor(p)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                          title={`View bank profile history for ${p.employee_code}`}
                        ><ClockIcon className="h-4 w-4" />History</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <span className="text-xs text-gray-500">Showing {items.length} of {totalEmployees} employees</span>
            {nextPage && <button onClick={() => void loadMore()} disabled={loadingMore} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-blue-700 ring-1 ring-gray-200 hover:bg-blue-50 disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button>}
          </div>
        )}
      </div>

      {modalOpen && (
        <ProfileFormModal
          initial={editing}
          employeeId={createForEmployee?.id}
          employeeLabel={createForEmployee?.label}
          onClose={() => { setModalOpen(false); setEditing(null); setCreateForEmployee(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); setCreateForEmployee(null); load(); }}
        />
      )}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setHistoryFor(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Bank profile history</h3>
                <p className="mt-1 text-sm text-gray-500">{historyFor.employee_name} · {historyFor.employee_code}</p>
              </div>
              <button onClick={() => setHistoryFor(null)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" aria-label="Close history"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="relative ml-2 border-l-2 border-blue-100 pl-6">
              {(historyFor.history || []).map((version: any, index: number) => (
                <div key={version.id} className="relative mb-5 last:mb-0">
                  <span className={`absolute -left-[31px] top-4 h-3 w-3 rounded-full ring-4 ring-white ${version.is_current ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-gray-800">Version {historyFor.history.length - index}{version.is_current ? ' · Current' : ' · Historical'}</span>
                      <span className="text-xs text-gray-500">{version.effective_from} – {version.effective_to || 'Present'}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <div><span className="text-gray-500">Bank:</span> {version.bank_name || '—'}</div>
                      <div><span className="text-gray-500">Account holder:</span> {version.account_holder_name || '—'}</div>
                      <div><span className="text-gray-500">Account:</span> {version.masked_account || '—'}</div>
                      <div><span className="text-gray-500">IFSC:</span> {version.ifsc_code || '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
