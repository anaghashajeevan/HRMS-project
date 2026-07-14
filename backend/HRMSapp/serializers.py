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