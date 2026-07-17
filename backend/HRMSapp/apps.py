from django.apps import AppConfig


class HrmsappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'HRMSapp'

    def ready(self):
        import HRMSapp.signals 