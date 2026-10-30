import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('HRMSapp', '0037_exit_employee_document_types'),
        ('payrollapp', '0015_employeeexitclearanceitem'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployeeExitDocument',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('document_type', models.CharField(choices=[('EXPERIENCE', 'Experience Certificate'), ('RELIEVING_LETTER', 'Relieving Letter'), ('FNF_STATEMENT', 'Full & Final Settlement Statement')], max_length=30)),
                ('issued_at', models.DateTimeField(auto_now_add=True)),
                ('download_count', models.PositiveIntegerField(default=0)),
                ('last_downloaded_at', models.DateTimeField(blank=True, null=True)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='exit_documents', to='HRMSapp.employee')),
                ('employee_document', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='exit_document_record', to='HRMSapp.employeedocument')),
                ('issued_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='HRMSapp.employee')),
                ('request', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='issued_documents', to='payrollapp.employeeexitrequest')),
            ],
            options={'db_table': 'payroll_employee_exit_documents', 'ordering': ['-issued_at']},
        ),
        migrations.AddConstraint(
            model_name='employeeexitdocument',
            constraint=models.UniqueConstraint(fields=('request', 'document_type'), name='unique_exit_document_type'),
        ),
    ]
