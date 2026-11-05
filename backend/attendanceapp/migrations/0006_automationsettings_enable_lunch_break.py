from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendanceapp", "0005_automationsettings_enable_employee_self_attendance_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="automationsettings",
            name="enable_lunch_break",
            field=models.BooleanField(default=True),
        ),
    ]
