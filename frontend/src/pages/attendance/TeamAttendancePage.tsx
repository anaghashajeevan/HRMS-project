import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Loader2, Users, TrendingDown,
  Clock, Calendar as CalIcon, ChevronRight as ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { personalAttendanceApi } from '../../api/attendance';
import type { TeamAttendanceData } from '../../types/attendance';

export default function TeamAttendancePage() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<TeamAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await personalAttendanceApi.getTeamMonth(year, month);
      setData(res);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to load team attendance');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: number) => {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth === 0) { newMonth = 12; newYear -= 1; }
    else if (newMonth === 13) { newMonth = 1; newYear += 1; }
    setMonth(newMonth);
    setYear(newYear);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Attendance</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Monitor your team's attendance and hours
              </p>
            </div>
          </div>

          {loading || !data ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Month Navigation */}
              <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">{data.month_label}</h2>
                <button
                  onClick={() => navigateMonth(1)}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Team Stats */}
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <TeamStatCard
                  label="Team Size"
                  value={String(data.team_size)}
                  helper="Active reportees"
                  icon={Users}
                  color="blue"
                />
                <TeamStatCard
                  label="Avg Attendance"
                  value={`${data.team_avg_attendance}%`}
                  helper="Team average"
                  icon={CalIcon}
                  color={data.team_avg_attendance >= 85 ? 'green' : 'amber'}
                />
                <TeamStatCard
                  label="Total Shortage"
                  value={`${data.team_total_shortage}h`}
                  helper="Combined hours"
                  icon={TrendingDown}
                  color={data.team_total_shortage > 0 ? 'red' : 'green'}
                />
                <TeamStatCard label="Total On Leave" value={String(data.team_total_on_leave)} helper="Combined leave days" icon={CalIcon} color="cyan" />
              </div>

              {/* Team Members Table */}
              <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <div className="border-b border-gray-100 p-4">
                  <h3 className="font-semibold text-gray-900">Team Members</h3>
                </div>
                {data.members.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-3 text-sm text-gray-500">No team members found</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Position</th>
                        <th className="px-4 py-3 text-center">Present</th>
                        <th className="px-4 py-3 text-center">Absent</th>
                        <th className="px-4 py-3 text-center">Missing</th>
                        <th className="px-4 py-3 text-center">On Leave</th> 
                        <th className="px-4 py-3 text-center">Worked</th>
                        <th className="px-4 py-3 text-center">Shortage</th>
                        <th className="px-4 py-3 text-center">%</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.members.map((member) => (
                        <tr
                          key={member.employee.id}
                          onClick={() => navigate(`/team-attendance/${member.employee.id}?year=${year}&month=${month}`)}
                          className="cursor-pointer hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {member.employee.full_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {member.employee.employee_id}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {member.employee.position || '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-green-700">
                            {member.stats.present_days}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-red-700">
                            {member.stats.absent_days}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-amber-700">
                            {member.stats.missing_punch_days}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-cyan-700">
  {member.stats.on_leave_days}
  {member.stats.on_half_leave_days > 0 && (
    <span className="text-xs text-teal-600 ml-1">
      (+{member.stats.on_half_leave_days} half)
    </span>
  )}
</td>
                          <td className="px-4 py-3 text-center text-gray-700">
                            {member.stats.total_worked_hours}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {member.stats.shortage_hours > 0 ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                {member.stats.shortage_hours}h
                              </span>
                            ) : (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                ✓
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold ${
                              member.stats.attendance_percent >= 90 ? 'text-green-700' :
                              member.stats.attendance_percent >= 75 ? 'text-amber-700' :
                              'text-red-700'
                            }`}>
                              {member.stats.attendance_percent}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function TeamStatCard({ label, value, helper, icon: Icon, color }: any) {
  const colorMap: any = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    cyan: 'bg-cyan-100 text-cyan-700',
  };
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-400">{helper}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}