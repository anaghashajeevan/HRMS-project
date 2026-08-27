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

// import { NavLink } from 'react-router-dom';
// import {
//   LayoutDashboard, Users, Calendar, DollarSign,
//   ClipboardList, BarChart3, Settings, Building2,
//   Shield, Briefcase, IdCard, CheckSquare, FileText, Workflow,Target,       
//   TrendingUp,    
//   Award,        
//   ClipboardCheck,  
//   UserCheck,Users2, PieChart,
// } from 'lucide-react';
// import { useAuth } from '../context/AuthContext';

// interface NavItem {
//   label: string;
//   icon: React.ComponentType<{ className?: string }>;
//   to: string;
//   allowedRoles: string[];
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
//     label: 'My Approvals',                       // ⬅ NEW
//     icon: CheckSquare,
//     to: '/approvals',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//   },
//   {
//     label: 'Lifecycle Requests',                 // ⬅ NEW
//     icon: Workflow,
//     to: '/lifecycle-requests',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
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
//   {
//   label: 'My Performance',
//   icon: ClipboardCheck,
//   to: '/my-performance',
//   allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
// },
// {
//   label: 'Team Performance',
//   icon: UserCheck,
//   to: '/team-performance',
//   allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
// },
// {
//   label: 'Performance Calibration',
//   icon: BarChart3,
//   to: '/hr/calibration',
//   allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],  // HR only
// },
// {
//   label: 'Peer Reviews',
//   icon: Users2,
//   to: '/peer-reviews',
//   allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
// },
// {
//   label: 'Performance Reports',
//   icon: PieChart,
//   to: '/performance-reports',
//   allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
// },

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
//   {
//     label: 'Approval Workflows',                 // ⬅ NEW
//     icon: Workflow,
//     to: '/settings/approval-workflows',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Letter Templates',                   // ⬅ NEW
//     icon: FileText,
//     to: '/settings/letter-templates',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Rating Scale',
//     icon: Award,
//     to: '/settings/rating-scale',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Org Priorities',
//     icon: Target,
//     to: '/settings/organizational-priorities',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Departmental KRAs',
//     icon: Building2,
//     to: '/settings/departmental-kras',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'KRA Library',
//     icon: TrendingUp,
//     to: '/settings/kra-library',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//   label: 'Performance Cycles',
//   icon: Calendar,
//   to: '/settings/performance-cycles',
//   allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
// },
// ];

// export default function Sidebar() {
//   const { user } = useAuth();
//   const userRoles = user?.role_codes || [];

//   const canAccess = (item: NavItem) =>
//     item.allowedRoles.some((role) => userRoles.includes(role));

//   const visibleMainNav = mainNav.filter(canAccess);
//   const visibleSettingsNav = settingsNav.filter(canAccess);

//   return (
//   <aside className="hidden h-screen w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
//     {/* Fixed header (never scrolls) */}
//     <div className="flex h-16 flex-shrink-0 items-center gap-2 border-b border-gray-200 px-6">
//       <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
//         <Building2 className="h-5 w-5" />
//       </div>
//       <span className="text-lg font-bold text-gray-900">HRMS</span>
//     </div>

//     {/* Scrollable nav (scrolls independently) */}
//     <nav className="flex-1 overflow-y-auto p-4">
//       {visibleMainNav.length > 0 && (
//         <div className="space-y-1">
//           {visibleMainNav.map((item) => (
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
//       )}

//       {visibleSettingsNav.length > 0 && (
//         <div className="mt-6">
//           <div className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase text-gray-400">
//             <Settings className="h-3.5 w-3.5" />
//             Settings
//           </div>
//           <div className="space-y-1">
//             {visibleSettingsNav.map((item) => (
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
//       )}
//     </nav>
//   </aside>
// );
// }


// import { useState } from 'react';
// import { NavLink, useLocation } from 'react-router-dom';
// import {
//   LayoutDashboard, Users, Calendar, DollarSign,
//   ClipboardList, BarChart3, Settings, Building2,
//   Shield, Briefcase, IdCard, CheckSquare, FileText, Workflow,
//   Target, TrendingUp, Award, ClipboardCheck, UserCheck, Users2,
//   PieChart, ChevronDown, ChevronRight, Receipt, Upload,
//   FileSpreadsheet, Mail, Cog, MonitorCheck, CheckCircle2,
// } from 'lucide-react';
// import { useAuth } from '../context/AuthContext';

// // ==============================================================================
// // TYPES
// // ==============================================================================

// interface NavItem {
//   label: string;
//   icon: React.ComponentType<{ className?: string }>;
//   to: string;
//   allowedRoles: string[];
// }

// interface NavGroup {
//   label: string;
//   icon: React.ComponentType<{ className?: string }>;
//   allowedRoles: string[];
//   children: NavItem[];
// }

// type NavEntry = NavItem | NavGroup;

// function isNavGroup(entry: NavEntry): entry is NavGroup {
//   return 'children' in entry;
// }

// // ==============================================================================
// // MENU CONFIGURATION
// // ==============================================================================

// const mainNav: NavEntry[] = [
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
//     label: 'My Approvals',
//     icon: CheckSquare,
//     to: '/approvals',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//   },
//   {
//     label: 'Lifecycle Requests',
//     icon: Workflow,
//     to: '/lifecycle-requests',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//   },

//   // ==================== KRA & KPIs (Dropdown) ====================
//   {
//     label: 'KRA & KPIs',
//     icon: Target,
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//     children: [
//       {
//         label: 'My Performance',
//         icon: ClipboardCheck,
//         to: '/my-performance',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//       },
//       {
//         label: 'Team Performance',
//         icon: UserCheck,
//         to: '/team-performance',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
//       },
//       {
//         label: 'Performance Calibration',
//         icon: BarChart3,
//         to: '/hr/calibration',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//       },
//       {
//         label: 'Peer Reviews',
//         icon: Users2,
//         to: '/peer-reviews',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//       },
//       {
//         label: 'Performance Reports',
//         icon: PieChart,
//         to: '/performance-reports',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
//       },
//     ],
//   },

//   // ==================== Reimbursements (Dropdown) ====================
//   {
//     label: 'Reimbursements',
//     icon: Receipt,
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//     children: [
//       {
//         label: 'Smart Upload',
//         icon: Upload,
//         to: '/reimbursements/smart-upload',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//       },
//       {
//         label: 'My Claims',
//         icon: FileSpreadsheet,
//         to: '/reimbursements/my-claims',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
//       },
//       {
//         label: 'Dashboard',
//         icon: LayoutDashboard,
//         to: '/reimbursements/dashboard',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//       },
//       {
//         label: 'Claim Monitor',
//         icon: MonitorCheck,
//         to: '/reimbursements/claims',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//       },
//       {
//         label: 'Finance Review',
//         icon: CheckCircle2,
//         to: '/reimbursements/finance-review',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//       },
//       {
//         label: 'Reports',
//         icon: PieChart,
//         to: '/reimbursements/reports',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//       },
//       {
//         label: 'Email Control',
//         icon: Mail,
//         to: '/reimbursements/email-control',
//         allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//       },
//       {
//         label: 'Settings',
//         icon: Cog,
//         to: '/reimbursements/settings',
//         allowedRoles: ['SYSTEM_ADMIN'],
//       },
//     ],
//   },

//   // ==================== Other Modules ====================
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
//   {
//     label: 'Approval Workflows',
//     icon: Workflow,
//     to: '/settings/approval-workflows',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Letter Templates',
//     icon: FileText,
//     to: '/settings/letter-templates',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Rating Scale',
//     icon: Award,
//     to: '/settings/rating-scale',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Org Priorities',
//     icon: Target,
//     to: '/settings/organizational-priorities',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Departmental KRAs',
//     icon: Building2,
//     to: '/settings/departmental-kras',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'KRA Library',
//     icon: TrendingUp,
//     to: '/settings/kra-library',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
//   {
//     label: 'Performance Cycles',
//     icon: Calendar,
//     to: '/settings/performance-cycles',
//     allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
//   },
// ];

// // ==============================================================================
// // COLLAPSIBLE GROUP COMPONENT
// // ==============================================================================

// function SidebarGroup({
//   group,
//   userRoles,
// }: {
//   group: NavGroup;
//   userRoles: string[];
// }) {
//   const location = useLocation();
//   const [isOpen, setIsOpen] = useState(() => {
//     // Auto-open if any child is active
//     return group.children.some((child) => location.pathname.startsWith(child.to));
//   });

//   const visibleChildren = group.children.filter((child) =>
//     child.allowedRoles.some((role) => userRoles.includes(role))
//   );

//   if (visibleChildren.length === 0) return null;

//   const hasActiveChild = visibleChildren.some(
//     (child) => location.pathname === child.to || location.pathname.startsWith(child.to + '/')
//   );

//   return (
//     <div>
//       {/* Group Header (clickable to expand/collapse) */}
//       <button
//         onClick={() => setIsOpen(!isOpen)}
//         className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
//           hasActiveChild
//             ? 'bg-primary-50 text-primary-700'
//             : 'text-gray-700 hover:bg-gray-100'
//         }`}
//       >
//         <group.icon className="h-5 w-5" />
//         <span className="flex-1 text-left">{group.label}</span>
//         {isOpen ? (
//           <ChevronDown className="h-4 w-4 text-gray-400" />
//         ) : (
//           <ChevronRight className="h-4 w-4 text-gray-400" />
//         )}
//       </button>

//       {/* Children (collapsible) */}
//       <div
//         className={`overflow-hidden transition-all duration-200 ease-in-out ${
//           isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
//         }`}
//       >
//         <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-200 pl-3">
//           {visibleChildren.map((child) => (
//             <NavLink
//               key={child.to}
//               to={child.to}
//               className={({ isActive }) =>
//                 `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
//                   isActive
//                     ? 'bg-primary-50 font-medium text-primary-700'
//                     : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
//                 }`
//               }
//             >
//               <child.icon className="h-4 w-4" />
//               {child.label}
//             </NavLink>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }

// // ==============================================================================
// // MAIN SIDEBAR COMPONENT
// // ==============================================================================

// export default function Sidebar() {
//   const { user } = useAuth();
//   const userRoles = user?.role_codes || [];

//   const canAccess = (item: NavItem) =>
//     item.allowedRoles.some((role) => userRoles.includes(role));

//   const canAccessGroup = (group: NavGroup) =>
//     group.allowedRoles.some((role) => userRoles.includes(role));

//   const visibleMainNav = mainNav.filter((entry) => {
//     if (isNavGroup(entry)) return canAccessGroup(entry);
//     return canAccess(entry);
//   });

//   const visibleSettingsNav = settingsNav.filter(canAccess);

//   return (
//     <aside className="hidden h-screen w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
//       {/* Fixed Header */}
//       <div className="flex h-16 flex-shrink-0 items-center gap-2 border-b border-gray-200 px-6">
//         <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
//           <Building2 className="h-5 w-5" />
//         </div>
//         <span className="text-lg font-bold text-gray-900">HRMS</span>
//       </div>

//       {/* Scrollable Nav */}
//       <nav className="flex-1 overflow-y-auto p-4">
//         {/* Main Navigation */}
//         {visibleMainNav.length > 0 && (
//           <div className="space-y-1">
//             {visibleMainNav.map((entry) => {
//               if (isNavGroup(entry)) {
//                 return (
//                   <SidebarGroup
//                     key={entry.label}
//                     group={entry}
//                     userRoles={userRoles}
//                   />
//                 );
//               }
//               return (
//                 <NavLink
//                   key={entry.to}
//                   to={entry.to}
//                   className={({ isActive }) =>
//                     `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
//                       isActive
//                         ? 'bg-primary-50 text-primary-700'
//                         : 'text-gray-700 hover:bg-gray-100'
//                     }`
//                   }
//                 >
//                   <entry.icon className="h-5 w-5" />
//                   {entry.label}
//                 </NavLink>
//               );
//             })}
//           </div>
//         )}

//         {/* Settings Section */}
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


import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, DollarSign,
  ClipboardList, BarChart3, Settings, Building2,
  Shield, Briefcase, IdCard, CheckSquare, FileText, Workflow,
  Target, TrendingUp, Award, ClipboardCheck, UserCheck, Users2,
  PieChart, ChevronDown, ChevronRight, Receipt, Upload,
  FileSpreadsheet, Mail, Cog, MonitorCheck, CheckCircle2,
  Sparkles,
  Plus,
  BookOpen,
  Clock,
  Activity,
  MessageCircle,Gift,
  Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ==============================================================================
// TYPES
// ==============================================================================

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  allowedRoles: string[];
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: string[];
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

// ==============================================================================
// MENU CONFIGURATION (unchanged)
// ==============================================================================

const mainNav: NavEntry[] = [
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
    label: 'My Approvals',
    icon: CheckSquare,
    to: '/approvals',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  },
  {
    label: 'Lifecycle Requests',
    icon: Workflow,
    to: '/lifecycle-requests',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  },

  // ==================== KRA & KPIs (Dropdown) ====================
  // {
  //   label: 'KRA & KPIs',
  //   icon: Target,
  //   allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  //   children: [
  //     {
  //       label: 'My Performance',
  //       icon: ClipboardCheck,
  //       to: '/my-performance',
  //       allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  //     },
  //     {
  //       label: 'Team Performance',
  //       icon: UserCheck,
  //       to: '/team-performance',
  //       allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
  //     },
  //     {
  //       label: 'Performance Calibration',
  //       icon: BarChart3,
  //       to: '/hr/calibration',
  //       allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  //     },
  //     {
  //       label: 'Peer Reviews',
  //       icon: Users2,
  //       to: '/peer-reviews',
  //       allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  //     },
  //     {
  //       label: 'Performance Reports',
  //       icon: PieChart,
  //       to: '/performance-reports',
  //       allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
  //     },
  //   ],
  // },
{
  label: 'Performance',
  icon: Target,
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  children: [
    {
      label: 'My Annual Plan',                     // ← Employee's own plan
      icon: ClipboardCheck,
      to: '/my-performance',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      label: 'All Annual Plans',                   // ← HR/Manager Directory
      icon: FileText,
      to: '/performance/annual-plans',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
    },
    {
      label: 'Peer Reviews',
      icon: Users2,
      to: '/peer-reviews',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
  ],
},
  // ==================== Reimbursements (Dropdown) ====================
  {
    label: 'Reimbursements',
    icon: Receipt,
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    children: [
      {
        label: 'Smart Upload',
        icon: Upload,
        to: '/reimbursements/smart-upload',
        allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
      },
      {
        label: 'My Claims',
        icon: FileSpreadsheet,
        to: '/reimbursements/my-claims',
        allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
      },
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        to: '/reimbursements/dashboard',
        allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
      },
      {
        label: 'Claim Monitor',
        icon: MonitorCheck,
        to: '/reimbursements/claims',
        allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
      },
      {
        label: 'Finance Review',
        icon: CheckCircle2,
        to: '/reimbursements/finance-review',
        allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
      },
      {
        label: 'Reports',
        icon: PieChart,
        to: '/reimbursements/reports',
        allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
      },
      {
        label: 'Email Control',
        icon: Mail,
        to: '/reimbursements/email-control',
        allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
      },
      {
        label: 'Settings',
        icon: Cog,
        to: '/reimbursements/settings',
        allowedRoles: ['SYSTEM_ADMIN'],
      },
    ],
  },

  // ==================== Asset Management (Dropdown) ====================
{
  label: 'Asset Management',
  icon: Package,
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  children: [
    {
      label: 'My Assets',
      icon: Package,
      to: '/assets/my-assets',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      to: '/assets/dashboard',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
    },
    {
      label: 'Asset Directory',
      icon: ClipboardList,
      to: '/assets',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
    },
    {
      label: 'Categories',
      icon: FileText,
      to: '/assets/categories',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
    },
  ],
},
  // ==================== Other Modules ====================
  {
  label: 'Attendance',
  icon: Calendar,
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  children: [
    {
      label: 'My Attendance',
      icon: ClipboardCheck,
      to: '/my-attendance',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      label: 'Team Attendance',
      icon: Users,
      to: '/team-attendance',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
    },
     {
      label: 'All Employees',
      icon: Users2,  // Import Users2 from lucide-react
      to: '/all-attendance',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
    },
    {
      label: 'Live Dashboard',
      icon: Activity,
      to: '/attendance/live',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER','EMPLOYEE'],
    },
    {
      label: 'HR Dashboard',
      icon: LayoutDashboard,
      to: '/attendance',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN','MANAGER','EMPLOYEE'],
    },
  ],
},
  {
  label: 'Leave',
  icon: ClipboardList,
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  children: [
    {
      label: 'My Leave',
      icon: Calendar,
      to: '/leave',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      label: 'My Calendar',
      icon: Calendar,
      to: '/leave/my-calendar',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      label: 'Apply Leave',
      icon: Plus,
      to: '/leave/apply',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      label: 'Pending Approvals',
      icon: CheckSquare,
      to: '/leave/approvals',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
    },
    {
      label: 'Team Calendar',
      icon: Users,
      to: '/leave/team-calendar',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
    },
    {
      label: 'Leave Types',
      icon: Sparkles,
      to: '/leave/types',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
    },
    {
      label: 'Leave Balances',
      icon: TrendingUp,
      to: '/leave/balances',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
    },
    {
  label: 'Comp-Off Logs',
  icon: Gift,   
  to: '/leave/compoff-logs',
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
},
  ],
},
{
  label: 'Policies',
  icon: Shield,
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  children: [
    {
      label: 'Policy Library',
      icon: BookOpen,
      to: '/policies/library',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      label: 'My Acknowledgments',
      icon: CheckSquare,
      to: '/policies/my-acknowledgments',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      label: 'Pending Approvals',
      icon: Clock,
      to: '/policies/pending-approvals',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
    },
    {
      label: 'Manage Policies',
      icon: Settings,
      to: '/policies',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN',],
    },
  ],
},

{
  label: 'Holiday Calendar',
  icon: Calendar,
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
  children: [
    {
      label: 'View Calendar',
      icon: Calendar,
      to: '/calendar',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      label: 'Manage Calendars',
      icon: Settings,
      to: '/calendar/manage',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
    },
    {
      label: 'Pending Approvals',
      icon: Clock,
      to: '/calendar/pending-approvals',
      allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER'],
    },
  ],
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
];

const settingsNav: NavItem[] = [
  {
    label: 'Roles',
    icon: Shield,
    to: '/settings/roles',
    allowedRoles: ['SYSTEM_ADMIN'],
  },
  {
    label: 'Company Structures',
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
  label: 'WhatsApp',
  icon: MessageCircle, // import from lucide-react
  to: '/settings/whatsapp',
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
},
  {
    label: 'Employee Code',
    icon: IdCard,
    to: '/settings/employee-code',
    allowedRoles: ['SYSTEM_ADMIN'],
  },
  {
    label: 'Approval Workflows',
    icon: Workflow,
    to: '/settings/approval-workflows',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
    label: 'Letter Templates',
    icon: FileText,
    to: '/settings/letter-templates',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  {
  label: 'Common KRAs (Master)',
  icon: Target,
  to: '/settings/common-kras',
  allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
},
{
  label: 'Departmental KRAs',
  icon: Building2,
  to: '/settings/departmental-kras',
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
    label: 'KRA Library',
    icon: TrendingUp,
    to: '/settings/kra-library',
    allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  },
  // {
  //   label: 'Performance Cycles',
  //   icon: Calendar,
  //   to: '/settings/performance-cycles',
  //   allowedRoles: ['SYSTEM_ADMIN', 'HR_ADMIN'],
  // },
];

// ==============================================================================
// SHARED STYLE HELPERS (presentation only — no behavioral change)
// ==============================================================================

const itemBase =
  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b1750]';

const itemActive =
  'font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg shadow-indigo-900/40 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-amber-400 before:content-[""]';

const itemInactive =
  'font-medium text-indigo-200/70 hover:bg-white/[0.06] hover:text-white hover:translate-x-0.5';

function iconClass(isActive?: boolean) {
  return `h-5 w-5 shrink-0 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-rotate-6 ${
    isActive ? 'text-amber-300' : ''
  }`;
}

function entranceStyle(index: number): React.CSSProperties {
  return { animation: 'navItemIn 0.45s ease-out both', animationDelay: `${index * 35}ms` };
}

// ==============================================================================
// COLLAPSIBLE GROUP COMPONENT
// ==============================================================================

function SidebarGroup({
  group,
  userRoles,
  index,
}: {
  group: NavGroup;
  userRoles: string[];
  index: number;
}) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(() => {
    // Auto-open if any child is active
    return group.children.some((child) => location.pathname.startsWith(child.to));
  });

  const visibleChildren = group.children.filter((child) =>
    child.allowedRoles.some((role) => userRoles.includes(role))
  );

  if (visibleChildren.length === 0) return null;

  const hasActiveChild = visibleChildren.some(
    (child) => location.pathname === child.to || location.pathname.startsWith(child.to + '/')
  );

  return (
    <div style={entranceStyle(index)}>
      {/* Group Header (clickable to expand/collapse) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${itemBase} w-full ${
          hasActiveChild ? 'text-white bg-white/[0.07]' : itemInactive
        }`}
      >
        <group.icon className={iconClass()} />
        <span className="flex-1 text-left tracking-wide">{group.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-indigo-300/60 transition-transform duration-300 ease-out ${
            isOpen ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </button>

      {/* Children (collapsible) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-white/10 pl-3">
          {visibleChildren.map((child, i) => (
            <NavLink
              key={child.to}
              to={child.to}
              style={isOpen ? entranceStyle(i) : undefined}
              className={({ isActive }) =>
                `group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b1750] ${
                  isActive
                    ? 'font-medium text-amber-200 bg-white/[0.08]'
                    : 'text-indigo-200/60 hover:bg-white/[0.05] hover:text-white hover:translate-x-0.5'
                }`
              }
            >
              <child.icon className="h-4 w-4 shrink-0 transition-transform duration-300 ease-out group-hover:scale-110" />
              {child.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MAIN SIDEBAR COMPONENT
// ==============================================================================

export default function Sidebar() {
  const { user } = useAuth();
  const userRoles = user?.role_codes || [];

  const canAccess = (item: NavItem) =>
    item.allowedRoles.some((role) => userRoles.includes(role));

  const canAccessGroup = (group: NavGroup) =>
    group.allowedRoles.some((role) => userRoles.includes(role));

  const visibleMainNav = mainNav.filter((entry) => {
    if (isNavGroup(entry)) return canAccessGroup(entry);
    return canAccess(entry);
  });

  const visibleSettingsNav = settingsNav.filter(canAccess);

  return (
    <aside
      className="hidden h-screen w-64 flex-shrink-0 flex-col border-r border-white/5 bg-gradient-to-b from-[#1e1b4b] via-[#221c5c] to-[#191653] shadow-2xl shadow-indigo-950/40 md:flex"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}
    >
      {/* Fonts + motion keyframes (scoped, presentation only) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap');

        @keyframes navItemIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes logoGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.45); }
          50% { box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); }
        }
        @keyframes brandFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .hrms-sidebar * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <div className="hrms-sidebar flex h-full flex-col">
        {/* Fixed Header */}
        <div className="flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-white/10 px-6">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white"
            style={{ animation: 'logoGlow 2.8s ease-in-out infinite' }}
          >
            <Building2 className="h-5 w-5" />
          </div>
          <span
            className="text-lg font-bold tracking-tight text-white"
            style={{
              fontFamily: "'Sora', 'Segoe UI', sans-serif",
              animation: 'brandFadeIn 0.5s ease-out both',
            }}
          >
            HRMS
          </span>
        </div>

        {/* Scrollable Nav */}
        <nav className="flex-1 overflow-y-auto p-4">
          {/* Main Navigation */}
          {visibleMainNav.length > 0 && (
            <div className="space-y-1">
              {visibleMainNav.map((entry, index) => {
                if (isNavGroup(entry)) {
                  return (
                    <SidebarGroup
                      key={entry.label}
                      group={entry}
                      userRoles={userRoles}
                      index={index}
                    />
                  );
                }
                return (
                  <NavLink
                    key={entry.to}
                    to={entry.to}
                    style={entranceStyle(index)}
                    className={({ isActive }) =>
                      `${itemBase} ${isActive ? itemActive : itemInactive}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <entry.icon className={iconClass(isActive)} />
                        {entry.label}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}

          {/* Settings Section */}
          {visibleSettingsNav.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-amber-300/70">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </div>
              <div className="space-y-1">
                {visibleSettingsNav.map((item, index) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    style={entranceStyle(index)}
                    className={({ isActive }) =>
                      `${itemBase} ${isActive ? itemActive : itemInactive}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={iconClass(isActive)} />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
          {/* LMS Module */}
          <div className="mt-6">
            <div className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-amber-300/70">
              <BookOpen className="h-3.5 w-3.5" />
              Modules
            </div>
            <div className="space-y-1">
              <button
  onClick={async () => {
    try {
      const token = localStorage.getItem('access_token')

      const res = await fetch(
        'http://localhost:8000/api/v1/lms/get-token/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Cannot connect to LMS')
        return
      }

      if (data.action === 'login') {
        // ✅ User exists - direct SSO login
        window.open(
          `${data.lms_url}/auth/cross-app` +
          `?token=${data.lms_token}` +
          `&redirect=/home`,
          '_blank'
        )
      } else if (data.action === 'register') {
        // ✅ User not in LMS - open registration page
        // with pre-filled email and name
        const params = new URLSearchParams({
          email: data.email || '',
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          source: 'hrms',
        })
        window.open(
          `${data.lms_url}/auth/register?${params.toString()}`,
          '_blank'
        )
      }
    } catch (err) {
      alert(
        'LMS server is not running. ' +
        'Please start it on port 8001.'
      )
    }
  }}
  className={`${itemBase} ${itemInactive} w-full`}
  style={entranceStyle(0)}
>
  <BookOpen className={iconClass()} />
  <span className="flex-1 text-left tracking-wide">LMS</span>
  <span className="flex h-5 items-center rounded-full bg-amber-400/20 px-2 text-[10px] font-bold text-amber-300">
    NEW
  </span>
</button>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}