import { useState } from 'react';
import { seedDefaults } from '../../../api/payrollApi';

export default function PayrollSettingsPage() {
  const [seeding, setSeeding] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSeed = async () => {
    setSeeding(true);
    setMsg('');
    try {
      const res = await seedDefaults();
      setMsg(JSON.stringify(res.data));
    } catch (err: any) {
      setMsg(JSON.stringify(err?.response?.data) || 'Failed.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Payroll Settings</h2>
        <p className="text-sm text-gray-500">One-time setup and data seeding.</p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Seed Default Components & Rules</h3>
          <p className="text-sm text-gray-500 mt-1">
            Creates standard salary components (Basic, HRA, PF, ESI, etc.) and statutory rules.
            Safe to run multiple times — existing items are skipped.
          </p>
        </div>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition"
        >
          {seeding ? 'Seeding…' : 'Seed Defaults'}
        </button>
        {msg && (
          <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100 text-sm text-gray-700 font-mono whitespace-pre-wrap">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}