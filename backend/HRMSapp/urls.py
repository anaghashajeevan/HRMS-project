"""
URL configuration for HRMS project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    # Authentication
    EmployeeDocumentViewSet,
    GetLMSTokenView,
    LoginView,
    LogoutView,
    CustomTokenRefreshView,
    MeView,
    ChangePasswordView,
    PerformanceReportsView,
    RegisterUserView,
    MyActiveSessionsView,
    ReportExportView,
    RevokeSessionView,
    AuthAuditLogListView,
    RoleViewSet,
    CompanyStructureViewSet,
    JobPositionViewSet,
    EmployeeIdSettingViewSet,
    # Employee Module
    EmployeeViewSet,
    ApprovalWorkflowViewSet,
    LetterTemplateViewSet,
    LifecycleChangeRequestViewSet,
    NotificationViewSet,
    RatingScaleViewSet,
    OrganizationalPriorityViewSet,
    DepartmentalKRAViewSet,
    DepartmentalKPIViewSet,
    KRALibraryViewSet,
    KPILibraryItemViewSet,
    # PerformanceCycleViewSet,
    # EmployeeScorecardViewSet,
    # EmployeeKRAViewSet,
    # EmployeeKPIViewSet,
    # EmployeeKPIEvidenceViewSet,KRAPeerNominationViewSet,
    # PeerRatingViewSet,
    # PeerSearchView,
    ForgotPasswordRequestView,
    ForgotPasswordVerifyOTPView,
    ForgotPasswordResetView,DashboardStatsView,

    AnnualPerformancePlanViewSet,MonthlyPerformancePlanViewSet,MonthlyKRAViewSet,MonthlyKPIViewSet,MonthlyPeerNominationViewSet,MonthlyPeerRatingViewSet,CommonKRAMasterViewSet,
    DepartmentalKRAMasterViewSet,CommonKPIMasterViewSet,MonthlyKPIEvidenceViewSet,CarryForwardRecordViewSet,
    
    
)


# ==============================================================================
# ROUTER REGISTRATION (ViewSets)
# ==============================================================================

router = DefaultRouter()
router.register(r'roles', RoleViewSet, basename='roles')
router.register(r'company-structures', CompanyStructureViewSet, basename='company-structures')
router.register(r'job-positions', JobPositionViewSet, basename='job-positions')
router.register(r'employee-id-settings', EmployeeIdSettingViewSet, basename='employee-id-settings')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'employee-documents', EmployeeDocumentViewSet, basename='employee-documents')
router.register(r'approval-workflows', ApprovalWorkflowViewSet, basename='approval-workflows')
router.register(r'letter-templates', LetterTemplateViewSet, basename='letter-templates')
router.register(r'lifecycle-requests', LifecycleChangeRequestViewSet, basename='lifecycle-requests')
router.register(r'notifications', NotificationViewSet, basename='notifications')
router.register(r'rating-scales', RatingScaleViewSet, basename='rating-scales')
router.register(r'organizational-priorities', OrganizationalPriorityViewSet, basename='org-priorities')
# router.register(r'departmental-kras', DepartmentalKRAViewSet, basename='dept-kras')
router.register(r'departmental-kpis', DepartmentalKPIViewSet, basename='dept-kpis')
router.register(r'kra-library', KRALibraryViewSet, basename='kra-library')
router.register(r'kpi-library', KPILibraryItemViewSet, basename='kpi-library')
# router.register(r'performance-cycles', PerformanceCycleViewSet, basename='performance-cycles')
# router.register(r'employee-scorecards', EmployeeScorecardViewSet, basename='employee-scorecards')
# router.register(r'employee-kras', EmployeeKRAViewSet, basename='employee-kras')
# router.register(r'employee-kpis', EmployeeKPIViewSet, basename='employee-kpis')
# router.register(r'kpi-evidences', EmployeeKPIEvidenceViewSet, basename='kpi-evidences')
# router.register(r'peer-nominations', KRAPeerNominationViewSet, basename='peer-nominations')
# router.register(r'peer-ratings', PeerRatingViewSet, basename='peer-ratings')

router.register(r'annual-plans', AnnualPerformancePlanViewSet, basename='annual-plans')
router.register(r'monthly-plans', MonthlyPerformancePlanViewSet, basename='monthly-plans')
router.register(r'monthly-kras', MonthlyKRAViewSet, basename='monthly-kras')
router.register(r'monthly-kpis', MonthlyKPIViewSet, basename='monthly-kpis')

router.register(r'monthly-peer-nominations', MonthlyPeerNominationViewSet, basename='monthly-peer-nominations')
router.register(r'monthly-peer-ratings', MonthlyPeerRatingViewSet, basename='monthly-peer-ratings')

router.register(r'common-kras', CommonKRAMasterViewSet, basename='common-kras')
router.register(r'dept-kras', DepartmentalKRAMasterViewSet, basename='dept-kras')
router.register(r'common-kpis', CommonKPIMasterViewSet, basename='common-kpis')
router.register(r'monthly-kpi-evidences', MonthlyKPIEvidenceViewSet, basename='monthly-kpi-evidences')
router.register(r'carry-forwards', CarryForwardRecordViewSet, basename='carry-forwards')
# ==============================================================================
# URL PATTERNS
# ==============================================================================

urlpatterns = [
    # ---------- Authentication ----------
    path('auth/token/', LoginView.as_view(), name='login'),
    path('auth/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/password/change/', ChangePasswordView.as_view(), name='password_change'),
    path('auth/register/', RegisterUserView.as_view(), name='register'),
    path('auth/forgot-password/request/', ForgotPasswordRequestView.as_view(), name='forgot-password-request'),
    path('auth/forgot-password/verify-otp/', ForgotPasswordVerifyOTPView.as_view(), name='forgot-password-verify-otp'),
    path('auth/forgot-password/reset/', ForgotPasswordResetView.as_view(), name='forgot-password-reset'),
    # ---------- Session Management ----------
    path('auth/sessions/', MyActiveSessionsView.as_view(), name='my_sessions'),
    path('auth/sessions/<uuid:session_id>/', RevokeSessionView.as_view(), name='revoke_session'),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('reports/data/', PerformanceReportsView.as_view(), name='performance-reports'),
    path('reports/export/', ReportExportView.as_view(), name='report-export'),
    
    # ---------- Audit Logs ----------
    path('auth/audit-logs/', AuthAuditLogListView.as_view(), name='audit_logs'),
    # path('peer-search/', PeerSearchView.as_view(), name='peer-search'),
    path('lms/get-token/', GetLMSTokenView.as_view()),
    # ---------- Router URLs (ViewSets) ----------
    path('', include(router.urls)),
]