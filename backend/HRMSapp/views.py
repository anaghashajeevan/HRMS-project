from time import timezone

from django.shortcuts import render

from django.db import models

from django.conf import settings
# Create your views here.
"""
Authentication views — flat class-based APIViews.
"""
from django.utils import timezone as django_timezone
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.decorators import action
from .models import KRAPeerNomination, PeerRating, UserAccount, UserActiveSession, AuthAuditLog, Role,EmployeeAuditLog
from .serializers import (
    EmployeeCreateUpdateSerializer,
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
from .permissions import IsHRAdmin, IsSystemAdmin, ReadHROnlyWriteSystemAdmin


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
# FORGOT PASSWORD VIEWS
# ==============================================================================

import secrets
import hashlib
import random
from datetime import timedelta
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone as dj_timezone
from .models import PasswordResetOTP, UserAccount, AuthAuditLog
from .serializers import (
    ForgotPasswordRequestSerializer,
    ForgotPasswordVerifyOTPSerializer,
    ForgotPasswordResetSerializer,
)


def _get_client_ip(request):
    """Extract client IP from request."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


def _hash_otp(otp: str) -> str:
    """Hash OTP using SHA-256 (fast, we just need integrity)."""
    return hashlib.sha256(otp.encode()).hexdigest()


class ForgotPasswordRequestView(APIView):
    """
    Step 1: POST /api/v1/auth/forgot-password/request/
    Body: { "email": "user@example.com" }
    → Sends 6-digit OTP to email (valid 10 min)
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        
        # For security: always return success, even if email doesn't exist
        # (prevents email enumeration attacks)
        try:
            user = UserAccount.objects.get(email__iexact=email, is_active=True)
        except UserAccount.DoesNotExist:
            # Silently succeed
            return Response({
                'status': 'success',
                'message': 'If an account exists with this email, an OTP has been sent.',
            })
        
        # Rate limiting: max 3 OTP requests per user per 10 minutes
        recent_otps = PasswordResetOTP.objects.filter(
            user=user,
            created_at__gte=dj_timezone.now() - timedelta(minutes=10),
        ).count()
        if recent_otps >= 3:
            return Response({
                'detail': 'Too many OTP requests. Please try again in 10 minutes.',
            }, status=429)
        
        # Invalidate previous unused OTPs
        PasswordResetOTP.objects.filter(
            user=user,
            is_used=False,
        ).update(is_used=True, used_at=dj_timezone.now())
        
        # Generate 6-digit OTP
        otp = f"{random.randint(0, 999999):06d}"
        otp_hash = _hash_otp(otp)
        
        # Create OTP record
        otp_record = PasswordResetOTP.objects.create(
            user=user,
            otp_hash=otp_hash,
            expires_at=dj_timezone.now() + timedelta(minutes=10),
            ip_address=_get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
        )
        
        # Send email
        try:
            context = {
                'full_name': user.employee.full_name if user.employee else user.email,
                'otp': otp,
                'ip_address': _get_client_ip(request),
                'timestamp': dj_timezone.now().strftime('%d %B %Y, %H:%M %Z'),
                'current_year': dj_timezone.now().year,
            }
            
            html_body = render_to_string('emails/password_reset_otp.html', context)
            text_body = render_to_string('emails/password_reset_otp.txt', context)
            
            email_msg = EmailMultiAlternatives(
                subject='🔐 HRMS - Your Password Reset OTP',
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email_msg.attach_alternative(html_body, 'text/html')
            email_msg.send(fail_silently=False)
        except Exception as e:
            # Delete the OTP if email fails
            otp_record.delete()
            return Response({
                'detail': f'Failed to send OTP email: {str(e)}',
            }, status=500)
        
        # Audit log
        AuthAuditLog.objects.create(
            user=user,
            username_attempted=email,
            event_type='PASSWORD_CHANGE',
            ip_address=_get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            details={'action': 'otp_requested'},
        )
        
        return Response({
            'status': 'success',
            'message': 'OTP sent to your registered email. Valid for 10 minutes.',
        })


class ForgotPasswordVerifyOTPView(APIView):
    """
    Step 2: POST /api/v1/auth/forgot-password/verify-otp/
    Body: { "email": "...", "otp": "123456" }
    → Returns reset_token to use for password reset
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = ForgotPasswordVerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        otp = serializer.validated_data['otp']
        
        try:
            user = UserAccount.objects.get(email__iexact=email, is_active=True)
        except UserAccount.DoesNotExist:
            return Response({'detail': 'Invalid email or OTP.'}, status=400)
        
        # Find latest valid OTP for this user
        otp_record = PasswordResetOTP.objects.filter(
            user=user,
            is_used=False,
            is_verified=False,
        ).order_by('-created_at').first()
        
        if not otp_record:
            return Response({'detail': 'No active OTP found. Please request a new one.'}, status=400)
        
        # Check expiry
        if otp_record.is_expired():
            return Response({'detail': 'OTP has expired. Please request a new one.'}, status=400)
        
        # Check attempts
        if otp_record.attempts >= otp_record.max_attempts:
            otp_record.is_used = True
            otp_record.used_at = dj_timezone.now()
            otp_record.save()
            return Response({
                'detail': 'Too many failed attempts. Please request a new OTP.',
            }, status=400)
        
        # Verify OTP
        otp_record.attempts += 1
        if otp_record.otp_hash != _hash_otp(otp):
            otp_record.save(update_fields=['attempts'])
            remaining = otp_record.max_attempts - otp_record.attempts
            return Response({
                'detail': f'Invalid OTP. {remaining} attempts remaining.',
            }, status=400)
        
        # OTP correct — generate reset token (valid 15 min)
        reset_token = secrets.token_urlsafe(48)
        otp_record.reset_token = reset_token
        otp_record.is_verified = True
        otp_record.verified_at = dj_timezone.now()
        otp_record.save()
        
        return Response({
            'status': 'success',
            'message': 'OTP verified. Use the reset token to set your new password.',
            'reset_token': reset_token,
            'expires_in_minutes': 15,
        })


class ForgotPasswordResetView(APIView):
    """
    Step 3: POST /api/v1/auth/forgot-password/reset/
    Body: { "reset_token": "...", "new_password": "...", "confirm_password": "..." }
    → Actually resets the password
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = ForgotPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset_token = serializer.validated_data['reset_token']
        new_password = serializer.validated_data['new_password']
        
        # Find OTP record
        try:
            otp_record = PasswordResetOTP.objects.select_related('user').get(
                reset_token=reset_token,
                is_verified=True,
                is_used=False,
            )
        except PasswordResetOTP.DoesNotExist:
            return Response({'detail': 'Invalid or expired reset token.'}, status=400)
        
        # Check if reset token is still valid (15 min from verification)
        if otp_record.verified_at:
            expiry = otp_record.verified_at + timedelta(minutes=15)
            if dj_timezone.now() > expiry:
                otp_record.is_used = True
                otp_record.used_at = dj_timezone.now()
                otp_record.save()
                return Response({
                    'detail': 'Reset token expired. Please start the process again.',
                }, status=400)
        
        user = otp_record.user
        
        # Check new password is different from old
        if user.check_password(new_password):
            return Response({
                'detail': 'New password must be different from your current password.',
            }, status=400)
        
        # Reset password
        user.set_password(new_password)
        user.password_changed_at = dj_timezone.now()
        user.failed_login_attempts = 0
        user.is_locked_out = False
        user.locked_until = None
        user.save(update_fields=[
            'password', 'password_changed_at',
            'failed_login_attempts', 'is_locked_out', 'locked_until',
        ])
        
        # Mark OTP as used
        otp_record.is_used = True
        otp_record.used_at = dj_timezone.now()
        otp_record.save()
        
        # Invalidate any other pending OTPs for this user
        PasswordResetOTP.objects.filter(
            user=user,
            is_used=False,
        ).update(is_used=True, used_at=dj_timezone.now())
        
        # Audit log
        AuthAuditLog.objects.create(
            user=user,
            username_attempted=user.email,
            event_type='PASSWORD_CHANGE',
            ip_address=_get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            details={'action': 'password_reset_completed'},
        )
        
        return Response({
            'status': 'success',
            'message': 'Password reset successfully. You can now login with your new password.',
        })

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
# EMPLOYEE MODULE VIEWS
# ==============================================================================

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.viewsets import ReadOnlyModelViewSet
from .models import Employee
from .serializers import EmployeeListSerializer, EmployeeDetailSerializer,EmployeeAuditLogSerializer
from .permissions import IsHRAdminOrReadOwn


from rest_framework.viewsets import ModelViewSet
from .utils import generate_employee_id


class EmployeeViewSet(ModelViewSet):
    """
    Full CRUD for employees.
    - LIST/DETAIL: HR sees all, managers see team, employees see self
    - CREATE/UPDATE/DELETE: HR Admin / System Admin only
    """
    permission_classes = [IsAuthenticated, IsHRAdminOrReadOwn]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'gender', 'position__department']
    search_fields = ['employee_id', 'first_name', 'last_name', 'official_email', 'phone_number']
    ordering_fields = ['date_of_joining', 'first_name', 'last_name', 'employee_id']
    ordering = ['employee_id']
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_queryset(self):
        user = self.request.user
        qs = Employee.objects.filter(is_deleted=False).select_related(
            'position', 'position__department', 'reporting_manager', 'structure_location'
        )

        if user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN'):
            return qs

        if user.has_role('MANAGER') and hasattr(user, 'employee'):
            return qs.filter(
                models.Q(reporting_manager_id=user.employee.id)
                | models.Q(id=user.employee.id)
            )

        if hasattr(user, 'employee'):
            return qs.filter(id=user.employee.id)

        return qs.none()

    def get_serializer_class(self):
        if self.action == 'list':
            return EmployeeListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return EmployeeCreateUpdateSerializer
        return EmployeeDetailSerializer

    def perform_create(self, serializer):
        """Auto-generate employee_id + increment position headcount."""
        employee_id = generate_employee_id()
        instance = serializer.save(employee_id=employee_id)

        # Increment position actual_count
        if instance.position:
            instance.position.actual_count = instance.position.employees.filter(is_deleted=False).count()
            instance.position.save(update_fields=['actual_count'])

    def perform_update(self, serializer):
        """Log field changes to audit trail + update position headcount."""
        old_instance = self.get_object()
        old_position_id = old_instance.position_id

        # ✅ Attach the user BEFORE saving so signal can log correctly
        user = self.request.user
        modifier = getattr(user, 'employee', None)

        # Set the modifier on the instance BEFORE serializer.save()
        instance = serializer.instance
        instance._modified_by = modifier

        # Now save — signal fires with correct modified_by
        instance = serializer.save()

        # Update position counts if position changed
        if old_position_id != instance.position_id:
            if old_instance.position:
                old_instance.position.actual_count = old_instance.position.employees.filter(is_deleted=False).count()
                old_instance.position.save(update_fields=['actual_count'])
            if instance.position:
                instance.position.actual_count = instance.position.employees.filter(is_deleted=False).count()
                instance.position.save(update_fields=['actual_count'])

    def perform_destroy(self, instance):
        """Soft delete — mark as TERMINATED instead of removing."""
        instance.is_deleted = True
        instance.status = 'TERMINATED'
        instance.save(update_fields=['is_deleted', 'status'])

        # Decrement position count
        if instance.position:
            instance.position.actual_count = instance.position.employees.filter(is_deleted=False).count()
            instance.position.save(update_fields=['actual_count'])

    @action(detail=False, methods=['get'], url_path='managers')
    def managers(self, request):
        """Get list of employees who can be managers (for dropdowns)."""
        qs = Employee.objects.filter(
            is_deleted=False,
            status__in=['ACTIVE', 'PROBATION']
        ).order_by('first_name')

        # Optional search
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                models.Q(first_name__icontains=search)
                | models.Q(last_name__icontains=search)
                | models.Q(employee_id__icontains=search)
            )

        qs = qs[:50]  # Limit results
        data = [{
            'id': str(emp.id),
            'employee_id': emp.employee_id,
            'full_name': emp.full_name,
            'official_email': emp.official_email,
        } for emp in qs]
        return Response(data)
    
    @action(detail=True, methods=['get'], url_path='audit-log')
    def audit_log(self, request, pk=None):
        """
        GET /api/v1/employees/{id}/audit-log/
        Returns audit history for this employee.
        HR/System Admin only.
        """
        employee = self.get_object()

        # Only HR/System Admin can view audit logs
        if not (request.user.has_role('SYSTEM_ADMIN') or request.user.has_role('HR_ADMIN')):
            return Response(
                {'detail': 'You do not have permission to view audit logs.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        logs = EmployeeAuditLog.objects.filter(
            employee=employee
        ).select_related('modified_by').order_by('-changed_at')

        # Optional filters
        field = request.query_params.get('field')
        if field:
            logs = logs.filter(field_name=field)

        # Pagination
        page = self.paginate_queryset(logs)
        if page is not None:
            serializer = EmployeeAuditLogSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = EmployeeAuditLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get', 'patch'], url_path='me')
    def me(self, request):
        """
        GET /api/v1/employees/me/     → Get logged-in user's own profile
        PATCH /api/v1/employees/me/   → Update own profile (limited fields)
        """
        user = request.user
        if not hasattr(user, 'employee'):
            return Response(
                {'detail': 'No employee record linked to your account.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        employee = user.employee

        # ---------- GET: return own profile ----------
        if request.method == 'GET':
            serializer = EmployeeDetailSerializer(employee, context={'request': request})
            return Response(serializer.data)

        # ---------- PATCH: update own profile (limited fields only) ----------
        ALLOWED_SELF_UPDATE_FIELDS = [
            'phone_number',
            'personal_email',
        ]

        # Filter incoming data to only allowed fields
        filtered_data = {
            k: v for k, v in request.data.items()
            if k in ALLOWED_SELF_UPDATE_FIELDS
        }

        if not filtered_data:
            return Response(
                {'detail': 'No editable fields provided. You can only update: ' + ', '.join(ALLOWED_SELF_UPDATE_FIELDS)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update using serializer (triggers validation + audit signal)
        for field, value in filtered_data.items():
            setattr(employee, field, value)
        employee._modified_by = employee    
        employee.save()

        # Return updated data
        serializer = EmployeeDetailSerializer(employee, context={'request': request})
        return Response(serializer.data) 

    @action(detail=True, methods=['get'], url_path='career-history')
    def career_history(self, request, pk=None):
        """
        GET /api/v1/employees/{id}/career-history/
        Extracts career-related changes from the audit log:
        - Position changes (promotions / re-designations)
        - Department changes (transfers)
        - Manager changes
        Returns human-readable timeline entries.
        """
        from .models import (
            EmployeeAuditLog, JobPosition, Employee as EmpModel, CompanyStructure
        )

        employee = self.get_object()

        # Only HR / System Admin / self / manager can view
        user = request.user
        can_view = (
            user.has_role('SYSTEM_ADMIN')
            or user.has_role('HR_ADMIN')
            or (hasattr(user, 'employee') and user.employee.id == employee.id)
            or (
                user.has_role('MANAGER')
                and hasattr(user, 'employee')
                and employee.reporting_manager_id == user.employee.id
            )
        )
        if not can_view:
            return Response(
                {'detail': 'You do not have permission to view this career history.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Only fields relevant to career progression
        CAREER_FIELDS = {
            'position_id': 'Position',
            'reporting_manager_id': 'Reporting Manager',
            'structure_location_id': 'Department / Location',
            'status': 'Employment Status',
        }

        logs = EmployeeAuditLog.objects.filter(
            employee=employee,
            field_name__in=list(CAREER_FIELDS.keys()),
        ).select_related('modified_by').order_by('-changed_at')

        # ---------- Build lookup maps to resolve UUIDs → names ----------
        # Collect all UUIDs referenced in old/new values
        position_ids = set()
        manager_ids = set()
        location_ids = set()

        for log in logs:
            for val in (log.old_value, log.new_value):
                if not val or val == 'None':
                    continue
                if log.field_name == 'position_id':
                    position_ids.add(val)
                elif log.field_name == 'reporting_manager_id':
                    manager_ids.add(val)
                elif log.field_name == 'structure_location_id':
                    location_ids.add(val)

        # Bulk fetch names
        positions_map = {
            str(p.id): f"{p.title} ({p.grade_band})"
            for p in JobPosition.objects.filter(id__in=position_ids)
        }
        managers_map = {
            str(e.id): f"{e.first_name} {e.last_name} ({e.employee_id})"
            for e in EmpModel.objects.filter(id__in=manager_ids)
        }
        locations_map = {
            str(c.id): c.name
            for c in CompanyStructure.objects.filter(id__in=location_ids)
        }

        def resolve(field_name, value):
            """Convert UUID string → human-readable name."""
            if not value or value == 'None':
                return '—'
            if field_name == 'position_id':
                return positions_map.get(value, f'Unknown Position ({value[:8]})')
            if field_name == 'reporting_manager_id':
                return managers_map.get(value, f'Unknown Manager ({value[:8]})')
            if field_name == 'structure_location_id':
                return locations_map.get(value, f'Unknown Location ({value[:8]})')
            if field_name == 'status':
                return value  # status is already readable (ACTIVE, PROBATION, etc.)
            return value

        # ---------- Build timeline entries ----------
        entries = []
        for log in logs:
            entries.append({
                'id': log.id,
                'event_type': CAREER_FIELDS.get(log.field_name, log.field_name),
                'field_name': log.field_name,
                'from_value': resolve(log.field_name, log.old_value),
                'to_value': resolve(log.field_name, log.new_value),
                'changed_at': log.changed_at,
                'changed_by': log.modified_by.full_name if log.modified_by else 'System',
                'changed_by_id': log.modified_by.employee_id if log.modified_by else None,
            })

        # ---------- Add "joined the company" as final entry ----------
        entries.append({
            'id': 0,
            'event_type': 'Joined the Company',
            'field_name': 'joined',
            'from_value': None,
            'to_value': employee.first_name + ' joined as a ' + (
                employee.position.title if employee.position else 'new employee'
            ),
            'changed_at': employee.date_of_joining,
            'changed_by': 'System',
            'changed_by_id': None,
        })

        return Response({
            'count': len(entries),
            'employee': {
                'id': str(employee.id),
                'employee_id': employee.employee_id,
                'full_name': employee.full_name,
                'date_of_joining': employee.date_of_joining,
            },
            'timeline': entries,
        })   
# ==============================================================================
# MASTER DATA VIEWS
# ==============================================================================

from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from .models import CompanyStructure, JobPosition, SystemSetting, Role
from .serializers import (
    RoleFullSerializer,
    CompanyStructureSerializer,
    JobPositionSerializer,
    EmployeeIdSettingSerializer,
    EmployeeIdPreviewSerializer,
)
from .permissions import IsHRAdmin, IsSystemAdmin


# ------------------------------------------------------------------------------
# ROLE MANAGEMENT
# ------------------------------------------------------------------------------

class RoleViewSet(ModelViewSet):
    """Full CRUD for roles. Only System Admins can manage."""
    queryset = Role.objects.all().order_by('-level', 'role_name')
    serializer_class = RoleFullSerializer
    permission_classes = [IsAuthenticated, ReadHROnlyWriteSystemAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['role_name', 'code', 'description']
    ordering_fields = ['level', 'role_name', 'created_at']

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.user_accounts.exists():
            return Response(
                {'detail': f'Cannot delete role "{role.role_name}" — it is assigned to {role.user_accounts.count()} user(s).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


# ------------------------------------------------------------------------------
# COMPANY STRUCTURE (Departments / Locations)
# ------------------------------------------------------------------------------

class CompanyStructureViewSet(ModelViewSet):
    """Full CRUD for departments, locations, cost centers."""
    queryset = CompanyStructure.objects.all().order_by('type', 'name')
    serializer_class = CompanyStructureSerializer
    permission_classes = [IsAuthenticated, IsHRAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'is_active', 'parent']
    search_fields = ['name', 'cost_center_code']
    ordering_fields = ['name', 'type', 'created_at']

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.employees.filter(is_deleted=False).exists():
            return Response(
                {'detail': f'Cannot delete "{obj.name}" — it has active employees.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if obj.children.exists():
            return Response(
                {'detail': f'Cannot delete "{obj.name}" — it has child structures.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def departments(self, request):
        """Fetch only DEPARTMENT type (for dropdowns)."""
        depts = self.get_queryset().filter(type='DEPARTMENT', is_active=True)
        serializer = self.get_serializer(depts, many=True)
        return Response(serializer.data)


# ------------------------------------------------------------------------------
# JOB POSITION
# ------------------------------------------------------------------------------

class JobPositionViewSet(ModelViewSet):
    """Full CRUD for job positions with headcount tracking."""
    queryset = JobPosition.objects.select_related('department').order_by('title')
    serializer_class = JobPositionSerializer
    permission_classes = [IsAuthenticated, IsHRAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['department', 'grade_band', 'is_active']
    search_fields = ['title', 'grade_band']
    ordering_fields = ['title', 'grade_band', 'budgeted_count', 'created_at']

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.employees.filter(is_deleted=False).exists():
            return Response(
                {'detail': f'Cannot delete position "{obj.title}" — it has employees assigned.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


# ------------------------------------------------------------------------------
# EMPLOYEE ID SETTINGS (only)
# ------------------------------------------------------------------------------

# ------------------------------------------------------------------------------
# EMPLOYEE ID SETTINGS (only)
# ------------------------------------------------------------------------------

class EmployeeIdSettingViewSet(ModelViewSet):
    """
    Manage Employee ID settings only (prefix, include_year, padding).
    Only System Admins can modify.
    Auto-creates default settings if they don't exist yet.
    """
    permission_classes = [IsAuthenticated, IsSystemAdmin]
    serializer_class = EmployeeIdSettingSerializer
    http_method_names = ['get', 'patch']  # No create/delete
    
    # Only expose these 3 settings + their defaults
    DEFAULT_SETTINGS = [
        {
            'key': 'EMPLOYEE_ID_PREFIX',
            'value': 'NL',
            'description': 'Prefix for employee ID (e.g., NL, NLT, EMP)',
        },
        {
            'key': 'EMPLOYEE_ID_INCLUDE_YEAR',
            'value': 'true',
            'description': 'Include year in employee ID. Use "true" or "false"',
        },
        {
            'key': 'EMPLOYEE_ID_PADDING',
            'value': '4',
            'description': 'Number of digits in sequence (4 = 0001, 5 = 00001)',
        },
    ]

    def _ensure_defaults_exist(self):
        """Auto-create the 3 default settings if they don't exist."""
        for default in self.DEFAULT_SETTINGS:
            SystemSetting.objects.get_or_create(
                key=default['key'],
                defaults={
                    'value': default['value'],
                    'description': default['description'],
                    'is_editable': True,
                }
            )

    def get_queryset(self):
        # Auto-create defaults on every list request
        self._ensure_defaults_exist()
        allowed_keys = [d['key'] for d in self.DEFAULT_SETTINGS]
        return SystemSetting.objects.filter(key__in=allowed_keys).order_by('key')

    def perform_update(self, serializer):
        user = self.request.user
        employee = getattr(user, 'employee', None)
        serializer.save(updated_by=employee)

    @action(detail=False, methods=['post'], url_path='preview')
    def preview_employee_id(self, request):
        """
        Preview what the next employee ID would look like with given settings.
        POST /api/v1/employee-id-settings/preview/
        Body: { "prefix": "NLT", "include_year": true, "padding": 4 }
        Returns: { "preview": "NLT-2026-0007" }
        """
        serializer = EmployeeIdPreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from .models import Employee
        from django.utils import timezone

        prefix = serializer.validated_data['prefix']
        include_year = serializer.validated_data['include_year']
        padding = serializer.validated_data['padding']
        year = timezone.now().year

        # Count existing employees to estimate next number
        next_seq = Employee.objects.count() + 1
        seq_str = str(next_seq).zfill(padding)

        if include_year:
            preview = f"{prefix}-{year}-{seq_str}"
        else:
            preview = f"{prefix}-{seq_str}"

        return Response({'preview': preview})



# ==============================================================================
# EMPLOYEE DOCUMENTS VIEWSET
# ==============================================================================

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import EmployeeDocument
from .serializers import EmployeeDocumentSerializer


class EmployeeDocumentViewSet(ModelViewSet):
    """
    CRUD for employee documents.
    - HR/System Admin: full access to any employee's docs
    - Employees: can view/upload own documents
    - Managers: view team documents (read-only)
    """
    serializer_class = EmployeeDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['document_type', 'employee']
    ordering_fields = ['uploaded_at', 'expiry_date', 'document_name']
    ordering = ['-uploaded_at']

    def get_queryset(self):
        user = self.request.user
        qs = EmployeeDocument.objects.select_related('employee', 'uploaded_by')

        # HR / System Admin — full access
        if user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN'):
            return qs

        # Manager — see docs of their team
        if user.has_role('MANAGER') and hasattr(user, 'employee'):
            return qs.filter(
                models.Q(employee__reporting_manager_id=user.employee.id)
                | models.Q(employee_id=user.employee.id)
            )

        # Regular employee — own docs only
        if hasattr(user, 'employee'):
            return qs.filter(employee_id=user.employee.id)

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        employee = getattr(user, 'employee', None)

        # Non-HR users can only upload to their OWN profile
        target_employee = serializer.validated_data.get('employee')
        if not (user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN')):
            if not target_employee or target_employee.id != employee.id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You can only upload documents to your own profile.")

        serializer.save(uploaded_by=employee)

    def perform_destroy(self, instance):
        user = self.request.user
        employee = getattr(user, 'employee', None)

        # Only HR or uploader can delete
        is_hr = user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN')
        is_uploader = instance.uploaded_by_id == (employee.id if employee else None)

        if not (is_hr or is_uploader):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You don't have permission to delete this document.")

        # Also delete the actual file
        if instance.file_path:
            instance.file_path.delete(save=False)
        instance.delete()




# requests


# ==============================================================================
# APPROVAL WORKFLOW VIEWS
# ==============================================================================

from .models import (
    ApprovalWorkflow, LetterTemplate, LifecycleChangeRequest,
    LifecycleApprovalAction, Notification
)
from .serializers import (
    ApprovalWorkflowSerializer, ApproverOptionSerializer,
    LetterTemplateSerializer, AIGenerateTemplateSerializer,
    LifecycleChangeRequestListSerializer,
    LifecycleChangeRequestDetailSerializer,
    LifecycleChangeRequestCreateSerializer,
    ApprovalActionSerializer, RejectActionSerializer,
    NotificationSerializer,
)
from .services.workflow_service import WorkflowService, generate_request_number
from .services.ai_letter_generator import generate_letter_template


class ApprovalWorkflowViewSet(ModelViewSet):
    """CRUD for approval workflow configurations."""
    queryset = ApprovalWorkflow.objects.all().prefetch_related('steps')
    serializer_class = ApprovalWorkflowSerializer
    permission_classes = [IsAuthenticated, IsHRAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['module', 'is_active']

    def perform_create(self, serializer):
        employee = getattr(self.request.user, 'employee', None)
        serializer.save(created_by=employee)

    @action(detail=False, methods=['get'], url_path='approver-options')
    def approver_options(self, request):
        """
        Returns dropdown options for approver selection:
        - Static: Reporting Manager, HR Admin, etc.
        - Dynamic: List of employees with "ROLE - Name" format
        """
        # Static options
        options = [
            {'id': 'REPORTING_MANAGER', 'label': '📌 Reporting Manager (auto)', 'category': 'Dynamic'},
            {'id': 'SKIP_LEVEL_MANAGER', 'label': '📌 Skip-Level Manager (auto)', 'category': 'Dynamic'},
            {'id': 'DEPARTMENT_HEAD', 'label': '📌 Department Head (auto)', 'category': 'Dynamic'},
            {'id': 'HR_ADMIN', 'label': '🎭 Any HR Admin', 'category': 'By Role'},
            {'id': 'SYSTEM_ADMIN', 'label': '🎭 Any System Admin', 'category': 'By Role'},
        ]
        
        # Specific employees (with their roles for identification)
        employees = Employee.objects.filter(
            is_deleted=False,
            status__in=['ACTIVE', 'PROBATION'],
            user_account__isnull=False,
        ).select_related('user_account').prefetch_related('user_account__roles').order_by('first_name')
        
        for emp in employees:
            role_names = list(emp.user_account.roles.values_list('role_name', flat=True))
            role_str = ', '.join(role_names) if role_names else 'EMPLOYEE'
            options.append({
                'id': f'SPECIFIC_EMPLOYEE:{emp.id}',
                'label': f'👤 {role_str} — {emp.full_name} ({emp.employee_id})',
                'category': 'Specific Employee',
                'employee_id': str(emp.id),
                'roles': role_names,
            })
        
        return Response(options)


# ------------------------------------------------------------------------------
# LETTER TEMPLATES
# ------------------------------------------------------------------------------

class LetterTemplateViewSet(ModelViewSet):
    """CRUD for letter templates + AI generation."""
    queryset = LetterTemplate.objects.all()
    serializer_class = LetterTemplateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['template_type', 'is_active', 'is_default', 'creation_method']
    search_fields = ['name', 'subject']

    def get_permissions(self):
        """
        - LIST/RETRIEVE: any authenticated user (needed by approvers to pick template)
        - CREATE/UPDATE/DELETE: HR Admin only
        - AI generation: HR Admin only
        """
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def perform_create(self, serializer):
        employee = getattr(self.request.user, 'employee', None)
        serializer.save(created_by=employee)

    @action(detail=False, methods=['post'], url_path='generate-ai')
    def generate_ai(self, request):
        # AI generation stays HR-only via explicit check
        user = request.user
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'Only HR Admin can generate templates.'}, status=403)
        
        serializer = AIGenerateTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            html = generate_letter_template(
                user_prompt=serializer.validated_data['prompt'],
                template_type=serializer.validated_data['template_type'],
            )
            return Response({'html': html})
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)
        except Exception as e:
            return Response({'detail': f'AI generation failed: {str(e)}'}, status=500)


# ------------------------------------------------------------------------------
# LIFECYCLE CHANGE REQUESTS
# ------------------------------------------------------------------------------

class LifecycleChangeRequestViewSet(ModelViewSet):
    """
    Create and manage lifecycle change requests.
    Approval flow handled by WorkflowService.
    """
    queryset = LifecycleChangeRequest.objects.all().select_related(
        'employee', 'workflow', 'requested_by',
        'current_position', 'proposed_position',
        'current_manager', 'proposed_manager',
        'current_location', 'proposed_location',
        'letter_template', 'generated_document',
    ).prefetch_related('approval_actions')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'change_type', 'employee']
    ordering_fields = ['created_at', 'effective_date']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'delete']

    def get_serializer_class(self):
        if self.action == 'list':
            return LifecycleChangeRequestListSerializer
        if self.action == 'create':
            return LifecycleChangeRequestCreateSerializer
        return LifecycleChangeRequestDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        if user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN'):
            return qs
        
        # Managers see requests they need to approve or that affect their team
        if user.has_role('MANAGER') and hasattr(user, 'employee'):
            return qs.filter(
                models.Q(employee__reporting_manager_id=user.employee.id) |
                models.Q(approval_actions__assigned_to=user.employee) |
                models.Q(requested_by=user.employee)
            ).distinct()
        
        # Regular employees see only their own requests
        if hasattr(user, 'employee'):
            return qs.filter(
                models.Q(employee=user.employee) |
                models.Q(requested_by=user.employee)
            )
        
        return qs.none()

    def create(self, request, *args, **kwargs):
        # Only HR/System Admin can create
        user = request.user
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response(
                {'detail': 'Only HR Admin can create lifecycle requests.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get active workflow
        workflow = WorkflowService.get_active_workflow('LIFECYCLE')
        if not workflow:
            return Response(
                {'detail': 'No active LIFECYCLE workflow configured. Please set it up in Settings first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        employee = serializer.validated_data['employee']
        
        # Snapshot current values
        instance = serializer.save(
            request_number=generate_request_number(),
            workflow=workflow,
            requested_by=user.employee,
            current_position=employee.position,
            current_manager=employee.reporting_manager,
            current_location=employee.structure_location,
            current_status=employee.status,
        )
        
        # Start the workflow
        try:
            WorkflowService.start_workflow(instance)
        except ValueError as e:
            instance.delete()
            return Response({'detail': str(e)}, status=400)
        
        # Return full detail
        detail_serializer = LifecycleChangeRequestDetailSerializer(
            instance, context={'request': request}
        )
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """
        Approve current pending action for this request.
        Body: { "comments": "...", "letter_template_id": "uuid" (only for final step) }
        """
        req = self.get_object()
        user = request.user
        
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record.'}, status=400)
        
        # Find MY pending action for this request
        my_action = LifecycleApprovalAction.objects.filter(
            request=req,
            assigned_to=user.employee,
            status='PENDING',
        ).first()
        
        if not my_action:
            return Response(
                {'detail': 'You have no pending action on this request.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Check if this is the final step → letter template required
        total_steps = req.workflow.steps.count()
        is_final_step = my_action.step_number == total_steps
        letter_template_id = serializer.validated_data.get('letter_template_id')
        
        if is_final_step:
            if not letter_template_id:
                return Response(
                    {'detail': 'Letter template is required for final approval.'},
                    status=400,
                )
            try:
                template = LetterTemplate.objects.get(id=letter_template_id, is_active=True)
                req.letter_template = template
                req.save(update_fields=['letter_template'])
            except LetterTemplate.DoesNotExist:
                return Response({'detail': 'Invalid letter template.'}, status=400)
        
        try:
            result = WorkflowService.approve_action(
                action_id=my_action.id,
                approver=user.employee,
                comments=serializer.validated_data.get('comments', ''),
            )
            return Response(result)
        except (ValueError, PermissionError) as e:
            return Response({'detail': str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        req = self.get_object()
        user = request.user
        
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record.'}, status=400)
        
        my_action = LifecycleApprovalAction.objects.filter(
            request=req,
            assigned_to=user.employee,
            status='PENDING',
        ).first()
        
        if not my_action:
            return Response({'detail': 'You have no pending action.'}, status=403)
        
        serializer = RejectActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            result = WorkflowService.reject_action(
                action_id=my_action.id,
                approver=user.employee,
                reason=serializer.validated_data['reason'],
            )
            return Response(result)
        except (ValueError, PermissionError) as e:
            return Response({'detail': str(e)}, status=400)

    @action(detail=False, methods=['get'], url_path='my-pending-approvals')
    def my_pending_approvals(self, request):
        """List requests awaiting current user's approval."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])
        
        pending_actions = LifecycleApprovalAction.objects.filter(
            assigned_to=user.employee,
            status='PENDING',
        ).select_related('request', 'request__employee').order_by('-created_at')
        
        request_ids = pending_actions.values_list('request_id', flat=True)
        requests_qs = self.get_queryset().filter(id__in=request_ids)
        
        serializer = LifecycleChangeRequestListSerializer(requests_qs, many=True)
        return Response(serializer.data)


# ------------------------------------------------------------------------------
# NOTIFICATIONS
# ------------------------------------------------------------------------------

class NotificationViewSet(ReadOnlyModelViewSet):
    """List + mark-read notifications for current user."""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_read', 'notification_type']

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'employee'):
            return Notification.objects.none()
        return Notification.objects.filter(recipient=user.employee)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.read_at = timezone.now()
        notif.save(update_fields=['is_read', 'read_at'])
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({'status': 'ok'})



# KRA and KPI module=====================================


# ==============================================================================
# PERFORMANCE MANAGEMENT
# ==============================================================================

from .models import (
    RatingScale, OrganizationalPriority,
    DepartmentalKRA, DepartmentalKPI,
    KRALibrary, KPILibraryItem
)
from .serializers import (
    RatingScaleSerializer,
    OrganizationalPrioritySerializer,
    DepartmentalKRASerializer, DepartmentalKPISerializer,
    KRALibrarySerializer, KPILibraryItemSerializer,
    KRALibraryMiniSerializer,
)


# ------------------------------------------------------------------------------
# RATING SCALE
# ------------------------------------------------------------------------------

class RatingScaleViewSet(ModelViewSet):
    """
    Company-wide rating scale (1-5 bands).
    Only System Admin can manage.
    """
    queryset = RatingScale.objects.all()
    serializer_class = RatingScaleSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_active', 'triggers_pip']
    ordering_fields = ['rating', 'created_at']
    ordering = ['-rating']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsSystemAdmin()]

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        """Create default 5-band rating scale if not exists."""
        user = request.user
        if not user.has_role('SYSTEM_ADMIN'):
            return Response({'detail': 'Permission denied'}, status=403)

        defaults = [
            {
                'rating': 5, 'label': 'Outstanding',
                'description': 'Exceptional performance, far exceeds expectations',
                'min_percent': 120, 'max_percent': 999,
                'color_code': '#16A34A', 'triggers_pip': False,
            },
            {
                'rating': 4, 'label': 'Exceeds Expectations',
                'description': 'Consistently exceeds expectations',
                'min_percent': 105, 'max_percent': 120,
                'color_code': '#22C55E', 'triggers_pip': False,
            },
            {
                'rating': 3, 'label': 'Meets Expectations',
                'description': 'Meets all expectations',
                'min_percent': 90, 'max_percent': 105,
                'color_code': '#3B82F6', 'triggers_pip': False,
            },
            {
                'rating': 2, 'label': 'Needs Improvement',
                'description': 'Below expectations, improvement required',
                'min_percent': 70, 'max_percent': 90,
                'color_code': '#F59E0B', 'triggers_pip': False,
            },
            {
                'rating': 1, 'label': 'Unsatisfactory',
                'description': 'Significantly below expectations, PIP required',
                'min_percent': 0, 'max_percent': 70,
                'color_code': '#EF4444', 'triggers_pip': True,
            },
        ]

        created_count = 0
        for band in defaults:
            _, created = RatingScale.objects.get_or_create(
                rating=band['rating'],
                defaults=band
            )
            if created:
                created_count += 1

        return Response({
            'message': f'Created {created_count} default rating bands',
            'total': RatingScale.objects.count()
        })


# ------------------------------------------------------------------------------
# ORGANIZATIONAL PRIORITY
# ------------------------------------------------------------------------------

class OrganizationalPriorityViewSet(ModelViewSet):
    """
    Company-wide strategic priorities.
    Only System Admin / HR Admin can manage.
    """
    queryset = OrganizationalPriority.objects.all().select_related('owner', 'created_by')
    serializer_class = OrganizationalPrioritySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['financial_year', 'is_active', 'review_frequency']
    search_fields = ['title', 'description', 'target']
    ordering_fields = ['financial_year', 'priority_number', 'created_at']
    ordering = ['-financial_year', 'priority_number']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def perform_create(self, serializer):
        employee = getattr(self.request.user, 'employee', None)
        serializer.save(created_by=employee)

    @action(detail=False, methods=['get'], url_path='by-year')
    def by_year(self, request):
        """Get priorities for a specific FY."""
        fy = request.query_params.get('fy')
        if not fy:
            return Response({'detail': 'Query param "fy" required'}, status=400)

        priorities = self.get_queryset().filter(financial_year=fy, is_active=True)
        serializer = self.get_serializer(priorities, many=True)
        return Response(serializer.data)


# ------------------------------------------------------------------------------
# DEPARTMENTAL KRA
# ------------------------------------------------------------------------------

class DepartmentalKRAViewSet(ModelViewSet):
    """
    Department-level KRAs cascaded from organizational priorities.
    HR Admin / System Admin can manage.
    """
    queryset = DepartmentalKRA.objects.all().select_related(
        'department', 'linked_priority', 'owner'
    ).prefetch_related('kpis')
    serializer_class = DepartmentalKRASerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['department', 'financial_year', 'is_active', 'linked_priority']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'financial_year', 'weight_in_dept']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]


class DepartmentalKPIViewSet(ModelViewSet):
    """KPIs under departmental KRAs."""
    queryset = DepartmentalKPI.objects.all().select_related('dept_kra')
    serializer_class = DepartmentalKPISerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['dept_kra', 'kpi_type']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]


# ------------------------------------------------------------------------------
# KRA LIBRARY
# ------------------------------------------------------------------------------

class KRALibraryViewSet(ModelViewSet):
    """
    Master KRA library — pool of KRAs employees can pick from.
    Only HR / System Admin can manage.
    """
    queryset = KRALibrary.objects.all().prefetch_related(
        'applicable_positions', 'applicable_departments', 'kpi_options'
    ).select_related('created_by')
    serializer_class = KRALibrarySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'kra_source', 'is_active', 'is_mandatory',
        'peer_rating_required', 'applicable_positions', 'applicable_departments'
    ]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['kra_source', 'name']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'for_employee']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def perform_create(self, serializer):
        employee = getattr(self.request.user, 'employee', None)
        serializer.save(created_by=employee)

    @action(detail=False, methods=['get'], url_path='for-employee/(?P<employee_id>[^/.]+)')
    def for_employee(self, request, employee_id=None):
        """
        Get all KRAs applicable to a specific employee.
        Considers their job position, department, and mandatory KRAs.
        """
        try:
            emp = Employee.objects.select_related('position', 'structure_location').get(id=employee_id)
        except Employee.DoesNotExist:
            return Response({'detail': 'Employee not found'}, status=404)

        qs = self.get_queryset().filter(is_active=True)

        # Filter by applicability
        applicable_qs = qs.filter(
            models.Q(kra_source='COMMON')  # Common KRAs for everyone
            | models.Q(kra_source='ROLE', applicable_positions=emp.position)  # Role-based
            | models.Q(kra_source='DEPARTMENTAL', applicable_departments=emp.structure_location)  # Dept
            | models.Q(is_mandatory=True)  # Mandatory KRAs
        ).distinct()

        serializer = self.get_serializer(applicable_qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='mini')
    def mini(self, request):
        """Lightweight list for dropdowns."""
        qs = self.get_queryset().filter(is_active=True)
        serializer = KRALibraryMiniSerializer(qs, many=True)
        return Response(serializer.data)


class KPILibraryItemViewSet(ModelViewSet):
    """KPI options within library KRAs."""
    queryset = KPILibraryItem.objects.all().select_related('kra')
    serializer_class = KPILibraryItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['kra', 'indicator_type', 'kpi_type', 'is_active']
    search_fields = ['name', 'description']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

from .models import (
    PerformanceCycle, EmployeeScorecard,
    EmployeeKRA, EmployeeKPI, EmployeeKPIEvidence,
    KRALibrary,
)
from .serializers import (
    PerformanceCycleSerializer,
    EmployeeScorecardListSerializer,
    EmployeeScorecardDetailSerializer,
    EmployeeKRASerializer,
    EmployeeKPISerializer,
    EmployeeKPIEvidenceSerializer,
    AddLibraryKRASerializer,
    SendBackSerializer,KRAPeerNominationSerializer,
    PeerRatingSerializer,
    PeerRatingSubmitSerializer,
    PeerRatingDeclineSerializer,
    NominatePeersSerializer,
    PendingPeerReviewSerializer,
    EmployeeForPeerSerializer,
)
from .services.scorecard_service import ScorecardService


# ------------------------------------------------------------------------------
# PERFORMANCE CYCLE
# ------------------------------------------------------------------------------

class PerformanceCycleViewSet(ModelViewSet):
    """
    Manage performance review cycles.
    HR Admin can create/edit; anyone can view.
    """
    queryset = PerformanceCycle.objects.all().prefetch_related(
        'applicable_departments', 'scorecards'
    )
    serializer_class = PerformanceCycleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['cycle_type', 'status', 'financial_year']
    search_fields = ['name']
    ordering_fields = ['period_start', 'created_at']
    ordering = ['-period_start']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'my_active', 'current_phase_info']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def perform_create(self, serializer):
        employee = getattr(self.request.user, 'employee', None)
        serializer.save(created_by=employee)

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        """
        Activate a cycle: change status to ACTIVE and auto-create scorecards
        for all applicable employees.
        """
        cycle = self.get_object()
        
        if cycle.status == 'ACTIVE':
            return Response({'detail': 'Cycle is already active'}, status=400)
        
        cycle.status = 'ACTIVE'
        cycle.save()
        
        count = ScorecardService.auto_create_scorecards_for_cycle(cycle)
        
        return Response({
            'status': 'success',
            'message': f'Cycle activated. {count} scorecards created.',
            'scorecards_created': count,
        })

    @action(detail=True, methods=['post'], url_path='close')
    def close(self, request, pk=None):
        """Close a cycle - locks all scorecards."""
        cycle = self.get_object()
        cycle.status = 'CLOSED'
        cycle.save()
        return Response({'status': 'success', 'message': 'Cycle closed'})

    @action(detail=False, methods=['get'], url_path='my-active')
    def my_active(self, request):
        """Get active cycles applicable to current user."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])
        
        employee = user.employee
        active_cycles = self.get_queryset().filter(status='ACTIVE')
        
        # Filter to cycles applicable to employee's department
        if employee.structure_location:
            active_cycles = active_cycles.filter(
                models.Q(applicable_departments__isnull=True) |
                models.Q(applicable_departments=employee.structure_location)
            ).distinct()
        
        serializer = self.get_serializer(active_cycles, many=True)
        return Response(serializer.data)


# ------------------------------------------------------------------------------
# EMPLOYEE SCORECARD
# ------------------------------------------------------------------------------

class EmployeeScorecardViewSet(ModelViewSet):
    """
    Employee scorecards for performance cycles.
    - Employees see their own
    - Managers see their team's
    - HR sees all
    """
    queryset = EmployeeScorecard.objects.all().select_related(
        'employee', 'employee__position', 'employee__structure_location',
        'employee__reporting_manager', 'cycle', 'manager_signed_off_by'
    ).prefetch_related('kras__kpis__evidences')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'cycle', 'status']
    ordering_fields = ['created_at', 'employee__first_name']
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_serializer_class(self):
        if self.action == 'list':
            return EmployeeScorecardListSerializer
        return EmployeeScorecardDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        if user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN'):
            return qs
        
        if user.has_role('MANAGER') and hasattr(user, 'employee'):
            return qs.filter(
                models.Q(employee__reporting_manager=user.employee) |
                models.Q(employee=user.employee)
            )
        
        if hasattr(user, 'employee'):
            return qs.filter(employee=user.employee)
        
        return qs.none()

    @action(detail=False, methods=['get'], url_path='my-scorecards')
    def my_scorecards(self, request):
        """Get current user's own scorecards."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])
        
        qs = self.queryset.filter(employee=user.employee)
        serializer = EmployeeScorecardListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='team-scorecards')
    def team_scorecards(self, request):
        """Get scorecards of team members (for managers)."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])
        
        qs = self.queryset.filter(employee__reporting_manager=user.employee)
        
        cycle_id = request.query_params.get('cycle')
        if cycle_id:
            qs = qs.filter(cycle_id=cycle_id)
        
        serializer = EmployeeScorecardListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='add-library-kra')
    def add_library_kra(self, request, pk=None):
        """Add a KRA from library to this scorecard."""
        scorecard = self.get_object()
        serializer = AddLibraryKRASerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            lib_kra = KRALibrary.objects.get(
                id=serializer.validated_data['library_kra_id'],
                is_active=True,
            )
        except KRALibrary.DoesNotExist:
            return Response({'detail': 'Library KRA not found'}, status=404)
        
        emp_kra = ScorecardService.add_library_kra_to_scorecard(
            scorecard,
            lib_kra,
            weight=serializer.validated_data.get('weight'),
            include_all_kpis=serializer.validated_data.get('include_all_kpis', True),
        )
        
        return Response(EmployeeKRASerializer(emp_kra).data, status=201)

    @action(detail=True, methods=['post'], url_path='submit')
    def submit(self, request, pk=None):
        """Employee submits scorecard for manager review."""
        scorecard = self.get_object()
        user = request.user
        
        # Only employee themselves can submit
        if not hasattr(user, 'employee') or user.employee.id != scorecard.employee.id:
            return Response({'detail': 'Only the employee can submit'}, status=403)
        
        if scorecard.status not in ['DRAFT', 'SENT_BACK']:
            return Response(
                {'detail': f'Cannot submit from status {scorecard.status}'},
                status=400
            )
        
        # Validate
        is_valid, errors = ScorecardService.validate_scorecard(scorecard)
        if not is_valid:
            return Response({'detail': 'Validation failed', 'errors': errors}, status=400)
        
        scorecard.status = 'SUBMITTED'
        scorecard.save()
        
        return Response({'status': 'success', 'message': 'Scorecard submitted for review'})

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Manager approves the scorecard."""
        from django.utils import timezone as dj_timezone  # ← Local import — guaranteed correct
        
        scorecard = self.get_object()
        user = request.user
        
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)
        
        # Only reporting manager or HR can approve
        is_manager = scorecard.employee.reporting_manager_id == user.employee.id
        is_hr = user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')
        
        if not (is_manager or is_hr):
            return Response({'detail': 'Only reporting manager or HR can approve'}, status=403)
        
        if scorecard.status not in ['SUBMITTED', 'MANAGER_REVIEWING']:
            return Response(
                {'detail': f'Cannot approve from status {scorecard.status}'},
                status=400
            )
        
        scorecard.status = 'APPROVED'
        scorecard.manager_signed_off_at = dj_timezone.now()   # ← Use dj_timezone
        scorecard.manager_signed_off_by = user.employee
        scorecard.save()
        
        return Response({'status': 'success', 'message': 'Scorecard approved'})

    @action(detail=True, methods=['post'], url_path='send-back')
    def send_back(self, request, pk=None):
        """Manager sends scorecard back for revision."""
        from django.utils import timezone as dj_timezone
        scorecard = self.get_object()
        user = request.user
        
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)
        
        is_manager = scorecard.employee.reporting_manager_id == user.employee.id
        is_hr = user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')
        
        if not (is_manager or is_hr):
            return Response({'detail': 'Only manager can send back'}, status=403)
        
        serializer = SendBackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        scorecard.status = 'SENT_BACK'
        scorecard.sent_back_reason = serializer.validated_data['reason']
        scorecard.sent_back_at = dj_timezone.now()
        scorecard.save()
        
        return Response({'status': 'success', 'message': 'Scorecard sent back for revision'})

    @action(detail=True, methods=['post'], url_path='sign-off')
    def sign_off(self, request, pk=None):
        """Employee signs off on approved scorecard."""
        from django.utils import timezone as dj_timezone
        scorecard = self.get_object()
        user = request.user
        
        if not hasattr(user, 'employee') or user.employee.id != scorecard.employee.id:
            return Response({'detail': 'Only the employee can sign off'}, status=403)
        
        if scorecard.status != 'APPROVED':
            return Response(
                {'detail': 'Scorecard must be approved before sign-off'},
                status=400
            )
        
        scorecard.status = 'SIGNED_OFF'
        scorecard.employee_signed_off_at = dj_timezone.now()
        scorecard.save()
        
        return Response({'status': 'success', 'message': 'Scorecard signed off'})

    @action(detail=True, methods=['post'], url_path='submit-self-review')
    def submit_self_review(self, request, pk=None):
        """Employee submits self-review (after entering actuals + evidence)."""
        from django.utils import timezone as dj_timezone
        scorecard = self.get_object()
        user = request.user
        
        if not hasattr(user, 'employee') or user.employee.id != scorecard.employee_id:
            return Response({'detail': 'Only the employee can submit self-review'}, status=403)
        
        if scorecard.status not in ['SIGNED_OFF', 'SELF_REVIEW_PENDING']:
            return Response(
                {'detail': f'Cannot submit self-review from status {scorecard.status}'},
                status=400
            )
        
        # Validate: at least one KPI has self_actual filled
        has_data = any(
            kpi.self_actual.strip() 
            for kra in scorecard.kras.all() 
            for kpi in kra.kpis.all()
        )
        if not has_data:
            return Response(
                {'detail': 'Please fill in actuals for at least one KPI'},
                status=400
            )
        
        # Mark all KPIs as self-reviewed
        for kra in scorecard.kras.all():
            for kpi in kra.kpis.all():
                if kpi.self_actual.strip() and not kpi.self_reviewed_at:
                    kpi.self_reviewed_at = dj_timezone.now()
                    kpi.save(update_fields=['self_reviewed_at'])
        
        scorecard.status = 'SELF_REVIEWED'
        scorecard.save(update_fields=['status'])
        
        return Response({'status': 'success', 'message': 'Self-review submitted'})

    @action(detail=True, methods=['post'], url_path='submit-final-review')
    def submit_final_review(self, request, pk=None):
        """Manager submits final review with scoring."""
        from django.utils import timezone as dj_timezone
        scorecard = self.get_object()
        user = request.user
        
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)
        
        is_manager = scorecard.employee.reporting_manager_id == user.employee.id
        is_hr = user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')
        
        if not (is_manager or is_hr):
            return Response({'detail': 'Only manager or HR can submit final review'}, status=403)
        
        if scorecard.status not in ['SELF_REVIEWED', 'MANAGER_REVIEW_PENDING']:
            return Response(
                {'detail': f'Cannot submit from status {scorecard.status}'},
                status=400
            )
        
        # Validate: at least one KPI has manager_actual filled
        has_data = any(
            kpi.manager_actual.strip() 
            for kra in scorecard.kras.all() 
            for kpi in kra.kpis.all()
        )
        if not has_data:
            return Response(
                {'detail': 'Please fill in manager actuals for at least one KPI'},
                status=400
            )
        
        # Mark KPIs as manager-reviewed
        for kra in scorecard.kras.all():
            for kpi in kra.kpis.all():
                if kpi.manager_actual.strip() and not kpi.manager_reviewed_at:
                    kpi.manager_reviewed_at = dj_timezone.now()
                    kpi.save(update_fields=['manager_reviewed_at'])
        
        # Calculate final scores
        scores = ScorecardService.calculate_final_score(scorecard)
        
        scorecard.status = 'MANAGER_REVIEWED'
        scorecard.save(update_fields=['status'])
        
        return Response({
            'status': 'success',
            'message': 'Final review submitted and scored',
            **scores,
        })

    @action(detail=True, methods=['post'], url_path='finalize')
    def finalize(self, request, pk=None):
        """HR finalizes the scorecard, generates rating letter."""
        from .tasks import finalize_scorecard_and_send_letter
        
        scorecard = self.get_object()
        user = request.user

        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'Only HR can finalize'}, status=403)

        if scorecard.status != 'MANAGER_REVIEWED':
            return Response(
                {'detail': 'Manager review must be complete before finalization'},
                status=400
            )

        scorecard.status = 'FINALIZED'
        scorecard.save(update_fields=['status'])

        # Trigger async letter generation
        finalize_scorecard_and_send_letter.delay(str(scorecard.id))

        return Response({
            'status': 'success',
            'message': 'Scorecard finalized. Rating letter is being generated and will be emailed shortly.',
        })


    @action(detail=False, methods=['post'], url_path='bulk-finalize')
    def bulk_finalize(self, request):
        """HR finalizes ALL MANAGER_REVIEWED scorecards for a cycle."""
        from .tasks import finalize_scorecard_and_send_letter
        
        user = request.user
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'Only HR can bulk finalize'}, status=403)

        cycle_id = request.data.get('cycle_id')
        if not cycle_id:
            return Response({'detail': 'cycle_id required'}, status=400)

        scorecards = EmployeeScorecard.objects.filter(
            cycle_id=cycle_id,
            status='MANAGER_REVIEWED',
        )
        
        count = 0
        for sc in scorecards:
            sc.status = 'FINALIZED'
            sc.save(update_fields=['status'])
            finalize_scorecard_and_send_letter.delay(str(sc.id))
            count += 1

        return Response({
            'status': 'success',
            'message': f'Finalized {count} scorecards. Letters being generated.',
            'count': count,
        })
    
    @action(detail=False, methods=['get'], url_path='all-scorecards')
    def all_scorecards(self, request):
        """
        HR-only endpoint: Returns ALL scorecards across the organization.
        Supports filtering by cycle, status, department, rating band.
        Used by the HR Calibration page.
        """
        user = request.user
        
        # Only HR and System Admin
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response(
                {'detail': 'Only HR can access all scorecards.'},
                status=403
            )
        
        qs = self.queryset
        
        # Optional filters
        cycle_id = request.query_params.get('cycle')
        if cycle_id:
            qs = qs.filter(cycle_id=cycle_id)
        
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        dept_id = request.query_params.get('department')
        if dept_id:
            qs = qs.filter(employee__structure_location_id=dept_id)
        
        rating = request.query_params.get('rating')
        if rating:
            qs = qs.filter(final_rating=int(rating))
        
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                models.Q(employee__first_name__icontains=search) |
                models.Q(employee__last_name__icontains=search) |
                models.Q(employee__employee_id__icontains=search)
            )
        
        serializer = EmployeeScorecardListSerializer(qs, many=True)
        return Response(serializer.data)


    @action(detail=False, methods=['get'], url_path='calibration-stats')
    def calibration_stats(self, request):
        """
        HR-only: Returns aggregate statistics for a cycle.
        Used to display the calibration dashboard header cards + bell curve.
        """
        user = request.user
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'HR only'}, status=403)
        
        cycle_id = request.query_params.get('cycle')
        if not cycle_id:
            return Response({'detail': 'cycle query param required'}, status=400)
        
        qs = self.queryset.filter(cycle_id=cycle_id)
        
        total = qs.count()
        if total == 0:
            return Response({
                'total': 0,
                'by_status': {},
                'by_rating': {},
                'avg_final_score': 0,
            })
        
        # Group by status
        from django.db.models import Count, Avg
        status_counts = dict(
            qs.values('status').annotate(cnt=Count('id')).values_list('status', 'cnt')
        )
        
        # Group by rating band (1-5)
        rating_counts = dict(
            qs.filter(final_rating__isnull=False)
            .values('final_rating')
            .annotate(cnt=Count('id'))
            .values_list('final_rating', 'cnt')
        )
        
        # Average final score
        avg_score = qs.filter(final_score__isnull=False).aggregate(
            avg=Avg('final_score')
        )['avg']
        
        # Department breakdown
        dept_breakdown = list(
            qs.values(
                'employee__structure_location__id',
                'employee__structure_location__name',
            )
            .annotate(cnt=Count('id'), avg_score=Avg('final_score'))
            .order_by('-cnt')
        )
        
        return Response({
            'total': total,
            'by_status': status_counts,
            'by_rating': rating_counts,
            'avg_final_score': round(avg_score, 2) if avg_score else 0,
            'department_breakdown': [
                {
                    'id': d['employee__structure_location__id'],
                    'name': d['employee__structure_location__name'] or 'No Dept',
                    'count': d['cnt'],
                    'avg_score': round(d['avg_score'], 2) if d['avg_score'] else 0,
                }
                for d in dept_breakdown
            ],
        })
# ------------------------------------------------------------------------------
# EMPLOYEE KRA (Nested under scorecard)
# ------------------------------------------------------------------------------

class EmployeeKRAViewSet(ModelViewSet):
    """CRUD for KRAs within a scorecard."""
    queryset = EmployeeKRA.objects.all().select_related('scorecard').prefetch_related('kpis')
    serializer_class = EmployeeKRASerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['scorecard']

    def perform_create(self, serializer):
        instance = serializer.save()
        ScorecardService.recalculate_total_weight(instance.scorecard)

    def perform_update(self, serializer):
        instance = serializer.save()
        ScorecardService.recalculate_total_weight(instance.scorecard)

    def perform_destroy(self, instance):
        scorecard = instance.scorecard
        instance.delete()
        ScorecardService.recalculate_total_weight(scorecard)


# ------------------------------------------------------------------------------
# EMPLOYEE KPI
# ------------------------------------------------------------------------------

class EmployeeKPIViewSet(ModelViewSet):
    """CRUD for KPIs within a KRA."""
    queryset = EmployeeKPI.objects.all().select_related('employee_kra').prefetch_related('evidences')
    serializer_class = EmployeeKPISerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee_kra']


# ------------------------------------------------------------------------------
# KPI EVIDENCE UPLOADS
# ------------------------------------------------------------------------------

class EmployeeKPIEvidenceViewSet(ModelViewSet):
    """Upload/manage evidence files for KPIs."""
    queryset = EmployeeKPIEvidence.objects.all().select_related('kpi', 'uploaded_by')
    serializer_class = EmployeeKPIEvidenceSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['kpi']

    def perform_create(self, serializer):
        employee = getattr(self.request.user, 'employee', None)
        serializer.save(uploaded_by=employee)



class KRAPeerNominationViewSet(ModelViewSet):
    """Manager nominates peers for peer-rated KRAs."""
    queryset = KRAPeerNomination.objects.all().select_related(
        'employee_kra', 'nominated_peer', 'nominated_by', 'rating'
    )
    serializer_class = KRAPeerNominationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee_kra', 'nominated_peer']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        if user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN'):
            return qs
        
        # Manager sees nominations for their team's KRAs
        if user.has_role('MANAGER') and hasattr(user, 'employee'):
            return qs.filter(
                models.Q(employee_kra__scorecard__employee__reporting_manager=user.employee) |
                models.Q(nominated_peer=user.employee)
            )
        
        # Employee sees their own nominations (as a peer, not as rated employee)
        if hasattr(user, 'employee'):
            return qs.filter(nominated_peer=user.employee)
        
        return qs.none()

    @action(detail=False, methods=['post'], url_path='nominate-peers')
    def nominate_peers(self, request):
        """
        Manager nominates peers for a KRA.
        POST body: { "employee_kra_id": "...", "peer_ids": ["uuid1", "uuid2"] }
        """
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)
        
        serializer = NominatePeersSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            employee_kra = EmployeeKRA.objects.select_related(
                'scorecard__employee'
            ).get(id=serializer.validated_data['employee_kra_id'])
        except EmployeeKRA.DoesNotExist:
            return Response({'detail': 'KRA not found'}, status=404)
        
        # Permission check: only reporting manager or HR
        is_manager = employee_kra.scorecard.employee.reporting_manager_id == user.employee.id
        is_hr = user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')
        
        if not (is_manager or is_hr):
            return Response({'detail': 'Only reporting manager or HR can nominate peers'}, status=403)
        
        if not employee_kra.peer_rating_required:
            return Response({'detail': 'This KRA does not require peer rating'}, status=400)
        
        # Prevent nominating the employee themselves
        peer_ids = serializer.validated_data['peer_ids']
        if str(employee_kra.scorecard.employee.id) in [str(p) for p in peer_ids]:
            return Response({'detail': 'Cannot nominate the employee as their own peer'}, status=400)
        
        try:
            count = ScorecardService.nominate_peers(
                employee_kra=employee_kra,
                peer_ids=peer_ids,
                nominated_by=user.employee,
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)
        
        return Response({
            'status': 'success',
            'message': f'Nominated {count} new peer(s)',
        })


# ------------------------------------------------------------------------------
# PEER RATING (Peer submits rating)
# ------------------------------------------------------------------------------

class PeerRatingViewSet(ModelViewSet):
    """Peer submits their rating."""
    queryset = PeerRating.objects.all().select_related(
        'nomination', 'nomination__nominated_peer',
        'nomination__employee_kra__scorecard__employee',
        'nomination__employee_kra__scorecard__cycle',
    )
    serializer_class = PeerRatingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'nomination']
    http_method_names = ['get', 'post', 'patch']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        if user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN'):
            return qs
        
        # Manager sees ratings for their team + their own submissions
        if user.has_role('MANAGER') and hasattr(user, 'employee'):
            return qs.filter(
                models.Q(nomination__employee_kra__scorecard__employee__reporting_manager=user.employee) |
                models.Q(nomination__nominated_peer=user.employee)
            )
        
        # Employee: only their own peer submissions
        if hasattr(user, 'employee'):
            return qs.filter(nomination__nominated_peer=user.employee)
        
        return qs.none()

    @action(detail=False, methods=['get'], url_path='my-pending-reviews')
    def my_pending_reviews(self, request):
        """
        Get peer reviews assigned to me that are still pending.
        Shows on /my-peer-reviews page.
        """
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])
        
        qs = PeerRating.objects.filter(
            nomination__nominated_peer=user.employee,
        ).select_related(
            'nomination__employee_kra__scorecard__employee',
            'nomination__employee_kra__scorecard__cycle',
        ).order_by('status', 'due_at')
        
        serializer = PendingPeerReviewSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_rating(self, request, pk=None):
        """Peer submits their rating."""
        peer_rating = self.get_object()
        user = request.user
        
        # Only nominated peer can submit
        if not hasattr(user, 'employee') or user.employee.id != peer_rating.nomination.nominated_peer_id:
            return Response({'detail': 'You are not the nominated peer'}, status=403)
        
        if peer_rating.status == 'SUBMITTED':
            return Response({'detail': 'Already submitted'}, status=400)
        
        serializer = PeerRatingSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        peer_rating.rating = serializer.validated_data['rating']
        peer_rating.strengths_comment = serializer.validated_data.get('strengths_comment', '')
        peer_rating.improvements_comment = serializer.validated_data.get('improvements_comment', '')
        peer_rating.additional_comments = serializer.validated_data.get('additional_comments', '')
        peer_rating.status = 'SUBMITTED'
        peer_rating.submitted_at = dj_timezone.now()
        peer_rating.save()
        
        return Response({'status': 'success', 'message': 'Peer rating submitted. Thank you!'})

    @action(detail=True, methods=['post'], url_path='decline')
    def decline_rating(self, request, pk=None):
        """Peer declines to rate (with reason)."""
        peer_rating = self.get_object()
        user = request.user
        
        if not hasattr(user, 'employee') or user.employee.id != peer_rating.nomination.nominated_peer_id:
            return Response({'detail': 'You are not the nominated peer'}, status=403)
        
        if peer_rating.status != 'PENDING':
            return Response({'detail': 'Cannot decline — status is not pending'}, status=400)
        
        serializer = PeerRatingDeclineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        peer_rating.status = 'DECLINED'
        peer_rating.decline_reason = serializer.validated_data['decline_reason']
        peer_rating.save()
        
        return Response({'status': 'success', 'message': 'Declined'})


# ------------------------------------------------------------------------------
# PEER SEARCH (for nomination dropdown)
# ------------------------------------------------------------------------------

class PeerSearchView(APIView):
    """
    Search for employees who can be peers.
    GET /api/v1/peer-search/?exclude_employee=<uuid>&search=<query>
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        exclude_employee_id = request.query_params.get('exclude_employee')
        search = request.query_params.get('search', '').strip()
        
        qs = Employee.objects.filter(
            is_deleted=False,
            status__in=['ACTIVE', 'PROBATION'],
        ).select_related('position', 'structure_location')
        
        if exclude_employee_id:
            qs = qs.exclude(id=exclude_employee_id)
        
        if search:
            qs = qs.filter(
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(employee_id__icontains=search)
            )
        
        qs = qs[:50]
        serializer = EmployeeForPeerSerializer(qs, many=True)
        return Response(serializer.data)


# ==============================================================================
# DASHBOARD STATS
# ==============================================================================

class DashboardStatsView(APIView):
    """
    Real-time dashboard statistics.
    Returns different data based on user role.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone as dj_tz
        from django.db.models import Count, Avg, Q
        from datetime import timedelta
        from .models import (
            Employee, EmployeeScorecard, PerformanceCycle,
            LifecycleChangeRequest, Notification,
            EmployeeDocument, KRALibrary,
        )
        
        user = request.user
        today = dj_tz.now().date()
        month_start = today.replace(day=1)
        
        is_hr = user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')
        is_manager = user.has_role('MANAGER')
        
        stats = {
            'user_role': 'HR' if is_hr else ('MANAGER' if is_manager else 'EMPLOYEE'),
        }
        
        # ==========================================================================
        # HR / SYSTEM ADMIN DASHBOARD
        # ==========================================================================
        if is_hr:
            # Employee stats
            employees = Employee.objects.filter(is_deleted=False)
            total_emp = employees.count()
            active_emp = employees.filter(status='ACTIVE').count()
            probation_emp = employees.filter(status='PROBATION').count()
            
            new_hires_this_month = employees.filter(
                date_of_joining__gte=month_start,
                date_of_joining__lte=today,
            ).count()
            
            # Compare with last month
            last_month_start = (month_start - timedelta(days=1)).replace(day=1)
            new_hires_last_month = employees.filter(
                date_of_joining__gte=last_month_start,
                date_of_joining__lt=month_start,
            ).count()
            
            hire_change = new_hires_this_month - new_hires_last_month
            
            # Attrition — separations this month
            attrition = employees.filter(
                date_of_exit__gte=month_start,
                date_of_exit__lte=today,
            ).count()
            
            attrition_rate = round((attrition / total_emp * 100), 2) if total_emp else 0
            
            # Performance stats (active cycle)
            active_cycle = PerformanceCycle.objects.filter(status='ACTIVE').first()
            perf_stats = {}
            if active_cycle:
                scorecards = active_cycle.scorecards.all()
                finalized = scorecards.filter(final_score__isnull=False)
                perf_stats = {
                    'cycle_name': active_cycle.name,
                    'total_scorecards': scorecards.count(),
                    'in_progress': scorecards.filter(
                        status__in=['DRAFT', 'SUBMITTED', 'APPROVED', 'SIGNED_OFF']
                    ).count(),
                    'awaiting_finalization': scorecards.filter(status='MANAGER_REVIEWED').count(),
                    'finalized': scorecards.filter(status='FINALIZED').count(),
                    'avg_score': round(
                        finalized.aggregate(avg=Avg('final_score'))['avg'] or 0, 2
                    ),
                }
            
            # Lifecycle requests
            pending_lifecycle = LifecycleChangeRequest.objects.filter(
                status='IN_PROGRESS'
            ).count()
            
            # Document expiries (next 90 days)
            expiry_alerts = EmployeeDocument.objects.filter(
                expiry_date__isnull=False,
                expiry_date__gte=today,
                expiry_date__lte=today + timedelta(days=90),
            ).count()
            
            # KRA library size
            active_kras = KRALibrary.objects.filter(is_active=True).count()
            
            stats.update({
                'total_employees': total_emp,
                'active_employees': active_emp,
                'probation_employees': probation_emp,
                'new_hires_month': new_hires_this_month,
                'new_hires_change': hire_change,
                'attrition_count': attrition,
                'attrition_rate': attrition_rate,
                'performance': perf_stats,
                'pending_lifecycle_requests': pending_lifecycle,
                'document_expiry_alerts': expiry_alerts,
                'active_kra_count': active_kras,
                
                # Recent activity data
                'recent_hires': list(
                    employees.filter(
                        date_of_joining__gte=today - timedelta(days=30)
                    ).order_by('-date_of_joining').values(
                        'id', 'employee_id', 'first_name', 'last_name',
                        'date_of_joining'
                    )[:5]
                ),
                
                # Department distribution
                'department_distribution': list(
                    employees.values('structure_location__name')
                    .annotate(count=Count('id'))
                    .order_by('-count')[:6]
                ),
            })
        
        # ==========================================================================
        # MANAGER DASHBOARD
        # ==========================================================================
        elif is_manager and hasattr(user, 'employee'):
            manager_emp = user.employee
            team = Employee.objects.filter(
                reporting_manager=manager_emp,
                is_deleted=False,
            )
            
            team_size = team.count()
            
            # Team scorecards
            active_cycle = PerformanceCycle.objects.filter(status='ACTIVE').first()
            team_perf = {}
            if active_cycle:
                team_scorecards = EmployeeScorecard.objects.filter(
                    employee__reporting_manager=manager_emp,
                    cycle=active_cycle,
                )
                team_perf = {
                    'cycle_name': active_cycle.name,
                    'total': team_scorecards.count(),
                    'pending_review': team_scorecards.filter(
                        status__in=['SUBMITTED', 'SELF_REVIEWED']
                    ).count(),
                    'approved': team_scorecards.filter(
                        status__in=['APPROVED', 'SIGNED_OFF', 'FINALIZED']
                    ).count(),
                    'avg_score': round(
                        team_scorecards.filter(final_score__isnull=False)
                        .aggregate(avg=Avg('final_score'))['avg'] or 0, 2
                    ),
                }
            
            # Pending approvals (lifecycle)
            pending_approvals = LifecycleChangeRequest.objects.filter(
                status='IN_PROGRESS',
                approval_actions__assigned_to=manager_emp,
                approval_actions__status='PENDING',
            ).distinct().count()
            
            stats.update({
                'team_size': team_size,
                'team_active': team.filter(status='ACTIVE').count(),
                'team_probation': team.filter(status='PROBATION').count(),
                'team_performance': team_perf,
                'pending_approvals': pending_approvals,
                
                # Team roster
                'team_roster': list(
                    team.values(
                        'id', 'employee_id', 'first_name', 'last_name',
                        'position__title', 'status'
                    )[:10]
                ),
            })
        
        # ==========================================================================
        # EMPLOYEE DASHBOARD
        # ==========================================================================
        if hasattr(user, 'employee'):
            emp = user.employee
            
            # My current scorecard
            active_cycle = PerformanceCycle.objects.filter(status='ACTIVE').first()
            my_scorecard = None
            if active_cycle:
                sc = EmployeeScorecard.objects.filter(
                    employee=emp, cycle=active_cycle
                ).first()
                if sc:
                    my_scorecard = {
                        'id': str(sc.id),
                        'cycle_name': sc.cycle.name,
                        'status': sc.status,
                        'status_display': sc.get_status_display(),
                        'total_weight': float(sc.total_weight),
                        'kra_count': sc.kras.count(),
                        'final_score': float(sc.final_score) if sc.final_score else None,
                        'final_rating': sc.final_rating,
                    }
            
            # My unread notifications
            unread_notifs = Notification.objects.filter(
                recipient=emp, is_read=False
            ).count()
            
            # Past scorecards count
            past_scorecards = EmployeeScorecard.objects.filter(
                employee=emp, status='FINALIZED'
            ).count()
            
            # Documents I own
            my_documents = EmployeeDocument.objects.filter(employee=emp).count()
            
            stats.update({
                'my_scorecard': my_scorecard,
                'my_unread_notifications': unread_notifs,
                'my_past_scorecards': past_scorecards,
                'my_documents': my_documents,
                'my_employee_id': emp.employee_id,
                'my_position': emp.position.title if emp.position else None,
                'my_department': emp.structure_location.name if emp.structure_location else None,
                'my_manager': emp.reporting_manager.full_name if emp.reporting_manager else None,
            })
        
        # ==========================================================================
        # RECENT NOTIFICATIONS (for everyone)
        # ==========================================================================
        if hasattr(user, 'employee'):
            recent_notifs = Notification.objects.filter(
                recipient=user.employee
            ).order_by('-created_at')[:5]
            
            stats['recent_notifications'] = [
                {
                    'id': str(n.id),
                    'title': n.title,
                    'message': n.message[:100],
                    'type': n.notification_type,
                    'is_read': n.is_read,
                    'link': n.link,
                    'created_at': n.created_at.isoformat(),
                }
                for n in recent_notifs
            ]
        
        return Response(stats)


from .services.reports_service import PerformanceReportsService

class PerformanceReportsView(APIView):
    """
    Aggregated performance reports.
    Different report types via query param: ?type=individual|team|department|cycle|kra|company
    """
    permission_classes = [IsAuthenticated]



    def get(self, request):
        report_type = request.query_params.get('type', 'company')
        user = request.user
        
        if report_type == 'individual':
            emp_id = request.query_params.get('employee_id')
            if not emp_id:
                emp_id = str(user.employee.id) if hasattr(user, 'employee') else None
            if not emp_id:
                return Response({'detail': 'employee_id required'}, status=400)
            
            # Permission: only self, manager of self, or HR
            can_view = (
                (hasattr(user, 'employee') and str(user.employee.id) == emp_id)
                or user.has_role('HR_ADMIN')
                or user.has_role('SYSTEM_ADMIN')
                or user.has_role('MANAGER')
            )
            if not can_view:
                return Response({'detail': 'Permission denied'}, status=403)
            
            return Response(PerformanceReportsService.individual_history(emp_id))
        
        elif report_type == 'team':
            if not hasattr(user, 'employee'):
                return Response({'detail': 'No employee record'}, status=400)
            
            if not (user.has_role('MANAGER') or user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
                return Response({'detail': 'Managers/HR only'}, status=403)
            
            manager_id = request.query_params.get('manager_id') or str(user.employee.id)
            cycle_id = request.query_params.get('cycle_id')
            
            return Response(PerformanceReportsService.team_dashboard(manager_id, cycle_id))
        
        elif report_type == 'department':
            if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
                return Response({'detail': 'HR only'}, status=403)
            
            cycle_id = request.query_params.get('cycle_id')
            if not cycle_id:
                return Response({'detail': 'cycle_id required'}, status=400)
            
            return Response(PerformanceReportsService.department_report(cycle_id))
        
        elif report_type == 'cycle_comparison':
            if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
                return Response({'detail': 'HR only'}, status=403)
            
            cycle_ids = request.query_params.get('cycle_ids', '').split(',')
            cycle_ids = [c.strip() for c in cycle_ids if c.strip()]
            if not cycle_ids:
                return Response({'detail': 'cycle_ids required (comma-separated)'}, status=400)
            
            return Response(PerformanceReportsService.cycle_comparison(cycle_ids))
        
        elif report_type == 'kra':
            if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
                return Response({'detail': 'HR only'}, status=403)
            
            cycle_id = request.query_params.get('cycle_id')
            if not cycle_id:
                return Response({'detail': 'cycle_id required'}, status=400)
            
            return Response(PerformanceReportsService.kra_achievement_report(cycle_id))
        
        elif report_type == 'company':
            if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
                return Response({'detail': 'HR only'}, status=403)
            
            cycle_id = request.query_params.get('cycle_id')
            if not cycle_id:
                return Response({'detail': 'cycle_id required'}, status=400)
            
            return Response(PerformanceReportsService.company_dashboard(cycle_id))
        
        return Response({'detail': 'Invalid report type'}, status=400)


# ==============================================================================
# REPORT EXPORT VIEW
# ==============================================================================

from django.http import HttpResponse
from .services.reports_export_service import ReportsExportService


class ReportExportView(APIView):
    """
    Download performance reports as Excel or PDF.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        print("=" * 70)
        print("🚨 ReportExportView.get() CALLED!")
        print(f"   Path: {request.path}")
        print(f"   Query: {dict(request.query_params)}")
        print(f"   User: {request.user}")
        print("=" * 70)
        from .models import PerformanceCycle, Employee
        import traceback
        
        print("\n" + "=" * 70)
        print("📥 EXPORT REQUEST RECEIVED")
        print(f"   Query params: {dict(request.query_params)}")
        print("=" * 70)
        
        report_type = request.query_params.get('type', 'company')
        file_format = request.query_params.get('format', 'excel').lower()
        cycle_id = request.query_params.get('cycle_id')
        employee_id = request.query_params.get('employee_id')
        manager_id = request.query_params.get('manager_id')
        
        user = request.user
        print(f"   User: {user.email if hasattr(user, 'email') else user}")
        print(f"   Roles: {user.get_role_codes() if hasattr(user, 'get_role_codes') else 'N/A'}")
        
        # Get cycle name for filename
        cycle_name = 'Report'
        if cycle_id:
            try:
                cycle = PerformanceCycle.objects.get(id=cycle_id)
                cycle_name = cycle.name
                print(f"   ✅ Cycle found: {cycle_name}")
            except PerformanceCycle.DoesNotExist:
                print(f"   ❌ Cycle {cycle_id} NOT FOUND")
                return Response({'detail': f'Cycle {cycle_id} not found'}, status=404)
        
        # Get employee name for individual reports
        employee_name = ''
        if employee_id:
            try:
                emp = Employee.objects.get(id=employee_id)
                employee_name = emp.full_name
            except Employee.DoesNotExist:
                return Response({'detail': 'Employee not found'}, status=404)
        elif report_type == 'individual':
            emp = getattr(user, 'employee', None)
            if emp:
                employee_id = str(emp.id)
                employee_name = emp.full_name
            else:
                return Response({'detail': 'No employee record'}, status=400)
        
        # Permission checks
        is_hr = user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')
        is_manager = user.has_role('MANAGER')
        
        print(f"   Report type: {report_type} | Format: {file_format}")
        print(f"   Is HR: {is_hr} | Is Manager: {is_manager}")
        
        # Generate the report
        try:
            if report_type == 'company':
                if not is_hr:
                    return Response({'detail': 'HR only'}, status=403)
                if not cycle_id:
                    return Response({'detail': 'cycle_id required'}, status=400)
                
                print(f"   📊 Calling export_company_{file_format}...")
                content = (ReportsExportService.export_company_excel(cycle_id, cycle_name)
                          if file_format == 'excel'
                          else ReportsExportService.export_company_pdf(cycle_id, cycle_name))
                filename = f"Company_Report_{cycle_name.replace(' ', '_')}"
            
            elif report_type == 'department':
                if not is_hr:
                    return Response({'detail': 'HR only'}, status=403)
                if not cycle_id:
                    return Response({'detail': 'cycle_id required'}, status=400)
                content = (ReportsExportService.export_department_excel(cycle_id, cycle_name)
                          if file_format == 'excel'
                          else ReportsExportService.export_department_pdf(cycle_id, cycle_name))
                filename = f"Department_Report_{cycle_name.replace(' ', '_')}"
            
            elif report_type == 'team':
                if not (is_hr or is_manager):
                    return Response({'detail': 'Managers/HR only'}, status=403)
                mgr_id = manager_id or (str(user.employee.id) if hasattr(user, 'employee') else None)
                if not mgr_id:
                    return Response({'detail': 'manager_id required'}, status=400)
                content = (ReportsExportService.export_team_excel(mgr_id, cycle_id)
                          if file_format == 'excel'
                          else ReportsExportService.export_team_pdf(mgr_id, cycle_id))
                filename = f"Team_Report_{cycle_name.replace(' ', '_')}"
            
            elif report_type == 'individual':
                content = (ReportsExportService.export_individual_excel(employee_id, employee_name)
                          if file_format == 'excel'
                          else ReportsExportService.export_individual_pdf(employee_id, employee_name))
                filename = f"Performance_{employee_name.replace(' ', '_')}"
            
            elif report_type == 'kra':
                if not is_hr:
                    return Response({'detail': 'HR only'}, status=403)
                if not cycle_id:
                    return Response({'detail': 'cycle_id required'}, status=400)
                content = (ReportsExportService.export_kra_excel(cycle_id, cycle_name)
                          if file_format == 'excel'
                          else ReportsExportService.export_kra_pdf(cycle_id, cycle_name))
                filename = f"KRA_Report_{cycle_name.replace(' ', '_')}"
            
            else:
                return Response({'detail': f'Invalid report type: {report_type}'}, status=400)
            
            print(f"   ✅ Content generated: {len(content)} bytes")
        
        except AttributeError as e:
            print(f"   ❌ ATTRIBUTE ERROR: {e}")
            traceback.print_exc()
            return Response({
                'detail': f'Missing method or attribute: {str(e)}',
                'hint': 'The export method for this report type may not exist yet.',
            }, status=500)
        
        except Exception as e:
            print(f"   ❌ EXCEPTION: {type(e).__name__}: {e}")
            traceback.print_exc()
            return Response({
                'detail': f'Export failed: {str(e)}',
                'error_type': type(e).__name__,
                'report_type': report_type,
                'format': file_format,
            }, status=500)
        
        # Return file download response
        try:
            if file_format == 'excel':
                response = HttpResponse(
                    content,
                    content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                )
                response['Content-Disposition'] = f'attachment; filename="{filename}.xlsx"'
            else:
                response = HttpResponse(content, content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
            
            print(f"   📤 Sending file: {filename}")
            return response
        
        except Exception as e:
            print(f"   ❌ RESPONSE ERROR: {e}")
            traceback.print_exc()
            return Response({'detail': f'Response error: {str(e)}'}, status=500)



# ==============================================================================
# FUNCTION-BASED EXPORT VIEW (Alternative to class-based)
# ==============================================================================

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse, JsonResponse


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_report_fn(request):
    """Function-based view for exporting reports."""
    print("=" * 70)
    print("🚨 EXPORT FUNCTION CALLED!")
    print(f"   Query: {dict(request.query_params)}")
    print("=" * 70)
    
    from .models import PerformanceCycle, Employee
    from .services.reports_export_service import ReportsExportService
    import traceback
    
    report_type = request.query_params.get('type', 'company')
    file_format = request.query_params.get('format', 'excel').lower()
    cycle_id = request.query_params.get('cycle_id')
    
    user = request.user
    
    # Get cycle name
    cycle_name = 'Report'
    if cycle_id:
        try:
            cycle = PerformanceCycle.objects.get(id=cycle_id)
            cycle_name = cycle.name
        except PerformanceCycle.DoesNotExist:
            return JsonResponse({'detail': 'Cycle not found'}, status=404)
    
    # Permission checks
    is_hr = user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')
    
    try:
        if report_type == 'company':
            if not is_hr:
                return JsonResponse({'detail': 'HR only'}, status=403)
            content = (ReportsExportService.export_company_excel(cycle_id, cycle_name)
                      if file_format == 'excel'
                      else ReportsExportService.export_company_pdf(cycle_id, cycle_name))
            filename = f"Company_Report_{cycle_name.replace(' ', '_')}"
        
        elif report_type == 'department':
            content = (ReportsExportService.export_department_excel(cycle_id, cycle_name)
                      if file_format == 'excel'
                      else ReportsExportService.export_department_pdf(cycle_id, cycle_name))
            filename = f"Department_Report_{cycle_name.replace(' ', '_')}"
        
        elif report_type == 'team':
            mgr_id = str(user.employee.id) if hasattr(user, 'employee') else None
            content = (ReportsExportService.export_team_excel(mgr_id, cycle_id)
                      if file_format == 'excel'
                      else ReportsExportService.export_team_pdf(mgr_id, cycle_id))
            filename = f"Team_Report_{cycle_name.replace(' ', '_')}"
        
        elif report_type == 'individual':
            emp = getattr(user, 'employee', None)
            if not emp:
                return JsonResponse({'detail': 'No employee record'}, status=400)
            content = (ReportsExportService.export_individual_excel(str(emp.id), emp.full_name)
                      if file_format == 'excel'
                      else ReportsExportService.export_individual_pdf(str(emp.id), emp.full_name))
            filename = f"Performance_{emp.full_name.replace(' ', '_')}"
        
        elif report_type == 'kra':
            content = (ReportsExportService.export_kra_excel(cycle_id, cycle_name)
                      if file_format == 'excel'
                      else ReportsExportService.export_kra_pdf(cycle_id, cycle_name))
            filename = f"KRA_Report_{cycle_name.replace(' ', '_')}"
        
        else:
            return JsonResponse({'detail': f'Invalid report type: {report_type}'}, status=400)
        
        print(f"   ✅ Generated {len(content)} bytes")
        
    except Exception as e:
        print(f"   ❌ ERROR: {type(e).__name__}: {e}")
        traceback.print_exc()
        return JsonResponse({'detail': str(e)}, status=500)
    
    # Return file
    if file_format == 'excel':
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}.xlsx"'
    else:
        response = HttpResponse(content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
    
    return response