from django.db import migrations


def sync_current_bank_profiles(apps, schema_editor):
    Employee = apps.get_model('HRMSapp', 'Employee')
    Profile = apps.get_model('payrollapp', 'EmployeePayrollProfile')
    alias = schema_editor.connection.alias

    profiles = Profile.objects.using(alias).filter(
        is_active=True, effective_to__isnull=True,
    ).select_related('employee').order_by('employee_id', '-effective_from')
    seen = set()
    for profile in profiles:
        if profile.employee_id in seen:
            continue
        seen.add(profile.employee_id)
        employee = Employee.objects.using(alias).get(pk=profile.employee_id)

        # Prefer values already collected on the employee record. For older
        # payroll-only profiles, migrate missing values onto the employee.
        employee.bank_name = employee.bank_name or profile.bank_name or ''
        employee.bank_account_holder_name = (
            employee.bank_account_holder_name or profile.account_holder_name or ''
        )
        employee.bank_account_encrypted = (
            employee.bank_account_encrypted or profile.bank_account or ''
        )
        employee.bank_ifsc_code = employee.bank_ifsc_code or profile.ifsc_code or ''
        employee.save(update_fields=[
            'bank_name', 'bank_account_holder_name',
            'bank_account_encrypted', 'bank_ifsc_code',
        ])

        # Keep the current payroll profile in sync with the chosen canonical
        # employee record. Older, closed profiles remain unchanged as history.
        profile.bank_name = employee.bank_name or ''
        profile.account_holder_name = employee.bank_account_holder_name or ''
        profile.bank_account = employee.bank_account_encrypted or ''
        profile.ifsc_code = employee.bank_ifsc_code or ''
        profile.save(update_fields=[
            'bank_name', 'account_holder_name', 'bank_account', 'ifsc_code',
        ])

    for employee in Employee.objects.using(alias).filter(is_deleted=False).iterator():
        if employee.pk in seen:
            continue
        latest = Profile.objects.using(alias).filter(
            employee_id=employee.pk,
        ).order_by('-effective_from').first()
        if latest:
            employee.bank_name = employee.bank_name or latest.bank_name or ''
            employee.bank_account_holder_name = (
                employee.bank_account_holder_name or latest.account_holder_name or ''
            )
            employee.bank_account_encrypted = (
                employee.bank_account_encrypted or latest.bank_account or ''
            )
            employee.bank_ifsc_code = employee.bank_ifsc_code or latest.ifsc_code or ''
            employee.save(update_fields=[
                'bank_name', 'bank_account_holder_name',
                'bank_account_encrypted', 'bank_ifsc_code',
            ])
        Profile.objects.using(alias).create(
            employee_id=employee.pk,
            bank_name=employee.bank_name or '',
            account_holder_name=employee.bank_account_holder_name or '',
            bank_account=employee.bank_account_encrypted or '',
            ifsc_code=employee.bank_ifsc_code or '',
            pan=employee.pan_number_encrypted or '',
            uan=employee.uan_number_encrypted or '',
            effective_from=employee.date_of_joining,
            is_active=True,
        )


class Migration(migrations.Migration):
    dependencies = [
        ('HRMSapp', '0033_employee_bank_account_holder_name_employee_bank_name'),
        ('payrollapp', '0003_employeesalaryassignment_fixed_salary_monthly'),
    ]

    operations = [
        migrations.RunPython(sync_current_bank_profiles, migrations.RunPython.noop),
    ]
