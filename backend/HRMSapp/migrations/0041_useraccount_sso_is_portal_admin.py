from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('HRMSapp', '0040_reseed_local_standard_roles')]

    operations = [
        migrations.AddField(
            model_name='useraccount',
            name='sso_is_portal_admin',
            field=models.BooleanField(default=False),
        ),
    ]
