from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payrollapp', '0009_employee_payroll_profile_tax_resident'),
    ]

    operations = [
        migrations.AddField(
            model_name='payrollrunadjustment',
            name='category',
            field=models.CharField(
                choices=[
                    ('BONUS', 'Bonus'),
                    ('INCREMENT_DIFFERENCE', 'Increment difference'),
                    ('EARNING_CORRECTION', 'Earning correction'),
                    ('DEDUCTION_CORRECTION', 'Deduction correction'),
                    ('REIMBURSEMENT', 'Reimbursement'),
                    ('OTHER', 'Other adjustment'),
                ], default='OTHER', max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='payrollrunadjustment',
            name='taxable',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='payrollrunadjustment',
            name='reference_period_start',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='payrollrunadjustment',
            name='reference_period_end',
            field=models.DateField(blank=True, null=True),
        ),
    ]
