// src/hooks/useCompanyLogo.ts (or src/api/useCompanyLogo.ts)
import { useState, useEffect } from 'react';
import { normalizeLogoUrl } from '../utils/image';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

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
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE_URL}/logos/active/`)
      .then((res) => res.json())
      .then((data) => {
        setLogo({
          logo_url: normalizeLogoUrl(data.logo_url),
          name: data.name || DEFAULT_LOGO.name,
          tagline: data.tagline || DEFAULT_LOGO.tagline,
          company_url: data.company_url || DEFAULT_LOGO.company_url,
        });
      })
      .catch((err) => {
        console.error("Failed to load active logo:", err);
      })
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const refresh = () => setRefreshTrigger((prev) => prev + 1);

  return { logo, loading, refresh };
}