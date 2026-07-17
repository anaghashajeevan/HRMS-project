import { useEffect, useState } from 'react';
import { Clock, Loader2, User, ArrowRight, History } from 'lucide-react';
import { auditLogApi } from '../api/auditLog';
import type { AuditLogEntry } from '../types/documents';
import toast from 'react-hot-toast';

interface Props {
  employeeId: string;
}

export default function AuditTrailTab({ employeeId }: Props) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await auditLogApi.getByEmployee(employeeId);
        setLogs(data.results);
      } catch {
        toast.error('Failed to load audit log');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [employeeId]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const truncate = (val: string | null, max = 60) => {
    if (!val) return '—';
    return val.length > max ? val.substring(0, max) + '...' : val;
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Audit Trail</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Complete history of changes • Retained for 7 years
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-gray-500">
          <History className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm">No changes recorded yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Changes made to this employee will appear here
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="relative flex gap-4">
                {/* Dot on timeline */}
                <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 ring-4 ring-white">
                  <Clock className="h-4 w-4 text-primary-600" />
                </div>

                {/* Card */}
                <div className="flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                      {log.field_display}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(log.changed_at)}
                    </span>
                  </div>

                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
  <code className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700 line-through">
    {truncate(log.old_value_display || log.old_value) || '(empty)'}
  </code>
  <ArrowRight className="h-3 w-3 text-gray-400" />
  <code className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">
    {truncate(log.new_value_display || log.new_value) || '(empty)'}
  </code>
</div>

                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    Changed by <span className="font-medium">{log.modified_by_name}</span>
                    {log.modified_by_id && (
                      <span className="text-gray-400">({log.modified_by_id})</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}