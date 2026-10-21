"""Payroll API routes, mounted at ``/api/v1/payroll/``."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views


router = DefaultRouter()
router.register(r'components', views.SalaryComponentViewSet, basename='payroll-components')
router.register(r'structures', views.SalaryStructureViewSet, basename='payroll-structures')
router.register(r'statutory-rules', views.StatutoryRuleViewSet, basename='payroll-statutory-rules')
router.register(r'calendar', views.PayCalendarViewSet, basename='payroll-calendar')
router.register(r'assignments', views.EmployeeSalaryAssignmentViewSet, basename='payroll-assignments')
router.register(r'profiles', views.EmployeePayrollProfileViewSet, basename='payroll-profiles')

urlpatterns = [
    path('seed-defaults/', views.SeedDefaultsView.as_view(), name='payroll-seed-defaults'),
    path('preview/', views.PreviewCalculationView.as_view(), name='payroll-structure-preview'),
    path('calculate-preview/', views.CalculatePreviewView.as_view(), name='payroll-calculate-preview'),
    path('profiles/overview/', views.PayrollProfilesOverviewView.as_view(), name='payroll-profiles-overview'),

    path('runs/', views.PayRunListCreateView.as_view(), name='payroll-runs'),
    path('runs/<uuid:run_id>/employees/', views.RunEmployeeListView.as_view(), name='payroll-run-employees'),
    path('runs/<uuid:run_id>/adjustments/', views.RunAdjustmentListCreateView.as_view(), name='payroll-run-adjustments'),
    path('runs/<uuid:run_id>/payment-batches/', views.PayRunPaymentBatchView.as_view(), name='payroll-run-payment-batches'),
    path('payment-batches/<uuid:batch_id>/export/<str:export_format>/', views.PaymentBatchExportView.as_view(), name='payroll-payment-batch-export'),
    path('payment-batches/<uuid:batch_id>/refresh-bank-details/', views.PaymentBatchRefreshBankDetailsView.as_view(), name='payroll-payment-batch-refresh-bank-details'),
    path('payment-batches/<uuid:batch_id>/lines/<uuid:line_id>/status/', views.PaymentBatchLineStatusView.as_view(), name='payroll-payment-line-status'),
    path('runs/<uuid:run_id>/employees/<uuid:pk>/exclude/', views.RunEmployeeExcludeView.as_view(), name='payroll-run-employee-exclude'),
    path('runs/<uuid:run_id>/employees/<uuid:pk>/', views.RunEmployeeDetailView.as_view(), name='payroll-run-employee-detail'),
    path('runs/<uuid:run_id>/variance/', views.RunVarianceView.as_view(), name='payroll-run-variance'),
    path('runs/<uuid:run_id>/audit-log/', views.RunAuditLogView.as_view(), name='payroll-run-audit-log'),
    path('payslips/eligible-runs/', views.PayslipEligibleRunsView.as_view(), name='payroll-payslip-eligible-runs'),
    path('payslips/requests/', views.PayslipRequestListCreateView.as_view(), name='payroll-payslip-requests'),
    # Put this before the generic decision route: otherwise "download" is
    # captured as the decision parameter and DRF returns 405 for GET.
    path('payslips/requests/<uuid:request_id>/download/', views.PayslipDownloadView.as_view(), name='payroll-payslip-download'),
    path('payslips/requests/<uuid:request_id>/<str:decision>/', views.PayslipRequestDecisionView.as_view(), name='payroll-payslip-request-decision'),
    path('runs/<uuid:pk>/', views.PayRunDetailView.as_view(), name='payroll-run-detail'),
    # Keep the catch-all action route after specific run subroutes.
    path('runs/<uuid:pk>/<str:action>/', views.PayRunTransitionView.as_view(), name='payroll-run-transition'),

    path('', include(router.urls)),
]
