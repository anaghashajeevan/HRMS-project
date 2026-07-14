import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  ClipboardList,
  BarChart3,
  Settings,
  Building2,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Employees', icon: Users, to: '/employees' },
  { label: 'Attendance', icon: Calendar, to: '/attendance' },
  { label: 'Leave', icon: ClipboardList, to: '/leave' },
  { label: 'Payroll', icon: DollarSign, to: '/payroll' },
  { label: 'Reports', icon: BarChart3, to: '/reports' },
  { label: 'Organization', icon: Building2, to: '/organization' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white md:block">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
          <Building2 className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold text-gray-900">HRMS</span>
      </div>

      <nav className="space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}