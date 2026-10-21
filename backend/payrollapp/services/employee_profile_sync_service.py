"""Keep current payroll identity details aligned with employee registration."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone


@transaction.atomic
def sync_employee_profile(employee, created_by=None, include_statutory=True):
    from ..models import EmployeePayrollProfile

    profile_values = {
        'bank_name': employee.bank_name or '',
        'account_holder_name': employee.bank_account_holder_name or '',
        'bank_account': employee.bank_account_encrypted or '',
        'ifsc_code': employee.bank_ifsc_code or '',
    }
    if include_statutory:
        profile_values.update({
            'pan': employee.pan_number_encrypted or '',
            'uan': employee.uan_number_encrypted or '',
        })
    current = EmployeePayrollProfile.objects.filter(
        employee=employee, is_active=True, effective_to__isnull=True,
    ).order_by('-effective_from').first()

    if current is None:
        return EmployeePayrollProfile.objects.create(
            employee=employee,
            **profile_values,
            effective_from=employee.date_of_joining or timezone.localdate(),
            created_by=created_by,
        )

    changed = {
        field: value for field, value in profile_values.items()
        if getattr(current, field) != value
    }
    if not changed:
        return current

    effective_date = max(timezone.localdate(), current.effective_from)
    if effective_date > current.effective_from:
        current.effective_to = effective_date - timedelta(days=1)
        current.is_active = False
        current.save(update_fields=['effective_to', 'is_active', 'updated_at'])
        values = {
            field: getattr(current, field)
            for field in (
                'bank_name', 'account_holder_name', 'bank_account', 'ifsc_code',
                'uan', 'pf_number', 'esi_number', 'pan', 'tax_regime',
            )
        }
        values.update(changed)
        return EmployeePayrollProfile.objects.create(
            employee=employee,
            **values,
            effective_from=effective_date,
            is_active=True,
            created_by=created_by,
        )

    for field, value in changed.items():
        setattr(current, field, value)
    current.save(update_fields=list(changed) + ['updated_at'])
    return current
