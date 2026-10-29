from django.db import migrations


STANDARD_ROLES = (
    ('SYSTEM_ADMIN', 'system_admin', 'Full HRMS administration.', 100),
    ('HR_ADMIN', 'hr_admin', 'HR administration.', 80),
    ('HOD', 'hod', 'Department administration.', 70),
    ('MANAGER', 'manager', 'People manager.', 60),
    ('REPORTING_MANAGER', 'reporting_manager', 'Reporting manager.', 55),
    ('EMPLOYEE', 'employee', 'Standard employee self-service access.', 10),
)


def seed_local_roles(apps, schema_editor):
    Role = apps.get_model('HRMSapp', 'Role')
    for role_name, code, description, level in STANDARD_ROLES:
        role, _ = Role.objects.get_or_create(
            code=code,
            defaults={
                'role_name': role_name,
                'description': description,
                'level': level,
                'is_active': True,
                'sso_managed': False,
            },
        )
        role.role_name = role_name
        role.description = description
        role.level = level
        role.is_active = True
        role.sso_managed = False
        role.save(update_fields=['role_name', 'description', 'level', 'is_active', 'sso_managed'])


class Migration(migrations.Migration):
    dependencies = [('HRMSapp', '0039_remove_sso_managed_roles')]

    operations = [migrations.RunPython(seed_local_roles, migrations.RunPython.noop)]
