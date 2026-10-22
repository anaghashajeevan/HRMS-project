from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payrollapp', '0008_paysliprequestapprovalaction'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeepayrollprofile',
            name='tax_resident',
            field=models.BooleanField(
                blank=True,
                default=None,
                help_text='Indian tax residency status for rebate eligibility. Unknown status does not apply resident-only rebate.',
                null=True,
            ),
        ),
    ]
