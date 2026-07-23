import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlarmClock, AlertOctagon, CalendarClock, Clock3, Download,
  Loader2, MailCheck, Play, Send, ServerCog, TimerReset, UsersRound, Wifi,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';

import type {
  AttendanceDashboardData, AttendanceSummary, DashboardMonthlyReport,
} from '../../types/attendance';
import { attendanceDashboardApi, attendanceAutomationApi, attendanceReportsApi } from '../../api/attendance';
import { AttendanceTable } from '../../components/attendance/AttendanceTable';
import { Button } from '../../components/attendance/Button';
import { ProgressSteps } from '../../components/attendance/ProgressSteps';
import { StatusBadge, type BadgeVariant } from '../../components/attendance/StatusBadge';
import { Toast, type ToastState } from '../../components/attendance/Toast';

const automationSteps = [
  'Connecting to eSSL API', 'Fetching punch logs', 'Processing attendance',
  'Generating Excel report', 'Sending report email', 'Completed',
];

const premiumEase = [0.16, 1, 0.3, 1] as const;

const pageVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: premiumEase } },
};

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function useAnimatedNumber(value: number, duration = 680) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      previousValue.current = value;
      setDisplayValue(value);
      return undefined;
    }
    const startValue = previousValue.current;
    const delta = value - startValue;
    const startTime = window.performance.now();
    let frame = 0;
    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      setDisplayValue(Math.round(startValue + delta * easeOutCubic(progress)));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
      else previousValue.current = value;
    }
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, value]);

  return displayValue;
}

function reportVariant(status: string): BadgeVariant {
  const normalized = status.toLowerCase();
  if (normalized === 'success') return 'positive';
  if (normalized.includes('fail')) return 'critical';
  if (normalized.includes('not sent') || normalized === '-') return 'neutral';
  return 'warning';
}

export default function AttendanceDashboardPage() {
  const [data, setData] = useState<AttendanceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [automationComplete, setAutomationComplete] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [automationError, setAutomationError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const response = await attendanceDashboardApi.getDashboard();
      setData(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load dashboard.';
      setToast({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }

  async function runAutomation() {
    setRunning(true);
    setAutomationComplete(false);
    setToast(null);
    setAutomationError(null);
    setActiveStep(0);

    let step = 0;
    const interval = window.setInterval(() => {
      step = Math.min(step + 1, automationSteps.length - 2);
      setActiveStep(step);
    }, 820);

    try {
      const result = await attendanceAutomationApi.run();
      window.clearInterval(interval);
      if (!result.ok) {
        throw new Error(result.message || 'Attendance automation failed.');
      }
      setActiveStep(automationSteps.length - 1);
      setAutomationComplete(true);
      setToast({ type: 'success', message: result.message });
      window.setTimeout(() => loadDashboard(), 1300);
    } catch (error: any) {
      window.clearInterval(interval);
      const message = error?.response?.data?.message || (error instanceof Error ? error.message : 'Attendance automation failed.');
      setAutomationError(message);
      setToast({ type: 'error', message });
      setRunning(false);
      setAutomationComplete(false);
    } finally {
      setTimeout(() => setRunning(false), 1400);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <span className="text-sm font-semibold">Loading attendance dashboard…</span>
        </div>
      </div>
    );
  }

  const downloadUrl = data.downloadReportUrl;

  return (
    <>
      <Toast toast={toast} />
      <motion.div
        className="mx-auto grid w-full max-w-[1280px] min-w-0 overflow-hidden gap-4 xl:gap-5"
        variants={pageVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <DashboardHeader
            reportDate={data.reportDate}
            rowCount={data.attendanceRows.length}
            downloadReportUrl={downloadUrl}
            running={running}
            onRunAutomation={runAutomation}
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <ProcessStatusRail
            apiStatus={data.apiStatus}
            reportSentStatus={data.summary.reportSentStatus}
            lastSentTime={data.summary.lastSentTime}
            running={running}
            activeStep={activeStep}
            lastError={automationError}
            complete={automationComplete}
          />
        </motion.div>

        <AnimatePresence>
          {automationError && (
            <motion.div variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, y: -8 }}>
              <AutomationErrorAlert message={automationError} running={running} onRetry={runAutomation} />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={fadeUp}>
          <AttendanceSummaryBand summary={data.summary} />
        </motion.div>

        <ProgressSteps
          visible={running || automationComplete || Boolean(automationError)}
          activeIndex={activeStep}
          complete={automationComplete}
          errorMessage={automationError}
        />

        {data.monthlyReport.available && (
          <motion.div variants={fadeUp}>
            <MonthlyStatusCard report={data.monthlyReport} />
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          {data.attendanceRows.length ? (
            <AttendanceTable rows={data.attendanceRows} />
          ) : data.monthlyReport.available ? null : (
            <DashboardEmptyState running={running} onRunAutomation={runAutomation} />
          )}
        </motion.div>
      </motion.div>
    </>
  );
}

interface DashboardHeaderProps {
  reportDate: string;
  rowCount: number;
  downloadReportUrl: string;
  running: boolean;
  onRunAutomation: () => void;
}

function DashboardHeader({ reportDate, rowCount, downloadReportUrl, running, onRunAutomation }: DashboardHeaderProps) {
  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-[24px] border border-blue-400/20 bg-[#0E1422]/88 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.48),0_0_58px_rgba(37,99,235,0.10),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-2xl sm:p-5 lg:p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-relay-blue/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-28 w-64 rounded-full bg-red-500/10 blur-3xl" />
      <div className="relative flex min-w-0 flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/25 bg-blue-500/12 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-blue-300">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Daily Attendance
          </div>
          <h1 className="mt-3 break-words text-3xl font-black leading-tight tracking-[-0.04em] text-ink lg:text-4xl">{reportDate}</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-muted sm:text-base">
            Generated from eSSL punch activity. {rowCount ? `${rowCount} register rows are ready for review.` : "Run automation to build today's register."}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap 2xl:w-auto 2xl:max-w-[540px] 2xl:justify-end">
          {downloadReportUrl && (
            <motion.button
              className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-bold text-slate-100 shadow-[0_12px_34px_rgba(0,0,0,0.32),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-xl transition-colors hover:border-blue-400/45 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2 focus:ring-offset-canvas sm:w-auto"
              whileHover={{ y: -2, scale: 1.012 }}
              whileTap={{ scale: 0.985 }}
              onClick={async () => {
                try {
                  // Extract log id from URL: /api/v1/attendance/reports/daily/<uuid>/download/
                  const match = downloadReportUrl.match(/daily\/([^/]+)\/download/);
                  if (!match) return;
                  const logId = match[1];
                  const blob = await attendanceReportsApi.downloadDaily(logId);
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Daily_Attendance_${new Date().toISOString().split('T')[0]}.xlsx`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('Download failed', err);
                }
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download Daily Excel
            </motion.button>
          )}
          <Button variant="primary" loading={running} onClick={onRunAutomation} className="min-h-11 w-full min-w-0 whitespace-nowrap px-5 shadow-[0_18px_44px_rgba(37,99,235,0.34)] sm:w-auto">
            <Play className="h-4 w-4" aria-hidden="true" />
            {running ? 'Running Automation' : 'Run Attendance Automation'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function MonthlyStatusCard({ report }: { report: DashboardMonthlyReport }) {
  const metrics = [
    ['Employees Count', report.employeesCount],
    ['Attendance Days', report.attendanceDays],
    ['Absent Days', report.absentDays],
    ['Missing Punch Days', report.missingPunchDays],
    ['Total Working Hours', report.totalWorkingHours],
  ];

  return (
    <section className="w-full min-w-0 rounded-[24px] border border-positive-line bg-positive-fill/80 p-5 shadow-[0_18px_54px_rgba(22,163,74,0.12)]">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-xl border border-positive-line bg-black/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-positive-text">
            <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Monthly Report
          </div>
          <h2 className="mt-3 text-xl font-black tracking-[-0.02em] text-ink">Monthly Attendance Report Sent Successfully</h2>
          <div className="mt-2 grid gap-1 text-sm font-semibold text-muted">
            <span>Report Period: <strong className="text-ink">{report.periodLabel}</strong></span>
            <span>Sent To: <strong className="text-ink">{report.sentTo || '-'}</strong></span>
            <span>Sent At: <strong className="text-ink">{report.sentAt}</strong></span>
          </div>
        </div>
        {report.downloadUrl && (
          <button
            onClick={async () => {
              try {
                const match = report.downloadUrl.match(/monthly\/([^/]+)\/download/);
                if (!match) return;
                const logId = match[1];
                const blob = await attendanceReportsApi.downloadMonthly(logId);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Monthly_Attendance_${report.periodLabel}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Download failed', err);
              }
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-positive-line bg-black/10 px-4 text-sm font-bold text-ink transition hover:bg-black/15"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Monthly Excel
          </button>
        )}
      </div>
      <div className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-positive-line/70 bg-black/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
            <p className="mt-1 text-lg font-black text-ink">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

interface ProcessStatusRailProps {
  apiStatus: string;
  reportSentStatus: string;
  lastSentTime: string;
  running: boolean;
  activeStep: number;
  lastError: string | null;
  complete: boolean;
}

function ProcessStatusRail({ apiStatus, reportSentStatus, lastSentTime, running, activeStep, lastError, complete }: ProcessStatusRailProps) {
  const items = useMemo(() => [
    { label: 'API', value: apiStatus, detail: apiStatus === 'Configured' ? 'Device configured' : 'Setup required', icon: ServerCog, variant: apiStatus === 'Configured' ? ('positive' as const) : ('warning' as const) },
    { label: 'Automation', value: lastError ? 'Failed' : running ? 'Running' : complete ? 'Complete' : 'Ready', detail: running ? automationSteps[activeStep] || 'Working' : lastError || 'Manual trigger', icon: Activity, variant: lastError ? ('critical' as const) : running ? ('info' as const) : complete ? ('positive' as const) : ('neutral' as const), active: running },
    { label: 'Report', value: reportSentStatus, detail: reportSentStatus === 'Success' ? 'Delivery confirmed' : 'Awaiting send', icon: MailCheck, variant: reportVariant(reportSentStatus) },
    { label: 'Last sent', value: lastSentTime, detail: lastSentTime === '-' ? 'No timestamp yet' : 'Local time', icon: Send, variant: lastSentTime === '-' ? ('neutral' as const) : ('info' as const) },
  ], [activeStep, apiStatus, complete, lastError, lastSentTime, reportSentStatus, running]);

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#0E1422]/76 p-3 shadow-[0_22px_70px_rgba(0,0,0,0.42),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-2xl sm:p-4" aria-label="Process status">
      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {items.map((item, index) => (
          <StatusRailItem key={item.label} item={item} index={index} />
        ))}
      </div>
    </section>
  );
}

interface StatusRailItemProps {
  item: { label: string; value: string; detail: string; icon: LucideIcon; variant: BadgeVariant; active?: boolean };
  index: number;
}

function StatusRailItem({ item, index }: StatusRailItemProps) {
  const Icon = item.icon;
  const variantClasses = {
    positive: 'border-positive-line/80 bg-positive-fill text-positive-text',
    neutral: 'border-neutral-line bg-white/[0.05] text-neutral-text',
    info: 'border-info-line bg-info-fill text-info-text',
    warning: 'border-warning-line bg-warning-fill text-warning-text',
    critical: 'border-critical-line bg-critical-fill text-critical-text',
  };
  return (
    <motion.article
      className="relative z-[1] min-w-0 rounded-[18px] border border-white/10 bg-[#111827]/78 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.30)] backdrop-blur-xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.28 }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <motion.span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border shadow-raised ${variantClasses[item.variant]}`}
          animate={item.active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={item.active ? { duration: 1.35, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">{item.label}</p>
          <p className="mt-1 truncate text-base font-black tracking-[-0.02em] text-ink">{item.value}</p>
          <p className="mt-1 truncate text-xs font-semibold text-muted">{item.detail}</p>
        </div>
      </div>
    </motion.article>
  );
}

function AttendanceSummaryBand({ summary }: { summary: AttendanceSummary }) {
  const cards = [
    { label: 'Present', value: summary.totalEmployeesPresent, helper: 'Employees in register', badge: 'On register', variant: 'positive' as const, icon: UsersRound, emphasis: true },
    { label: 'Late Coming', value: summary.lateComing, helper: 'After shift start', badge: 'Review', variant: 'warning' as const, icon: AlarmClock },
    { label: 'Early Exit', value: summary.earlyExit, helper: 'Before shift end', badge: 'Review', variant: 'warning' as const, icon: TimerReset },
    { label: 'Missing Punch', value: summary.missingPunch, helper: 'Needs correction', badge: 'Needs action', variant: 'critical' as const, icon: AlertOctagon },
    { label: 'Total Break Time', value: summary.totalBreakTime, helper: 'Inferred from middle punches', badge: 'Inferred', variant: 'neutral' as const, icon: Clock3, dataValue: true },
  ];

  return (
    <section className="grid w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3" aria-label="Attendance summary">
      {cards.map((card, index) => (
        <SummaryMetricCard key={card.label} {...card} index={index} />
      ))}
    </section>
  );
}

interface SummaryMetricCardProps {
  label: string;
  value: number | string;
  helper: string;
  badge: string;
  variant: BadgeVariant;
  icon: LucideIcon;
  emphasis?: boolean;
  dataValue?: boolean;
  index: number;
}

function SummaryMetricCard({ label, value, helper, badge, variant, icon: Icon, emphasis = false, dataValue = false, index }: SummaryMetricCardProps) {
  const numericValue = typeof value === 'number' ? value : null;
  const animatedValue = useAnimatedNumber(numericValue ?? 0);
  const valueClass = variant === 'warning' ? 'text-warning-text' : variant === 'critical' ? 'text-critical-text' : variant === 'positive' ? 'text-positive-text' : 'text-ink';

  return (
    <motion.article
      className={`group relative flex min-h-[150px] min-w-0 flex-col justify-between overflow-hidden rounded-[22px] border p-4 backdrop-blur-2xl ${
        emphasis
          ? 'border-blue-400/35 bg-[linear-gradient(145deg,rgba(17,24,39,0.94),rgba(14,20,34,0.92))] shadow-[0_24px_70px_rgba(37,99,235,0.18),0_1px_0_rgba(255,255,255,0.07)_inset]'
          : 'border-white/10 bg-[#111827]/78 shadow-[0_18px_54px_rgba(0,0,0,0.34),0_1px_0_rgba(255,255,255,0.06)_inset]'
      }`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ delay: index * 0.055, duration: 0.32, ease: 'easeOut' }}
    >
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-relay-blue/8 blur-2xl transition group-hover:bg-relay-blue/12" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-5 text-muted">{label}</p>
          <p className="mt-1 text-xs font-semibold text-muted/80">{helper}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-blue-400/25 bg-blue-500/12 text-blue-300 shadow-raised">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <div className="relative mt-4">
        <strong className={`block text-[30px] font-black leading-8 tracking-[-0.04em] ${dataValue ? 'tabular-data text-[25px] text-ink' : valueClass}`}>
          {numericValue === null ? value : animatedValue}
        </strong>
        <div className="mt-3">
          <StatusBadge variant={variant} size="md" withIcon>{badge}</StatusBadge>
        </div>
      </div>
    </motion.article>
  );
}

function AutomationErrorAlert({ message, running, onRetry }: { message: string; running: boolean; onRetry: () => void }) {
  return (
    <section className="flex w-full min-w-0 flex-col gap-3 rounded-[24px] border border-red-400/45 bg-red-500/12 p-5 text-red-200 shadow-[0_18px_54px_rgba(220,38,38,0.16)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-black text-red-100">Attendance automation failed</h2>
          <p className="mt-1 text-sm leading-5 text-red-200/85">{message}</p>
        </div>
      </div>
      <Button variant="danger" loading={running} onClick={onRetry} className="w-full sm:w-auto">Retry automation</Button>
    </section>
  );
}

function DashboardEmptyState({ running, onRunAutomation }: { running: boolean; onRunAutomation: () => void }) {
  return (
    <section className="w-full min-w-0 rounded-[28px] border border-white/10 bg-[#0E1422]/86 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-12">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-blue-400/25 bg-blue-500/12 text-blue-300 shadow-raised">
        <CalendarClock className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-xl font-black tracking-[-0.02em] text-ink">No register generated for today</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
        Run attendance automation to fetch eSSL punches and create the register.
      </p>
      <div className="mt-6 flex justify-center">
        <Button variant="primary" loading={running} onClick={onRunAutomation}>
          <Wifi className="h-4 w-4" aria-hidden="true" />
          Run Attendance Automation
        </Button>
      </div>
    </section>
  );
}