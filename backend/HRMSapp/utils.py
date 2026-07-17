"""
Utility functions for HRMS.
"""
from django.db import transaction
from django.utils import timezone


def generate_employee_id():
    """
    Auto-generate employee ID based on system settings.
    Format examples:
        - NL-2026-0001 (with year, prefix=NL, padding=4)
        - NLT-0001 (no year, prefix=NLT, padding=4)
        - EMP-2026-001 (with year, prefix=EMP, padding=3)
    """
    from .models import SystemSetting, Employee

    prefix = SystemSetting.get_value('EMPLOYEE_ID_PREFIX', 'EMP')
    include_year = SystemSetting.get_value('EMPLOYEE_ID_INCLUDE_YEAR', 'true').lower() == 'true'
    padding = int(SystemSetting.get_value('EMPLOYEE_ID_PADDING', '4'))

    year = timezone.now().year

    with transaction.atomic():
        # Build search pattern for existing IDs
        if include_year:
            search_pattern = f"{prefix}-{year}-"
        else:
            search_pattern = f"{prefix}-"

        # Find highest existing sequence
        existing = Employee.objects.filter(
            employee_id__startswith=search_pattern
        ).order_by('-employee_id').first()

        next_seq = 1
        if existing:
            try:
                last_seq = int(existing.employee_id.split('-')[-1])
                next_seq = last_seq + 1
            except (ValueError, IndexError):
                next_seq = Employee.objects.count() + 1

        seq_str = str(next_seq).zfill(padding)

        if include_year:
            return f"{prefix}-{year}-{seq_str}"
        return f"{prefix}-{seq_str}"