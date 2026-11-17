# from django.db import migrations


# def remove_sso_managed_roles(apps, schema_editor):
#     Role = apps.get_model('HRMSapp', 'Role')
#     UserAccount = apps.get_model('HRMSapp', 'UserAccount')

#     # These rows are the former SSO role mirror. They must not survive as
#     # HRMS authorization roles after ownership moves to HRMS.
#     Role.objects.filter(sso_managed=True).delete()

#     default_role, _ = Role.objects.get_or_create(
#         code='employee',
#         defaults={
#             'role_name': 'EMPLOYEE',
#             'description': 'Default HRMS employee role.',
#             'level': 10,
#             'is_active': True,
#             'sso_managed': False,
#         },
#     )
#     for user in UserAccount.objects.filter(sso_user_id__isnull=False):
#         if not user.roles.exists() and default_role.is_active:
#             user.roles.add(default_role)


# class Migration(migrations.Migration):
#     dependencies = [('HRMSapp', '0038_role_sso_managed')]

#     operations = [migrations.RunPython(remove_sso_managed_roles, migrations.RunPython.noop)]


from django.db import migrations


def remove_sso_managed_roles(apps, schema_editor):
    Role = apps.get_model('HRMSapp', 'Role')
    UserAccount = apps.get_model('HRMSapp', 'UserAccount')
    database = schema_editor.connection.alias
    roles = Role.objects.using(database)

    # These rows are the former SSO role mirror. They must not survive as
    # HRMS authorization roles after ownership moves to HRMS.
    roles.filter(sso_managed=True).delete()

    default_role = roles.filter(code='employee').first()

    if default_role is None:
        default_role = roles.filter(role_name='EMPLOYEE').first()

        if default_role is None:
            default_role = roles.create(
                role_name='EMPLOYEE',
                code='employee',
                description='Default HRMS employee role.',
                level=10,
                is_active=True,
                sso_managed=False,
            )
        else:
            # Keep the existing row so its ID and user assignments are preserved.
            default_role.code = 'employee'
            default_role.description = 'Default HRMS employee role.'
            default_role.level = 10
            default_role.is_active = True
            default_role.sso_managed = False
            default_role.save(
                using=database,
                update_fields=[
                    'code',
                    'description',
                    'level',
                    'is_active',
                    'sso_managed',
                ],
            )

    users = UserAccount.objects.using(database).filter(
        sso_user_id__isnull=False,
    )
    for user in users:
        if not user.roles.exists() and default_role.is_active:
            user.roles.add(default_role)


class Migration(migrations.Migration):
    dependencies = [('HRMSapp', '0038_role_sso_managed')]

    operations = [
        migrations.RunPython(
            remove_sso_managed_roles,
            migrations.RunPython.noop,
        )
    ]