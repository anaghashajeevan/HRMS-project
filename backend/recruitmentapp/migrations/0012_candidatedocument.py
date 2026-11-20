# Generated manually for HR-managed offer-stage candidate documents.
import uuid

import django.db.models.deletion
import recruitmentapp.models
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('HRMSapp', '0046_asset_receipt_review_workflow'),
        ('recruitmentapp', '0011_remove_candidateofferapproval_unique_offer_approval_role_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CandidateDocument',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('document_type', models.CharField(choices=[('ID_PROOF', 'ID Proof'), ('ADDRESS_PROOF', 'Address Proof'), ('EDUCATION', 'Education Certificate'), ('EXPERIENCE', 'Experience Certificate'), ('PAN', 'PAN Card'), ('AADHAAR', 'Aadhaar Card'), ('PASSPORT', 'Passport'), ('MEDICAL', 'Medical Certificate'), ('OTHER', 'Other')], default='OTHER', max_length=30)),
                ('document_name', models.CharField(max_length=150)),
                ('file', models.FileField(upload_to=recruitmentapp.models.candidate_document_path, storage=recruitmentapp.models.PrivateResumeStorage())),
                ('original_filename', models.CharField(max_length=255)),
                ('file_size_kb', models.PositiveIntegerField(default=0)),
                ('mime_type', models.CharField(blank=True, max_length=100)),
                ('status', models.CharField(choices=[('RECEIVED', 'Received'), ('VERIFIED', 'Verified'), ('REJECTED', 'Needs replacement')], default='RECEIVED', max_length=12)),
                ('review_notes', models.TextField(blank=True)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('application', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='candidate_documents', to='recruitmentapp.candidateapplication')),
                ('candidate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='recruitmentapp.recruitmentcandidate')),
                ('employee_document', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='source_candidate_document', to='HRMSapp.employeedocument')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='candidate_documents_reviewed', to='HRMSapp.employee')),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='candidate_documents_uploaded', to='HRMSapp.employee')),
            ],
            options={'db_table': 'candidate_documents', 'ordering': ['-uploaded_at']},
        ),
    ]
