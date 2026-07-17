"""
Django signals for automatic audit logging.
"""
from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Employee, EmployeeAuditLog


# Fields we care about tracking
AUDITED_FIELDS = [
    'first_name', 'last_name', 'official_email', 'personal_email',
    'phone_number', 'gender', 'status',
    'position_id', 'reporting_manager_id', 'structure_location_id',
    'date_of_joining', 'date_of_exit',
    'bank_ifsc_code',
]


@receiver(pre_save, sender=Employee)
def log_employee_changes(sender, instance, **kwargs):
    """Log any changes to Employee model fields."""
    if not instance.pk:
        return  # New employee — nothing to compare

    try:
        old_instance = Employee.objects.get(pk=instance.pk)
    except Employee.DoesNotExist:
        return

    # Get the user making the change from the instance
    # Views MUST set this before calling save()
    modified_by = getattr(instance, '_modified_by', None)

    changes = []
    for field in AUDITED_FIELDS:
        old_value = getattr(old_instance, field, None)
        new_value = getattr(instance, field, None)

        if old_value != new_value:
            changes.append(EmployeeAuditLog(
                employee=instance,
                modified_by=modified_by,   # ← Can be None; DB allows null now
                field_name=field,
                old_value=str(old_value) if old_value is not None else '',
                new_value=str(new_value) if new_value is not None else '',
            ))

    if changes:
        EmployeeAuditLog.objects.bulk_create(changes)