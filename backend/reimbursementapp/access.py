"""
Access control for reimbursement app.
Integrates with HRMS's role system (HR_ADMIN, SYSTEM_ADMIN).
"""

FULL_ACCESS_GROUP_NAMES = {"finance team", "finance head", "admin", "admins"}
FULL_ACCESS_ROLE_NAMES = {"FINANCE", "FINANCE_HEAD", "ADMIN"}


def _has_hrms_role(user, role_names):
    """Check if user has any of the specified HRMS roles."""
    if not hasattr(user, 'has_role'):
        return False
    for role_name in role_names:
        if user.has_role(role_name):
            return True
    return False


def _group_names(user):
    if not user or not user.is_authenticated:
        return set()
    return {name.strip().lower() for name in user.groups.values_list("name", flat=True)}


def user_can_access_full_app(user):
    """
    Check if user has finance/admin access.
    Works with both HRMS role-based access AND legacy group-based access.
    """
    if not user or not user.is_authenticated:
        return False
    
    # HRMS role check (primary)
    if _has_hrms_role(user, ['HR_ADMIN', 'SYSTEM_ADMIN']):
        return True
    
    # Django staff/superuser check
    if user.is_superuser or user.is_staff:
        return True
    
    # Legacy group check (from original ReimburIQ)
    if _group_names(user) & FULL_ACCESS_GROUP_NAMES:
        return True
    
    return False


def user_is_finance_or_admin(user):
    return user_can_access_full_app(user)


def user_can_access_upload(user, smart_upload):
    if not user or not user.is_authenticated or smart_upload is None:
        return False
    return user_can_access_full_app(user) or smart_upload.created_by_id == user.id