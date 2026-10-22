from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payrollapp', '0010_offcycle_adjustment_metadata'),
    ]

    operations = [
        migrations.AddField(
            model_name='payrollrun',
            name='payment_date',
            field=models.DateField(
                blank=True, help_text='Expected or actual disbursement date. For off-cycle runs, this determines the TDS tax month and financial year; the pay calendar remains the reference period.', null=True,
            ),
        ),
    ]
