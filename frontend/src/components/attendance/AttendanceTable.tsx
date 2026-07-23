import { AlertOctagon, AlertTriangle, CheckCircle2, Minus, Search, X } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { AttendanceRow } from '../../types/attendance';

interface AttendanceTableProps {
  rows: AttendanceRow[];
  loading?: boolean;
}

type TableBadgeTone = 'success' | 'warning' | 'danger' | 'neutral';

function missingTone(value: string): TableBadgeTone {
  return value === 'Yes' ? 'danger' : 'success';
}

function statusTone(value: string): TableBadgeTone {
  return value === 'Present' ? 'success' : 'danger';
}

function missingPunchLabel(value: string) {
  return value === 'Yes' ? 'Missing Punch' : 'No Missing';
}

function presenceTone(value: AttendanceRow['liveStatus']): TableBadgeTone {
  if (value === 'IN_OFFICE') return 'success';
  if (value === 'NOT_ARRIVED') return 'warning';
  return 'neutral';
}

function highlightMatch(value: string, query: string): ReactNode {
  if (!query) return value;
  const lowerValue = value.toLowerCase();
  const index = lowerValue.indexOf(query);
  if (index === -1) return value;
  const before = value.slice(0, index);
  const match = value.slice(index, index + query.length);
  const after = value.slice(index + query.length);
  return (
    <>
      {before}
      <mark className="rounded bg-blue-500/20 px-0.5 text-inherit">{match}</mark>
      {after}
    </>
  );
}

export function AttendanceTable({ rows, loading = false }: AttendanceTableProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter(
      (row) =>
        row.employeeCode.toLowerCase().includes(normalizedQuery) ||
        row.employeeName.toLowerCase().includes(normalizedQuery)
    );
  }, [rows, normalizedQuery]);

  const countLabel = normalizedQuery
    ? `${filteredRows.length} of ${rows.length} rows`
    : `${filteredRows.length} rows visible`;

  return (
    <motion.section
      className="w-full min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.94),rgba(14,20,34,0.88))] shadow-[0_28px_90px_rgba(0,0,0,0.52),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-2xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: 'easeOut' }}
    >
      <div className="flex min-w-0 flex-col gap-4 border-b border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.84),rgba(14,20,34,0.58))] px-4 py-5 sm:px-5 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">Employee Audit</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-ink sm:text-[28px]">Attendance Register</h2>
          <p className="mt-2 text-sm font-semibold text-muted">{countLabel}</p>
        </div>
        <label className="relative block w-full min-w-0 lg:max-w-[360px]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-2xl border border-white/10 bg-blue-500/10 text-blue-300 shadow-[0_8px_22px_rgba(37,99,235,0.10)]">
            <Search className="h-4 w-4" aria-hidden="true" />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-14 w-full rounded-[22px] border border-white/10 bg-[#070A12]/85 pl-14 pr-11 text-sm font-bold text-slate-100 shadow-[0_16px_38px_rgba(0,0,0,0.34),0_1px_0_rgba(255,255,255,0.05)_inset] outline-none transition duration-200 placeholder:font-semibold placeholder:text-slate-500 focus:border-blue-400/60 focus:bg-[#0B1020] focus:ring-4 focus:ring-blue-500/15"
            placeholder={loading ? 'Loading register' : 'Search code or name'}
            type="search"
            disabled={loading}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-2xl text-muted transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </label>
      </div>

      <div className="mx-2 mb-3 mt-3 max-w-full overflow-hidden rounded-[22px] border border-white/10 bg-[#070A12]/72 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] sm:mx-3">
        <div className="table-scroll max-h-[640px] w-full min-w-0 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[1040px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[20%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[16%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                <th className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1020]/95 px-3 py-4 leading-4 backdrop-blur-xl">Employee Code</th>
                <th className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1020]/95 px-3 py-4 leading-4 backdrop-blur-xl">Employee Name</th>
                <th className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1020]/95 px-3 py-4 leading-4 backdrop-blur-xl">Punch In</th>
                <th className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1020]/95 px-3 py-4 leading-4 backdrop-blur-xl">Punch Out</th>
                <th className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1020]/95 px-3 py-4 leading-4 backdrop-blur-xl" title="Break Time is inferred from intermediate punches.">Break Time</th>
                <th className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1020]/95 px-3 py-4 leading-4 backdrop-blur-xl">Net Hours</th>
                <th className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1020]/95 px-3 py-4 text-center leading-4 backdrop-blur-xl">Flags</th>
                <th className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1020]/95 px-3 py-4 text-center leading-4 backdrop-blur-xl">Current Presence</th>
                <th className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1020]/95 px-3 py-4 text-center leading-4 backdrop-blur-xl">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`loading-row-${index}`}>
                    {Array.from({ length: 9 }).map((__, cellIndex) => (
                      <td key={`loading-cell-${index}-${cellIndex}`} className="border-b border-white/[0.07] px-4 py-4">
                        <span className={`skeleton-shimmer block h-4 rounded-xl ${cellIndex < 2 ? 'w-28' : cellIndex > 6 ? 'mx-auto w-16' : 'w-20'}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length ? (
                filteredRows.map((row) => {
                  const rowIsCritical = row.missingPunch === 'Yes' || row.status !== 'Present';
                  return (
                    <motion.tr
                      key={`${row.employeeCode}-${row.punchIn}-${row.punchOut}`}
                      className={`group text-sm text-ink transition duration-200 hover:bg-blue-500/[0.08] hover:shadow-[inset_3px_0_0_rgba(59,130,246,0.82)] ${
                        rowIsCritical ? 'bg-red-500/[0.07] shadow-[inset_3px_0_0_rgba(239,68,68,0.55)]' : 'even:bg-white/[0.025]'
                      }`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(0.28, filteredRows.indexOf(row) * 0.018) }}
                    >
                      <td className="whitespace-nowrap border-b border-white/[0.07] px-3 py-4 font-black text-ink tabular-data">
                        {highlightMatch(row.employeeCode, normalizedQuery)}
                      </td>
                      <td className="whitespace-nowrap border-b border-white/[0.07] px-3 py-4 font-bold leading-5">
                        {row.isUnknownEmployee ? (
                          <TableBadge tone={rowIsCritical ? 'danger' : 'warning'}>Unknown Employee</TableBadge>
                        ) : (
                          highlightMatch(row.employeeName, normalizedQuery)
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b border-white/[0.07] px-3 py-4 font-semibold text-slate-300 tabular-data">{row.punchIn}</td>
                      <td className="whitespace-nowrap border-b border-white/[0.07] px-3 py-4 font-semibold text-slate-300 tabular-data">{row.punchOut}</td>
                      <td className="whitespace-nowrap border-b border-white/[0.07] px-3 py-4 font-semibold text-slate-300 tabular-data">{row.breakTime}</td>
                      <td className="whitespace-nowrap border-b border-white/[0.07] px-3 py-4 font-black text-ink tabular-data">{row.netWorkingHours}</td>
                      <td className="border-b border-white/[0.07] px-3 py-3">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <TableBadge tone={missingTone(row.missingPunch)} compact>
                            {missingPunchLabel(row.missingPunch)}
                          </TableBadge>
                        </div>
                      </td>
                      <td className="border-b border-white/[0.07] px-3 py-3 text-center">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <TableBadge tone={presenceTone(row.liveStatus)} emphasis>
                            {row.currentPresenceDisplay}
                          </TableBadge>
                          <span className="whitespace-nowrap text-[11px] font-bold leading-4 text-slate-400 tabular-data">
                            Last: {row.lastPunchTime || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap border-b border-white/[0.07] px-3 py-4 text-center">
                        <TableBadge tone={statusTone(row.status)} emphasis>
                          {row.status}
                        </TableBadge>
                      </td>
                    </motion.tr>
                  );
                })
              ) : normalizedQuery ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-sm text-muted">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-muted shadow-raised">
                        <Search className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="mt-4 text-base font-black text-ink">No matching employees</h3>
                      <p className="mt-1 text-sm leading-6 text-muted">Try another employee code or name.</p>
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-bold text-ink shadow-raised transition hover:border-blue-400/45 hover:bg-blue-500/10 hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                      >
                        Clear search
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-sm text-muted">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-muted shadow-raised">
                        <Minus className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="mt-4 text-base font-black text-ink">No attendance data</h3>
                      <p className="mt-1 text-sm leading-6 text-muted">The register will appear here after attendance data is available.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  );
}

interface TableBadgeProps {
  tone: TableBadgeTone;
  children: ReactNode;
  emphasis?: boolean;
  compact?: boolean;
}

function TableBadge({ tone, children, emphasis = false, compact = false }: TableBadgeProps) {
  const Icon =
    tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : tone === 'danger' ? AlertOctagon : Minus;
  const toneClass = {
    success: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_20px_rgba(34,197,94,0.08)]',
    warning: 'border-amber-400/40 bg-amber-500/13 text-amber-200 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_20px_rgba(245,158,11,0.09)]',
    danger: 'border-red-400/45 bg-red-500/14 text-red-200 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_20px_rgba(239,68,68,0.10)]',
    neutral: 'border-white/10 bg-white/[0.06] text-slate-300 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]'
  };

  return (
    <span
      className={`state-pop inline-flex max-w-none items-center justify-center gap-1 whitespace-nowrap rounded-full border font-black ${
        compact ? 'min-h-6 px-2 text-[11px]' : 'min-h-7 px-2.5 text-xs'
      } ${emphasis ? 'min-w-[92px]' : ''} ${toneClass[tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}