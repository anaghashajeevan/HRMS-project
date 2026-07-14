from django.shortcuts import render

# Create your views here.
"""
Authentication views — flat class-based APIViews.
"""
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenRefreshView

from .models import UserAccount, UserActiveSession, AuthAuditLog, Role
from .serializers import (
    LoginSerializer,
    LogoutSerializer,
    UserProfileSerializer,
    ChangePasswordSerializer,
    RegisterUserSerializer,
    ActiveSessionSerializer,
    AuthAuditLogSerializer,
    RoleSerializer,
    CustomTokenRefreshSerializer,
)
from .permissions import IsHRAdmin, IsSystemAdmin


# ==============================================================================
# LOGIN
# ==============================================================================

class LoginView(APIView):
    """
    POST /api/v1/auth/token/
    Body: { "username": "...", "password": "...", "device_id": "..." }
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        device_id = request.data.get('device_id', '')
        tokens = serializer.create_tokens(user, device_id=device_id)

        return Response({
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user': UserProfileSerializer(user).data,
        }, status=status.HTTP_200_OK)


# ==============================================================================
# LOGOUT
# ==============================================================================

class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Body: { "refresh": "<refresh_token>" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)


# ==============================================================================
# TOKEN REFRESH
# ==============================================================================

class CustomTokenRefreshView(TokenRefreshView):
    """POST /api/v1/auth/token/refresh/"""
    serializer_class = CustomTokenRefreshSerializer


# ==============================================================================
# CURRENT USER (/me)
# ==============================================================================

class MeView(APIView):
    """GET /api/v1/auth/me/ — returns current authenticated user profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)


# ==============================================================================
# CHANGE PASSWORD
# ==============================================================================

class ChangePasswordView(APIView):
    """POST /api/v1/auth/password/change/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'status': 'SUCCESS', 'message': 'Password changed successfully.'},
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# REGISTER USER (Admin-only)
# ==============================================================================

class RegisterUserView(APIView):
    """
    POST /api/v1/auth/register/
    Admin creates an Employee + UserAccount in a single call.
    """
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        serializer = RegisterUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            'id': str(user.id),
            'username': user.username,
            'employee_id': user.employee.employee_id,
            'status': user.employee.status,
            'created_at': user.created_at,
        }, status=status.HTTP_201_CREATED)


# ==============================================================================
# ACTIVE SESSIONS
# ==============================================================================

class MyActiveSessionsView(generics.ListAPIView):
    """GET /api/v1/auth/sessions/ — list my active sessions."""
    serializer_class = ActiveSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserActiveSession.objects.filter(
            user=self.request.user, is_valid=True
        ).order_by('-created_at')


class RevokeSessionView(APIView):
    """DELETE /api/v1/auth/sessions/<uuid:session_id>/ — revoke a session."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, session_id):
        try:
            session = UserActiveSession.objects.get(id=session_id, user=request.user)
        except UserActiveSession.DoesNotExist:
            return Response(
                {'detail': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        session.is_valid = False
        session.save(update_fields=['is_valid'])
        return Response({'status': 'REVOKED'}, status=status.HTTP_200_OK)


# ==============================================================================
# AUDIT LOGS (Admin-only)
# ==============================================================================

class AuthAuditLogListView(generics.ListAPIView):
    """GET /api/v1/auth/audit-logs/ — admin only."""
    serializer_class = AuthAuditLogSerializer
    permission_classes = [IsAuthenticated, IsSystemAdmin]
    queryset = AuthAuditLog.objects.all().select_related('user')


# ==============================================================================
# ROLE MANAGEMENT (Admin-only)
# ==============================================================================

class RoleListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/auth/roles/"""
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsSystemAdmin]
    queryset = Role.objects.all()


class RoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/v1/auth/roles/<uuid:pk>/"""
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsSystemAdmin]
    queryset = Role.objects.all()