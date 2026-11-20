from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('HRMSapp', '0044_merge_20261117_1053'),
    ]

    operations = [
        migrations.AddField(
            model_name='monthlykra',
            name='external_source_id',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
