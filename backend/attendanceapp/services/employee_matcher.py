"""
Employee matcher service — normalizes eSSL codes and matches them to HRMS Employees.
"""

from HRMSapp.models import Employee
from ..models import normalize_employee_code


def find_hrms_employee_by_code(essl_code: str):
    """
    Find HRMS Employee by matching eSSL code to Employee.employee_id.
    Uses normalization to handle format differences (hyphens, spaces, case).
    
    Examples:
        eSSL 'NL001' -> matches HRMS 'NL-001' or 'NL001'
        eSSL 'NL-002' -> matches HRMS 'NL002' or 'NL-002'
    
    Returns:
        HRMSapp.Employee instance or None
    """
    if not essl_code:
        return None

    # Try exact match first (fast path — DB index)
    employee = Employee.objects.filter(
        employee_id__iexact=essl_code,
        is_deleted=False,
    ).first()
    if employee:
        return employee

    # Try normalized match (slower — full scan, but only for unmatched)
    normalized_essl = normalize_employee_code(essl_code)
    if not normalized_essl:
        return None

    active_employees = Employee.objects.filter(is_deleted=False).only(
        'id', 'employee_id', 'first_name', 'last_name'
    )
    for emp in active_employees:
        if normalize_employee_code(emp.employee_id) == normalized_essl:
            return emp

    return None


def get_employee_display_name(hrms_employee):
    """Get display name from HRMS Employee, or fallback."""
    if not hrms_employee:
        return "Unknown Employee"
    return hrms_employee.full_name  # first_name + last_name


def get_employee_context(essl_code: str):
    """
    Convenience: fetch HRMS employee + display name in one call.
    Returns (employee_or_none, display_name)
    """
    emp = find_hrms_employee_by_code(essl_code)
    name = get_employee_display_name(emp)
    return emp, name