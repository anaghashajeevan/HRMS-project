# """
# Utility functions for HRMS.
# """
# from django.db import transaction
# from django.utils import timezone


# def generate_employee_id():
#     """
#     Auto-generate employee ID based on system settings.
#     Format examples:
#         - NL-2026-0001 (with year, prefix=NL, padding=4)
#         - NLT-0001 (no year, prefix=NLT, padding=4)
#         - EMP-2026-001 (with year, prefix=EMP, padding=3)
#     """
#     from .models import SystemSetting, Employee

#     prefix = SystemSetting.get_value('EMPLOYEE_ID_PREFIX', 'EMP')
#     include_year = SystemSetting.get_value('EMPLOYEE_ID_INCLUDE_YEAR', 'true').lower() == 'true'
#     padding = int(SystemSetting.get_value('EMPLOYEE_ID_PADDING', '4'))

#     year = timezone.now().year

#     with transaction.atomic():
#         # Build search pattern for existing IDs
#         if include_year:
#             search_pattern = f"{prefix}-{year}-"
#         else:
#             search_pattern = f"{prefix}-"

#         # Find highest existing sequence
#         existing = Employee.objects.filter(
#             employee_id__startswith=search_pattern
#         ).order_by('-employee_id').first()

#         next_seq = 1
#         if existing:
#             try:
#                 last_seq = int(existing.employee_id.split('-')[-1])
#                 next_seq = last_seq + 1
#             except (ValueError, IndexError):
#                 next_seq = Employee.objects.count() + 1

#         seq_str = str(next_seq).zfill(padding)

#         if include_year:
#             return f"{prefix}-{year}-{seq_str}"
#         return f"{prefix}-{seq_str}"



"""
Utility functions for HRMS.
"""
import re
from django.db import transaction
from django.utils import timezone


def generate_employee_id():
    """
    Auto-generate employee ID based on system settings.
    Format examples:
        - NL2026 0001 (with year, prefix=NL, padding=4)  → NL20260001
        - NL0001 (no year, prefix=NL, padding=4)         → NL0001
        - NL001 (no year, prefix=NL, padding=3)          → NL001  ✅ matches eSSL
    
    Note: Uses NO separator between prefix/year/sequence for eSSL compatibility.
    """
    from .models import SystemSetting, Employee

    prefix = SystemSetting.get_value('EMPLOYEE_ID_PREFIX', 'NL')
    include_year = SystemSetting.get_value('EMPLOYEE_ID_INCLUDE_YEAR', 'false').lower() == 'true'
    padding = int(SystemSetting.get_value('EMPLOYEE_ID_PADDING', '3'))

    year = timezone.now().year

    with transaction.atomic():
        # Build search pattern for existing IDs
        if include_year:
            search_pattern = f"{prefix}{year}"       # e.g. "NL2026"
        else:
            search_pattern = f"{prefix}"             # e.g. "NL"

        # Find all existing IDs matching this pattern
        existing_qs = Employee.objects.filter(
            employee_id__startswith=search_pattern
        ).values_list('employee_id', flat=True)

        # Extract the numeric sequence from each ID
        # Handles both old (NL-001) and new (NL001) formats
        max_seq = 0
        for emp_id in existing_qs:
            # Remove prefix + optional year, then extract trailing digits
            remainder = emp_id.replace(search_pattern, '', 1)
            # Strip any hyphens/spaces
            remainder = remainder.replace('-', '').replace(' ', '')
            # Extract trailing digits
            match = re.search(r'(\d+)$', remainder)
            if match:
                try:
                    seq = int(match.group(1))
                    if seq > max_seq:
                        max_seq = seq
                except ValueError:
                    continue

        next_seq = max_seq + 1
        seq_str = str(next_seq).zfill(padding)

        # Build final ID WITHOUT hyphens
        if include_year:
            return f"{prefix}{year}{seq_str}"        # NL20260001
        return f"{prefix}{seq_str}"                  # NL001  ✅
    

def generate_employee_id_preview(prefix: str, include_year: bool, padding: int) -> str:
    """
    Generate a preview of what the next employee ID would look like.
    Used by the settings preview endpoint.
    """
    from .models import Employee

    year = timezone.now().year

    if include_year:
        search_pattern = f"{prefix}{year}"
    else:
        search_pattern = f"{prefix}"

    existing_qs = Employee.objects.filter(
        employee_id__startswith=search_pattern
    ).values_list('employee_id', flat=True)

    max_seq = 0
    for emp_id in existing_qs:
        remainder = emp_id.replace(search_pattern, '', 1)
        remainder = remainder.replace('-', '').replace(' ', '')
        match = re.search(r'(\d+)$', remainder)
        if match:
            try:
                seq = int(match.group(1))
                if seq > max_seq:
                    max_seq = seq
            except ValueError:
                continue

    next_seq = max_seq + 1
    seq_str = str(next_seq).zfill(padding)

    if include_year:
        return f"{prefix}{year}{seq_str}"
    return f"{prefix}{seq_str}"