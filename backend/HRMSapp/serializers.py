"""
Authentication serializers — flat classes.
"""
from django.contrib.auth import authenticate
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from django.conf import settings

from .models import UserAccount, Employee, Role, UserActiveSession, AuthAuditLog


# ------------------------------------------------------------------------------
# ROLE
# ------------------------------------------------------------------------------

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'role_name', 'code', 'description', 'level', 'is_active']
        read_only_fields = ['id']


# ------------------------------------------------------------------------------
# EMPLOYEE (minimal — for auth context)
# ------------------------------------------------------------------------------

class EmployeeMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'full_name',
            'first_name', 'last_name', 'official_email',
            'status', 'date_of_joining',
        ]
        read_only_fields = fields


# ------------------------------------------------------------------------------
# USER PROFILE (for /me endpoint)
# ------------------------------------------------------------------------------

class UserProfileSerializer(serializers.ModelSerializer):
    employee = EmployeeMiniSerializer(read_only=True)
    roles = RoleSerializer(many=True, read_only=True)
    role_codes = serializers.SerializerMethodField()

    class Meta:
        model = UserAccount
        fields = [
            'id', 'username', 'email',
            'is_ldap_user', 'mfa_enabled',
            'is_active', 'last_login',
            'employee', 'roles', 'role_codes',
        ]
        read_only_fields = fields

    def get_role_codes(self, obj):
        return obj.get_role_codes()


# ------------------------------------------------------------------------------
# LOGIN
# ------------------------------------------------------------------------------

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)                         
    password = serializers.CharField(required=True, write_only=True, style={'input_type': 'password'})
    device_id = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        email = attrs.get('email')                                        
        password = attrs.get('password')
        request = self.context.get('request')

        # Try to load user by email
        try:
            user = UserAccount.objects.get(email__iexact=email)           
        except UserAccount.DoesNotExist:
            user = None

        # Check lockout
        if user and user.is_locked_out:
            if user.locked_until and user.locked_until > timezone.now():
                raise serializers.ValidationError({
                    'detail': f'Account locked. Try again after {user.locked_until.strftime("%Y-%m-%d %H:%M:%S")}.'
                })
            else:
                user.is_locked_out = False
                user.failed_login_attempts = 0
                user.locked_until = None
                user.save(update_fields=['is_locked_out', 'failed_login_attempts', 'locked_until'])

        # Authenticate using email as the username field
        auth_user = authenticate(request=request, username=email, password=password)  # ← username=email

        if auth_user is None:
            if user:
                user.failed_login_attempts += 1
                max_attempts = getattr(settings, 'MAX_LOGIN_ATTEMPTS', 5)
                if user.failed_login_attempts >= max_attempts:
                    user.is_locked_out = True
                    user.locked_until = timezone.now() + timedelta(
                        minutes=getattr(settings, 'LOGIN_LOCKOUT_DURATION_MINUTES', 30)
                    )
                user.save(update_fields=['failed_login_attempts', 'is_locked_out', 'locked_until'])

                AuthAuditLog.objects.create(
                    user=user,
                    username_attempted=email,                             
                    event_type='LOGIN_FAILED',
                    ip_address=self._get_ip(request),
                    user_agent=self._get_ua(request),
                    details={'reason': 'invalid_password', 'attempts': user.failed_login_attempts},
                )
            else:
                AuthAuditLog.objects.create(
                    username_attempted=email,                              
                    event_type='LOGIN_FAILED',
                    ip_address=self._get_ip(request),
                    user_agent=self._get_ua(request),
                    details={'reason': 'user_not_found'},
                )
            raise serializers.ValidationError({'detail': 'Invalid email or password.'})  

        if not auth_user.is_active:
            raise serializers.ValidationError({'detail': 'Account is disabled.'})

        # Reset counters on success
        auth_user.failed_login_attempts = 0
        auth_user.is_locked_out = False
        auth_user.locked_until = None
        auth_user.last_login = timezone.now()
        auth_user.last_login_ip = self._get_ip(request)
        auth_user.save(update_fields=[
            'failed_login_attempts', 'is_locked_out', 'locked_until',
            'last_login', 'last_login_ip',
        ])

        attrs['user'] = auth_user
        return attrs

    @staticmethod
    def _get_ip(request):
        if not request:
            return None
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    @staticmethod
    def _get_ua(request):
        if not request:
            return ''
        return request.META.get('HTTP_USER_AGENT', '')

    def create_tokens(self, user, device_id=None):
        """Generate JWT + persist session record."""
        refresh = RefreshToken.for_user(user)

        refresh['email'] = user.email                                      
        refresh['username'] = user.username
        refresh['roles'] = user.get_role_codes()
        if user.employee_id:
            refresh['employee_id'] = str(user.employee.employee_id)

        access = refresh.access_token
        access['email'] = user.email                                       
        access['roles'] = user.get_role_codes()

        request = self.context.get('request')
        UserActiveSession.objects.create(
            user=user,
            device_fingerprint=device_id or self._get_ua(request)[:255],
            refresh_token_jti=refresh['jti'],
            ip_address=self._get_ip(request) or '0.0.0.0',
            user_agent=self._get_ua(request),
            expires_at=timezone.now() + settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'],
        )

        AuthAuditLog.objects.create(
            user=user,
            username_attempted=user.email,                                 
            event_type='LOGIN_SUCCESS',
            ip_address=self._get_ip(request),
            user_agent=self._get_ua(request),
            details={'device_id': device_id},
        )

        return {
            'access': str(access),
            'refresh': str(refresh),
        }


# ------------------------------------------------------------------------------
# LOGOUT
# ------------------------------------------------------------------------------

class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=True)

    def validate(self, attrs):
        try:
            token = RefreshToken(attrs['refresh'])
            attrs['token_obj'] = token
        except Exception:
            raise serializers.ValidationError({'refresh': 'Invalid or expired token.'})
        return attrs

    def save(self, **kwargs):
        token = self.validated_data['token_obj']
        jti = token.get('jti')

        # Blacklist the token
        try:
            token.blacklist()
        except Exception:
            pass

        # Invalidate active session record
        UserActiveSession.objects.filter(refresh_token_jti=jti).update(is_valid=False)

        # Audit
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None
        AuthAuditLog.objects.create(
            user=user,
            username_attempted=user.username if user else None,
            event_type='LOGOUT',
            ip_address=self._get_ip(request),
            user_agent=self._get_ua(request),
            details={'jti': jti},
        )
        return {'status': 'SUCCESS', 'message': 'Session token blacklisted.'}

    @staticmethod
    def _get_ip(request):
        if not request:
            return None
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    @staticmethod
    def _get_ua(request):
        if not request:
            return ''
        return request.META.get('HTTP_USER_AGENT', '')


# ------------------------------------------------------------------------------
# TOKEN REFRESH (extends default to audit)
# ------------------------------------------------------------------------------

class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        # Optional: log refresh
        return data


# ------------------------------------------------------------------------------
# CHANGE PASSWORD
# ------------------------------------------------------------------------------

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        user = self.context['request'].user

        if not user.check_password(attrs['old_password']):
            raise serializers.ValidationError({'old_password': 'Old password is incorrect.'})

        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        if attrs['old_password'] == attrs['new_password']:
            raise serializers.ValidationError({'new_password': 'New password must differ from old password.'})

        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.password_changed_at = timezone.now()
        user.save(update_fields=['password', 'password_changed_at'])

        request = self.context.get('request')
        AuthAuditLog.objects.create(
            user=user,
            username_attempted=user.username,
            event_type='PASSWORD_CHANGE',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )
        return user


# ------------------------------------------------------------------------------
# REGISTER USER (Admin-only — creates Employee + UserAccount together)
# ------------------------------------------------------------------------------

class RegisterUserSerializer(serializers.Serializer):
    # Employee fields
    first_name = serializers.CharField(max_length=50)
    last_name = serializers.CharField(max_length=50)
    official_email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20)
    date_of_birth = serializers.DateField()
    gender = serializers.ChoiceField(choices=Employee.GENDER_CHOICES, required=False)
    date_of_joining = serializers.DateField()

    # Account fields
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    role_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )

    def validate_username(self, value):
        if UserAccount.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already exists.')
        return value

    def validate_official_email(self, value):
        if Employee.objects.filter(official_email=value).exists():
            raise serializers.ValidationError('Email already registered.')
        return value

    def create(self, validated_data):
        role_ids = validated_data.pop('role_ids', [])
        password = validated_data.pop('password')
        username = validated_data.pop('username')

        # Generate employee ID
        last = Employee.objects.order_by('-created_at').first()
        next_num = 1
        if last and last.employee_id.startswith('EMP-'):
            try:
                next_num = int(last.employee_id.split('-')[-1]) + 1
            except (ValueError, IndexError):
                next_num = Employee.objects.count() + 1

        emp_id = f"EMP-{timezone.now().year}-{next_num:04d}"

        employee = Employee.objects.create(
            employee_id=emp_id,
            **validated_data
        )

        user = UserAccount.objects.create_user(
            username=username,
            email=validated_data['official_email'],
            password=password,
            employee=employee,
        )

        if role_ids:
            roles = Role.objects.filter(id__in=role_ids, is_active=True)
            user.roles.set(roles)
        else:
            # Default to EMPLOYEE role
            default_role = Role.objects.filter(role_name='EMPLOYEE', is_active=True).first()
            if default_role:
                user.roles.add(default_role)

        return user


# ------------------------------------------------------------------------------
# ACTIVE SESSION
# ------------------------------------------------------------------------------

class ActiveSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserActiveSession
        fields = [
            'id', 'device_fingerprint', 'ip_address',
            'user_agent', 'is_valid', 'expires_at', 'created_at',
        ]
        read_only_fields = fields


# ------------------------------------------------------------------------------
# AUDIT LOG
# ------------------------------------------------------------------------------

class AuthAuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AuthAuditLog
        fields = [
            'id', 'user', 'username', 'username_attempted',
            'event_type', 'ip_address', 'user_agent',
            'details', 'created_at',
        ]
        read_only_fields = fields

# ==============================================================================
# EMPLOYEE MODULE SERIALIZERS
# ==============================================================================

from .models import Employee, CompanyStructure, JobPosition


class CompanyStructureMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyStructure
        fields = ['id', 'name', 'type']


class JobPositionMiniSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = JobPosition
        fields = ['id', 'title', 'grade_band', 'department_name']


class EmployeeManagerMiniSerializer(serializers.ModelSerializer):
    """Used to show manager info nested inside employee response."""
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Employee
        fields = ['id', 'employee_id', 'full_name', 'official_email']


# ------------------------------------------------------------------------------
# LIST SERIALIZER (lightweight — for table view)
# ------------------------------------------------------------------------------

class EmployeeListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    position_title = serializers.CharField(source='position.title', read_only=True, default=None)
    department_name = serializers.CharField(
        source='position.department.name', read_only=True, default=None
    )
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id',
            'employee_id',
            'full_name',
            'first_name',
            'last_name',
            'official_email',
            'phone_number',
            'status',
            'position_title',
            'department_name',
            'manager_name',
            'date_of_joining',
        ]
        read_only_fields = fields

    def get_manager_name(self, obj):
        if obj.reporting_manager:
            return obj.reporting_manager.full_name
        return None


# ------------------------------------------------------------------------------
# DETAIL SERIALIZER (full profile view)
# ------------------------------------------------------------------------------

class EmployeeDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    position = JobPositionMiniSerializer(read_only=True)
    reporting_manager = EmployeeManagerMiniSerializer(read_only=True)
    structure_location = CompanyStructureMiniSerializer(read_only=True)

    # NEW: Check if user account exists
    has_user_account = serializers.SerializerMethodField()
    user_account_info = serializers.SerializerMethodField()

    # Masked encrypted fields
    bank_account = serializers.SerializerMethodField()
    pan_number = serializers.SerializerMethodField()
    aadhaar_number = serializers.SerializerMethodField()
    uan_number = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            # Identification
            'id', 'employee_id', 'status',

            # Personal
            'first_name', 'last_name', 'full_name',
            'official_email', 'personal_email', 'phone_number',
            'date_of_birth', 'gender',

            # Employment
            'position', 'reporting_manager', 'structure_location',
            'date_of_joining', 'date_of_exit',

            # Bank / Statutory (masked)
            'bank_account', 'bank_ifsc_code',
            'pan_number', 'aadhaar_number', 'uan_number',

            # NEW: User account info
            'has_user_account', 'user_account_info',

            # Timestamps
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    # ---------- User Account Check ----------
    def get_has_user_account(self, obj):
        return hasattr(obj, 'user_account')

    def get_user_account_info(self, obj):
        if hasattr(obj, 'user_account'):
            user = obj.user_account
            return {
                'username': user.username,
                'email': user.email,
                'is_active': user.is_active,
                'is_locked_out': user.is_locked_out,
                'last_login': user.last_login,
                'roles': list(user.roles.values_list('role_name', flat=True)),
            }
        return None

    # ---------- Masking Logic ----------
    def _can_see_full_pii(self):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        user = request.user
        return user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')

    def _mask(self, value, visible_chars=4):
        if not value:
            return None
        if self._can_see_full_pii():
            return value
        if len(value) <= visible_chars:
            return '*' * len(value)
        return '*' * (len(value) - visible_chars) + value[-visible_chars:]

    def get_bank_account(self, obj):
        return self._mask(obj.bank_account_encrypted)

    def get_pan_number(self, obj):
        return self._mask(obj.pan_number_encrypted)

    def get_aadhaar_number(self, obj):
        return self._mask(obj.aadhaar_number_encrypted)

    def get_uan_number(self, obj):
        return self._mask(obj.uan_number_encrypted)



# ==============================================================================
# MASTER DATA SERIALIZERS
# ==============================================================================

from .models import CompanyStructure, JobPosition, SystemSetting


# ------------------------------------------------------------------------------
# ROLE (Enhanced)
# ------------------------------------------------------------------------------

class RoleFullSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            'id', 'role_name', 'code', 'description',
            'level', 'is_active', 'user_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user_count', 'created_at', 'updated_at']

    def get_user_count(self, obj):
        return obj.user_accounts.count()

    def validate_code(self, value):
        if not value.replace('_', '').isalnum():
            raise serializers.ValidationError(
                'Code can only contain letters, numbers, and underscores.'
            )
        return value.lower()


# ------------------------------------------------------------------------------
# COMPANY STRUCTURE (Departments / Locations)
# ------------------------------------------------------------------------------

class CompanyStructureSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True, default=None)
    children_count = serializers.SerializerMethodField()
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = CompanyStructure
        fields = [
            'id', 'name', 'type', 'parent', 'parent_name',
            'cost_center_code', 'is_active',
            'children_count', 'employee_count', 'created_at',
        ]
        read_only_fields = ['id', 'children_count', 'employee_count', 'created_at']

    def get_children_count(self, obj):
        return obj.children.count()

    def get_employee_count(self, obj):
        return obj.employees.filter(is_deleted=False).count()


# ------------------------------------------------------------------------------
# JOB POSITION
# ------------------------------------------------------------------------------

class JobPositionSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    vacancy_count = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)

    class Meta:
        model = JobPosition
        fields = [
            'id', 'title', 'grade_band',
            'department', 'department_name',
            'budgeted_count', 'actual_count', 'vacancy_count', 'is_full',
            'salary_min', 'salary_max',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'actual_count', 'vacancy_count', 'is_full', 'created_at', 'updated_at']

    def validate(self, attrs):
        salary_min = attrs.get('salary_min')
        salary_max = attrs.get('salary_max')
        if salary_min and salary_max and salary_min > salary_max:
            raise serializers.ValidationError({
                'salary_max': 'Maximum salary must be greater than minimum salary.'
            })
        return attrs


# ------------------------------------------------------------------------------
# EMPLOYEE ID SETTINGS (only)
# ------------------------------------------------------------------------------

class EmployeeIdSettingSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.CharField(source='updated_by.full_name', read_only=True, default=None)

    class Meta:
        model = SystemSetting
        fields = [
            'id', 'key', 'value', 'description',
            'is_editable', 'updated_at', 'updated_by_name',
        ]
        read_only_fields = ['id', 'key', 'is_editable', 'updated_at', 'updated_by_name']


class EmployeeIdPreviewSerializer(serializers.Serializer):
    """For previewing what the next employee ID will look like."""
    prefix = serializers.CharField(required=True, max_length=10)
    include_year = serializers.BooleanField(required=True)
    padding = serializers.IntegerField(required=True, min_value=1, max_value=8)



# ==============================================================================
# EMPLOYEE CREATE / UPDATE SERIALIZER
# ==============================================================================

# ==============================================================================
# EMPLOYEE CREATE / UPDATE SERIALIZER
# ==============================================================================

class EmployeeCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Handles creating and updating employees.
    Optionally creates a UserAccount on create OR on update (if none exists).
    """
    create_user_account = serializers.BooleanField(write_only=True, required=False, default=False)
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
        min_length=8,
    )
    role_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True, required=False, allow_empty=True
    )

    class Meta:
        model = Employee
        fields = [
            'first_name', 'last_name', 'official_email', 'personal_email',
            'phone_number', 'date_of_birth', 'gender',
            'status', 'position', 'reporting_manager', 'structure_location',
            'date_of_joining', 'date_of_exit',
            'bank_account_encrypted', 'bank_ifsc_code',
            'pan_number_encrypted', 'aadhaar_number_encrypted', 'uan_number_encrypted',
            'create_user_account', 'password', 'role_ids',
        ]

    def validate_official_email(self, value):
        qs = Employee.objects.filter(official_email__iexact=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('An employee with this email already exists.')
        return value

    def validate(self, attrs):
        create_account = attrs.get('create_user_account', False)
        password = attrs.get('password', '').strip() if attrs.get('password') else ''

        if create_account:
            # Check if employee already has an account (only on update)
            if self.instance and hasattr(self.instance, 'user_account'):
                raise serializers.ValidationError({
                    'create_user_account': 'This employee already has a user account.'
                })

            if not password:
                raise serializers.ValidationError({
                    'password': 'Password is required when creating a user account.'
                })
            if len(password) < 8:
                raise serializers.ValidationError({
                    'password': 'Password must be at least 8 characters.'
                })
        return attrs

    def _create_user_account(self, employee, password, role_ids):
        """Helper to create UserAccount for an employee."""
        from .models import UserAccount, Role

        username = employee.official_email.split('@')[0]
        base_username = username
        counter = 1
        while UserAccount.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        user = UserAccount.objects.create_user(
            email=employee.official_email,
            username=username,
            password=password,
            employee=employee,
            is_active=True,
        )

        if role_ids:
            roles = Role.objects.filter(id__in=role_ids, is_active=True)
            user.roles.set(roles)
        else:
            default_role = Role.objects.filter(role_name='EMPLOYEE', is_active=True).first()
            if default_role:
                user.roles.add(default_role)

        return user

    def create(self, validated_data):
        create_account = validated_data.pop('create_user_account', False)
        password = validated_data.pop('password', None)
        role_ids = validated_data.pop('role_ids', [])

        employee = Employee.objects.create(**validated_data)

        if create_account and password:
            self._create_user_account(employee, password, role_ids)

        return employee

    def update(self, instance, validated_data):
        # Extract user account fields
        create_account = validated_data.pop('create_user_account', False)
        password = validated_data.pop('password', None)
        role_ids = validated_data.pop('role_ids', [])

        # Update employee fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Create user account if requested (and doesn't exist)
        if create_account and password and not hasattr(instance, 'user_account'):
            self._create_user_account(instance, password, role_ids)

        return instance


# ==============================================================================
# EMPLOYEE DOCUMENTS
# ==============================================================================

from .models import EmployeeDocument


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True, default=None)
    is_expired = serializers.BooleanField(read_only=True)
    days_until_expiry = serializers.IntegerField(read_only=True)
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)

    class Meta:
        model = EmployeeDocument
        fields = [
            'id', 'employee',
            'document_type', 'document_type_display',
            'document_name',
            'file_path', 'file_url',
            'file_size_kb', 'mime_type',
            'expiry_date', 'is_expired', 'days_until_expiry',
            'alert_fired_count',
            'uploaded_by', 'uploaded_by_name',
            'uploaded_at',
        ]
        read_only_fields = [
            'id', 'file_url', 'file_size_kb', 'mime_type',
            'is_expired', 'days_until_expiry',
            'alert_fired_count', 'uploaded_by', 'uploaded_by_name',
            'uploaded_at',
        ]

    def get_file_url(self, obj):
        if obj.file_path:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file_path.url)
            return obj.file_path.url
        return None

    def create(self, validated_data):
        # Auto-compute file size + mime type
        file_obj = validated_data.get('file_path')
        if file_obj:
            validated_data['file_size_kb'] = round(file_obj.size / 1024)
            validated_data['mime_type'] = getattr(file_obj, 'content_type', '')
        return super().create(validated_data)


# ==============================================================================
# EMPLOYEE AUDIT LOG
# ==============================================================================

from .models import EmployeeAuditLog


# ==============================================================================
# EMPLOYEE AUDIT LOG (with UUID → name resolution)
# ==============================================================================

from .models import EmployeeAuditLog


class EmployeeAuditLogSerializer(serializers.ModelSerializer):
    modified_by_name = serializers.CharField(
        source='modified_by.full_name', read_only=True, default='System'
    )
    modified_by_id = serializers.CharField(
        source='modified_by.employee_id', read_only=True, default=None
    )
    field_display = serializers.SerializerMethodField()
    old_value_display = serializers.SerializerMethodField()
    new_value_display = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeAuditLog
        fields = [
            'id', 'employee',
            'field_name', 'field_display',
            'old_value', 'new_value',
            'old_value_display', 'new_value_display',
            'modified_by', 'modified_by_name', 'modified_by_id',
            'changed_at',
        ]
        read_only_fields = fields

    def get_field_display(self, obj):
        """Human-friendly field labels."""
        labels = {
            'first_name': 'First Name',
            'last_name': 'Last Name',
            'official_email': 'Official Email',
            'personal_email': 'Personal Email',
            'phone_number': 'Phone Number',
            'gender': 'Gender',
            'status': 'Status',
            'position_id': 'Position',
            'reporting_manager_id': 'Reporting Manager',
            'structure_location_id': 'Department/Location',
            'date_of_joining': 'Date of Joining',
            'date_of_exit': 'Date of Exit',
            'bank_ifsc_code': 'Bank IFSC Code',
        }
        return labels.get(obj.field_name, obj.field_name.replace('_', ' ').title())

    def _resolve_uuid(self, field_name, value):
        """Convert UUID references to human-readable names."""
        if not value or value in ('None', 'null', ''):
            return None

        # Import inside function to avoid circular imports
        from .models import JobPosition, Employee, CompanyStructure

        try:
            if field_name == 'position_id':
                pos = JobPosition.objects.filter(id=value).first()
                return f"{pos.title} ({pos.grade_band})" if pos else f"Unknown Position"

            if field_name == 'reporting_manager_id':
                mgr = Employee.objects.filter(id=value).first()
                return f"{mgr.full_name} ({mgr.employee_id})" if mgr else f"Unknown Manager"

            if field_name == 'structure_location_id':
                loc = CompanyStructure.objects.filter(id=value).first()
                return loc.name if loc else f"Unknown Location"
        except Exception:
            return value  # Fallback to raw value on error

        return value  # Non-UUID fields — return as-is

    def get_old_value_display(self, obj):
        return self._resolve_uuid(obj.field_name, obj.old_value)

    def get_new_value_display(self, obj):
        return self._resolve_uuid(obj.field_name, obj.new_value)