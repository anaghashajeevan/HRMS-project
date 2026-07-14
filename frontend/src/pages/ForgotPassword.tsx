import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Wire this to your backend endpoint when available:
      //   await api.post('/auth/password/reset-request/', { email });
      await new Promise((r) => setTimeout(r, 1200)); // simulate

      setSubmitted(true);
      toast.success('If the email exists, a reset link has been sent.');
    } catch {
      setError('Something went wrong. Please try again.');
      toast.error('Request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-100">
          <Link
            to="/login"
            className="mb-6 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Link>

          {!submitted ? (
            <>
              <div className="mb-6">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-100">
                  <Mail className="h-7 w-7 text-primary-600" />
                </div>
                <h1 className="text-center text-2xl font-bold text-gray-900">Forgot Password?</h1>
                <p className="mt-2 text-center text-sm text-gray-600">
                  Enter your registered email and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="you@company.com"
                      className={`w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 ${
                        error
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                          : 'border-gray-300 focus:border-primary-500 focus:ring-primary-100'
                      }`}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-primary-700 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-9 w-9 text-green-600" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-gray-900">Check Your Email</h2>
              <p className="text-sm text-gray-600">
                If an account exists for <span className="font-medium">{email}</span>, we've sent a
                password reset link. Please check your inbox (and spam folder).
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Return to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}