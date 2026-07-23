import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  children: ReactNode;
}

const variants = {
  primary:
    'border border-blue-400/50 bg-[linear-gradient(135deg,#1d4ed8,#3b82f6)] text-white shadow-[0_16px_42px_rgba(37,99,235,0.42),0_0_0_1px_rgba(255,255,255,0.16)_inset] hover:shadow-[0_20px_54px_rgba(37,99,235,0.54),0_0_0_1px_rgba(255,255,255,0.22)_inset]',
  secondary:
    'border border-white/10 bg-white/[0.055] text-slate-100 shadow-[0_12px_34px_rgba(0,0,0,0.32),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-xl hover:border-blue-400/45 hover:bg-blue-500/10 hover:text-white',
  danger:
    'border border-red-400/45 bg-red-500/12 text-red-200 shadow-[0_14px_36px_rgba(220,38,38,0.16)] hover:bg-red-500/18 hover:text-red-100'
};

export function Button({
  variant = 'secondary',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold tracking-[-0.01em] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      whileHover={disabled || loading ? undefined : { y: -2, scale: 1.012 }}
      whileTap={disabled || loading ? undefined : { y: 0, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </motion.button>
  );
}