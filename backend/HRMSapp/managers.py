# """
# Custom User Manager for UserAccount model.
# """
# from django.contrib.auth.models import BaseUserManager


# class UserAccountManager(BaseUserManager):
#     """Custom manager for UserAccount using EMAIL as unique identifier."""

#     def create_user(self, email, username, password=None, **extra_fields):
#         if not email:
#             raise ValueError('Email is required')
#         if not username:
#             raise ValueError('Username is required')

#         email = self.normalize_email(email)
#         user = self.model(email=email, username=username, **extra_fields)
#         user.set_password(password)
#         user.save(using=self._db)
#         return user

#     def create_superuser(self, email, username, password=None, **extra_fields):
#         extra_fields.setdefault('is_staff', True)
#         extra_fields.setdefault('is_superuser', True)
#         extra_fields.setdefault('is_active', True)

#         if extra_fields.get('is_staff') is not True:
#             raise ValueError('Superuser must have is_staff=True')
#         if extra_fields.get('is_superuser') is not True:
#             raise ValueError('Superuser must have is_superuser=True')

#         return self.create_user(email, username, password, **extra_fields)



"""
Custom User Manager for UserAccount model.
Automatically creates an Employee profile with employee_id 'NL001' 
and assigns SYSTEM_ADMIN role during createsuperuser.
"""
from django.contrib.auth.models import BaseUserManager


class UserAccountManager(BaseUserManager):
    """Custom manager for UserAccount using EMAIL as unique identifier."""

    def create_user(self, email, username, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        if not username:
            raise ValueError('Username is required')

        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True')

        # Local imports to avoid circular import issues
        from .models import Employee, Role

        # 1. Automatically create or fetch linked Employee record
        if 'employee' not in extra_fields or not extra_fields['employee']:
            # Set Employee ID to NL001 (or next available NLxxx sequence)
            emp_id = 'NL001'
            if Employee.objects.filter(employee_id=emp_id).exists():
                count = Employee.objects.filter(employee_id__startswith='NL').count() + 1
                emp_id = f"NL{count:03d}"
                while Employee.objects.filter(employee_id=emp_id).exists():
                    count += 1
                    emp_id = f"NL{count:03d}"

            employee, _ = Employee.objects.get_or_create(
                official_email=email,
                defaults={
                    'employee_id': emp_id,
                    'first_name': username.capitalize() if username else 'System',
                    'last_name': 'Admin',
                    'phone_number': '+910000000000',
                    'date_of_birth': '1990-01-01',
                    'date_of_joining': '2026-01-01',
                    'status': 'ACTIVE',
                }
            )
            extra_fields['employee'] = employee

        # 2. Create the UserAccount
        user = self.create_user(email, username, password, **extra_fields)

        # 3. Automatically assign SYSTEM_ADMIN role
        admin_role, _ = Role.objects.get_or_create(
            role_name='SYSTEM_ADMIN',
            defaults={'code': 'system_admin', 'level': 100, 'description': 'System Administrator'}
        )
        user.roles.add(admin_role)

        return user