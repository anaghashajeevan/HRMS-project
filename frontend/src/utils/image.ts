// src/utils/image.ts

// 1. Read the API URL defined at build time (e.g., "http://yourdomain.com/api/v1")
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

// 2. Extract the base Django server URL (e.g., "http://yourdomain.com")
const DJANGO_SERVER_URL = API_BASE_URL.replace('/api/v1', '');

export function normalizeLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // If the backend returned a fully qualified absolute URL (e.g., http://...), use it directly
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a relative path (e.g., /media/company_logos/logo.png), prepend the dynamic server URL
  const separator = url.startsWith('/') ? '' : '/';
  return `${DJANGO_SERVER_URL}${separator}${url}`;
}