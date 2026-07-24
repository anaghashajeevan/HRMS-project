"""
Signals for leave app.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from HRMSapp.models import Employee


@receiver(post_save, sender=Employee)
def allocate_leave_balance_on_create(sender, instance, created, **kwargs):
    """Auto-allocate leave balance when a new employee is created."""
    if not created:
        return

    # Import here to avoid circular imports
    from .services.balance_service import LeaveBalanceService

    try:
        LeaveBalanceService.allocate_initial_balance(instance)
    except Exception as exc:
        # Don't block employee creation if balance allocation fails
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(f"Failed to allocate leave balance for {instance.employee_id}: {exc}")