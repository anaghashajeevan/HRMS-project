import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('HRMSapp', '0036_alter_approvalworkflow_module'),
        ('payrollapp', '0014_arrears_workflow'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployeeExitClearanceItem',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('source_key', models.CharField(max_length=120)),
                ('category', models.CharField(choices=[('ASSET', 'Asset return'), ('REIMBURSEMENT', 'Reimbursement'), ('HANDOVER', 'Work handover'), ('OTHER', 'Other clearance')], max_length=20)),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('responsible_person', models.CharField(blank=True, max_length=150)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('COMPLETED', 'Completed'), ('WAIVED', 'Exception approved')], default='PENDING', max_length=20)),
                ('resolution_notes', models.TextField(blank=True)),
                ('exception_reason', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='HRMSapp.employee')),
                ('request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='clearance_items', to='payrollapp.employeeexitrequest')),
                ('resolved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='HRMSapp.employee')),
            ],
            options={'db_table': 'payroll_employee_exit_clearance_items', 'ordering': ['status', 'due_date', 'created_at']},
        ),
        migrations.AddConstraint(
            model_name='employeeexitclearanceitem',
            constraint=models.UniqueConstraint(fields=('request', 'source_key'), name='unique_exit_clearance_source'),
        ),
    ]
