import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, LogOut, RadioTower, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export function AttendanceLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const userRoles = user?.role_codes || [];
  const isSuperuser = userRoles.includes('SYSTEM_ADMIN') || userRoles.includes('HR_ADMIN');

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Logout failed');
    }
  };

  const navLinkClass = (isActive: boolean) =>
    `flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm transition ${
      isActive
        ? 'bg-blue-500/14 font-bold text-blue-200 shadow-[inset_3px_0_0_#3B82F6,0_12px_30px_rgba(37,99,235,0.16)]'
        : 'font-semibold text-slate-400 hover:bg-white/[0.05] hover:text-white'
    }`;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_14%_0%,rgba(37,99,235,0.22),transparent_34rem),radial-gradient(circle_at_88%_10%,rgba(220,38,38,0.14),transparent_30rem),linear-gradient(135deg,#05070D_0%,#070A12_52%,#0B1020_100%)] text-ink">
      <div className="flex min-h-screen w-full min-w-0 flex-col overflow-x-hidden lg:flex-row">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/35 p-5 shadow-[1px_0_0_rgba(255,255,255,0.04),18px_0_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl lg:flex lg:flex-col">
          <a href="/attendance" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#1d4ed8,#3b82f6)] text-sm font-black text-white shadow-[0_16px_42px_rgba(37,99,235,0.34)]">
              EA
            </span>
            <span>
              <span className="block text-sm font-bold text-white">eSSL Attendance</span>
              <span className="block text-xs text-slate-400">Internal Automation</span>
            </span>
          </a>

          <nav className="mt-9 grid gap-1.5" aria-label="Attendance navigation">
            <NavLink to="/attendance" end className={({ isActive }) => navLinkClass(isActive)}>
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </NavLink>
            <NavLink to="/attendance/live" className={({ isActive }) => navLinkClass(isActive)}>
              <RadioTower className="h-4 w-4" aria-hidden="true" />
              Live Dashboard
            </NavLink>
            {isSuperuser && (
              <NavLink to="/attendance/settings" className={({ isActive }) => navLinkClass(isActive)}>
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </NavLink>
            )}
          </nav>

          {/* Back to HRMS + user info */}
          <div className="mt-auto grid gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-semibold text-slate-300 transition hover:bg-blue-500/10 hover:text-blue-200"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to HRMS
            </button>

            <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 shadow-raised backdrop-blur-xl">
              <p className="text-sm font-semibold text-white">
                {user?.employee?.full_name || user?.username}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
              <button
                onClick={handleLogout}
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-blue-300"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl lg:hidden">
          <a href="/attendance" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-xs font-black text-white">EA</span>
            <span>
              <span className="block text-sm font-bold text-white">eSSL Attendance</span>
              <span className="block text-xs text-slate-400">Internal Automation</span>
            </span>
          </a>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm font-semibold text-slate-400"
          >
            ← HRMS
          </button>
        </header>

        {/* Main content — nested routes render here */}
        <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden p-3 sm:p-4 lg:w-[calc(100vw-16rem)] lg:max-w-[calc(100vw-16rem)] lg:p-5 xl:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}