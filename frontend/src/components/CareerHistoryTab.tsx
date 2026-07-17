import { useEffect, useState } from 'react';
import {
  Briefcase, User, Building2, TrendingUp, Rocket, Calendar,
  Loader2, ArrowRight, MapPin, Activity,
} from 'lucide-react';
import { employeesApi } from '../api/employees';
import type { CareerHistoryEntry } from '../types/employee';
import toast from 'react-hot-toast';

interface Props {
  employeeId: string;
}

// Icons per event type
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  position_id: Briefcase,
  reporting_manager_id: User,
  structure_location_id: Building2,
  status: Activity,
  joined: Rocket,
};

// Colors per event type
const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
  position_id: { bg: 'bg-purple-100', text: 'text-purple-700', icon: 'text-purple-600' },
  reporting_manager_id: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'text-blue-600' },
  structure_location_id: { bg: 'bg-teal-100', text: 'text-teal-700', icon: 'text-teal-600' },
  status: { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'text-amber-600' },
  joined: { bg: 'bg-green-100', text: 'text-green-700', icon: 'text-green-600' },
};

export default function CareerHistoryTab({ employeeId }: Props) {
  const [timeline, setTimeline] = useState<CareerHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await employeesApi.getCareerHistory(employeeId);
        setTimeline(data.timeline);
      } catch {
        toast.error('Failed to load career history');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [employeeId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate tenure
  const getTenure = () => {
    const joined = timeline.find((e) => e.field_name === 'joined');
    if (!joined) return null;
    const start = new Date(joined.changed_at);
    const now = new Date();
    const years = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365));
    const months = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)) % 12;
    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`;
    return `${months} month${months !== 1 ? 's' : ''}`;
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Career History</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Complete timeline of position, department, and manager changes
          </p>
        </div>

        {timeline.length > 0 && getTenure() && (
          <div className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-1.5">
            <TrendingUp className="h-4 w-4 text-primary-600" />
            <span className="text-sm font-semibold text-primary-700">
              {getTenure()} tenure
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : timeline.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-gray-500">
          <Calendar className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm">No career events yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Position, manager, or department changes will appear here
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-300 via-gray-200 to-transparent" />

          <div className="space-y-6">
            {timeline.map((entry, idx) => {
              const Icon = iconMap[entry.field_name] || Briefcase;
              const colors = colorMap[entry.field_name] || colorMap.position_id;

              return (
                <div key={`${entry.id}-${idx}`} className="relative flex gap-4">
                  {/* Icon circle on timeline */}
                  <div className={`relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${colors.bg} ring-4 ring-white shadow-sm`}>
                    <Icon className={`h-5 w-5 ${colors.icon}`} />
                  </div>

                  {/* Event card */}
                  <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}>
                        {entry.event_type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(entry.changed_at)}
                      </span>
                    </div>

                    {/* Special layout for "Joined" event */}
                    {entry.field_name === 'joined' ? (
                      <div>
                        <p className="text-sm text-gray-900">
                          🎉 <span className="font-medium">Joined the company</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {entry.to_value}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          {entry.from_value && entry.from_value !== '—' ? (
                            <>
                              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 line-through decoration-gray-400">
                                {entry.from_value}
                              </span>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                            </>
                          ) : null}
                          <span className={`rounded-md ${colors.bg} px-2 py-1 text-xs font-medium ${colors.text}`}>
                            {entry.to_value}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-gray-500">
                          Changed by <span className="font-medium text-gray-700">{entry.changed_by}</span>
                          {entry.changed_by_id && (
                            <span className="text-gray-400"> ({entry.changed_by_id})</span>
                          )}
                          {' · '}
                          <span title={formatFullDate(entry.changed_at)}>
                            {formatFullDate(entry.changed_at)}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary footer */}
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-gray-600">
                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                  Position
                </span>
                <span className="flex items-center gap-1 text-gray-600">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  Manager
                </span>
                <span className="flex items-center gap-1 text-gray-600">
                  <div className="h-2 w-2 rounded-full bg-teal-500"></div>
                  Department
                </span>
                <span className="flex items-center gap-1 text-gray-600">
                  <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                  Status
                </span>
              </div>
              <span className="text-gray-500">
                Total events: <strong className="text-gray-900">{timeline.length}</strong>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}