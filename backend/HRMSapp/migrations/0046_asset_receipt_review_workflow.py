from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('HRMSapp', '0045_monthlykra_external_source_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='approvalworkflow',
            name='module',
            field=models.CharField(choices=[('LIFECYCLE', 'Lifecycle Change'), ('LEAVE', 'Leave Application'), ('POLICY', 'Policy Approval'), ('CALENDAR', 'Annual Calendar'), ('PAYROLL', 'Payroll Run'), ('PAYSLIP', 'Payslip Request'), ('EXIT', 'Employee Exit'), ('RECRUITMENT', 'Hiring Requisition'), ('RECRUITMENT_OFFER', 'Recruitment Offer'), ('ASSET_RECEIPT_REVIEW', 'Asset Receipt Flag Review')], max_length=30),
        ),
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(choices=[('APPROVAL_REQUEST', 'Approval Request'), ('APPROVAL_APPROVED', 'Request Approved'), ('APPROVAL_REJECTED', 'Request Rejected'), ('LETTER_GENERATED', 'Letter Generated'), ('SYSTEM', 'System Notification'), ('ASSET_ALLOCATED', 'Asset Allocated'), ('ASSET_RETURNED', 'Asset Returned'), ('ASSET_RECEIPT_REVIEW', 'Asset Receipt Review'), ('EMPLOYEE_ID_CHANGED', 'Employee ID Changed'), ('EMPLOYMENT_STATUS_CHANGED', 'Employment Status Changed')], max_length=30),
        ),
    ]
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('HRMSapp', '0045_monthlykra_external_source_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='approvalworkflow',
            name='module',
            field=models.CharField(choices=[
                ('LIFECYCLE', 'Lifecycle Change'), ('LEAVE', 'Leave Application'),
                ('POLICY', 'Policy Approval'), ('CALENDAR', 'Annual Calendar'),
                ('PAYROLL', 'Payroll Run'), ('PAYSLIP', 'Payslip Request'),
                ('EXIT', 'Employee Exit'), ('RECRUITMENT', 'Hiring Requisition'),
                ('RECRUITMENT_OFFER', 'Recruitment Offer'),
                ('ASSET_RECEIPT_REVIEW', 'Asset Receipt Flag Review'),
            ], max_length=30),
        ),
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(choices=[
                ('APPROVAL_REQUEST', 'Approval Request'), ('APPROVAL_APPROVED', 'Request Approved'),
                ('APPROVAL_REJECTED', 'Request Rejected'), ('LETTER_GENERATED', 'Letter Generated'),
                ('SYSTEM', 'System Notification'), ('ASSET_ALLOCATED', 'Asset Allocated'),
                ('ASSET_RETURNED', 'Asset Returned'), ('ASSET_RECEIPT_REVIEW', 'Asset Receipt Review'),
                ('EMPLOYEE_ID_CHANGED', 'Employee ID Changed'),
                ('EMPLOYMENT_STATUS_CHANGED', 'Employment Status Changed'),
            ], max_length=30),
        ),
    ]
