"""
Attendance app URL configuration.
All endpoints mounted under /api/v1/attendance/
"""

from django.urls import path

from .views import (
    AttendanceDashboardView,
    AttendanceSettingsView,
    DownloadDailyReportView,
    DownloadMonthlyReportView,
    GenerateMonthlyReportView,
    ListMonthlyReportsView,
    LivePresenceView,
    RunAutomationView,
    SendMonthlyReportView,
    SendTestEmailView,
    TestEsslConnectionView,MyAttendanceMonthView,
    MyAttendanceDayView,
    TeamAttendanceMonthView,
    EmployeeAttendanceMonthView,AllEmployeesAttendanceView,
)

urlpatterns = [
    # Dashboard
    path('dashboard/', AttendanceDashboardView.as_view(), name='attendance-dashboard'),

    # Live presence
    path('live-presence/', LivePresenceView.as_view(), name='attendance-live-presence'),

    # Automation
    path('run-automation/', RunAutomationView.as_view(), name='attendance-run-automation'),

    # Settings
    path('settings/', AttendanceSettingsView.as_view(), name='attendance-settings'),
    path('settings/test-essl/', TestEsslConnectionView.as_view(), name='attendance-test-essl'),
    path('settings/test-email/', SendTestEmailView.as_view(), name='attendance-test-email'),

    # Monthly report
    path('monthly-report/generate/', GenerateMonthlyReportView.as_view(), name='attendance-monthly-generate'),
    path('monthly-report/send/', SendMonthlyReportView.as_view(), name='attendance-monthly-send'),
    path('monthly-report/history/', ListMonthlyReportsView.as_view(), name='attendance-monthly-history'),

    # Report downloads
    path('reports/daily/<uuid:log_id>/download/', DownloadDailyReportView.as_view(), name='attendance-download-daily'),
    path('reports/monthly/<uuid:log_id>/download/', DownloadMonthlyReportView.as_view(), name='attendance-download-monthly'),
    path('my-attendance/month/', MyAttendanceMonthView.as_view(), name='my-attendance-month'),
    path('my-attendance/day/', MyAttendanceDayView.as_view(), name='my-attendance-day'),
    path('team-attendance/month/', TeamAttendanceMonthView.as_view(), name='team-attendance-month'),
    path('employee-attendance/<uuid:employee_id>/month/', EmployeeAttendanceMonthView.as_view(), name='employee-attendance-month'),
    path('all-employees-attendance/',AllEmployeesAttendanceView.as_view(),name='all-employees-attendance'),
]