// import { useEffect, useState } from 'react';
// import { Loader2, Gift, PlayCircle, Search, Calendar } from 'lucide-react';
// import toast from 'react-hot-toast';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import api from '../../api/axios';

// export default function CompOffLogsPage() {
//   const [logs, setLogs] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [scanning, setScanning] = useState(false);
//   const [startDate, setStartDate] = useState('');
//   const [endDate, setEndDate] = useState('');

//   useEffect(() => {
//     loadLogs();
//   }, []);

//   const loadLogs = async () => {
//     setLoading(true);
//     try {
//       const { data } = await api.get('/leave/compoff/logs/');
//       setLogs(data.logs || []);
//     } catch {
//       toast.error('Failed to load comp-off logs');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleScan = async () => {
//     if (!window.confirm('Scan attendance and credit comp-off for weekend/holiday work?')) return;
    
//     setScanning(true);
//     try {
//       const payload: any = {};
//       if (startDate) payload.start_date = startDate;
//       if (endDate) payload.end_date = endDate;
      
//       const { data } = await api.post('/leave/compoff/scan/', payload);
//       toast.success(data.message);
//       loadLogs();
//     } catch (error: any) {
//       toast.error(error?.response?.data?.error || 'Scan failed');
//     } finally {
//       setScanning(false);
//     }
//   };

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           <div className="mb-6 flex items-center justify-between">
//             <div className="flex items-center gap-3">
//               <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-600 text-white">
//                 <Gift className="h-5 w-5" />
//               </div>
//               <div>
//                 <h1 className="text-2xl font-bold text-gray-900">Comp-Off Credits</h1>
//                 <p className="text-sm text-gray-500">
//                   Auto-credited when employees work on weekends/holidays
//                 </p>
//               </div>
//             </div>
//           </div>

//           {/* Manual Scan Section */}
//           <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//             <h2 className="mb-3 text-sm font-semibold uppercase text-gray-900">
//               Manual Scan
//             </h2>
//             <p className="mb-4 text-sm text-gray-500">
//               Runs automatically every night at 11 PM. Manually trigger below if needed.
//             </p>
//             <div className="flex flex-wrap items-end gap-3">
//               <div>
//                 <label className="mb-1 block text-xs font-medium text-gray-600">
//                   Start Date
//                 </label>
//                 <input
//                   type="date"
//                   value={startDate}
//                   onChange={(e) => setStartDate(e.target.value)}
//                   className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                 />
//               </div>
//               <div>
//                 <label className="mb-1 block text-xs font-medium text-gray-600">
//                   End Date
//                 </label>
//                 <input
//                   type="date"
//                   value={endDate}
//                   onChange={(e) => setEndDate(e.target.value)}
//                   className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                 />
//               </div>
//               <button
//                 onClick={handleScan}
//                 disabled={scanning}
//                 className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
//               >
//                 {scanning ? (
//                   <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</>
//                 ) : (
//                   <><PlayCircle className="h-4 w-4" /> Scan Now</>
//                 )}
//               </button>
//             </div>
//             <p className="mt-2 text-xs text-gray-400">
//               Leave dates empty to scan last 7 days.
//             </p>
//           </div>

//           {/* Logs Table */}
//           <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
//             <div className="border-b border-gray-100 p-4">
//               <h3 className="font-semibold text-gray-900">
//                 Recent Comp-Off Credits ({logs.length})
//               </h3>
//             </div>
//             {loading ? (
//               <div className="flex justify-center py-16">
//                 <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
//               </div>
//             ) : logs.length === 0 ? (
//               <div className="p-12 text-center">
//                 <Gift className="mx-auto h-12 w-12 text-gray-300" />
//                 <p className="mt-3 text-sm text-gray-500">
//                   No comp-off credits yet. Click "Scan Now" to check.
//                 </p>
//               </div>
//             ) : (
//               <table className="w-full text-sm">
//                 <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
//                   <tr>
//                     <th className="px-4 py-3">Employee</th>
//                     <th className="px-4 py-3">Work Date</th>
//                     <th className="px-4 py-3 text-center">Hours Worked</th>
//                     <th className="px-4 py-3 text-center">Comp-Off Credited</th>
//                     <th className="px-4 py-3">Reason</th>
//                     <th className="px-4 py-3">Credited At</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-gray-100">
//                   {logs.map((log) => (
//                     <tr key={log.id} className="hover:bg-gray-50">
//                       <td className="px-4 py-3">
//                         <div className="font-medium text-gray-900">
//                           {log.employee_name}
//                         </div>
//                         <div className="text-xs text-gray-500 font-mono">
//                           {log.employee_id}
//                         </div>
//                       </td>
//                       <td className="px-4 py-3 text-gray-700">
//                         {new Date(log.credit_date).toLocaleDateString('en-IN', {
//                           day: '2-digit',
//                           month: 'short',
//                           year: 'numeric',
//                           weekday: 'short',
//                         })}
//                       </td>
//                       <td className="px-4 py-3 text-center font-semibold text-blue-700">
//                         {log.worked_hours.toFixed(1)}h
//                       </td>
//                       <td className="px-4 py-3 text-center">
//                         <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-0.5 text-sm font-bold text-purple-800">
//                           +{log.comp_off_days}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 text-xs text-gray-600">
//                         {log.reason}
//                       </td>
//                       <td className="px-4 py-3 text-xs text-gray-500">
//                         {new Date(log.credited_at).toLocaleString('en-IN')}
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             )}
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import { Loader2, Gift, PlayCircle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function CompOffLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 🔥 Check if user has permission to scan
  const canScan = 
    user?.role_codes?.includes('HR_ADMIN') || 
    user?.role_codes?.includes('SYSTEM_ADMIN');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leave/compoff/logs/');
      setLogs(data.logs || []);
    } catch {
      toast.error('Failed to load comp-off logs');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!canScan) {
      toast.error('Only HR can scan for comp-off');
      return;
    }
    if (!window.confirm('Scan attendance and credit comp-off for weekend/holiday work?')) return;
    
    setScanning(true);
    try {
      const payload: any = {};
      if (startDate) payload.start_date = startDate;
      if (endDate) payload.end_date = endDate;
      
      const { data } = await api.post('/leave/compoff/scan/', payload);
      toast.success(data.message);
      loadLogs();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100">
              <Gift className="h-5 w-5 text-gray-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Comp-Off Credits</h1>
              <p className="text-sm text-gray-500">
                {canScan
                  ? 'Auto-credited when employees work on weekends/holidays'
                  : 'Your comp-off credits earned from working on weekends/holidays'}
              </p>
            </div>
          </div>

          {/* 🔥 Manual Scan Section — ONLY VISIBLE TO HR/ADMIN */}
          {canScan && (
            <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="mb-3 flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold uppercase text-gray-900">
                  Manual Scan
                </h2>
              </div>
              <p className="mb-4 text-sm text-gray-500">
                Runs automatically every night at 11 PM. Manually trigger below if needed.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
                >
                  {scanning ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</>
                  ) : (
                    <><PlayCircle className="h-4 w-4" /> Scan Now</>
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Leave dates empty to scan last 7 days.
              </p>
            </div>
          )}

          {/* Info Banner for Employees */}
          {!canScan && (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <h3 className="text-sm font-semibold text-blue-900">
                    How Comp-Off Works
                  </h3>
                  <p className="mt-1 text-xs text-blue-800">
                    When you work on a <strong>weekend</strong> or <strong>holiday</strong>, 
                    you automatically earn compensatory off (comp-off) leaves. 
                    These credits appear here and are added to your leave balance.
                  </p>
                  <ul className="mt-2 space-y-0.5 text-xs text-blue-700">
                    <li>• 6+ hours worked → <strong>1 full comp-off day</strong></li>
                    <li>• 3-6 hours worked → <strong>0.5 comp-off day</strong></li>
                    <li>• Less than 3 hours → No comp-off credited</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Logs Table */}
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="border-b border-gray-100 p-4">
              <h3 className="font-semibold text-gray-900">
                {canScan ? 'Recent Comp-Off Credits' : 'My Comp-Off Credits'} ({logs.length})
              </h3>
            </div>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center">
                <Gift className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">
                  {canScan 
                    ? 'No comp-off credits yet. Click "Scan Now" to check.'
                    : 'No comp-off credits earned yet.'}
                </p>
                {!canScan && (
                  <p className="mt-1 text-xs text-gray-400">
                    Work on weekends or holidays to earn comp-off leaves.
                  </p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    {canScan && <th className="px-4 py-3">Employee</th>}
                    <th className="px-4 py-3">Work Date</th>
                    <th className="px-4 py-3 text-center">Hours Worked</th>
                    <th className="px-4 py-3 text-center">Comp-Off Credited</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Credited At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      {canScan && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {log.employee_name}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {log.employee_id}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(log.credit_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          weekday: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">
                        {log.worked_hours.toFixed(1)}h
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-0.5 text-sm font-semibold text-emerald-800">
                          +{log.comp_off_days}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {log.reason}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(log.credited_at).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}