"""
Custom RBAC permission classes.
"""
from rest_framework.permissions import BasePermission


class HasRole(BasePermission):
    """Require user to have at least one of the specified roles."""
    required_roles = []

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        required = getattr(view, 'required_roles', self.required_roles)
        if not required:
            return True
        user_roles = set(request.user.get_role_codes())
        return bool(user_roles.intersection(set(required)))


class IsSystemAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.has_role('SYSTEM_ADMIN')
        )


class IsHRAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (
                request.user.has_role('HR_ADMIN')
                or request.user.has_role('SYSTEM_ADMIN')
            )
        )


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (
                request.user.has_role('MANAGER')
                or request.user.has_role('HR_ADMIN')
                or request.user.has_role('SYSTEM_ADMIN')
            )
        )
    

class IsHRAdminOrReadOwn(BasePermission):
    """
    HR Admin / System Admin: full access.
    Others: can only view their own employee record.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user

        # HR / System admins can do anything
        if user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN'):
            return True

        # Manager can view their team (read-only)
        if user.has_role('MANAGER') and request.method in ('GET', 'HEAD', 'OPTIONS'):
            if hasattr(user, 'employee') and obj.reporting_manager_id == user.employee.id:
                return True

        # Regular user can only view their own record
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            if hasattr(user, 'employee') and user.employee.id == obj.id:
                return True

        return False

class ReadHROnlyWriteSystemAdmin(BasePermission):
    """
    Allow READ for HR_ADMIN and SYSTEM_ADMIN.
    Allow WRITE (create/update/delete) only for SYSTEM_ADMIN.

    Used for master data (Roles, Positions, Departments, Employee ID Settings)
    where HR needs to view/select but only System Admin can modify.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        user = request.user

        # SAFE methods (GET, HEAD, OPTIONS) — HR + System Admin
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return (
                user.has_role('SYSTEM_ADMIN')
                or user.has_role('HR_ADMIN')
                or user.has_role('MANAGER')  # Managers may need dropdowns too
            )

        # WRITE methods — only System Admin
        return user.has_role('SYSTEM_ADMIN')    