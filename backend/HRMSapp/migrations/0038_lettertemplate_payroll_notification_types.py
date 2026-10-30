from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('HRMSapp', '0037_exit_employee_document_types'),
    ]

    operations = [
        migrations.AlterField(
            model_name='lettertemplate',
            name='template_type',
            field=models.CharField(
                choices=[
                    ('PROMOTION', 'Promotion Letter'),
                    ('TRANSFER', 'Transfer Letter'),
                    ('REDESIGNATION', 'Re-designation Letter'),
                    ('CONFIRMATION', 'Confirmation Letter'),
                    ('MANAGER_CHANGE', 'Manager Change Letter'),
                    ('PERFORMANCE_RATING', 'Performance Rating Letter'),
                    ('APPRAISAL_LETTER', 'Appraisal Letter'),
                    ('PIP_LETTER', 'Performance Improvement Plan Letter'),
                    ('LEAVE_APPLICATION', 'Leave Application Letter'),
                    ('LEAVE_APPROVAL', 'Leave Approval Letter'),
                    ('ASSET_ALLOCATION', 'Asset Allocation Letter'),
                    ('ASSET_RETURN', 'Asset Return Letter'),
                    ('PROBATION_REMINDER', 'Probation Review Reminder'),
                    ('PROBATION_PERIOD_CHANGED', 'Probation Period Changed'),
                    ('EMPLOYMENT_STATUS_CHANGED', 'Employment Status Changed'),
                    ('EMPLOYEE_ID_CHANGED', 'Employee ID Changed'),
                    ('PAYROLL_APPROVAL_REQUEST', 'Payroll Approval Request Email'),
                    ('PAYROLL_RUN_APPROVED', 'Payroll Run Approved Email'),
                    ('PAYROLL_RUN_RETURNED', 'Payroll Run Returned Email'),
                    ('PAYROLL_RUN_PAID', 'Payroll Run Paid Email'),
                ],
                max_length=30,
            ),
        ),
    ]
