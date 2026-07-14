from django.contrib import admin

# Register your models here.
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import UserAccount, Employee, Role, CompanyStructure, UserActiveSession, AuthAuditLog


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('role_name', 'code', 'level', 'is_active', 'created_at')
    search_fields = ('role_name', 'code')
    list_filter = ('is_active',)


@admin.register(CompanyStructure)
class CompanyStructureAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'parent', 'is_active')
    list_filter = ('type', 'is_active')
    search_fields = ('name', 'cost_center_code')


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'full_name', 'official_email', 'position', 'status', 'date_of_joining')
    list_filter = ('status', 'gender', 'position__grade_band')
    search_fields = ('employee_id', 'first_name', 'last_name', 'official_email')

    fieldsets = (
        ('Identification', {
            'fields': ('employee_id', 'status'),
        }),
        ('Personal Information', {
            'fields': ('first_name', 'last_name', 'date_of_birth', 'gender',
                       'phone_number', 'official_email', 'personal_email'),
        }),
        ('Employment', {
            'fields': ('position', 'reporting_manager', 'structure_location',
                       'date_of_joining', 'date_of_exit'),
        }),
        ('Statutory / Bank (Encrypted)', {
            'classes': ('collapse',),
            'fields': ('bank_account_encrypted', 'bank_ifsc_code',
                       'pan_number_encrypted', 'aadhaar_number_encrypted',
                       'uan_number_encrypted'),
        }),
        ('System', {
            'classes': ('collapse',),
            'fields': ('is_deleted',),
        }),
    )


@admin.register(UserAccount)
class UserAccountAdmin(UserAdmin):
    list_display = ('username', 'email', 'employee', 'is_active', 'is_ldap_user', 'is_locked_out')
    list_filter = ('is_active', 'is_ldap_user', 'is_locked_out', 'roles')
    search_fields = ('username', 'email')
    ordering = ('-created_at',)
    filter_horizontal = ('roles', 'groups', 'user_permissions')

    fieldsets = (
        (None, {'fields': ('username', 'email', 'password')}),
        ('Employee Link', {'fields': ('employee',)}),
        ('Security', {'fields': (
            'is_ldap_user', 'mfa_enabled', 'mfa_secret_encrypted',
            'failed_login_attempts', 'is_locked_out', 'locked_until', 'last_login_ip',
        )}),
        ('Roles & Permissions', {'fields': (
            'is_active', 'is_staff', 'is_superuser', 'roles', 'groups', 'user_permissions',
        )}),
        ('Timestamps', {'fields': ('last_login', 'password_changed_at')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ( 'email','username', 'employee', 'password1', 'password2'),
        }),
    )

from .models import JobPosition, EmployeeDocument


@admin.register(JobPosition)
class JobPositionAdmin(admin.ModelAdmin):
    list_display = ('title', 'grade_band', 'department', 'budgeted_count', 'actual_count', 'vacancy_count', 'is_active')
    list_filter = ('grade_band', 'department', 'is_active')
    search_fields = ('title', 'grade_band')
    readonly_fields = ('actual_count',)


@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(admin.ModelAdmin):
    list_display = ('employee', 'document_name', 'document_type', 'expiry_date', 'is_expired', 'uploaded_at')
    list_filter = ('document_type', 'uploaded_at')
    search_fields = ('employee__employee_id', 'document_name')
    readonly_fields = ('alert_fired_count', 'uploaded_at')

@admin.register(UserActiveSession)
class UserActiveSessionAdmin(admin.ModelAdmin):
    list_display = ('user', 'ip_address', 'is_valid', 'expires_at', 'created_at')
    list_filter = ('is_valid',)
    search_fields = ('user__username', 'ip_address')


@admin.register(AuthAuditLog)
class AuthAuditLogAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'user', 'username_attempted', 'ip_address', 'created_at')
    list_filter = ('event_type',)
    search_fields = ('username_attempted', 'ip_address')
    readonly_fields = [f.name for f in AuthAuditLog._meta.fields]

from .models import EmployeeAuditLog

@admin.register(EmployeeAuditLog)
class EmployeeAuditLogAdmin(admin.ModelAdmin):
    list_display = ('employee', 'field_name', 'old_value', 'new_value', 'modified_by', 'changed_at')
    list_filter = ('field_name', 'changed_at')
    search_fields = ('employee__employee_id', 'employee__first_name', 'field_name')
    readonly_fields = [f.name for f in EmployeeAuditLog._meta.fields]
    ordering = ['-changed_at']

