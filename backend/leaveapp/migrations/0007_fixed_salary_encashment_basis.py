from django.db import migrations, models


def use_fixed_salary_for_existing_basic_policies(apps, schema_editor):
    LeaveType = apps.get_model('leaveapp', 'LeaveType')
    LeaveType.objects.filter(encashment_basis='BASIC').update(encashment_basis='FIXED')


class Migration(migrations.Migration):

    dependencies = [
        ('leaveapp', '0006_leavetype_encashment_divisor_days_and_more'),
    ]

    operations = [
        migrations.RunPython(use_fixed_salary_for_existing_basic_policies, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='leavetype',
            name='encashment_basis',
            field=models.CharField(
                choices=[
                    ('FIXED', 'Fixed Monthly Salary (Gross)'),
                    ('BASIC', 'Basic Salary'),
                    ('GROSS', 'Gross Salary'),
                    ('CTC', 'CTC'),
                ],
                default='FIXED',
                max_length=20,
            ),
        ),
    ]
