import type { ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Minus } from 'lucide-react';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'muted' | 'info';
export type BadgeVariant = 'positive' | 'neutral' | 'info' | 'warning' | 'critical';

interface StatusBadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  withIcon?: boolean;
}

const toneToVariant: Record<BadgeTone, BadgeVariant> = {
  success: 'positive',
  warning: 'warning',
  danger: 'critical',
  muted: 'neutral',
  info: 'info'
};

const variants: Record<BadgeVariant, string> = {
  positive: 'border-positive-line/80 bg-positive-fill/90 text-positive-text shadow-[0_0_22px_rgba(34,197,94,0.08)]',
  neutral: 'border-neutral-line bg-neutral-fill/90 text-neutral-text',
  info: 'border-info-line/80 bg-info-fill/90 text-info-text shadow-[0_0_22px_rgba(37,99,235,0.10)]',
  warning: 'border-warning-line/80 bg-warning-fill/90 text-warning-text',
  critical: 'border-critical-line/80 bg-critical-fill/90 text-critical-text shadow-[0_0_22px_rgba(220,38,38,0.12)]'
};

const icons = {
  positive: CheckCircle2,
  neutral: Minus,
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon
};

const sizes = {
  sm: 'min-h-6 px-2.5 text-xs',
  md: 'min-h-7 px-3 text-xs'
};

export function StatusBadge({ children, tone = 'muted', variant, size = 'sm', withIcon = false }: StatusBadgeProps) {
  const resolvedVariant = variant || toneToVariant[tone];
  const Icon = icons[resolvedVariant];

  return (
    <span className={`state-pop inline-flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border font-bold shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] ${sizes[size]} ${variants[resolvedVariant]}`}>
      {withIcon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}