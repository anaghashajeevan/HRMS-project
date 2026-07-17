from django.shortcuts import render

from django.db import models
# Create your views here.
"""
Authentication views — flat class-based APIViews.
"""
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.decorators import action
from .models import UserAccount, UserActiveSession, AuthAuditLog, Role,EmployeeAuditLog
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