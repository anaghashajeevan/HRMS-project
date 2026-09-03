// import { useState, useRef, useEffect } from 'react';
// import { Bell, ChevronDown, LogOut, User as UserIcon, Settings, Key } from 'lucide-react';
// import { useAuth } from '../context/AuthContext';
// import { useNavigate } from 'react-router-dom';
// import toast from 'react-hot-toast';
// import ChangePasswordModal from './ChangePasswordModal';

// export default function Topbar() {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();
//   const [open, setOpen] = useState(false);
//   const [passwordModalOpen, setPasswordModalOpen] = useState(false);
//   const menuRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     const handler = (e: MouseEvent) => {
//       if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
//         setOpen(false);
//       }
//     };
//     document.addEventListener('mousedown', handler);
//     return () => document.removeEventListener('mousedown', handler);
//   }, []);

//   const handleLogout = async () => {
//     try {
//       await logout();
//       toast.success('Logged out successfully');
//       navigate('/login', { replace: true });
//     } catch {
//       toast.error('Logout failed');
//     }
//   };

//   const initials = user?.employee
//     ? `${user.employee.first_name[0] || ''}${user.employee.last_name[0] || ''}`.toUpperCase()
//     : user?.username?.[0]?.toUpperCase() || 'U';

//   return (
//     <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
//       <h2 className="text-lg font-semibold text-gray-800">
//         Welcome back, {user?.employee?.first_name || user?.username || 'User'} 👋
//       </h2>

//       <div className="flex items-center gap-4">
//         <button className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100">
//           <Bell className="h-5 w-5" />
//           <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"></span>
//         </button>

//         <div className="relative" ref={menuRef}>
//           <button
//             onClick={() => setOpen(!open)}
//             className="flex items-center gap-1 rounded-full p-1 hover:bg-gray-100 transition"
//             title={user?.employee?.full_name || user?.username}
//           >
//             <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
//               {initials}
//             </div>
//             <ChevronDown className="h-4 w-4 text-gray-500" />
//           </button>

//           {open && (
//             <div
//               className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 py-2 shadow-2xl ring-1 ring-black/5"
//               style={{ backgroundColor: '#ffffff' }}
//             >
//               <div className="border-b border-gray-100 px-4 py-3">
//                 <p className="text-sm font-medium text-gray-900">
//                   {user?.employee?.full_name || user?.username}
//                 </p>
//                 <p className="truncate text-xs text-gray-500">{user?.email}</p>
//               </div>

//               <button
//                 onClick={() => {
//                   setOpen(false);
//                   navigate('/profile');
//                 }}
//                 className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
//               >
//                 <UserIcon className="h-4 w-4" />
//                 My Profile
//               </button>

//               <button
//                 onClick={() => {
//                   setOpen(false);
//                   setPasswordModalOpen(true);
//                 }}
//                 className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
//               >
//                 <Key className="h-4 w-4" />
//                 Change Password
//               </button>

//               <button
//                 onClick={() => {
//                   setOpen(false);
//                   navigate('/settings');
//                 }}
//                 className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
//               >
//                 <Settings className="h-4 w-4" />
//                 Settings
//               </button>

//               <div className="my-1 border-t border-gray-100"></div>

//               <button
//                 onClick={handleLogout}
//                 className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
//               >
//                 <LogOut className="h-4 w-4" />
//                 Sign Out
//               </button>
//             </div>
//           )}
//         </div>
//       </div>

//       <ChangePasswordModal
//         isOpen={passwordModalOpen}
//         onClose={() => setPasswordModalOpen(false)}
//       />
//     </header>
//   );
// }


import { useState, useRef, useEffect } from 'react';
import { 
  Bell, ChevronDown, LogOut, User as UserIcon, Settings, Key, 
  CheckCircle2, AlertCircle, Mail, FileText, HelpCircle, Inbox
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ChangePasswordModal from './ChangePasswordModal';
import { notificationsApi } from '../api/workflow';

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  
  // Notification States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Click outside handler for both dropdowns
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch Notifications on Mount & Interval
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const count = await notificationsApi.unreadCount();
      setUnreadCount(count);
      
      const response = await notificationsApi.list({ page: 1 });
      setNotifications(Array.isArray(response) ? response : response.results || []);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Logout failed');
    }
  };

  const handleMarkRead = async (id: string, link?: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifOpen(false);
      if (link) {
        navigate(link);
      }
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'APPROVAL_REQUEST':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'APPROVAL_APPROVED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'APPROVAL_REJECTED':
        return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case 'LETTER_GENERATED':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'ASSET_ALLOCATED':
      case 'ASSET_RETURNED':
        return <Inbox className="h-4 w-4 text-indigo-500" />;
      default:
        return <Mail className="h-4 w-4 text-gray-500" />;
    }
  };

  const initials = user?.employee
    ? `${user.employee.first_name[0] || ''}${user.employee.last_name[0] || ''}`.toUpperCase()
    : user?.username?.[0]?.toUpperCase() || 'U';

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h2 className="text-lg font-semibold text-gray-800">
        Welcome back, {user?.employee?.first_name || user?.username || 'User'} 👋
      </h2>

      <div className="flex items-center gap-4">
        {/* NOTIFICATIONS DROPDOWN */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white py-2 shadow-2xl ring-1 ring-black/5">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                <span className="text-sm font-semibold text-gray-900">Notifications</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkRead(n.id, n.link)}
                      className={`flex items-start gap-3 border-b border-gray-50 px-4 py-3 cursor-pointer transition ${
                        n.is_read ? 'bg-white hover:bg-gray-50' : 'bg-indigo-50/40 hover:bg-indigo-50/70'
                      }`}
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-50">
                        {getNotifIcon(n.notification_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-950'}`}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-2">
                          {n.message}
                        </p>
                        <span className="mt-1 block text-[9px] text-gray-400">
                          {new Date(n.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {!n.is_read && (
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* PROFILE DROPDOWN */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 rounded-full p-1 hover:bg-gray-100 transition"
            title={user?.employee?.full_name || user?.username}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
              {initials}
            </div>
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </button>

          {open && (
            <div
              className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 py-2 shadow-2xl ring-1 ring-black/5"
              style={{ backgroundColor: '#ffffff' }}
            >
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">
                  {user?.employee?.full_name || user?.username}
                </p>
                <p className="truncate text-xs text-gray-500">{user?.email}</p>
              </div>

              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/profile');
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <UserIcon className="h-4 w-4" />
                My Profile
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  setPasswordModalOpen(true);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Key className="h-4 w-4" />
                Change Password
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/settings');
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>

              <div className="my-1 border-t border-gray-100"></div>

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <ChangePasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </header>
  );
}