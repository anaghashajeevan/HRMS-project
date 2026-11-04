from django.db import migrations, models


def migrate_resignation_statuses(apps, schema_editor):
    Employee = apps.get_model('HRMSapp', 'Employee')
    ExitRequest = apps.get_model('payrollapp', 'EmployeeExitRequest')
    database = schema_editor.connection.alias

    paid_exit_employee_ids = list(
        ExitRequest.objects.using(database).filter(
            status='APPROVED',
            fnf_runs__run_type='FNF',
            fnf_runs__status='PAID',
        ).values_list('employee_id', flat=True).distinct()
    )
    Employee.objects.using(database).filter(
        pk__in=paid_exit_employee_ids,
        status='TERMINATED',
    ).update(status='INACTIVE')

    unpaid_approved_employee_ids = ExitRequest.objects.using(database).filter(
        status='APPROVED',
    ).exclude(
        employee_id__in=paid_exit_employee_ids,
    ).values_list('employee_id', flat=True)
    Employee.objects.using(database).filter(
        pk__in=unpaid_approved_employee_ids,
        status__in=['ACTIVE', 'PROBATION'],
    ).update(status='NOTICE_PERIOD')


class Migration(migrations.Migration):
    dependencies = [
        ('HRMSapp', '0038_lettertemplate_payroll_notification_types'),
        ('payrollapp', '0017_salary_assignment_increment_interval'),
    ]

    operations = [
        migrations.AlterField(
            model_name='employee',
            name='status',
            field=models.CharField(
                choices=[
                    ('ACTIVE', 'Active'),
                    ('PROBATION', 'Probation'),
                    ('NOTICE_PERIOD', 'Notice Period'),
                    ('RELIEVED', 'Relieved'),
                    ('INACTIVE', 'Inactive'),
                    ('SUSPENDED', 'Suspended'),
                    ('TERMINATED', 'Terminated (Dismissed)'),
                ],
                default='PROBATION',
                max_length=15,
            ),
        ),
        migrations.RunPython(migrate_resignation_statuses, migrations.RunPython.noop),
    ]
