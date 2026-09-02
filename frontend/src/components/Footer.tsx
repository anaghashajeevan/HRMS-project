import { useCompanyLogo } from '../hooks/useCompanyLogo';

export default function Footer() {
  const { logo } = useCompanyLogo();
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-gray-200 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
        {/* Logo */}
        <div className="flex items-center gap-3">
          {logo.logo_url ? (
            <img 
              src={logo.logo_url} 
              alt={logo.name} 
              className="h-8 w-auto object-contain" 
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-xs font-bold text-white">
              NL
            </div>
          )}
        </div>

        {/* Tagline */}
        <p className="text-xs tracking-wide text-gray-400 uppercase italic">
          {logo.tagline}
        </p>

        {/* Copyright */}
        <p className="text-xs text-gray-500">
          © {year}{' '}
          <a
            href={logo.company_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
          >
            {logo.name}
          </a>
          {' · '}All rights reserved
        </p>
      </div>
    </footer>
  );
}