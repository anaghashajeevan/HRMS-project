import { useState, type FormEvent } from 'react';
import { X, Eye, EyeOff, Lock, Loader2, Check } from 'lucide-react';
import { authApi } from '../api/auth';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: Props) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // Password strength calculation
  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500 text-red-700' };
    if (score <= 4) return { score, label: 'Medium', color: 'bg-amber-500 text-amber-700' };
    return { score, label: 'Strong', color: 'bg-green-500 text-green-700' };
  };

  const strength = getStrength(newPassword);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!oldPassword) errs.old_password = 'Current password is required';
    if (!newPassword) errs.new_password = 'New password is required';
    else if (newPassword.length < 8) errs.new_password = 'Must be at least 8 characters';
    else if (newPassword === oldPassword) errs.new_password = 'New password must be different';
    if (!confirmPassword) errs.confirm_password = 'Please confirm your password';
    else if (newPassword !== confirmPassword) errs.confirm_password = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleClose = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOld(false);
    setShowNew(false);
    setShowConfirm(false);
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      toast.success('Password changed successfully! 🎉');
      handleClose();
    } catch (err) {
      const error = err as AxiosError<Record<string, string[] | string>>;
      const data = error.response?.data;
      if (data && typeof data === 'object') {
        const newErrors: Record<string, string> = {};
        Object.entries(data).forEach(([key, val]) => {
          newErrors[key] = Array.isArray(val) ? val[0] : String(val);
        });
        setErrors(newErrors);
      }
      toast.error('Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
              <Lock className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
              <p className="text-xs text-gray-500">Keep your account secure</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => {
                  setOldPassword(e.target.value);
                  if (errors.old_password) setErrors({ ...errors, old_password: '' });
                }}
                className={`w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm outline-none focus:ring-2 ${
                  errors.old_password
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-100'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.old_password && (
              <p className="mt-1 text-xs text-red-600">{errors.old_password}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.new_password) setErrors({ ...errors, new_password: '' });
                }}
                className={`w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm outline-none focus:ring-2 ${
                  errors.new_password
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-100'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.new_password && (
              <p className="mt-1 text-xs text-red-600">{errors.new_password}</p>
            )}

            {/* Password strength indicator */}
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Password strength:</span>
                  <span className={`font-medium ${strength.color.split(' ')[1]}`}>
                    {strength.label}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full ${strength.color.split(' ')[0]} transition-all duration-300`}
                    style={{ width: `${(strength.score / 6) * 100}%` }}
                  />
                </div>
                <ul className="mt-2 space-y-0.5 text-xs">
                  <PasswordRule met={newPassword.length >= 8} text="At least 8 characters" />
                  <PasswordRule met={/[A-Z]/.test(newPassword)} text="One uppercase letter" />
                  <PasswordRule met={/[0-9]/.test(newPassword)} text="One number" />
                  <PasswordRule met={/[^A-Za-z0-9]/.test(newPassword)} text="One special character" />
                </ul>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirm_password) setErrors({ ...errors, confirm_password: '' });
                }}
                className={`w-full rounded-lg border py-2.5 pl-3 pr-10 text-sm outline-none focus:ring-2 ${
                  errors.confirm_password
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-100'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirm_password && (
              <p className="mt-1 text-xs text-red-600">{errors.confirm_password}</p>
            )}
            {confirmPassword && newPassword === confirmPassword && !errors.confirm_password && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" /> Passwords match
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Change Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Password rule item ----------
function PasswordRule({ met, text }: { met: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? 'text-green-600' : 'text-gray-400'}`}>
      <Check className={`h-3 w-3 ${met ? 'opacity-100' : 'opacity-30'}`} />
      {text}
    </li>
  );
}