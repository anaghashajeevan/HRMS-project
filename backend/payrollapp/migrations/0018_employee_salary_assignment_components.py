import uuid

from django.db import migrations, models
import django.db.models.deletion


def copy_structure_components_to_assignments(apps, schema_editor):
    Assignment = apps.get_model('payrollapp', 'EmployeeSalaryAssignment')
    AssignmentComponent = apps.get_model('payrollapp', 'EmployeeSalaryAssignmentComponent')
    StructureComponent = apps.get_model('payrollapp', 'SalaryStructureComponent')
    database = schema_editor.connection.alias
    batch = []

    for assignment in Assignment.objects.using(database).iterator():
        source_rows = StructureComponent.objects.using(database).filter(
            structure_id=assignment.structure_id,
        ).values('component_id', 'amount', 'percentage_of_basic', 'is_enabled', 'display_order')
        for row in source_rows:
            batch.append(AssignmentComponent(
                id=uuid.uuid4(),
                assignment_id=assignment.pk,
                **row,
            ))
        if len(batch) >= 2000:
            AssignmentComponent.objects.using(database).bulk_create(batch, batch_size=1000)
            batch = []

    if batch:
        AssignmentComponent.objects.using(database).bulk_create(batch, batch_size=1000)


class Migration(migrations.Migration):

    dependencies = [
        ('payrollapp', '0017_salary_assignment_increment_interval'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployeeSalaryAssignmentComponent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('amount', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('percentage_of_basic', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('is_enabled', models.BooleanField(default=True)),
                ('display_order', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('assignment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='components', to='payrollapp.employeesalaryassignment')),
                ('component', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='payrollapp.salarycomponent')),
            ],
            options={
                'db_table': 'payroll_salary_assignment_components',
                'ordering': ['component__component_type', 'display_order', 'component__code'],
            },
        ),
        migrations.AddConstraint(
            model_name='employeesalaryassignmentcomponent',
            constraint=models.UniqueConstraint(fields=('assignment', 'component'), name='uniq_assignment_salary_component'),
        ),
        migrations.RunPython(copy_structure_components_to_assignments, migrations.RunPython.noop),
    ]
