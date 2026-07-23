import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon, AlertTriangle, CheckCircle2, Clock3, Loader2, RadioTower,
  RefreshCw, Search, ShieldCheck, Timer, UsersRound, X, type LucideIcon,
} from 'lucide-react';
import { motion, type Variants } from 'framer-motion';

import type { LivePresenceEmployee, LivePresenceResponse, LivePresenceStatus } from '../../types/attendance';
import { attendanceLivePresenceApi } from '../../api/attendance';
import { Button } from '../../components/attendance/Button';

type PresenceFilter = 'ALL' | 'IN_OFFICE' | 'OUTSIDE' | 'NOT_ARRIVED';
type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';

const AUTO_REFRESH_MS = 15000;
const premiumEase = [0.16, 1, 0.3, 1] as const;

const pageVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: premiumEase } },
};

const filters: Array<{ value: PresenceFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'IN_OFFICE', label: 'In Office' },
  { value: 'OUTSIDE', label: 'Outside' },
  { value: 'NOT_ARRIVED', label: 'Not Arrived' },
];

function presenceTone(status: LivePresenceStatus): BadgeTone {
  if (status === 'IN_OFFICE') return 'success';
  if (status === 'OUTSIDE') return 'neutral';
  if (status === 'NOT_ARRIVED') return 'warning';
  return 'neutral';
}

function statusTone(status: string): BadgeTone {
  const normalized = status.toLowerCase();
  if (normalized === 'present') return 'success';
  if (normalized.includes('not arrived')) return 'warning';
  if (normalized.includes('missing')) return 'danger';
  return 'neutral';
}

export default function LiveDashboardPage() {
  const [liveData, setLiveData] = useState<LivePresenceResponse | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PresenceFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLivePresence = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const payload = await attendanceLivePresenceApi.get();
      setLiveData(payload);
      setError(null);
    } catch (refreshError: any) {
      const message = refreshError?.response?.data?.detail || (refreshError instanceof Error ? refreshError.message : 'Live presence refresh failed.');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshLivePresence();
    const interval = window.setInterval(() => refreshLivePresence(true), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refreshLivePresence]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredEmployees = useMemo(() => {
    const employees = liveData?.employees ?? [];
    return employees.filter((employee) => {
      const matchesSearch = !normalizedQuery ||
        employee.employee_code.toLowerCase().includes(normalizedQuery) ||
        employee.employee_name.toLowerCase().includes(normalizedQuery);
      const matchesFilter = filter === 'ALL' || employee.current_presence === filter;
      return matchesSearch && matchesFilter;
    });
  }, [filter, liveData?.employees, normalizedQuery]);

  return (
    <motion.div
      className="mx-auto grid w-full max-w-[1280px] min-w-0 overflow-hidden gap-4 xl:gap-5"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <LiveHeader
          lastUpdated={liveData?.last_updated || '--:--:--'}
          refreshing={refreshing}
          loading={loading}
          onRefresh={() => refreshLivePresence(Boolean(liveData))}
        />
      </motion.div>

      {(error || liveData?.warning) && (
        <motion.div variants={fadeUp}>
          <LiveWarning message={error || liveData?.warning || ''} hasPreviousData={Boolean(liveData)} />
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <SummaryGrid data={liveData} loading={loading} />
      </motion.div>

      <motion.div variants={fadeUp}>
        <LiveEmployeePanel
          employees={filteredEmployees}
          totalEmployees={liveData?.employees.length ?? 0}
          query={query}
          filter={filter}
          loading={loading}
          onQueryChange={setQuery}
          onFilterChange={setFilter}
          onClearSearch={() => setQuery('')}
        />
      </motion.div>
    </motion.div>
  );
}

function LiveHeader({ lastUpdated, refreshing, loading, onRefresh }: { lastUpdated: string; refreshing: boolean; loading: boolean; onRefresh: () => void }) {
  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-[24px] border border-blue-400/20 bg-[#0E1422]/88 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.48),0_0_58px_rgba(37,99,235,0.10),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-2xl sm:p-5 lg:p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-relay-blue/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-28 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/12 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-emerald-300">
            <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
            Live Presence
          </div>
          <h1 className="mt-3 break-words text-3xl font-black leading-tight tracking-[-0.04em] text-ink lg:text-4xl">Live Presence Dashboard</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-muted sm:text-base">
            Real-time eSSL monitoring for who is in office, outside, or not arrived.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
          <div className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-sm font-bold text-slate-200 shadow-raised">
            <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Auto-refreshing every 15 seconds</span>
            <span className="mt-1 flex items-center gap-2 tabular-data">
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300" aria-hidden="true" /> : <Clock3 className="h-3.5 w-3.5 text-blue-300" aria-hidden="true" />}
              Last updated: {lastUpdated}
            </span>
          </div>
          <Button variant="primary" loading={loading || refreshing} onClick={onRefresh} className="min-h-11 w-full min-w-0 whitespace-nowrap px-5 sm:w-auto">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}

function LiveWarning({ message, hasPreviousData }: { message: string; hasPreviousData: boolean }) {
  return (
    <section className="flex w-full min-w-0 items-start gap-3 rounded-[22px] border border-amber-400/40 bg-amber-500/12 p-4 text-amber-100 shadow-[0_18px_54px_rgba(245,158,11,0.12)]">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <h2 className="text-sm font-black">Live refresh warning</h2>
        <p className="mt-1 text-sm leading-6 text-amber-100/85">
          {message} {hasPreviousData ? 'Keeping the latest data on screen.' : 'Try refreshing again after checking the device connection.'}
        </p>
      </div>
    </section>
  );
}

function SummaryGrid({ data, loading }: { data: LivePresenceResponse | null; loading: boolean }) {
  const cards: Array<{ label: string; value: number | string; helper: string; icon: LucideIcon; tone: BadgeTone }> = [
    { label: 'Total Employees', value: data?.summary.total_employees ?? 0, helper: 'Visible live roster', icon: UsersRound, tone: 'neutral' },
    { label: 'In Office', value: data?.summary.in_office ?? 0, helper: 'Odd punch count', icon: ShieldCheck, tone: 'success' },
    { label: 'Outside', value: data?.summary.outside ?? 0, helper: 'Even punch count', icon: Timer, tone: 'neutral' },
    { label: 'Not Arrived', value: data?.summary.not_arrived ?? 0, helper: 'No punches today', icon: AlertOctagon, tone: 'warning' },
    { label: 'Last Updated Time', value: data?.last_updated ?? '--:--:--', helper: data?.date ?? 'Live date', icon: Clock3, tone: 'success' },
  ];

  return (
    <section className="grid w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3" aria-label="Live presence summary">
      {cards.map((card, index) => (
        <SummaryCard key={card.label} card={card} loading={loading} index={index} />
      ))}
    </section>
  );
}

function SummaryCard({ card, loading, index }: { card: { label: string; value: number | string; helper: string; icon: LucideIcon; tone: BadgeTone }; loading: boolean; index: number }) {
  const Icon = card.icon;
  const toneClass = {
    success: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200',
    warning: 'border-amber-400/40 bg-amber-500/13 text-amber-200',
    danger: 'border-red-400/45 bg-red-500/14 text-red-200',
    neutral: 'border-blue-400/25 bg-blue-500/12 text-blue-200',
  };
  const valueClass = card.tone === 'success' ? 'text-emerald-200' : card.tone === 'warning' ? 'text-amber-200' : 'text-ink';

  return (
    <motion.article
      className="group relative flex min-h-[148px] min-w-0 flex-col justify-between overflow-hidden rounded-[22px] border border-white/10 bg-[#111827]/78 p-4 shadow-[0_18px_54px_rgba(0,0,0,0.34),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-2xl"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ delay: index * 0.055, duration: 0.32, ease: 'easeOut' }}
    >
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-relay-blue/8 blur-2xl transition group-hover:bg-relay-blue/12" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-5 text-muted">{card.label}</p>
          <p className="mt-1 text-xs font-semibold text-muted/80">{card.helper}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border shadow-raised ${toneClass[card.tone]}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <div className="relative mt-4">
        {loading ? (
          <span className="skeleton-shimmer block h-9 w-24 rounded-xl" />
        ) : (
          <strong className={`block break-words text-[30px] font-black leading-8 tracking-[-0.04em] tabular-data ${valueClass}`}>
            {card.value}
          </strong>
        )}
      </div>
    </motion.article>
  );
}

interface LiveEmployeePanelProps {
  employees: LivePresenceEmployee[];
  totalEmployees: number;
  query: string;
  filter: PresenceFilter;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: PresenceFilter) => void;
  onClearSearch: () => void;
}

function LiveEmployeePanel({ employees, totalEmployees, query, filter, loading, onQueryChange, onFilterChange, onClearSearch }: LiveEmployeePanelProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const countLabel = `${employees.length} of ${totalEmployees} employees visible`;

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.94),rgba(14,20,34,0.88))] shadow-[0_28px_90px_rgba(0,0,0,0.52),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-2xl">
      <div className="flex min-w-0 flex-col gap-4 border-b border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.84),rgba(14,20,34,0.58))] px-4 py-5 sm:px-5 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">Live Monitor</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-ink sm:text-[28px]">Employee Presence</h2>
          <p className="mt-2 text-sm font-semibold text-muted">{loading ? 'Loading live employees' : countLabel}</p>
        </div>
        <div className="grid w-full min-w-0 gap-3 xl:max-w-3xl xl:grid-cols-[minmax(220px,360px)_auto]">
          <label className="relative block w-full min-w-0">
            <span className="pointer-events-none absolute left-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-2xl border border-white/10 bg-blue-500/10 text-blue-300 shadow-[0_8px_22px_rgba(37,99,235,0.10)]">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="h-14 w-full rounded-[22px] border border-white/10 bg-[#070A12]/85 pl-14 pr-11 text-sm font-bold text-slate-100 shadow-[0_16px_38px_rgba(0,0,0,0.34),0_1px_0_rgba(255,255,255,0.05)_inset] outline-none transition duration-200 placeholder:font-semibold placeholder:text-slate-500 focus:border-blue-400/60 focus:bg-[#0B1020] focus:ring-4 focus:ring-blue-500/15"
              placeholder={loading ? 'Loading live roster' : 'Search code or name'}
              type="search"
              disabled={loading}
            />
            {query && (
              <button type="button" onClick={onClearSearch} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-2xl text-muted transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40" aria-label="Clear search">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </label>
          <div className="flex min-w-0 flex-wrap gap-2 rounded-[22px] border border-white/10 bg-[#070A12]/70 p-1.5 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onFilterChange(item.value)}
                className={`min-h-10 flex-1 whitespace-nowrap rounded-2xl px-3 text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-blue-400/40 sm:flex-none ${
                  filter === item.value
                    ? 'bg-blue-500/18 text-blue-100 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.32)]'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-2 mb-3 mt-3 max-w-full overflow-hidden rounded-[22px] border border-white/10 bg-[#070A12]/72 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] sm:mx-3">
        <div className="table-scroll max-h-[620px] w-full min-w-0 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[1160px] table-auto border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                <LiveTh>Employee Code</LiveTh>
                <LiveTh>Employee Name</LiveTh>
                <LiveTh>Punch In</LiveTh>
                <LiveTh>Punch Out</LiveTh>
                <LiveTh>Break Time</LiveTh>
                <LiveTh>Net Hours</LiveTh>
                <LiveTh align="center">Missing Punch</LiveTh>
                <LiveTh align="center">Current Presence</LiveTh>
                <LiveTh align="center">Last Punch</LiveTh>
                <LiveTh align="center">Status</LiveTh>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, rowIndex) => (
                  <tr key={`live-loading-${rowIndex}`}>
                    {Array.from({ length: 10 }).map((__, cellIndex) => (
                      <td key={`live-loading-${rowIndex}-${cellIndex}`} className="border-b border-white/[0.07] px-4 py-4">
                        <span className={`skeleton-shimmer block h-4 rounded-xl ${cellIndex < 2 ? 'w-28' : cellIndex > 6 ? 'mx-auto w-20' : 'w-16'}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : employees.length ? (
                employees.map((employee) => (
                  <LiveRow key={employee.employee_code} employee={employee} query={normalizedQuery} />
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center text-sm text-muted">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-muted shadow-raised">
                        <Search className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="mt-4 text-base font-black text-ink">No matching employees</h3>
                      <p className="mt-1 text-sm leading-6 text-muted">Try another search term or presence filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function LiveTh({ children, align = 'left' }: { children: string; align?: 'left' | 'center' }) {
  return (
    <th className={`sticky top-0 z-10 border-b border-white/10 bg-[#0B1020]/95 px-3 py-4 leading-4 backdrop-blur-xl ${align === 'center' ? 'text-center' : ''}`}>
      {children}
    </th>
  );
}

function LiveRow({ employee, query }: { employee: LivePresenceEmployee; query: string }) {
  return (
    <motion.tr
      className="group text-sm text-ink transition duration-200 hover:bg-blue-500/[0.08] hover:shadow-[inset_3px_0_0_rgba(59,130,246,0.82)] even:bg-white/[0.025]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <LiveTd strong mono>{highlightMatch(employee.employee_code, query)}</LiveTd>
      <LiveTd strong>{highlightMatch(employee.employee_name, query)}</LiveTd>
      <LiveTd mono muted>{employee.punch_in}</LiveTd>
      <LiveTd mono muted>{employee.punch_out}</LiveTd>
      <LiveTd mono muted>{employee.break_time}</LiveTd>
      <LiveTd mono strong>{employee.net_hours}</LiveTd>
      <LiveTd align="center">
        <LiveBadge tone={employee.missing_punch ? 'danger' : 'success'}>
          {employee.missing_punch ? 'Missing Punch' : 'No Missing'}
        </LiveBadge>
      </LiveTd>
      <LiveTd align="center">
        <LiveBadge tone={presenceTone(employee.current_presence)} emphasis>
          {employee.current_presence_display}
        </LiveBadge>
      </LiveTd>
      <LiveTd align="center" mono muted>{employee.last_punch_time || '-'}</LiveTd>
      <LiveTd align="center">
        <LiveBadge tone={statusTone(employee.status)} emphasis>{employee.status}</LiveBadge>
      </LiveTd>
    </motion.tr>
  );
}

function LiveTd({ children, align = 'left', strong = false, muted = false, mono = false }: { children: ReactNode; align?: 'left' | 'center'; strong?: boolean; muted?: boolean; mono?: boolean }) {
  return (
    <td className={`whitespace-nowrap border-b border-white/[0.07] px-3 py-4 leading-5 ${align === 'center' ? 'text-center' : ''} ${strong ? 'font-black text-ink' : 'font-semibold'} ${muted ? 'text-slate-300' : ''} ${mono ? 'tabular-data' : ''}`}>
      {children}
    </td>
  );
}

function LiveBadge({ tone, children, emphasis = false }: { tone: BadgeTone; children: ReactNode; emphasis?: boolean }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : tone === 'danger' ? AlertOctagon : Timer;
  const toneClass = {
    success: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_20px_rgba(34,197,94,0.08)]',
    warning: 'border-amber-400/40 bg-amber-500/13 text-amber-200 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_20px_rgba(245,158,11,0.09)]',
    danger: 'border-red-400/45 bg-red-500/14 text-red-200 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_20px_rgba(239,68,68,0.10)]',
    neutral: 'border-orange-300/28 bg-orange-400/10 text-orange-100 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_20px_rgba(251,146,60,0.08)]',
  };
  return (
    <span className={`state-pop inline-flex max-w-none items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-xs font-black ${emphasis ? 'min-h-8 min-w-[112px]' : 'min-h-7'} ${toneClass[tone]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

function highlightMatch(value: string, query: string) {
  if (!query) return value;
  const lowerValue = value.toLowerCase();
  const index = lowerValue.indexOf(query);
  if (index === -1) return value;
  return (
    <>
      {value.slice(0, index)}
      <mark className="rounded bg-blue-500/20 px-0.5 text-inherit">{value.slice(index, index + query.length)}</mark>
      {value.slice(index + query.length)}
    </>
  );
}