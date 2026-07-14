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