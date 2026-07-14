"""
Authentication URL routes for HRMS.
Prefix: /api/v1/auth/
"""
from django.urls import path
from .views import (
    LoginView,
    LogoutView,
    CustomTokenRefreshView,
    MeView,
    ChangePasswordView,
    RegisterUserView,
    MyActiveSessionsView,
    RevokeSessionView,
    AuthAuditLogListView,
    RoleListCreateView,
    RoleDetailView,
)

app_name = 'auth'

urlpatterns = [
    # --- Authentication ---
    path('auth/token/', LoginView.as_view(), name='login'),
    path('auth/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),

    # --- Current user ---
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/password/change/', ChangePasswordView.as_view(), name='password_change'),

    # --- Registration (Admin) ---
    path('auth/register/', RegisterUserView.as_view(), name='register'),

    # --- Sessions ---
    path('auth/sessions/', MyActiveSessionsView.as_view(), name='my_sessions'),
    path('auth/sessions/<uuid:session_id>/', RevokeSessionView.as_view(), name='revoke_session'),

    # --- Audit ---
    path('auth/audit-logs/', AuthAuditLogListView.as_view(), name='audit_logs'),

    # --- Roles ---
    path('auth/roles/', RoleListCreateView.as_view(), name='role_list'),
    path('auth/roles/<uuid:pk>/', RoleDetailView.as_view(), name='role_detail'),
]