import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import type { UserProfile, LoginPayload } from '../types/auth';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  loginWithNexus: (code: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * An HRMS session is valid only in the document that received the SSO
 * callback.  sessionStorage alone is not sufficient here: browsers can copy
 * it when a tab is duplicated, and it also survives typing a new HRMS URL in
 * the address bar.  That previously let /dashboard restore a session before
 * the /login SSO redirect could run.
 */
const isSsoCallbackDocument = () => {
  const query = new URLSearchParams(window.location.search);
  return window.location.pathname === '/login' && Boolean(query.get('code'));
};

const isFreshDocumentNavigation = () => {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return entry?.type === 'navigate' || entry?.type === 'reload';
};

const discardDirectUrlSession = () => {
  if (isSsoCallbackDocument() || !isFreshDocumentNavigation()) return;

  // Preserve the explicit sign-out marker so Login does not silently create
  // a new session when the browser is sent back to the SSO portal.
  const signedOut = sessionStorage.getItem('hrms_sso_signed_out');
  sessionStorage.clear();
  if (signedOut === 'true') sessionStorage.setItem('hrms_sso_signed_out', 'true');
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      // This must run before reading access_token.  A pasted IP/URL is a new
      // document navigation, never an SSO launch, so it cannot reuse the
      // authenticated tab's stored credentials.
      discardDirectUrlSession();
      const token = sessionStorage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        setUser(me);
      } catch {
        sessionStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (payload: LoginPayload) => {
    const res = await authApi.login(payload);
    sessionStorage.removeItem('hrms_sso_signed_out');
    sessionStorage.setItem('access_token', res.access);
    sessionStorage.setItem('refresh_token', res.refresh);
    sessionStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
  };

  const loginWithNexus = async (code: string, state: string) => {
    const res = await authApi.loginWithNexus(code, state);
    sessionStorage.removeItem('hrms_sso_signed_out');
    sessionStorage.setItem('access_token', res.access);
    sessionStorage.setItem('refresh_token', res.refresh);
    sessionStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
  };

  const logout = async () => {
    const refresh = sessionStorage.getItem('refresh_token');
    try {
      if (refresh) await authApi.logout(refresh);
    } catch {
      // ignore
    } finally {
      // Keep the user signed out instead of immediately reusing an active
      // Nexus browser session when the app navigates to /login.
      sessionStorage.clear();
      sessionStorage.setItem('hrms_sso_signed_out', 'true');
      setUser(null);
      // A CRM logout returns to the central NexusOne applications workspace.
      // Do not use the callback-only Company Portal URL here.
      window.location.replace(`${window.location.protocol}//${window.location.hostname}:7000/login`);
    }
  };

  const refreshUser = async () => {
    const me = await authApi.me();
    setUser(me);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithNexus,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
