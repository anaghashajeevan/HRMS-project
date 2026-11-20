import django.db.models.deletion
import django.utils.timezone
import uuid
from django.db import migrations, models


def mark_preexisting_allocations_acknowledged(apps, schema_editor):
    Allocation = apps.get_model('assetapp', 'AssetAllocation')
    Allocation.objects.all().update(receipt_status='ACCEPTED')


class Migration(migrations.Migration):
    dependencies = [
        ('assetapp', '0001_initial'),
        ('HRMSapp', '0045_monthlykra_external_source_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='assetcategory',
            name='employee_response_days',
            field=models.PositiveSmallIntegerField(default=10, help_text='Days the employee has to confirm receipt or raise a flag after allocation.'),
        ),
        migrations.AddField(
            model_name='assetallocation',
            name='receipt_status',
            field=models.CharField(choices=[('PENDING', 'Awaiting Employee Response'), ('ACCEPTED', 'Receipt Confirmed'), ('FLAGGED', 'Raised for Management Review'), ('AUTO_ACCEPTED', 'Auto-Accepted After Timeout'), ('REVIEW_CONFIRMED', 'Management Confirmed Receipt'), ('REVIEW_NOT_RECEIVED', 'Management Confirmed Not Received')], default='PENDING', max_length=24),
        ),
        migrations.RunPython(mark_preexisting_allocations_acknowledged, migrations.RunPython.noop),
        migrations.AddField(
            model_name='assetallocation',
            name='response_due_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='assetallocation',
            name='employee_response_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='assetallocation',
            name='employee_response_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='assetallocation',
            name='review_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='assetallocation',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='assetallocation',
            name='reviewed_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='asset_receipt_reviews', to='HRMSapp.employee'),
        ),
        migrations.AlterField(
            model_name='assetallocation',
            name='status',
            field=models.CharField(choices=[('ALLOCATED', 'Allocated'), ('NOT_RECEIVED', 'Not Received'), ('RETURNED', 'Returned'), ('DAMAGED', 'Damaged'), ('LOST', 'Lost / Stolen')], default='ALLOCATED', max_length=20),
        ),
        migrations.CreateModel(
            name='AssetPhoto',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('image', models.ImageField(upload_to='assets/gallery/%Y/%m/')),
                ('caption', models.CharField(blank=True, max_length=200)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('asset', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='photos', to='assetapp.asset')),
            ],
            options={'db_table': 'asset_photos', 'ordering': ['uploaded_at']},
        ),
    ]
