from rest_framework import permissions

from .access import user_can_access_full_app


class IsFinanceOrAdmin(permissions.BasePermission):
    message = "You do not have permission to access this page."

    def has_permission(self, request, view):
        return bool(request.user and user_can_access_full_app(request.user))
