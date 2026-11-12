from django.db import migrations


STANDARD_ROLES = (
    ('SYSTEM_ADMIN', 'system_admin', 'System administrator', 100),
    ('HR_ADMIN', 'hr_admin', 'HR administrator', 80),
    ('HOD', 'hod', 'Head of department', 70),
    ('MANAGER', 'manager', 'People manager', 60),
    ('REPORTING_MANAGER', 'reporting_manager', 'Reporting manager', 55),
    ('EMPLOYEE', 'employee', 'Standard employee self-service access', 10),
)


def seed_standard_roles(apps, schema_editor):
    Role = apps.get_model('HRMSapp', 'Role')
    for role_name, code, description, level in STANDARD_ROLES:
        Role.objects.get_or_create(
            role_name=role_name,
            defaults={
                'code': code,
                'description': description,
                'level': level,
                'is_active': True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [('HRMSapp', '0035_approvalworkflow_payslip_module')]

    operations = [migrations.RunPython(seed_standard_roles, migrations.RunPython.noop)]
