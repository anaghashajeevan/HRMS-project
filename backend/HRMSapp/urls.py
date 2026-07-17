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
    LoginView,
    LogoutView,
    CustomTokenRefreshView,
    MeView,
    ChangePasswordView,
    RegisterUserView,
    MyActiveSessionsView,
    RevokeSessionView,
    AuthAuditLogListView,
    RoleViewSet,
    CompanyStructureViewSet,
    JobPositionViewSet,
    EmployeeIdSettingViewSet,
    # Employee Module
    EmployeeViewSet,
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

    # ---------- Session Management ----------
    path('auth/sessions/', MyActiveSessionsView.as_view(), name='my_sessions'),
    path('auth/sessions/<uuid:session_id>/', RevokeSessionView.as_view(), name='revoke_session'),

    # ---------- Audit Logs ----------
    path('auth/audit-logs/', AuthAuditLogListView.as_view(), name='audit_logs'),


    # ---------- Router URLs (ViewSets) ----------
    path('', include(router.urls)),
]