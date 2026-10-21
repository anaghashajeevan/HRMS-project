from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payrollapp', '0006_payrollrunapprovalaction'),
    ]

    operations = [
        migrations.AddField(
            model_name='paymentbatch',
            name='payment_mode',
            field=models.CharField(default='NEFT', max_length=20),
        ),
    ]
