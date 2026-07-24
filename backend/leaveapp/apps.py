from django.apps import AppConfig


class LeaveappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'leaveapp'
    verbose_name = 'Leave Management'

    def ready(self):
        # Import signals when app is ready
        from . import signals  # noqa