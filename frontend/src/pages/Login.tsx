// import { useState, type FormEvent } from 'react';
// import { Link, useNavigate, useLocation } from 'react-router-dom';
// import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
// import { useAuth } from '../context/AuthContext';
// import toast from 'react-hot-toast';
// import { AxiosError } from 'axios';

// export default function Login() {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [showPassword, setShowPassword] = useState(false);
//   const [rememberMe, setRememberMe] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

//   const { login } = useAuth();
//   const navigate = useNavigate();
//   const location = useLocation();
//   const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

//   const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

//   const validate = (): boolean => {
//     const newErrors: typeof errors = {};
//     if (!email.trim()) newErrors.email = 'Email is required';
//     else if (!validateEmail(email)) newErrors.email = 'Please enter a valid email address';

//     if (!password) newErrors.password = 'Password is required';
//     else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     setErrors({});
//     if (!validate()) return;

//     setIsSubmitting(true);
//     try {
//       await login({
//         email: email.trim().toLowerCase(),
//         password,
//         device_id: navigator.userAgent.substring(0, 100),
//       });
//       toast.success('Welcome back!');
//       navigate(from, { replace: true });
//     } catch (err) {
//       const error = err as AxiosError<{ detail?: string; email?: string[]; password?: string[] }>;
//       const status = error.response?.status;
//       const data = error.response?.data;

//       if (status === 400 && data) {
//         setErrors({
//           email: data.email?.[0],
//           password: data.password?.[0],
//           general: data.detail,
//         });
//         toast.error(data.detail || 'Please fix the errors below.');
//       } else if (status === 401) {
//         setErrors({ general: 'Invalid email or password.' });
//         toast.error('Invalid credentials');
//       } else if (status === 403) {
//         setErrors({ general: data?.detail || 'Access denied.' });
//         toast.error(data?.detail || 'Access denied');
//       } else if (status === 429) {
//         setErrors({ general: 'Too many attempts. Please try again later.' });
//         toast.error('Too many attempts');
//       } else if (!error.response) {
//         setErrors({ general: 'Unable to reach server. Please check your connection.' });
//         toast.error('Network error');
//       } else {
//         setErrors({ general: 'Something went wrong. Please try again.' });
//         toast.error('Login failed');
//       }
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4">
//       <div className="w-full max-w-md">
//         {/* Header */}
//         <div className="mb-8 text-center">
//           <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg">
//             <Lock className="h-8 w-8 text-white" />
//           </div>
//           <h1 className="text-3xl font-bold text-gray-900">HRMS Portal</h1>
//           <p className="mt-2 text-sm text-gray-600">Sign in with your work email</p>
//         </div>

//         <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-100">
//           <form onSubmit={handleSubmit} noValidate className="space-y-5">
//             {/* General error */}
//             {errors.general && (
//               <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
//                 <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
//                 <p className="text-sm text-red-700">{errors.general}</p>
//               </div>
//             )}

//             {/* Email */}
//             <div>
//               <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
//                 Email Address
//               </label>
//               <div className="relative">
//                 <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
//                 <input
//                   id="email"
//                   type="email"
//                   autoComplete="email"
//                   value={email}
//                   onChange={(e) => {
//                     setEmail(e.target.value);
//                     if (errors.email) setErrors({ ...errors, email: undefined });
//                   }}
//                   placeholder="you@company.com"
//                   className={`w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm outline-none transition focus:ring-2 ${
//                     errors.email
//                       ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
//                       : 'border-gray-300 focus:border-primary-500 focus:ring-primary-100'
//                   }`}
//                   disabled={isSubmitting}
//                 />
//               </div>
//               {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
//             </div>

//             {/* Password */}
//             <div>
//               <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
//                 Password
//               </label>
//               <div className="relative">
//                 <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
//                 <input
//                   id="password"
//                   type={showPassword ? 'text' : 'password'}
//                   autoComplete="current-password"
//                   value={password}
//                   onChange={(e) => {
//                     setPassword(e.target.value);
//                     if (errors.password) setErrors({ ...errors, password: undefined });
//                   }}
//                   placeholder="Enter your password"
//                   className={`w-full rounded-lg border py-2.5 pl-10 pr-10 text-sm outline-none transition focus:ring-2 ${
//                     errors.password
//                       ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
//                       : 'border-gray-300 focus:border-primary-500 focus:ring-primary-100'
//                   }`}
//                   disabled={isSubmitting}
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword(!showPassword)}
//                   className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
//                   tabIndex={-1}
//                   aria-label={showPassword ? 'Hide password' : 'Show password'}
//                 >
//                   {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
//                 </button>
//               </div>
//               {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
//             </div>

//             {/* Remember + Forgot */}
//             <div className="flex items-center justify-between">
//               <label className="flex items-center gap-2 text-sm text-gray-600">
//                 <input
//                   type="checkbox"
//                   checked={rememberMe}
//                   onChange={(e) => setRememberMe(e.target.checked)}
//                   className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
//                 />
//                 Remember me
//               </label>
//               <Link
//                 to="/forgot-password"
//                 className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
//               >
//                 Forgot password?
//               </Link>
//             </div>

//             {/* Submit */}
//             <button
//               type="submit"
//               disabled={isSubmitting}
//               className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
//             >
//               {isSubmitting ? (
//                 <>
//                   <Loader2 className="h-4 w-4 animate-spin" />
//                   Signing in...
//                 </>
//               ) : (
//                 'Sign In'
//               )}
//             </button>
//           </form>

//           <p className="mt-6 text-center text-xs text-gray-500">
//             Having trouble? Contact your{' '}
//             <a href="mailto:hr@company.com" className="text-primary-600 hover:underline">
//               HR administrator
//             </a>
//           </p>
//         </div>

//         <p className="mt-6 text-center text-xs text-gray-500">
//           © {new Date().getFullYear()} HRMS Enterprise. All rights reserved.
//         </p>
//       </div>
//     </div>
//   );
// }

import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, ShieldCheck, Users, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!validateEmail(email)) newErrors.email = 'Please enter a valid email address';

    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
        device_id: navigator.userAgent.substring(0, 100),
      });
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      const error = err as AxiosError<{ detail?: string; email?: string[]; password?: string[] }>;
      const status = error.response?.status;
      const data = error.response?.data;

      if (status === 400 && data) {
        setErrors({
          email: data.email?.[0],
          password: data.password?.[0],
          general: data.detail,
        });
        toast.error(data.detail || 'Please fix the errors below.');
      } else if (status === 401) {
        setErrors({ general: 'Invalid email or password.' });
        toast.error('Invalid credentials');
      } else if (status === 403) {
        setErrors({ general: data?.detail || 'Access denied.' });
        toast.error(data?.detail || 'Access denied');
      } else if (status === 429) {
        setErrors({ general: 'Too many attempts. Please try again later.' });
        toast.error('Too many attempts');
      } else if (!error.response) {
        setErrors({ general: 'Unable to reach server. Please check your connection.' });
        toast.error('Network error');
      } else {
        setErrors({ general: 'Something went wrong. Please try again.' });
        toast.error('Login failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <style>{css}</style>

      {/* LEFT PANEL — brand / motion side */}
      <div style={styles.leftPanel} className="hrms-left">
        <div style={styles.leftGradient} />
        <div className="hrms-orb hrms-orb-1" />
        <div className="hrms-orb hrms-orb-2" />
        <div className="hrms-orb hrms-orb-3" />

        {/* connective node network — signature element */}
        <svg
          viewBox="0 0 400 400"
          style={styles.nodeSvg}
          className="hrms-node-svg"
          aria-hidden="true"
        >
          <g className="hrms-nodes">
            <line x1="80" y1="90" x2="200" y2="160" className="hrms-edge" />
            <line x1="200" y1="160" x2="330" y2="100" className="hrms-edge" />
            <line x1="200" y1="160" x2="150" y2="280" className="hrms-edge" />
            <line x1="200" y1="160" x2="300" y2="260" className="hrms-edge" />
            <line x1="150" y1="280" x2="300" y2="260" className="hrms-edge" />
            <line x1="80" y1="90" x2="150" y2="280" className="hrms-edge" />
            <circle cx="80" cy="90" r="7" className="hrms-node hrms-node-a" />
            <circle cx="200" cy="160" r="10" className="hrms-node hrms-node-b" />
            <circle cx="330" cy="100" r="6" className="hrms-node hrms-node-c" />
            <circle cx="150" cy="280" r="8" className="hrms-node hrms-node-d" />
            <circle cx="300" cy="260" r="6" className="hrms-node hrms-node-e" />
          </g>
        </svg>

        <div style={styles.leftContent}>
          <div style={styles.brandRow} className="hrms-brand-row">
            <div style={styles.brandMark} className="hrms-brand-mark">
              <Building2 size={22} color="#fff" strokeWidth={2.25} />
            </div>
            <div style={styles.brandTextCol}>
              <span style={styles.brandName}>
                HRMS<span style={styles.brandNameAccent}> Portal</span>
              </span>
              <span style={styles.brandTag}>ENTERPRISE EDITION</span>
            </div>
          </div>

          <h1 style={styles.leftHeadline}>
            Every person,
            <br />
            one system of record.
          </h1>
          <p style={styles.leftSub}>
            Payroll, attendance, and people operations — connected in real time
            across your whole organization.
          </p>

          <div style={styles.statRow}>
            <div style={styles.statItem}>
              <Users size={18} color="#e9d5ff" />
              <div>
                <div style={styles.statNum}>12,400+</div>
                <div style={styles.statLabel}>employees managed</div>
              </div>
            </div>
            <div style={styles.statItem}>
              <ShieldCheck size={18} color="#e9d5ff" />
              <div>
                <div style={styles.statNum}>SOC 2</div>
                <div style={styles.statLabel}>compliant infrastructure</div>
              </div>
            </div>
          </div>

          {/* team snapshot illustration — the "picture" */}
          <div style={styles.teamCard} className="hrms-team-card">
            <div style={styles.avatarStack}>
              <div style={{ ...styles.avatar, ...styles.avatar1 }}>AR</div>
              <div style={{ ...styles.avatar, ...styles.avatar2 }}>SK</div>
              <div style={{ ...styles.avatar, ...styles.avatar3 }}>MJ</div>
              <div style={{ ...styles.avatar, ...styles.avatarMore }}>+9k</div>
            </div>
            <div>
              <div style={styles.teamCardTitle}>Your whole workforce, in sync</div>
              <div style={styles.teamCardSub}>
                <span className="hrms-live-dot" /> Live directory · updated in real time
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — form side */}
      <div style={styles.rightPanel}>
        <div className="hrms-blob-top" />
        <div className="hrms-blob-bottom" />

        <div style={styles.formWrap} className="hrms-form-wrap">
          <div style={styles.mobileBrandRow} className="hrms-mobile-brand">
            <div style={styles.brandMarkSmall}>
              <Building2 size={16} color="#fff" strokeWidth={2.25} />
            </div>
            <span style={styles.brandNameSmall}>HRMS Portal</span>
          </div>

          <h2 style={styles.formTitle}>Welcome back</h2>
          <p style={styles.formSubtitle}>Sign in with your work email to continue</p>

          <form onSubmit={handleSubmit} noValidate style={{ marginTop: 28 }}>
            {errors.general && (
              <div style={styles.generalError} className="hrms-shake">
                <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={styles.generalErrorText}>{errors.general}</p>
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="email" style={styles.label}>
                Email address
              </label>
              <div
                style={{
                  ...styles.inputShell,
                  ...(focusedField === 'email' ? styles.inputShellFocused : {}),
                  ...(errors.email ? styles.inputShellError : {}),
                }}
              >
                <Mail size={17} color={focusedField === 'email' ? '#7c3aed' : '#a1a1aa'} style={{ flexShrink: 0 }} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  placeholder="you@company.com"
                  style={styles.input}
                  disabled={isSubmitting}
                />
              </div>
              {errors.email && <p style={styles.fieldError}>{errors.email}</p>}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 10 }}>
              <label htmlFor="password" style={styles.label}>
                Password
              </label>
              <div
                style={{
                  ...styles.inputShell,
                  ...(focusedField === 'password' ? styles.inputShellFocused : {}),
                  ...(errors.password ? styles.inputShellError : {}),
                }}
              >
                <Lock size={17} color={focusedField === 'password' ? '#7c3aed' : '#a1a1aa'} style={{ flexShrink: 0 }} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  placeholder="Enter your password"
                  style={styles.input}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && <p style={styles.fieldError}>{errors.password}</p>}
            </div>

            {/* Remember + Forgot */}
            <div style={styles.rowBetween}>
              <label style={styles.rememberLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={styles.checkbox}
                />
                Remember me
              </label>
              <Link to="/forgot-password" style={styles.forgotLink}>
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...styles.submitButton,
                ...(isSubmitting ? styles.submitButtonDisabled : {}),
              }}
              className="hrms-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="hrms-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p style={styles.helpText}>
            Having trouble?{' '}
            <a href="mailto:hr@company.com" style={styles.helpLink}>
              Contact your HR administrator
            </a>
          </p>
        </div>

        <p style={styles.copyright}>© {new Date().getFullYear()} HRMS Enterprise. All rights reserved.</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: '#0f0a24',
    overflow: 'hidden',
  },
  leftPanel: {
    position: 'relative',
    flex: '0 0 44%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  leftGradient: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(135deg, #4c1d95 0%, #6d28d9 45%, #7c3aed 75%, #a855f7 100%)',
    backgroundSize: '200% 200%',
    animation: 'hrmsGradientShift 12s ease infinite',
  },
  nodeSvg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  leftContent: {
    position: 'relative',
    zIndex: 2,
    padding: '0 56px',
    maxWidth: 480,
    color: '#fff',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    marginBottom: 48,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 13,
    background: 'linear-gradient(135deg, #f5d0fe 0%, #a855f7 55%, #6d28d9 100%)',
    border: '1px solid rgba(255,255,255,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 18px -4px rgba(168,85,247,0.65), inset 0 0 0 1px rgba(255,255,255,0.15)',
    flexShrink: 0,
  },
  brandTextCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  brandName: {
    fontSize: 21,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: '#ffffff',
  },
  brandNameAccent: {
    fontWeight: 500,
    color: '#e9d5ff',
  },
  brandTag: {
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.14)',
    border: '1px solid rgba(251,191,36,0.35)',
    borderRadius: 5,
    padding: '2px 7px',
    width: 'fit-content',
  },
  teamCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginTop: 28,
    padding: '14px 16px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.20)',
    backdropFilter: 'blur(8px)',
  },
  avatarStack: {
    display: 'flex',
    flexShrink: 0,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11.5,
    fontWeight: 700,
    color: '#fff',
    border: '2px solid #5b21b6',
    marginLeft: -10,
  },
  avatar1: {
    background: 'linear-gradient(135deg, #fb923c, #f472b6)',
    marginLeft: 0,
  },
  avatar2: {
    background: 'linear-gradient(135deg, #34d399, #0ea5e9)',
  },
  avatar3: {
    background: 'linear-gradient(135deg, #818cf8, #c084fc)',
  },
  avatarMore: {
    background: 'rgba(255,255,255,0.22)',
    fontSize: 10.5,
  },
  teamCardTitle: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 3,
  },
  teamCardSub: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
  },
  leftHeadline: {
    fontSize: 40,
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: '-0.02em',
    margin: '0 0 18px 0',
  },
  leftSub: {
    fontSize: 15.5,
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.82)',
    margin: '0 0 40px 0',
    maxWidth: 400,
  },
  statRow: {
    display: 'flex',
    gap: 32,
    paddingTop: 28,
    borderTop: '1px solid rgba(255,255,255,0.18)',
  },
  statItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  statNum: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.3,
  },
  statLabel: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.7)',
  },
  rightPanel: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#faf9fc',
    overflow: 'hidden',
    padding: '32px 24px',
  },
  formWrap: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: 400,
    background: '#ffffff',
    borderRadius: 20,
    padding: '38px 34px',
    boxShadow:
      '0 1px 2px rgba(76,29,149,0.04), 0 20px 48px -12px rgba(124,58,237,0.18)',
    border: '1px solid #f1edf9',
  },
  mobileBrandRow: {
    display: 'none',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  brandMarkSmall: {
    width: 30,
    height: 30,
    borderRadius: 9,
    background: 'linear-gradient(135deg, #6d28d9, #a855f7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandNameSmall: {
    fontSize: 15,
    fontWeight: 700,
    color: '#3b0764',
  },
  formTitle: {
    fontSize: 25,
    fontWeight: 800,
    color: '#1e1033',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  formSubtitle: {
    fontSize: 13.5,
    color: '#6b7280',
    margin: '6px 0 0 0',
  },
  generalError: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    padding: '11px 12px',
    marginBottom: 18,
  },
  generalErrorText: {
    fontSize: 13,
    color: '#b91c1c',
    margin: 0,
    lineHeight: 1.4,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#3f3153',
    marginBottom: 7,
  },
  inputShell: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    border: '1.5px solid #e6e1f2',
    borderRadius: 12,
    padding: '10px 13px',
    background: '#fbfaff',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
  },
  inputShellFocused: {
    borderColor: '#a855f7',
    background: '#ffffff',
    boxShadow: '0 0 0 4px rgba(168,85,247,0.14)',
  },
  inputShellError: {
    borderColor: '#fca5a5',
    background: '#fff8f8',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14.5,
    color: '#1e1033',
    fontFamily: 'inherit',
  },
  eyeButton: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    color: '#a1a1aa',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  fieldError: {
    fontSize: 12,
    color: '#dc2626',
    margin: '6px 0 0 2px',
  },
  rowBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '4px 0 24px 0',
  },
  rememberLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 13,
    color: '#52525b',
    cursor: 'pointer',
  },
  checkbox: {
    width: 15,
    height: 15,
    accentColor: '#7c3aed',
    cursor: 'pointer',
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: 600,
    color: '#7c3aed',
    textDecoration: 'none',
  },
  submitButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 'none',
    borderRadius: 12,
    padding: '12px 0',
    fontSize: 14.5,
    fontWeight: 700,
    color: '#fff',
    background: 'linear-gradient(135deg, #6d28d9, #7c3aed 55%, #a855f7)',
    backgroundSize: '160% 160%',
    cursor: 'pointer',
    boxShadow: '0 10px 24px -8px rgba(124,58,237,0.55)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-position 0.4s ease',
  },
  submitButtonDisabled: {
    opacity: 0.75,
    cursor: 'not-allowed',
  },
  helpText: {
    textAlign: 'center',
    fontSize: 12.5,
    color: '#8b8398',
    marginTop: 24,
  },
  helpLink: {
    color: '#7c3aed',
    fontWeight: 600,
    textDecoration: 'none',
  },
  copyright: {
    position: 'relative',
    zIndex: 2,
    marginTop: 22,
    fontSize: 11.5,
    color: '#b3aec2',
  },
};

const css = `
@keyframes hrmsGradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes hrmsFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(14px, -18px) scale(1.06); }
}

@keyframes hrmsPulse {
  0%, 100% { opacity: 0.55; r: var(--r, 7); }
  50% { opacity: 1; }
}

@keyframes hrmsDash {
  from { stroke-dashoffset: 24; }
  to { stroke-dashoffset: 0; }
}

@keyframes hrmsSpin {
  to { transform: rotate(360deg); }
}

@keyframes hrmsLiveDot {
  0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.55); }
  50% { box-shadow: 0 0 0 4px rgba(74,222,128,0); }
}

@keyframes hrmsBrandGlow {
  0%, 100% { box-shadow: 0 6px 18px -4px rgba(168,85,247,0.65), inset 0 0 0 1px rgba(255,255,255,0.15); }
  50% { box-shadow: 0 6px 24px -2px rgba(216,180,254,0.85), inset 0 0 0 1px rgba(255,255,255,0.25); }
}

.hrms-brand-mark {
  animation: hrmsBrandGlow 3.2s ease-in-out infinite;
}

.hrms-live-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  animation: hrmsLiveDot 2s ease-in-out infinite;
}

.hrms-team-card {
  transition: transform 0.2s ease, background 0.2s ease;
}
.hrms-team-card:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,0.14);
}

@keyframes hrmsShake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}

.hrms-spin {
  animation: hrmsSpin 0.8s linear infinite;
}

.hrms-shake {
  animation: hrmsShake 0.4s ease;
}

.hrms-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px -8px rgba(124,58,237,0.65);
  background-position: 100% 0%;
}
.hrms-submit:active:not(:disabled) {
  transform: translateY(0);
}

.hrms-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(2px);
  z-index: 1;
  animation: hrmsFloat 7s ease-in-out infinite;
}
.hrms-orb-1 {
  width: 130px; height: 130px;
  top: 8%; left: 65%;
  background: radial-gradient(circle at 30% 30%, rgba(233,213,255,0.55), rgba(233,213,255,0) 70%);
  animation-delay: 0s;
}
.hrms-orb-2 {
  width: 90px; height: 90px;
  bottom: 14%; left: 10%;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 70%);
  animation-delay: 1.5s;
}
.hrms-orb-3 {
  width: 60px; height: 60px;
  top: 45%; left: 8%;
  background: radial-gradient(circle at 30% 30%, rgba(216,180,254,0.5), rgba(216,180,254,0) 70%);
  animation-delay: 3s;
}

.hrms-edge {
  stroke: rgba(255,255,255,0.35);
  stroke-width: 1.2;
  stroke-dasharray: 4 4;
  animation: hrmsDash 3s linear infinite;
}
.hrms-node {
  fill: #f5f3ff;
  animation: hrmsPulse 3.5s ease-in-out infinite;
}
.hrms-node-a { animation-delay: 0s; }
.hrms-node-b { animation-delay: 0.4s; fill: #ffffff; }
.hrms-node-c { animation-delay: 0.8s; }
.hrms-node-d { animation-delay: 1.2s; }
.hrms-node-e { animation-delay: 1.6s; }

.hrms-blob-top, .hrms-blob-bottom {
  position: absolute;
  border-radius: 50%;
  z-index: 0;
  filter: blur(0px);
}
.hrms-blob-top {
  width: 380px; height: 380px;
  top: -140px; right: -120px;
  background: radial-gradient(circle, rgba(216,180,254,0.35), rgba(216,180,254,0) 70%);
}
.hrms-blob-bottom {
  width: 320px; height: 320px;
  bottom: -140px; left: -100px;
  background: radial-gradient(circle, rgba(196,181,253,0.3), rgba(196,181,253,0) 70%);
}

@media (max-width: 860px) {
  .hrms-left {
    display: none !important;
  }
  .hrms-mobile-brand {
    display: flex !important;
  }
}

@media (max-width: 480px) {
  .hrms-form-wrap {
    padding: 28px 22px !important;
    border-radius: 16px !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hrms-orb, .hrms-edge, .hrms-node, .hrms-spin, .hrms-shake, .hrms-submit,
  .hrms-brand-mark, .hrms-live-dot {
    animation: none !important;
  }
}
`;