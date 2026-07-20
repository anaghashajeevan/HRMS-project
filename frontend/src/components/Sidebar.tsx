// import { NavLink } from 'react-router-dom';
// import {
//   LayoutDashboard, Users, Calendar, DollarSign,
//   ClipboardList, BarChart3, Settings, Building2,
//   Shield, Briefcase, IdCard,
// } from 'lucide-react';

// const mainNav = [
//   { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
//   { label: 'Employees', icon: Users, to: '/employees' },
//   { label: 'Attendance', icon: Calendar, to: '/attendance' },
//   { label: 'Leave', icon: ClipboardList, to: '/leave' },
//   { label: 'Payroll', icon: DollarSign, to: '/payroll' },
//   { label: 'Reports', icon: BarChart3, to: '/reports' },
// ];

// const settingsNav = [
//   { label: 'Roles', icon: Shield, to: '/settings/roles' },
//   { label: 'Departments', icon: Building2, to: '/settings/departments' },
//   { label: 'Job Positions', icon: Briefcase, to: '/settings/positions' },
//   { label: 'Employee Code', icon: IdCard, to: '/settings/employee-code' },
// ];

// export default function Sidebar() {
//   return (
//     <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white md:block">
//       <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
//         <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
//           <Building2 className="h-5 w-5" />
//         </div>
//         <span className="text-lg font-bold text-gray-900">HRMS</span>
//       </div>

//       <nav className="p-4">
//         <div className="space-y-1">
//           {mainNav.map((item) => (
//             <NavLink
//               key={item.to}
//               to={item.to}
//               className={({ isActive }) =>
//                 `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
//                   isActive
//                     ? 'bg-primary-50 text-primary-700'
//                     : 'text-gray-700 hover:bg-gray-100'
//                 }`
//               }
//             >
//               <item.icon className="h-5 w-5" />
//               {item.label}
//             </NavLink>
//           ))}
//         </div>

//         <div className="mt-6">
//           <div className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase text-gray-400">
//             <Settings className="h-3.5 w-3.5" />
//             Settings
//           </div>
//           <div className="space-y-1">
//             {settingsNav.map((item) => (
//               <NavLink
//                 key={item.to}
//                 to={item.to}
//                 className={({ isActive }) =>
//                   `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
//                     isActive
//                       ? 'bg-primary-50 text-primary-700'
//                       : 'text-gray-700 hover:bg-gray-100'
//                   }`
//                 }
//               >
//                 <item.icon className="h-5 w-5" />
//                 {item.label}
//               </NavLink>
//             ))}
//           </div>
//         </div>
//       </nav>
//     </aside>
//   );
// }

// import { NavLink } from 'react-router-dom';
// import {
//   LayoutDashboard, Users, Calendar, DollarSign,
//   ClipboardList, BarChart3, Settings, Building2,
//   Shield, Briefcase, IdCard,
// } from 'lucide-react';
// import { useAuth } from '../context/AuthContext';

// interface NavItem {
//   label: string;
//   icon: React.ComponentType<{ className?: string }>;
//   to: string;
//   allowedRoles: string[];  // Which roles can see this menu item
// }

// const mainNav: NavItem[] = [
//   {
//     label: 'Dashboard',
//     icon: LayoutDashboard,
//     to: '/dashboard',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//   },
//   {
//     label: 'Employees',
//     icon: Users,
//     to: '/employees',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
//   },
//   {
//     label: 'Attendance',
//     icon: Calendar,
//     to: '/attendance',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//   },
//   {
//     label: 'Leave',
//     icon: ClipboardList,
//     to: '/leave',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//   },
//   {
//     label: 'Payroll',
//     icon: DollarSign,
//     to: '/payroll',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Reports',
//     icon: BarChart3,
//     to: '/reports',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
//   },
// ];

// const settingsNav: NavItem[] = [
//   {
//     label: 'Roles',
//     icon: Shield,
//     to: '/settings/roles',
//     allowedRoles: ['SYSTEM_ADMIN'],
//   },
//   {
//     label: 'Departments',
//     icon: Building2,
//     to: '/settings/departments',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Job Positions',
//     icon: Briefcase,
//     to: '/settings/positions',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Employee Code',
//     icon: IdCard,
//     to: '/settings/employee-code',
//     allowedRoles: ['SYSTEM_ADMIN'],
//   },
// ];

// export default function Sidebar() {
//   const { user } = useAuth();
//   const userRoles = user?.role_codes || [];

//   // Filter menu items based on user's roles
//   const canAccess = (item: NavItem) =>
//     item.allowedRoles.some((role) => userRoles.includes(role));

//   const visibleMainNav = mainNav.filter(canAccess);
//   const visibleSettingsNav = settingsNav.filter(canAccess);

//   return (
//     <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white md:block">
//       <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
//         <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
//           <Building2 className="h-5 w-5" />
//         </div>
//         <span className="text-lg font-bold text-gray-900">HRMS</span>
//       </div>

//       <nav className="p-4">
//         {visibleMainNav.length > 0 && (
//           <div className="space-y-1">
//             {visibleMainNav.map((item) => (
//               <NavLink
//                 key={item.to}
//                 to={item.to}
//                 className={({ isActive }) =>
//                   `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
//                     isActive
//                       ? 'bg-primary-50 text-primary-700'
//                       : 'text-gray-700 hover:bg-gray-100'
//                   }`
//                 }
//               >
//                 <item.icon className="h-5 w-5" />
//                 {item.label}
//               </NavLink>
//             ))}
//           </div>
//         )}

//         {visibleSettingsNav.length > 0 && (
//           <div className="mt-6">
//             <div className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase text-gray-400">
//               <Settings className="h-3.5 w-3.5" />
//               Settings
//             </div>
//             <div className="space-y-1">
//               {visibleSettingsNav.map((item) => (
//                 <NavLink
//                   key={item.to}
//                   to={item.to}
//                   className={({ isActive }) =>
//                     `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
//                       isActive
//                         ? 'bg-primary-50 text-primary-700'
//                         : 'text-gray-700 hover:bg-gray-100'
//                     }`
//                   }
//                 >
//                   <item.icon className="h-5 w-5" />
//                   {item.label}
//                 </NavLink>
//               ))}
//             </div>
//           </div>
//         )}
//       </nav>
//     </aside>
//   );
// }

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, DollarSign,
  ClipboardList, BarChart3, Settings, Building2,
  Shield, Briefcase, IdCard, CheckSquare, FileText, Workflow,Target,       
  TrendingUp,    
  Award,        
  ClipboardCheck,  
  UserCheck,Users2, PieChart,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  allowedRoles: string[];
}

const mainNav: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/dashboard',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    label: 'Employees',
    icon: Users,
    to: '/employees',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
  },
  {
    label: 'My Approvals',                       // ⬅ NEW
    icon: CheckSquare,
    to: '/approvals',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    label: 'Lifecycle Requests',                 // ⬅ NEW
    icon: Workflow,
    to: '/lifecycle-requests',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    label: 'Attendance',
    icon: Calendar,
    to: '/attendance',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    label: 'Leave',
    icon: ClipboardList,
    to: '/leave',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    label: 'Payroll',
    icon: DollarSign,
    to: '/payroll',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    to: '/reports',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
  },
  {
  label: 'My Performance',
  icon: ClipboardCheck,
  to: '/my-performance',
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
},
{
  label: 'Team Performance',
  icon: UserCheck,
  to: '/team-performance',
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
},
{
  label: 'Performance Calibration',
  icon: BarChart3,
  to: '/hr/calibration',
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],  // HR only
},
{
  label: 'Peer Reviews',
  icon: Users2,
  to: '/peer-reviews',
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
},
{
  label: 'Performance Reports',
  icon: PieChart,
  to: '/performance-reports',
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
},

];

const settingsNav: NavItem[] = [
  {
    label: 'Roles',
    icon: Shield,
    to: '/settings/roles',
    allowedRoles: ['SYSTEM_ADMIN'],
  },
  {
    label: 'Departments',
    icon: Building2,
    to: '/settings/departments',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
    label: 'Job Positions',
    icon: Briefcase,
    to: '/settings/positions',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
    label: 'Employee Code',
    icon: IdCard,
    to: '/settings/employee-code',
    allowedRoles: ['SYSTEM_ADMIN'],
  },
  {
    label: 'Approval Workflows',                 // ⬅ NEW
    icon: Workflow,
    to: '/settings/approval-workflows',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
    label: 'Letter Templates',                   // ⬅ NEW
    icon: FileText,
    to: '/settings/letter-templates',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
    label: 'Rating Scale',
    icon: Award,
    to: '/settings/rating-scale',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
    label: 'Org Priorities',
    icon: Target,
    to: '/settings/organizational-priorities',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
    label: 'Departmental KRAs',
    icon: Building2,
    to: '/settings/departmental-kras',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
    label: 'KRA Library',
    icon: TrendingUp,
    to: '/settings/kra-library',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
  label: 'Performance Cycles',
  icon: Calendar,
  to: '/settings/performance-cycles',
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
},
];

export default function Sidebar() {
  const { user } = useAuth();
  const userRoles = user?.role_codes || [];

  const canAccess = (item: NavItem) =>
    item.allowedRoles.some((role) => userRoles.includes(role));

  const visibleMainNav = mainNav.filter(canAccess);
  const visibleSettingsNav = settingsNav.filter(canAccess);

  return (
  <aside className="hidden h-screen w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
    {/* Fixed header (never scrolls) */}
    <div className="flex h-16 flex-shrink-0 items-center gap-2 border-b border-gray-200 px-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
        <Building2 className="h-5 w-5" />
      </div>
      <span className="text-lg font-bold text-gray-900">HRMS</span>
    </div>

    {/* Scrollable nav (scrolls independently) */}
    <nav className="flex-1 overflow-y-auto p-4">
      {visibleMainNav.length > 0 && (
        <div className="space-y-1">
          {visibleMainNav.map((item) => (
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
        </div>
      )}

      {visibleSettingsNav.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase text-gray-400">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </div>
          <div className="space-y-1">
            {visibleSettingsNav.map((item) => (
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
          </div>
        </div>
      )}
    </nav>
  </aside>
);
}