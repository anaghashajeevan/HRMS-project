import { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, LogOut, User as UserIcon, Settings, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ChangePasswordModal from './ChangePasswordModal';

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Logout failed');
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
        <button className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"></span>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 rounded-full p-1 hover:bg-gray-100 transition"
            title={user?.employee?.full_name || user?.username}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
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