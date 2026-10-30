import { NavLink, Outlet } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import {
  Cog6ToothIcon,
  CurrencyRupeeIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  BanknotesIcon,
  PlayCircleIcon,
  CalculatorIcon,
  DocumentTextIcon,
  ArrowRightStartOnRectangleIcon,
  ClockIcon,
  DocumentMagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const tabs = [
  { to: '/payroll/components', label: 'Components', icon: Cog6ToothIcon },
  { to: '/payroll/structures', label: 'Structures', icon: CalculatorIcon },
  { to: '/payroll/statutory', label: 'Statutory Rules', icon: BanknotesIcon },
  { to: '/payroll/calendar', label: 'Pay Calendar', icon: CalendarDaysIcon },
  { to: '/payroll/assignments', label: 'Assignments', icon: UserGroupIcon },
  { to: '/payroll/arrears', label: 'Arrears', icon: ClockIcon },
  { to: '/payroll/profiles', label: 'Tax & Bank Profiles', icon: CurrencyRupeeIcon },
  { to: '/payroll/preview', label: 'Calculation Preview', icon: DocumentMagnifyingGlassIcon },
  { to: '/payroll/runs', label: 'Pay Runs', icon: PlayCircleIcon },
  { to: '/payroll/exits', label: 'Employee Exits', icon: ArrowRightStartOnRectangleIcon },
  { to: '/payroll/statutory-exports', label: 'PF & ESI Exports', icon: DocumentTextIcon },
];

export default function PayrollLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-6 overflow-x-auto px-1" aria-label="Payroll tabs">
                {tabs.map((t) => (
                  <NavLink
                    key={t.to}
                    to={t.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition ${
                        isActive
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`
                    }
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
