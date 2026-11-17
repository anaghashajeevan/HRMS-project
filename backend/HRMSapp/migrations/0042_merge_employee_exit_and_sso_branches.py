from django.db import migrations


class Migration(migrations.Migration):
    """Join the independent employee-exit and SSO migration branches."""

    dependencies = [
        ('HRMSapp', '0039_employee_exit_status_lifecycle'),
        ('HRMSapp', '0041_useraccount_sso_is_portal_admin'),
    ]

    operations = []
