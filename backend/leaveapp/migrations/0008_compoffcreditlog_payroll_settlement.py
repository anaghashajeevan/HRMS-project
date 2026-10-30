from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('leaveapp', '0007_fixed_salary_encashment_basis'),
    ]

    operations = [
        migrations.AddField(
            model_name='compoffcreditlog',
            name='paid_in_payroll_run_id',
            field=models.CharField(blank=True, default='', max_length=36),
        ),
        migrations.AddField(
            model_name='compoffcreditlog',
            name='paid_comp_off_days',
            field=models.DecimalField(decimal_places=1, default=0, max_digits=4),
        ),
        migrations.AddField(
            model_name='compoffcreditlog',
            name='paid_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
