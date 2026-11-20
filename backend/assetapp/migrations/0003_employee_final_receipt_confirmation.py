from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('assetapp', '0002_receipt_confirmation_and_photos'),
    ]

    operations = [
        migrations.AddField(
            model_name='assetallocation',
            name='final_employee_response_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='assetallocation',
            name='final_employee_response_note',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='assetallocation',
            name='receipt_status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Awaiting Employee Response'),
                    ('ACCEPTED', 'Receipt Confirmed'),
                    ('FLAGGED', 'Raised for Management Review'),
                    ('AWAITING_EMPLOYEE_CONFIRMATION', 'Awaiting Final Employee Confirmation'),
                    ('AUTO_ACCEPTED', 'Auto-Accepted After Timeout'),
                    ('REVIEW_CONFIRMED', 'Management Confirmed Receipt'),
                    ('REVIEW_NOT_RECEIVED', 'Management Confirmed Not Received'),
                ],
                default='PENDING',
                max_length=40,
            ),
        ),
    ]
