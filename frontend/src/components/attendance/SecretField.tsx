import type { ChangeEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface SecretFieldProps {
  label: string;
  status: string;
  value: string;
  name: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function SecretField({ label, status, value, name, onChange }: SecretFieldProps) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between gap-3 text-sm font-medium text-slate-300">
        {label}
        <StatusBadge tone={status === 'Configured' ? 'success' : 'muted'}>{status}</StatusBadge>
      </span>
      <span className="relative">
        <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-300" aria-hidden="true" />
        <input
          className="min-h-11 w-full rounded-xl border border-white/10 bg-[#070A12]/80 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
          name={name}
          value={value}
          onChange={onChange}
          type="password"
          autoComplete="new-password"
          placeholder="Enter new password to update"
        />
      </span>
    </label>
  );
}