import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalIcon, MapPin, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { calendarApi } from '../../api/calendar';
import type { AnnualCalendarDetail, Holiday } from '../../types/calendar';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HOLIDAY_TYPE_COLORS: Record<string, string> = {
  NATIONAL: 'bg-red-100 text-red-700 border-red-200',
  REGIONAL: 'bg-blue-100 text-blue-700 border-blue-200',
  COMPANY: 'bg-purple-100 text-purple-700 border-purple-200',
  OPTIONAL: 'bg-amber-100 text-amber-700 border-amber-200',
  RESTRICTED: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function CalendarViewPage() {
  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState<AnnualCalendarDetail | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadCalendar();
  }, []);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const data = await calendarApi.getPublished(currentYear);
      setCalendar(data);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setCalendar(null);
      } else {
        toast.error('Failed to load calendar');
      }
    } finally {
      setLoading(false);
    }
  };

  // Group holidays by month
  const holidaysByMonth = (calendar?.holidays || []).reduce((acc, h) => {
    const month = new Date(h.date).getMonth();
    if (!acc[month]) acc[month] = [];
    acc[month].push(h);
    return acc;
  }, {} as Record<number, Holiday[]>);

  // Sort holidays within each month
  Object.keys(holidaysByMonth).forEach((k) => {
    holidaysByMonth[+k].sort((a, b) => a.date.localeCompare(b.date));
  });

  const daysInMonth = new Date(currentYear, selectedMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, selectedMonth, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isHoliday = (day: number) => {
    return holidaysByMonth[selectedMonth]?.find((h) => {
      const d = new Date(h.date);
      return d.getDate() === day;
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                <CalIcon className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Holiday Calendar {currentYear}
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  {calendar
                    ? `${calendar.holiday_count} official holidays`
                    : 'View this year\'s holidays'}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : !calendar ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
              <CalIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-3 text-lg font-semibold text-gray-900">
                No published calendar for {currentYear}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                The HR team hasn't published the {currentYear} holiday calendar yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

              {/* LEFT: Month Grid */}
              <div className="lg:col-span-2">
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
                    <button
                      onClick={() =>
                        setSelectedMonth((m) => (m === 0 ? 11 : m - 1))
                      }
                      className="rounded-lg p-2 text-gray-600 hover:bg-white"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="text-lg font-bold text-gray-900">
                      {MONTHS[selectedMonth]} {currentYear}
                    </h2>
                    <button
                      onClick={() =>
                        setSelectedMonth((m) => (m === 11 ? 0 : m + 1))
                      }
                      className="rounded-lg p-2 text-gray-600 hover:bg-white"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Month quick nav */}
                  <div className="flex flex-wrap gap-1 border-b border-gray-100 p-3">
                    {MONTHS.map((m, idx) => {
                      const count = holidaysByMonth[idx]?.length || 0;
                      return (
                        <button
                          key={m}
                          onClick={() => setSelectedMonth(idx)}
                          className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            selectedMonth === idx
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {m.slice(0, 3)}
                          {count > 0 && (
                            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              selectedMonth === idx
                                ? 'bg-white text-primary-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Calendar grid */}
                  <div className="p-5">
                    {/* Day headers */}
                    <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-gray-500">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <div key={d} className="py-2">{d}</div>
                      ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-2">
                      {/* Empty cells before first day */}
                      {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square" />
                      ))}

                      {days.map((day) => {
                        const holiday = isHoliday(day);
                        const dayOfWeek = new Date(currentYear, selectedMonth, day).getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        const isToday =
                          currentYear === new Date().getFullYear() &&
                          selectedMonth === new Date().getMonth() &&
                          day === new Date().getDate();

                        return (
                          <div
                            key={day}
                            className={`relative flex aspect-square flex-col rounded-lg border p-2 ${
                              holiday
                                ? 'border-red-200 bg-red-50 cursor-pointer hover:bg-red-100'
                                : isWeekend
                                ? 'border-gray-100 bg-gray-50'
                                : 'border-gray-100 bg-white'
                            } ${isToday ? 'ring-2 ring-primary-500' : ''}`}
                            title={holiday?.name || ''}
                          >
                            <span
                              className={`text-sm font-semibold ${
                                holiday
                                  ? 'text-red-700'
                                  : isWeekend
                                  ? 'text-gray-400'
                                  : 'text-gray-700'
                              }`}
                            >
                              {day}
                            </span>
                            {holiday && (
                              <span className="mt-auto truncate text-[10px] font-medium text-red-600">
                                {holiday.name}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Holiday Types</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(HOLIDAY_TYPE_COLORS).map(([type, cls]) => (
                      <span
                        key={type}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}
                      >
                        {type.charAt(0) + type.slice(1).toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT: This Month's Holidays */}
              <div>
                <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 text-sm font-semibold text-gray-900">
                    {MONTHS[selectedMonth]} Holidays
                  </h3>

                  {holidaysByMonth[selectedMonth]?.length ? (
                    <div className="space-y-3">
                      {holidaysByMonth[selectedMonth].map((h) => (
                        <HolidayCard key={h.id} holiday={h} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-gray-50 py-8 text-center">
                      <p className="text-sm text-gray-500">
                        No holidays in {MONTHS[selectedMonth]}
                      </p>
                    </div>
                  )}
                </div>

                {/* Upcoming Holidays */}
                <div className="mt-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 text-sm font-semibold text-gray-900">
                    All Upcoming Holidays
                  </h3>
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const upcoming = (calendar.holidays || [])
                      .filter((h) => new Date(h.date) >= today)
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(0, 5);

                    if (upcoming.length === 0) {
                      return (
                        <p className="text-center text-sm text-gray-500 py-4">
                          No upcoming holidays this year
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {upcoming.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
                          >
                            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-red-50">
                              <span className="text-[9px] font-semibold uppercase text-red-600">
                                {MONTHS[new Date(h.date).getMonth()].slice(0, 3)}
                              </span>
                              <span className="text-sm font-bold text-red-700">
                                {new Date(h.date).getDate()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {h.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {h.holiday_type_display}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function HolidayCard({ holiday }: { holiday: Holiday }) {
  const colorClass = HOLIDAY_TYPE_COLORS[holiday.holiday_type] || HOLIDAY_TYPE_COLORS.NATIONAL;
  const date = new Date(holiday.date);

  return (
    <div className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-red-50">
          <span className="text-[10px] font-semibold uppercase text-red-600">
            {MONTHS[date.getMonth()].slice(0, 3)}
          </span>
          <span className="text-base font-bold text-red-700">
            {date.getDate()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{holiday.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
              {holiday.holiday_type_display}
            </span>
            {!holiday.applicable_to_all_locations && holiday.location_names.length > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                <MapPin className="h-2.5 w-2.5" />
                {holiday.location_names.map((l) => l.name).join(', ')}
              </span>
            )}
            {holiday.is_optional && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Optional
              </span>
            )}
          </div>
          {holiday.description && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">
              {holiday.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}