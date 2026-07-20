import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, KeyRound, Lock, ArrowLeft, Loader2, CheckCircle2,
  AlertCircle, RefreshCw, Eye, EyeOff, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { forgotPasswordApi } from '../api/auth';

type Step = 'email' | 'otp' | 'reset' | 'success';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP timer
  const [otpCountdown, setOtpCountdown] = useState(0);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => setOtpCountdown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // ==============================================================================
  // STEP 1: Request OTP
  // ==============================================================================

  const handleRequestOTP = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }

    setLoading(true);
    try {
      await forgotPasswordApi.requestOTP(email);
      toast.success('OTP sent to your email');
      setStep('otp');
      setOtpCountdown(600); // 10 minutes
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // ==============================================================================
  // STEP 2: Verify OTP
  // ==============================================================================

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const result = await forgotPasswordApi.verifyOTP(email, otp);
      setResetToken(result.reset_token);
      toast.success('OTP verified! Set your new password.');
      setStep('reset');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Invalid OTP');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // ==============================================================================
  // STEP 3: Reset Password
  // ==============================================================================

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    // Password strength check
    if (
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      toast.error('Password must include uppercase, lowercase, and a number');
      return;
    }

    setLoading(true);
    try {
      await forgotPasswordApi.resetPassword(resetToken, newPassword, confirmPassword);
      toast.success('Password reset successful!');
      setStep('success');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = () => {
    const min = Math.floor(otpCountdown / 60);
    const sec = otpCountdown % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const passwordStrength = () => {
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[a-z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  };

  const strengthLabel = () => {
    const s = passwordStrength();
    if (s <= 2) return { text: 'Weak', color: 'bg-red-500', width: '33%' };
    if (s <= 4) return { text: 'Medium', color: 'bg-amber-500', width: '66%' };
    return { text: 'Strong', color: 'bg-green-500', width: '100%' };
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HRMS Password Reset</h1>
          <p className="mt-1 text-sm text-gray-500">
            Secure your account in 3 simple steps
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {[
            { id: 'email', label: 'Email' },
            { id: 'otp', label: 'Verify' },
            { id: 'reset', label: 'Reset' },
          ].map((s, idx) => {
            const isActive = step === s.id;
            const isDone =
              (step === 'otp' && s.id === 'email') ||
              (step === 'reset' && (s.id === 'email' || s.id === 'otp')) ||
              (step === 'success');
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive || isDone ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
                {idx < 2 && (
                  <div
                    className={`mx-1 h-0.5 w-6 ${isDone ? 'bg-green-500' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-100">
          {/* STEP 1: EMAIL */}
          {step === 'email' && (
            <>
              <div className="mb-6">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                  <Mail className="h-6 w-6 text-primary-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  Enter Your Email
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  We'll send you a 6-digit OTP to reset your password
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase text-gray-500">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRequestOTP()}
                      className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="you@company.com"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  onClick={handleRequestOTP}
                  disabled={loading || !email}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Send OTP
                </button>
              </div>
            </>
          )}

          {/* STEP 2: OTP */}
          {step === 'otp' && (
            <>
              <div className="mb-6">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                  <KeyRound className="h-6 w-6 text-primary-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Enter OTP</h2>
                <p className="mt-1 text-sm text-gray-500">
                  We sent a 6-digit code to <strong>{email}</strong>
                </p>
                {otpCountdown > 0 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-primary-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Expires in {formatCountdown()}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase text-gray-500">
                    6-Digit OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && otp.length === 6 && handleVerifyOTP()
                    }
                    className="w-full rounded-lg border border-gray-300 py-3 text-center text-2xl font-bold tracking-[0.5em] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="••••••"
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Verify OTP
                </button>

                <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-500">
                  <button
                    onClick={() => {
                      setStep('email');
                      setOtp('');
                    }}
                    className="flex items-center gap-1 hover:text-primary-600"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Change email
                  </button>
                  <button
                    onClick={handleRequestOTP}
                    disabled={otpCountdown > 540} // Only allow resend after 60 sec
                    className="flex items-center gap-1 hover:text-primary-600 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Resend OTP
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 3: RESET PASSWORD */}
          {step === 'reset' && (
            <>
              <div className="mb-6">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                  <Lock className="h-6 w-6 text-primary-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  Set New Password
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Choose a strong password for your account
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase text-gray-500">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="At least 8 characters"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="mt-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-gray-500">Password strength</span>
                        <span className="font-medium text-gray-700">
                          {strengthLabel().text}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full transition-all ${strengthLabel().color}`}
                          style={{ width: strengthLabel().width }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase text-gray-500">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                      className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Re-enter password"
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      Passwords do not match
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                  Password must contain:
                  <ul className="mt-1 space-y-0.5">
                    <li>✓ At least 8 characters</li>
                    <li>✓ One uppercase letter</li>
                    <li>✓ One lowercase letter</li>
                    <li>✓ One number</li>
                  </ul>
                </div>

                <button
                  onClick={handleResetPassword}
                  disabled={
                    loading || !newPassword || newPassword !== confirmPassword
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Reset Password
                </button>
              </div>
            </>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
            <div className="text-center py-6">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Password Reset!</h2>
              <p className="mt-2 text-sm text-gray-500">
                Your password has been successfully reset. You can now login with
                your new password.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="mt-6 w-full rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>

        {/* Back to login */}
        {step !== 'success' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-primary-600"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}