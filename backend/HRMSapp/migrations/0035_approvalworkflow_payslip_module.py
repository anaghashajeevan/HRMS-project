from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('HRMSapp', '0034_alter_approvalworkflow_module'),
    ]

    operations = [
        migrations.AlterField(
            model_name='approvalworkflow',
            name='module',
            field=models.CharField(
                choices=[
                    ('LIFECYCLE', 'Lifecycle Change'),
                    ('LEAVE', 'Leave Application'),
                    ('POLICY', 'Policy Approval'),
                    ('CALENDAR', 'Annual Calendar'),
                    ('PAYROLL', 'Payroll Run'),
                    ('PAYSLIP', 'Payslip Request'),
                ],
                max_length=30,
            ),
        ),
    ]
