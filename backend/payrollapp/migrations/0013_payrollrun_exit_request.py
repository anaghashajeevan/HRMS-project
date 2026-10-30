import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payrollapp', '0012_employeeexitrequest_employeeexitapprovalaction'),
    ]

    operations = [
        migrations.AddField(
            model_name='payrollrun',
            name='exit_request',
            field=models.ForeignKey(
                blank=True,
                help_text='Exit case this F&F run settles; required for F&F runs.',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='fnf_runs',
                to='payrollapp.employeeexitrequest',
            ),
        ),
    ]
