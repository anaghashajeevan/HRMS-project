from django.apps import AppConfig


class PolicyappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'policyapp'
    verbose_name = 'Policy Management'

    def ready(self):
        from . import signals  # noqa