import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('HRMSapp', '0035_approvalworkflow_payslip_module'),
        ('payrollapp', '0007_paymentbatch_payment_mode'),
    ]

    operations = [
        migrations.CreateModel(
            name='PayslipRequestApprovalAction',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('step_number', models.PositiveSmallIntegerField()),
                ('step_name', models.CharField(max_length=100)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected'), ('CANCELLED', 'Cancelled')], default='PENDING', max_length=12)),
                ('comments', models.TextField(blank=True)),
                ('acted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('acted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payslip_approvals_acted', to='HRMSapp.employee')),
                ('assigned_to', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='payslip_approvals_assigned', to='HRMSapp.employee')),
                ('request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='approval_actions', to='payrollapp.paysliprequest')),
                ('workflow', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payslip_approval_actions', to='HRMSapp.approvalworkflow')),
            ],
            options={
                'db_table': 'payroll_payslip_approval_actions',
                'ordering': ['step_number', 'created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='paysliprequestapprovalaction',
            constraint=models.UniqueConstraint(fields=('request', 'step_number', 'assigned_to'), name='unique_payslip_request_step_approver'),
        ),
    ]
