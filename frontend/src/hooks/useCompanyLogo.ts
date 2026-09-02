import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { normalizeLogoUrl } from '../utils/image';

export interface CompanyLogoData {
  logo_url: string | null;
  name: string;
  tagline: string;
  company_url: string;
}

const DEFAULT_LOGO: CompanyLogoData = {
  logo_url: null,
  name: 'HRMS',
  tagline: 'Enterprise Human Resource Management System',
  company_url: '#',
};

export function useCompanyLogo() {
  const [logo, setLogo] = useState<CompanyLogoData>(DEFAULT_LOGO);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/logos/active/');
        if (cancelled) return;

        setLogo({
          logo_url: normalizeLogoUrl(data?.logo_url ?? null),
          name: data?.name || DEFAULT_LOGO.name,
          tagline: data?.tagline || DEFAULT_LOGO.tagline,
          company_url: data?.company_url || DEFAULT_LOGO.company_url,
        });
      } catch (err) {
        console.warn('Failed to load active company logo:', err);
        if (!cancelled) {
          setLogo(DEFAULT_LOGO);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // ✅ FIX for "prev" error — explicit number type
  const refresh = useCallback(() => {
    setRefreshKey((current: number) => current + 1);
  }, []);

  return { logo, loading, refresh };
}