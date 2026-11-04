from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payrollapp', '0016_employeeexitdocument'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeesalaryassignment',
            name='increment_interval_months',
            field=models.PositiveSmallIntegerField(
                blank=True,
                default=12,
                help_text='Months between salary increment review reminders; measured from the employee joining date.',
                null=True,
            ),
        ),
    ]
