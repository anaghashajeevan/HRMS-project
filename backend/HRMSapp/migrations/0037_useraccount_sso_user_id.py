from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("HRMSapp", "0036_seed_standard_roles")]

    operations = [
        migrations.AddField(
            model_name="useraccount",
            name="sso_user_id",
            field=models.CharField(blank=True, max_length=100, null=True, unique=True),
        ),
    ]
