import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { onboardingApi, type OnboardingSetupOptions, type OnboardingTask } from '../../api/onboarding';
import { useAuth } from '../../context/AuthContext';
import OnboardingTaskCard from './OnboardingTaskCard';

export default function MyOnboardingTasksPage() {
  const { user } = useAuth();
  const isHr = Boolean(user?.role_codes.some((role) => ['HR_ADMIN', 'SYSTEM_ADMIN'].includes(role)));
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [employees, setEmployees] = useState<OnboardingSetupOptions['employees']>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setTasks(await onboardingApi.tasks()); }
    catch (error: any) { toast.error(error?.response?.data?.detail || 'Could not load onboarding tasks'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!isHr) {
      setEmployees([]);
      return;
    }
    onboardingApi.options()
      .then((options) => setEmployees(options.employees))
      .catch((error: any) => {
        setEmployees([]);
        toast.error(error?.response?.data?.detail || 'Could not load employees for task assignment');
      });
  }, [isHr]);

  return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="min-w-0 flex-1"><Topbar /><div className="mx-auto max-w-5xl space-y-5 p-6"><header className="flex items-start gap-3"><span className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><ClipboardCheck /></span><div><p className="text-sm font-semibold text-indigo-600">Onboarding</p><h1 className="text-2xl font-bold text-slate-900">My onboarding tasks</h1><p className="mt-1 text-sm text-slate-600">Update your assigned tasks and submit requested documents here.</p></div></header>
    {loading ? <div className="flex justify-center rounded-xl border bg-white py-12"><Loader2 className="animate-spin text-indigo-600" /></div> : tasks.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">No onboarding tasks are assigned to you.</div> : <div className="space-y-3">{tasks.map((task) => <OnboardingTaskCard key={task.id} task={task} employees={employees} onChanged={() => void load()} />)}</div>}
  </div></main></div>;
}
