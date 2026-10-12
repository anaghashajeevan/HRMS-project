"""
Django signals for automatic audit logging.
"""
from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Employee, EmployeeAuditLog


# Fields we care about tracking
AUDITED_FIELDS = [
    'employee_id', 'first_name', 'last_name', 'official_email', 'personal_email',
    'phone_number', 'gender', 'status',
    'position_id', 'reporting_manager_id', 'structure_location_id',
    'department_id', 'location_id', 'cost_center_id',   # 🆕 Track hierarchy changes
    'date_of_joining', 'date_of_exit',
    'bank_ifsc_code','work_mode', 'can_self_attend',
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

    update_fields = kwargs.get('update_fields')
    employee_change = {}
    if old_instance.status != instance.status and (update_fields is None or 'status' in update_fields):
        employee_change['status'] = (old_instance.status, instance.status)
    if old_instance.employee_id != instance.employee_id and (
        update_fields is None or 'employee_id' in update_fields
    ):
        employee_change['employee_id'] = (old_instance.employee_id, instance.employee_id)
    if employee_change:
        instance._employee_notification_changes = {
            'changes': employee_change,
            'changed_on': timezone.localdate().isoformat(),
        }

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


@receiver(post_save, sender=Employee)
def queue_employment_status_email(sender, instance, created, **kwargs):
    """Create in-app notifications and queue emails for employee ID/status changes."""
    change = getattr(instance, '_employee_notification_changes', None)
    if created or not change:
        return

    del instance._employee_notification_changes
    employee_id = str(instance.pk)
    changed_on = change['changed_on']
    from .models import Notification

    status_labels = dict(Employee.STATUS_CHOICES)
    if 'status' in change['changes']:
        previous_status, new_status = change['changes']['status']
        previous_label = status_labels.get(previous_status, previous_status)
        new_label = status_labels.get(new_status, new_status)
        Notification.objects.create(
            recipient=instance,
            notification_type='EMPLOYMENT_STATUS_CHANGED',
            title='Employment status updated',
            message=f'Your employment status changed from {previous_label} to {new_label}.',
            link='/profile',
            metadata={
                'previous_status': previous_status,
                'new_status': new_status,
            },
        )

        def enqueue_status_email():
            from .tasks import email_employment_status_changed
            email_employment_status_changed.delay(
                employee_id, previous_status, new_status, changed_on
            )

        transaction.on_commit(enqueue_status_email, robust=True)

    if 'employee_id' in change['changes']:
        previous_employee_id, new_employee_id = change['changes']['employee_id']
        Notification.objects.create(
            recipient=instance,
            notification_type='EMPLOYEE_ID_CHANGED',
            title='Employee ID updated',
            message=f'Your employee ID changed from {previous_employee_id} to {new_employee_id}.',
            link='/profile',
            metadata={
                'previous_employee_id': previous_employee_id,
                'new_employee_id': new_employee_id,
            },
        )

        def enqueue_employee_id_email():
            from .tasks import email_employee_id_changed
            email_employee_id_changed.delay(
                employee_id, previous_employee_id, new_employee_id, changed_on
            )

        transaction.on_commit(enqueue_employee_id_email, robust=True)
