import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0E1422]/86 p-5 shadow-glass backdrop-blur-xl">
      <h2 className="mb-5 text-lg font-semibold text-white">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}