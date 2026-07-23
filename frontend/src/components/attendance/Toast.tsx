import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface ToastState {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toast: ToastState | null;
}

export function Toast({ toast }: ToastProps) {
  if (!toast) {
    return null;
  }

  const icon =
    toast.type === 'success' ? (
      <CheckCircle2 className="h-5 w-5 text-positive-text" aria-hidden="true" />
    ) : toast.type === 'error' ? (
      <AlertCircle className="h-5 w-5 text-critical-text" aria-hidden="true" />
    ) : (
      <Info className="h-5 w-5 text-info-text" aria-hidden="true" />
    );

  const tone =
    toast.type === 'success'
      ? 'border-positive-line/70 bg-[#07140d]/95 text-positive-text'
      : toast.type === 'error'
        ? 'border-critical-line/70 bg-[#19070a]/95 text-critical-text'
        : 'border-info-line/70 bg-[#081225]/95 text-info-text';

  return (
    <AnimatePresence>
      <motion.div
        className={`fixed left-4 right-4 top-4 z-50 flex max-w-none items-start gap-3 rounded-2xl border p-4 text-sm font-semibold shadow-[0_24px_80px_rgba(0,0,0,0.52)] backdrop-blur-xl sm:left-auto sm:right-6 sm:top-6 sm:max-w-md ${tone}`}
        initial={{ opacity: 0, y: -14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {icon}
        <span>{toast.message}</span>
      </motion.div>
    </AnimatePresence>
  );
}