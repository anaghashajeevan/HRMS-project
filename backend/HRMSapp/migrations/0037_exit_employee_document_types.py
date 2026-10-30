from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('HRMSapp', '0036_alter_approvalworkflow_module'),
    ]

    operations = [
        migrations.AlterField(
            model_name='employeedocument',
            name='document_type',
            field=models.CharField(
                choices=[
                    ('CONTRACT', 'Employment Contract'), ('OFFER_LETTER', 'Offer Letter'),
                    ('ID_PROOF', 'ID Proof'), ('ADDRESS_PROOF', 'Address Proof'),
                    ('EDUCATION', 'Education Certificate'), ('EXPERIENCE', 'Experience Certificate'),
                    ('RELIEVING_LETTER', 'Relieving Letter'),
                    ('FNF_STATEMENT', 'Full & Final Settlement Statement'),
                    ('PAN', 'PAN Card'), ('AADHAAR', 'Aadhaar Card'), ('PASSPORT', 'Passport'),
                    ('VISA', 'Visa'), ('WORK_PERMIT', 'Work Permit'), ('MEDICAL', 'Medical Certificate'),
                    ('LETTER_PROMOTION', 'Promotion Letter'), ('LETTER_TRANSFER', 'Transfer Letter'),
                    ('LETTER_REDESIGNATION', 'Re-designation Letter'),
                    ('LETTER_CONFIRMATION', 'Confirmation Letter'),
                    ('LETTER_MANAGER_CHANGE', 'Manager Change Letter'),
                    ('PERFORMANCE_LETTER', 'Performance Rating Letter'),
                    ('APPRAISAL_LETTER', 'Appraisal Letter'), ('PIP_LETTER', 'PIP Letter'), ('OTHER', 'Other'),
                ], default='OTHER', max_length=30,
            ),
        ),
    ]
