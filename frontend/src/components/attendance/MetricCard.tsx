import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  icon: LucideIcon;
}

const tones = {
  neutral: 'text-ink',
  success: 'text-positive-text',
  warning: 'text-warning-text',
  danger: 'text-critical-text',
  info: 'text-info-text'
};

export function MetricCard({ label, value, tone = 'neutral', icon: Icon }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#0E1422]/90 p-5 shadow-crafted transition duration-200 hover:-translate-y-0.5 hover:border-blue-400/45 hover:shadow-popover">
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm leading-5 text-muted">{label}</span>
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-blue-400/25 bg-blue-500/12 text-blue-300">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <strong className={`mt-6 block text-2xl font-bold tracking-normal ${tones[tone]}`}>{value}</strong>
    </article>
  );
}