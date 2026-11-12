from django.db import migrations, models
class Migration(migrations.Migration):
    dependencies=[('HRMSapp','0037_useraccount_sso_user_id')]
    operations=[migrations.AddField(model_name='role',name='sso_managed',field=models.BooleanField(default=False))]
