import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Plus, ArrowRight, Search, FileText, Users, X,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { annualPlansApi } from '../../api/performance';
import { employeesApi, type ManagerOption } from '../../api/employees';
import type { AnnualPerformancePlanListItem } from '../../types/performance';
import toast from 'react-hot-toast';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-emerald-100 text-emerald-800',
};

const FY_OPTIONS = ['2026-27', '2025-26', '2024-25'];

export default function AnnualPlansDirectoryPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<AnnualPerformancePlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFY, setSelectedFY] = useState('2026-27');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await annualPlansApi.list({ financial_year: selectedFY });
      setPlans(data);
    } catch (err) {
      toast.error('Failed to load annual plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [selectedFY]);

  const filteredPlans = plans.filter((p) =>
    p.employee_name.toLowerCase().includes(search.toLowerCase()) ||
    p.employee_id_display.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Annual Performance Plans</h1>
              <p className="text-sm text-gray-500">Manage annual plans for all employees. Generate new plans and view existing ones.</p>
            </div>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Generate New Plan
            </button>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee name or ID..."
                className="w-full rounded-xl border border-gray-200 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {FY_OPTIONS.map((fy) => (
                <option key={fy} value={fy}>FY {fy}</option>
              ))}
            </select>
            <div className="text-xs text-gray-500">
              <Users className="inline h-3 w-3" /> {filteredPlans.length} plans
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm border">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 font-semibold text-gray-900">No Annual Plans for FY {selectedFY}</p>
              <p className="text-sm text-gray-500 mt-1">Click "Generate New Plan" to create the first one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => navigate(`/performance/annual-plans/${plan.id}`)}
                  className="cursor-pointer rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-indigo-300 transition-all"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[plan.status]}`}>
                      {plan.status_display}
                    </span>
                    <span className="text-xs font-bold text-gray-500">FY {plan.financial_year}</span>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-bold text-gray-900 text-lg">{plan.employee_name}</h3>
                    <p className="text-xs text-gray-500">{plan.employee_id_display}</p>
                  </div>

                  {plan.annual_score && (
                    <div className="mt-3 rounded-xl bg-emerald-50 p-2 text-center">
                      <span className="text-xs text-gray-600">Annual Score:</span>
                      <span className="ml-2 font-bold text-emerald-700 text-lg">{plan.annual_score}%</span>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end text-xs font-bold text-indigo-600">
                    View Plan <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {showGenerateModal && (
            <GeneratePlanModal
              onClose={() => setShowGenerateModal(false)}
              onSuccess={() => {
                setShowGenerateModal(false);
                loadPlans();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// GENERATE PLAN MODAL
// ==============================================================================

function GeneratePlanModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [employees, setEmployees] = useState<ManagerOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [financialYear, setFinancialYear] = useState('2026-27');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    employeesApi.getManagers(search).then((data) => {
      setEmployees(data);
      setLoading(false);
    });
  }, [search]);

  const handleGenerate = async () => {
    if (!selectedEmployeeId) return toast.error('Please select an employee');
    setGenerating(true);
    try {
      const plan = await annualPlansApi.generate({
        employee_id: selectedEmployeeId,
        financial_year: financialYear,
      });
      toast.success(`Annual Plan generated for FY ${financialYear}!`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b pb-3">
          <h3 className="font-bold text-lg text-gray-900">Generate Annual Plan</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase">Financial Year</label>
            <select
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-xl p-2.5 text-sm"
            >
              {FY_OPTIONS.map((fy) => <option key={fy} value={fy}>FY {fy}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 uppercase">Select Employee</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-2.5 pl-10 text-sm"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-indigo-600" />
            ) : employees.length === 0 ? (
              <p className="text-xs text-center text-gray-400 py-4">No employees found</p>
            ) : (
              employees.map((emp) => (
                <label
                  key={emp.id}
                  className={`flex items-center gap-3 rounded-lg p-2 cursor-pointer text-xs ${
                    selectedEmployeeId === emp.id ? 'bg-indigo-50 border border-indigo-300' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="employee"
                    checked={selectedEmployeeId === emp.id}
                    onChange={() => setSelectedEmployeeId(emp.id)}
                    className="text-indigo-600"
                  />
                  <div>
                    <p className="font-bold text-gray-900">{emp.full_name}</p>
                    <p className="text-gray-500">{emp.employee_id}</p>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800 border border-blue-100">
            <strong>Auto-Injection:</strong> When you generate this plan, the system will automatically:
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Create 12 monthly plans (April to March)</li>
              <li>Add all Common KRAs from Master</li>
              <li>Add Departmental KRAs for employee's dept</li>
              <li>Create 4 quarterly review checkpoints</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-xl text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedEmployeeId}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}