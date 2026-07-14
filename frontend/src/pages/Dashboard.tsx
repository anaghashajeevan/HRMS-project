import { Users, UserPlus, Calendar, TrendingUp, Clock, CheckCircle2, XCircle } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useAuth } from '../context/AuthContext';

const stats = [
  { label: 'Total Employees', value: '1,250', change: '+12', icon: Users, color: 'blue' },
  { label: 'New Hires (Month)', value: '24', change: '+3', icon: UserPlus, color: 'green' },
  { label: 'On Leave Today', value: '38', change: '-5', icon: Calendar, color: 'amber' },
  { label: 'Attrition Rate', value: '4.2%', change: '-0.8%', icon: TrendingUp, color: 'red' },
];

const colorMap: Record<string, string> = {
  blue:  'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  red:   'bg-red-50 text-red-600',
};

const recentActivities = [
  { user: 'Priya Sharma', action: 'applied for leave', time: '5 min ago', type: 'leave' },
  { user: 'Rajesh Kumar', action: 'clocked in', time: '12 min ago', type: 'attendance' },
  { user: 'Anaghs N', action: 'submitted expense claim', time: '1 hr ago', type: 'expense' },
  { user: 'Kiran Kumar', action: 'completed onboarding', time: '2 hr ago', type: 'onboarding' },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-6">
          {/* Welcome banner */}
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 p-6 text-white shadow-lg">
            <h1 className="text-2xl font-bold">
              Hello, {user?.employee?.first_name || user?.username}!
            </h1>
            <p className="mt-1 text-primary-100">
              Here's what's happening in your organization today.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {user?.role_codes.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="mt-1 text-xs font-medium text-green-600">
                      {stat.change} vs last month
                    </p>
                  </div>
                  <div className={`rounded-lg p-2.5 ${colorMap[stat.color]}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Two-column: Activity + Attendance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                <button className="text-sm text-primary-600 hover:underline">View all</button>
              </div>
              <div className="space-y-3">
                {recentActivities.map((activity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-gray-50"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                      {activity.user[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{activity.user}</span> {activity.action}
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                    <Clock className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Today's Attendance</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm text-gray-700">Present</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">1,180</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-sm text-gray-700">Absent</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">32</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-amber-600" />
                    <span className="text-sm text-gray-700">On Leave</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">38</span>
                </div>

                <div className="pt-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-gray-600">Attendance Rate</span>
                    <span className="font-semibold text-gray-900">94.4%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-primary-600"
                      style={{ width: '94.4%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}