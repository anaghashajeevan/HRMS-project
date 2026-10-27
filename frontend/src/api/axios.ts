import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// Use the HRMS host's reverse proxy in production. A browser opened through
// NexusOne must not call its own localhost address.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';



const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  // The Nexus SSO handshake uses a short-lived, HttpOnly state cookie.  It
  // must accompany both the request that starts SSO and the code exchange.
  // This is a no-op for the normal same-origin /api proxy, and also supports
  // a deliberately configured credentialed API origin.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ---------- Request Interceptor: attach access token ----------
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- Response Interceptor: refresh on 401 ----------
let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else if (token) p.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // A 401 from a login or SSO-code exchange describes that request itself;
    // it is not an expired HRMS session.  Let the caller show the provider's
    // response rather than clearing storage and redirecting back to /login.
    const requestUrl = originalRequest?.url || '';
    const isAuthenticationRequest =
      requestUrl.includes('/auth/token/') ||
      requestUrl.includes('/auth/sso/') ||
      requestUrl.includes('/auth/token/refresh/');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthenticationRequest) {
      const refresh = localStorage.getItem('refresh_token');

      if (!refresh) {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh,
        });
        localStorage.setItem('access_token', data.access);
        if (data.refresh) localStorage.setItem('refresh_token', data.refresh);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
        }
        processQueue(null, data.access);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
