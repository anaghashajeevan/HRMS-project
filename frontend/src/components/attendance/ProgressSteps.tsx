import { CheckCircle2, CircleDot, Loader2, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface ProgressStepsProps {
  activeIndex: number;
  visible: boolean;
  failedIndex?: number;
  complete?: boolean;
  errorMessage?: string | null;
}

const steps = [
  'Connecting to eSSL API',
  'Fetching punch logs',
  'Processing attendance',
  'Generating Excel report',
  'Sending report email',
  'Completed'
];

export function ProgressSteps({ activeIndex, visible, failedIndex, complete = false, errorMessage }: ProgressStepsProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.section
          className="mb-6 w-full min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#0E1422]/88 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-2xl sm:p-5"
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.985 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          aria-live="polite"
        >
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-blue-300">Automation Run</p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-ink">
                {errorMessage ? 'Run needs attention' : complete ? 'Attendance automation completed' : 'Running attendance automation'}
              </h2>
            </div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-blue-400/25 bg-blue-500/12 px-3 py-2 text-sm font-bold text-blue-200">
              {errorMessage ? (
                <XCircle className="h-4 w-4 text-critical-text" aria-hidden="true" />
              ) : complete ? (
                <CheckCircle2 className="h-4 w-4 text-positive-text" aria-hidden="true" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span className="min-w-0 truncate">{errorMessage ? 'Failed' : complete ? 'Complete' : steps[Math.min(activeIndex, steps.length - 1)]}</span>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]">
            <motion.div
              className={`h-full rounded-full ${errorMessage ? 'bg-red-500' : complete ? 'bg-positive-text' : 'bg-[linear-gradient(90deg,#2563eb,#3b82f6,#ef4444)]'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(((activeIndex + 1) / steps.length) * 100, 100)}%` }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          </div>

          <ol className="mt-5 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
            {steps.map((step, index) => {
              const isDone = index < activeIndex || complete;
              const isActive = index === activeIndex && !complete && !errorMessage;
              const isFailed = failedIndex === index || (errorMessage && index === activeIndex);
              return (
                <motion.li
                  key={step}
                  className={`relative flex min-h-[66px] min-w-0 items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-sm font-bold ${
                    isFailed
                      ? 'border-critical-line bg-critical-fill text-critical-text'
                      : isDone
                        ? 'border-positive-line bg-positive-fill text-positive-text'
                        : isActive
                          ? 'border-info-line bg-info-fill text-info-text shadow-[0_14px_34px_rgba(37,99,235,0.16)]'
                          : 'border-white/10 bg-white/[0.045] text-muted'
                  }`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, scale: isActive ? 1.015 : 1 }}
                  transition={{ delay: index * 0.035, duration: 0.22 }}
                >
                  {isActive ? (
                    <motion.span
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-relay-blue"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25 shadow-raised">
                    {isFailed ? (
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    ) : isActive ? (
                      <motion.span animate={{ scale: [1, 1.14, 1] }} transition={{ duration: 1.1, repeat: Infinity }}>
                        <CircleDot className="h-4 w-4" aria-hidden="true" />
                      </motion.span>
                    ) : (
                      <CircleDot className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 leading-5">{step}</span>
                </motion.li>
              );
            })}
          </ol>

          {errorMessage ? (
            <div className="mt-4 rounded-2xl border border-critical-line bg-critical-fill px-4 py-3 text-sm font-semibold text-critical-text">
              {errorMessage}
            </div>
          ) : null}
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}