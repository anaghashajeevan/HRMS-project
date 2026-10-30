"""
DRF serializers for payroll app.
Phase 2: Configuration, Assignment, Profile, Preview.
Phase 4+ will add Run, Payment, Payslip serializers.
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import date
import re
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    SalaryComponent, SalaryStructure, SalaryStructureComponent,
    StatutoryRule, PayCalendar, EmployeeSalaryAssignment,
    EmployeePayrollProfile, PayrollRun, PayrollRunEmployee,
    PayrollRunComponentDetail, PaymentBatch, PaymentBatchLine,
    PayslipRequest, PayslipRequestApprovalAction, PayrollAuditLog, ArrearsLog, PayrollRunAdjustment,
    PayrollRunApprovalAction,
    EmployeeExitRequest, EmployeeExitApprovalAction,
)


# ==============================================================================
# 1. SALARY COMPONENT
# ==============================================================================

class SalaryComponentSerializer(serializers.ModelSerializer):
    formula = serializers.CharField(max_length=500, required=False, allow_blank=True, allow_null=True)

    component_type_display = serializers.CharField(
        source='get_component_type_display', read_only=True,
    )

    class Meta:
        model = SalaryComponent
        fields = [
            'id', 'code', 'name', 'description',
            'component_type', 'component_type_display',
            'is_taxable', 'is_fixed', 'formula',
            'display_order', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'effective_to', 'created_at', 'updated_at']

    def validate_formula(self, value):
        # The database field is blankable but not nullable. Treat UI/import
        # placeholder values as an omitted formula, not as variable names.
        formula = (value or '').strip()
        if formula.lower() in {'blank', 'none', 'null'}:
            return ''
        if formula:
            from .services.formula_parser import FormulaError, FormulaParser
            try:
                FormulaParser().evaluate(formula, {
                    'basic': Decimal('100'),
                    'ctc': Decimal('1000'),
                    'gross': Decimal('1000'),
                    'hra': Decimal('10'),
                })
            except FormulaError as exc:
                raise serializers.ValidationError(str(exc))
        return formula


class SalaryComponentMiniSerializer(serializers.ModelSerializer):
    """Lightweight for dropdowns."""
    class Meta:
        model = SalaryComponent
        fields = ['id', 'code', 'name', 'component_type', 'is_fixed', 'is_taxable']


# ==============================================================================
# 2. SALARY STRUCTURE + COMPONENTS
# ==============================================================================

class SalaryStructureComponentSerializer(serializers.ModelSerializer):
    component_name = serializers.CharField(source='component.name', read_only=True)
    component_code = serializers.CharField(source='component.code', read_only=True)
    component_type = serializers.CharField(
        source='component.component_type', read_only=True,
    )

    class Meta:
        model = SalaryStructureComponent
        fields = [
            'id', 'structure', 'component',
            'component_name', 'component_code', 'component_type',
            'amount', 'percentage_of_basic', 'is_enabled',
            'display_order', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SalaryStructureListSerializer(serializers.ModelSerializer):
    component_count = serializers.SerializerMethodField()

    class Meta:
        model = SalaryStructure
        fields = [
            'id', 'name', 'description', 'version',
            'is_active', 'component_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_component_count(self, obj):
        return obj.components.filter(is_enabled=True).count()


class SalaryStructureDetailSerializer(serializers.ModelSerializer):
    components = SalaryStructureComponentSerializer(many=True, read_only=True)

    class Meta:
        model = SalaryStructure
        fields = [
            'id', 'name', 'description', 'version',
            'is_active', 'components',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SalaryStructureComponentCreateSerializer(serializers.ModelSerializer):
    """For creating/updating components within a structure."""
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True,
        default=Decimal('0'),
    )
    percentage_of_basic = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True,
        default=Decimal('0'),
    )

    class Meta:
        model = SalaryStructureComponent
        fields = [
            'component', 'amount', 'percentage_of_basic',
            'is_enabled', 'display_order',
        ]

    def validate_amount(self, value):
        return value if value is not None else Decimal('0')

    def validate_percentage_of_basic(self, value):
        return value if value is not None else Decimal('0')


class SalaryStructureCreateSerializer(serializers.ModelSerializer):
    """Create structure with nested components in one request."""
    components = SalaryStructureComponentCreateSerializer(many=True, required=False)

    class Meta:
        model = SalaryStructure
        fields = ['id', 'name', 'description', 'version', 'is_active', 'components']
        read_only_fields = ['id']

    def validate_components(self, components):
        component_ids = [row['component'].id for row in components]
        if len(component_ids) != len(set(component_ids)):
            raise serializers.ValidationError('A component can only be added once to a structure.')
        return components

    @transaction.atomic
    def create(self, validated_data):
        components_data = validated_data.pop('components', [])
        structure = SalaryStructure.objects.create(**validated_data)
        for comp_data in components_data:
            SalaryStructureComponent.objects.create(
                structure=structure, **comp_data,
            )
        return structure

    @transaction.atomic
    def update(self, instance, validated_data):
        components_data = validated_data.pop('components', None)
        instance.name = validated_data.get('name', instance.name)
        instance.description = validated_data.get('description', instance.description)
        instance.version = validated_data.get('version', instance.version)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save()

        if components_data is not None:
            # Replace all components
            instance.components.all().delete()
            for comp_data in components_data:
                SalaryStructureComponent.objects.create(
                    structure=instance, **comp_data,
                )
        return instance


# ==============================================================================
# 3. STATUTORY RULE
# ==============================================================================

class StatutoryRuleSerializer(serializers.ModelSerializer):
    threshold = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True,
        default=Decimal('0'),
    )
    slabs = serializers.JSONField(required=False, allow_null=True, default=list)
    statutory_type_display = serializers.CharField(
        source='get_statutory_type_display', read_only=True,
    )
    tax_regime_display = serializers.CharField(
        source='get_tax_regime_display', read_only=True,
    )
    approved_by_name = serializers.CharField(
        source='approved_by.full_name', read_only=True, default=None,
    )

    class Meta:
        model = StatutoryRule
        fields = [
            'id', 'statutory_type', 'statutory_type_display',
            'name', 'jurisdiction', 'tax_regime', 'tax_regime_display',
            'employee_rate', 'employer_rate',
            'employer_pension_rate',
            'wage_ceiling', 'threshold', 'min_employees',
            'slabs',
            'effective_from', 'effective_to',
            'approved_by', 'approved_by_name', 'approved_at',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'approved_at', 'created_at', 'updated_at']

    def validate_threshold(self, value):
        return value if value is not None else Decimal('0')

    def validate_slabs(self, value):
        return value if value is not None else []

    def validate(self, attrs):
        attrs = super().validate(attrs)
        statutory_type = attrs.get('statutory_type', getattr(self.instance, 'statutory_type', None))
        tax_regime = attrs.get('tax_regime', getattr(self.instance, 'tax_regime', 'ALL'))
        slabs = attrs.get('slabs', getattr(self.instance, 'slabs', []))
        if statutory_type == 'TDS':
            if tax_regime not in ('OLD', 'NEW'):
                raise serializers.ValidationError({'tax_regime': 'TDS rules must target OLD or NEW tax regime.'})
            if not isinstance(slabs, dict) or not isinstance(slabs.get('slabs'), list) or not slabs['slabs']:
                raise serializers.ValidationError({'slabs': 'TDS slabs must be an object with a non-empty slabs array.'})
            if any(not isinstance(slab, dict) for slab in slabs['slabs']):
                raise serializers.ValidationError({'slabs': 'Every TDS slab must be a JSON object.'})
            previous_max = None
            for index, slab in enumerate(sorted(slabs['slabs'], key=lambda item: item.get('min', 0))):
                if not isinstance(slab, dict) or 'min' not in slab or 'rate' not in slab:
                    raise serializers.ValidationError({'slabs': f'Slab {index + 1} needs min and rate.'})
                try:
                    lower = Decimal(str(slab['min']))
                    rate = Decimal(str(slab['rate']))
                    upper = Decimal(str(slab['max'])) if slab.get('max') is not None else None
                except Exception:
                    raise serializers.ValidationError({'slabs': f'Slab {index + 1} has invalid numeric values.'})
                if lower < 0 or rate < 0 or rate > 100 or (upper is not None and upper <= lower):
                    raise serializers.ValidationError({'slabs': f'Slab {index + 1} has an invalid range or rate.'})
                if previous_max is not None and lower < previous_max:
                    raise serializers.ValidationError({'slabs': 'TDS slabs cannot overlap.'})
                previous_max = upper
            for field in ('standard_deduction', 'cess_rate'):
                try:
                    if Decimal(str(slabs.get(field, 0))) < 0:
                        raise ValueError
                except Exception:
                    raise serializers.ValidationError({'slabs': f'{field} must be a non-negative number.'})
        return attrs


# ==============================================================================
# 4. PAY CALENDAR
# ==============================================================================

class PayCalendarSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source='get_status_display', read_only=True,
    )
    month_name = serializers.SerializerMethodField()

    class Meta:
        model = PayCalendar
        fields = [
            'id', 'year', 'month', 'month_name',
            'period_start', 'period_end', 'days_in_month',
            'saturday_is_working', 'cutoff_date', 'pay_date',
            'status', 'status_display',
            'input_locked_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'input_locked_at', 'created_at', 'updated_at']

    def get_month_name(self, obj):
        import calendar
        return calendar.month_name[obj.month]

    def validate(self, attrs):
        if attrs.get('period_start') and attrs.get('period_end'):
            if attrs['period_start'] >= attrs['period_end']:
                raise serializers.ValidationError({
                    'period_end': 'Period end must be after period start.'
                })
        return attrs


# ==============================================================================
# 5. EMPLOYEE SALARY ASSIGNMENT
# ==============================================================================

class EmployeeSalaryAssignmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source='employee.full_name', read_only=True,
    )
    employee_code = serializers.CharField(
        source='employee.employee_id', read_only=True,
    )
    structure_name = serializers.CharField(
        source='structure.name', read_only=True,
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True, default=None,
    )
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeSalaryAssignment
        fields = [
            'id', 'employee', 'employee_name', 'employee_code',
            'structure', 'structure_name',
            'ctc_annual', 'ctc_monthly', 'fixed_salary_monthly',
            'effective_from', 'effective_to',
            'is_current', 'reason',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_current(self, obj):
        return obj.effective_to is None


class EmployeeSalaryAssignmentCreateSerializer(serializers.ModelSerializer):
    """
    Create a new salary assignment.
    Overlap validation is handled in the view via AssignmentService.
    """

    class Meta:
        model = EmployeeSalaryAssignment
        fields = [
            'employee', 'structure',
            'ctc_annual', 'ctc_monthly', 'fixed_salary_monthly',
            'effective_from', 'effective_to',
            'reason',
        ]
        extra_kwargs = {
            'ctc_monthly': {'required': False},
            'effective_from': {'required': False},
            # Fixed gross is derived by the server from the selected structure;
            # never trust a cached or client-edited preview value.
            'fixed_salary_monthly': {'read_only': True},
        }

    def validate_employee(self, employee):
        if employee.is_deleted:
            raise serializers.ValidationError('Cannot assign salary to a deleted employee.')
        return employee

    def validate(self, attrs):
        employee = attrs['employee']
        # If a client omits the date, default the assignment start to the
        # employee's joining date. Clients may still send an edited date.
        attrs.setdefault('effective_from', employee.date_of_joining)
        if attrs['ctc_annual'] <= 0:
            raise serializers.ValidationError({
                'ctc_annual': 'CTC must be greater than zero.'
            })
        expected_monthly = (attrs['ctc_annual'] / Decimal('12')).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP,
        )
        supplied_monthly = attrs.get('ctc_monthly')
        if supplied_monthly is not None and abs(supplied_monthly - expected_monthly) > Decimal('0.01'):
            raise serializers.ValidationError({
                'ctc_monthly': 'Monthly CTC must equal annual CTC divided by 12.'
            })
        attrs['ctc_monthly'] = expected_monthly
        fixed_salary = attrs.get('fixed_salary_monthly')
        if fixed_salary is not None and fixed_salary <= 0:
            raise serializers.ValidationError({
                'fixed_salary_monthly': 'Fixed monthly salary must be greater than zero.'
            })
        if attrs.get('effective_to') and attrs['effective_from'] >= attrs['effective_to']:
            raise serializers.ValidationError({
                'effective_to': 'Effective-to must be after effective-from.'
            })
        return attrs


# ==============================================================================
# 6. EMPLOYEE PAYROLL PROFILE (Bank + Statutory IDs)
# ==============================================================================

class EmployeePayrollProfileSerializer(serializers.ModelSerializer):
    """
    Full detail serializer. Bank account is masked in list views.
    django_cryptography handles encryption transparently.
    """
    employee_name = serializers.CharField(
        source='employee.full_name', read_only=True,
    )
    employee_code = serializers.CharField(
        source='employee.employee_id', read_only=True,
    )
    masked_account = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = EmployeePayrollProfile
        fields = [
            'id', 'employee', 'employee_name', 'employee_code',
            'bank_name', 'account_holder_name',
            'bank_account', 'masked_account', 'ifsc_code',
            'uan', 'pf_number', 'esi_number', 'pan',
            'tax_regime', 'tax_resident',
            'effective_from', 'effective_to',
            'is_current', 'is_active',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'bank_account': {'write_only': True},
            'uan': {'write_only': True},
            'pf_number': {'write_only': True},
            'esi_number': {'write_only': True},
            'pan': {'write_only': True},
            'effective_from': {'required': False},
        }

    def get_masked_account(self, obj):
        account = (
            obj.employee.bank_account_encrypted or obj.bank_account
            if obj.effective_to is None and obj.is_active
            else obj.bank_account
        )
        if account:
            acct = str(account)
            if len(acct) >= 4:
                return f"XXXX XXXX {acct[-4:]}"
            return "XXXX"
        return ""

    def get_is_current(self, obj):
        return obj.effective_to is None and obj.is_active

    def validate_effective_from(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError(
                'Future-dated bank profile changes are not supported; use today or an earlier effective date.'
            )
        return value

    def validate_ifsc_code(self, value):
        value = (value or '').strip().upper()
        if value and len(value) != 11:
            raise serializers.ValidationError('IFSC must contain exactly 11 characters.')
        if value and not re.fullmatch(r'[A-Z]{4}0[A-Z0-9]{6}', value):
            raise serializers.ValidationError('IFSC must have 4 letters, then 0, then 6 letters or digits (example: ABCD0123456).')
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.effective_to is None and instance.is_active:
            data['bank_name'] = instance.employee.bank_name or instance.bank_name
            data['account_holder_name'] = instance.employee.bank_account_holder_name or instance.account_holder_name
            data['ifsc_code'] = instance.employee.bank_ifsc_code or instance.ifsc_code
        return data

    @transaction.atomic
    def create(self, validated_data):
        employee = validated_data['employee']
        if EmployeePayrollProfile.objects.filter(
            employee=employee, is_active=True, effective_to__isnull=True,
        ).exists():
            raise serializers.ValidationError({
                'employee': 'This employee already has a current payroll profile. Edit that profile to change bank details.'
            })
        validated_data.setdefault('effective_from', timezone.localdate())
        # The Employee record is the canonical current bank record. Keep the
        # profile copy synchronized for existing consumers and payment runs.
        for field, employee_field in (
            ('bank_name', 'bank_name'),
            ('account_holder_name', 'bank_account_holder_name'),
            ('bank_account', 'bank_account_encrypted'),
            ('ifsc_code', 'bank_ifsc_code'),
        ):
            if field not in validated_data:
                validated_data[field] = getattr(employee, employee_field) or ''
        profile = super().create(validated_data)
        self._sync_employee_bank(profile, validated_data)
        return profile

    @transaction.atomic
    def update(self, instance, validated_data):
        if instance.effective_to is not None or not instance.is_active:
            raise serializers.ValidationError('Historical payroll profiles cannot be edited.')
        if validated_data.get('employee', instance.employee) != instance.employee:
            raise serializers.ValidationError({'employee': 'A profile cannot be moved to another employee.'})

        employee = instance.employee
        for profile_field, employee_field in (
            ('bank_name', 'bank_name'),
            ('account_holder_name', 'bank_account_holder_name'),
            ('bank_account', 'bank_account_encrypted'),
            ('ifsc_code', 'bank_ifsc_code'),
        ):
            validated_data.setdefault(profile_field, getattr(employee, employee_field) or '')

        effective_from = validated_data.get('effective_from', timezone.localdate())
        if effective_from < instance.effective_from:
            raise serializers.ValidationError({
                'effective_from': 'A new profile version must start on or after the current version.'
            })

        if effective_from > instance.effective_from:
            old_effective_to = date.fromordinal(effective_from.toordinal() - 1)
            instance.effective_to = old_effective_to
            instance.is_active = False
            instance.save(update_fields=['effective_to', 'is_active', 'updated_at'])

            version_values = {
                'employee': instance.employee,
                'bank_name': instance.bank_name,
                'account_holder_name': instance.account_holder_name,
                'bank_account': instance.bank_account,
                'ifsc_code': instance.ifsc_code,
                'uan': instance.uan,
                'pf_number': instance.pf_number,
                'esi_number': instance.esi_number,
                'pan': instance.pan,
                'tax_regime': instance.tax_regime,
                'effective_from': effective_from,
                'effective_to': None,
                'is_active': True,
                'created_by': getattr(self.context.get('request').user, 'employee', None)
                if self.context.get('request') else instance.created_by,
            }
            version_values.update(validated_data)
            version_values['employee'] = instance.employee
            version_values['effective_to'] = None
            version_values['is_active'] = validated_data.get('is_active', True)
            profile = EmployeePayrollProfile.objects.create(**version_values)
        else:
            profile = super().update(instance, validated_data)
        self._sync_employee_bank(profile, validated_data)
        return profile

    @staticmethod
    def _sync_employee_bank(profile, submitted):
        employee = profile.employee
        mapping = {
            'bank_name': 'bank_name',
            'account_holder_name': 'bank_account_holder_name',
            'bank_account': 'bank_account_encrypted',
            'ifsc_code': 'bank_ifsc_code',
        }
        changed = []
        for profile_field, employee_field in mapping.items():
            if profile_field in submitted:
                setattr(employee, employee_field, getattr(profile, profile_field) or '')
                changed.append(employee_field)
        if changed:
            employee.save(update_fields=changed + ['updated_at'])


class EmployeePayrollProfileListSerializer(serializers.ModelSerializer):
    """List view: sensitive fields masked."""
    employee_name = serializers.CharField(
        source='employee.full_name', read_only=True,
    )
    employee_code = serializers.CharField(
        source='employee.employee_id', read_only=True,
    )
    masked_account = serializers.SerializerMethodField()
    bank_name = serializers.SerializerMethodField()
    account_holder_name = serializers.SerializerMethodField()
    ifsc_code = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = EmployeePayrollProfile
        fields = [
            'id', 'employee', 'employee_name', 'employee_code',
            'bank_name', 'account_holder_name', 'masked_account', 'ifsc_code',
            'tax_regime', 'tax_resident', 'effective_from', 'effective_to',
            'is_active', 'is_current', 'created_at',
        ]

    def get_bank_name(self, obj):
        return (obj.employee.bank_name or obj.bank_name) if obj.effective_to is None and obj.is_active else obj.bank_name

    def get_account_holder_name(self, obj):
        return (obj.employee.bank_account_holder_name or obj.account_holder_name) if obj.effective_to is None and obj.is_active else obj.account_holder_name

    def get_ifsc_code(self, obj):
        return (obj.employee.bank_ifsc_code or obj.ifsc_code) if obj.effective_to is None and obj.is_active else obj.ifsc_code

    def get_is_current(self, obj):
        return obj.effective_to is None and obj.is_active

    def get_masked_account(self, obj):
        account = (
            obj.employee.bank_account_encrypted or obj.bank_account
            if obj.effective_to is None and obj.is_active
            else obj.bank_account
        )
        if account:
            acct = str(account)
            if len(acct) >= 4:
                return f"XXXX XXXX {acct[-4:]}"
            return "XXXX"
        return ""


# ==============================================================================
# 7. PAYROLL RUN (Read-only for Phase 2, full CRUD in Phase 4)
# ==============================================================================

class PayrollRunListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source='get_status_display', read_only=True,
    )
    run_type_display = serializers.CharField(
        source='get_run_type_display', read_only=True,
    )
    calendar_label = serializers.CharField(
        source='pay_calendar.__str__', read_only=True,
    )
    prepared_by_name = serializers.CharField(
        source='prepared_by.full_name', read_only=True, default=None,
    )
    approved_by_name = serializers.CharField(
        source='approved_by.full_name', read_only=True, default=None,
    )

    class Meta:
        model = PayrollRun
        fields = [
            'id', 'pay_calendar', 'calendar_label',
            'run_type', 'run_type_display',
            'status', 'status_display',
            'total_employees', 'total_gross',
            'total_deductions', 'total_net',
            'prepared_by', 'prepared_by_name',
            'approved_by', 'approved_by_name',
            'created_at',
        ]


# ==============================================================================
# 8. PREVIEW BREAKDOWN (For salary assignment preview)
# ==============================================================================

class PreviewBreakdownSerializer(serializers.Serializer):
    """Accept both the legacy monthly and the frontend annual CTC payload."""
    employee = serializers.UUIDField(required=False)
    structure = serializers.UUIDField(required=False)
    structure_id = serializers.UUIDField(required=False)
    ctc_monthly = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    ctc_annual = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    effective_from = serializers.DateField(required=False)

    def validate(self, attrs):
        structure_id = attrs.get('structure') or attrs.get('structure_id')
        if not structure_id:
            raise serializers.ValidationError({'structure_id': 'This field is required.'})

        monthly = attrs.get('ctc_monthly')
        annual = attrs.get('ctc_annual')
        if monthly is None and annual is None:
            raise serializers.ValidationError({'ctc_annual': 'Provide ctc_annual or ctc_monthly.'})
        if monthly is None:
            monthly = (annual / Decimal('12')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if monthly <= 0:
            raise serializers.ValidationError({'ctc_monthly': 'CTC must be greater than zero.'})

        attrs['structure'] = structure_id
        attrs['ctc_monthly'] = monthly
        attrs['ctc_annual'] = annual if annual is not None else monthly * Decimal('12')
        return attrs


# ──────────────────────────────────────────────────────────────
# Phase 4 — Pay Run serializers
# ──────────────────────────────────────────────────────────────

class PayrollRunListSerializer(serializers.ModelSerializer):
    pay_calendar_display = serializers.SerializerMethodField()
    prepared_by_name = serializers.SerializerMethodField()
    employee_count = serializers.SerializerMethodField()
    totals = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = [
            'id', 'pay_calendar', 'pay_calendar_display', 'run_type', 'payment_date',
            'exit_request',
            'status', 'formula_version', 'totals',
            'prepared_by', 'prepared_by_name',
            'approved_by', 'finalized_by',
            'employee_count', 'created_at',
        ]

    def get_pay_calendar_display(self, obj):
        c = obj.pay_calendar
        months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return f'{months[c.month]} {c.year}'

    def get_prepared_by_name(self, obj):
        return obj.prepared_by.full_name if obj.prepared_by else None

    def get_employee_count(self, obj):
        return obj.employees.exclude(status='EXCLUDED').count()

    def get_totals(self, obj):
        return {
            'total_gross_pay': str(obj.total_gross),
            'total_deductions': str(obj.total_deductions),
            'total_reimbursements': str(obj.total_reimbursements),
            'total_net_pay': str(obj.total_net),
            'total_employer_cost': str(obj.total_employer_cost),
            'total_ctc': str(obj.total_ctc),
        }


class PayrollRunDetailSerializer(serializers.ModelSerializer):
    pay_calendar_display = serializers.SerializerMethodField()
    pay_calendar = PayCalendarSerializer(read_only=True)
    prepared_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    finalized_by_name = serializers.SerializerMethodField()
    employee_count = serializers.SerializerMethodField()
    totals = serializers.SerializerMethodField()
    approval_actions = serializers.SerializerMethodField()
    can_current_user_approve = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = [
            'id', 'pay_calendar', 'pay_calendar_display', 'run_type', 'payment_date',
            'exit_request',
            'status', 'formula_version', 'totals',
            'prepared_by', 'prepared_by_name',
            'approved_by', 'approved_by_name',
            'finalized_by', 'finalized_by_name',
            'returned_by', 'return_reason',
            'approval_actions', 'can_current_user_approve',
            'employee_count',
            'created_at', 'input_locked_at', 'calculation_completed_at',
            'approved_at', 'finalized_at',
            'paid_at', 'reversed_at',
        ]

    def get_pay_calendar_display(self, obj):
        c = obj.pay_calendar
        months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return f'{months[c.month]} {c.year}'

    def get_prepared_by_name(self, obj):
        return obj.prepared_by.full_name if obj.prepared_by else None

    def get_approved_by_name(self, obj):
        return obj.approved_by.full_name if obj.approved_by else None

    def get_finalized_by_name(self, obj):
        return obj.finalized_by.full_name if obj.finalized_by else None

    def get_employee_count(self, obj):
        return obj.employees.exclude(status='EXCLUDED').count()

    def get_totals(self, obj):
        return {
            'total_gross_pay': str(obj.total_gross),
            'total_deductions': str(obj.total_deductions),
            'total_reimbursements': str(obj.total_reimbursements),
            'total_net_pay': str(obj.total_net),
            'total_employer_cost': str(obj.total_employer_cost),
            'total_ctc': str(obj.total_ctc),
        }

    def get_approval_actions(self, obj):
        actions = obj.approval_actions.select_related('assigned_to', 'acted_by').all()
        return [{
            'id': str(action.id),
            'cycle': action.cycle,
            'step_number': action.step_number,
            'step_name': action.step_name,
            'assigned_to': str(action.assigned_to_id),
            'assigned_to_name': action.assigned_to.full_name,
            'status': action.status,
            'acted_by_name': action.acted_by.full_name if action.acted_by else None,
            'acted_at': action.acted_at,
            'comments': action.comments,
        } for action in actions]

    def get_can_current_user_approve(self, obj):
        request = self.context.get('request')
        employee = getattr(getattr(request, 'user', None), 'employee', None)
        if not employee or obj.status != 'UNDER_REVIEW':
            return False
        latest_cycle = obj.approval_actions.order_by('-cycle').values_list('cycle', flat=True).first()
        if not latest_cycle:
            return bool(request and (
                request.user.has_role('HR_ADMIN') or request.user.has_role('SYSTEM_ADMIN')
            ))
        current_step = obj.approval_actions.filter(
            cycle=latest_cycle, status='PENDING',
        ).order_by('step_number').values_list('step_number', flat=True).first()
        return bool(current_step is not None and obj.approval_actions.filter(
            cycle=latest_cycle, step_number=current_step,
            assigned_to=employee, status='PENDING',
        ).exists())


class RunComponentDetailSerializer(serializers.ModelSerializer):
    component_name = serializers.SerializerMethodField()
    component_code = serializers.SerializerMethodField()
    component_is_taxable = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRunComponentDetail
        fields = [
            'id', 'component', 'component_name', 'component_code', 'component_is_taxable',
            'amount', 'is_earning', 'is_employer_cost',
            'is_reimbursement', 'formula_used', 'rule_reference',
        ]

    def get_component_name(self, obj):
        return obj.component.name if obj.component_id else obj.component_label or 'Adjustment'

    def get_component_code(self, obj):
        return obj.component.code if obj.component_id else None

    def get_component_is_taxable(self, obj):
        return obj.component.is_taxable if obj.component_id else False


class PayrollRunEmployeeListSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRunEmployee
        fields = [
            'id', 'employee', 'employee_name', 'employee_code',
            'eligible_calendar_days', 'days_in_month', 'salary_divisor_days', 'payable_days',
            'lop_days', 'paid_leave_days',
            'gross_pay', 'total_earnings', 'total_deductions',
            'total_reimbursements', 'total_employer_cost', 'total_ctc', 'net_pay',
            'status', 'error_message',
        ]

    def get_employee_name(self, obj):
        e = obj.employee
        return f'{e.first_name} {e.last_name}' if e else None

    def get_employee_code(self, obj):
        return obj.employee.employee_id if obj.employee else None


class PayrollRunEmployeeDetailSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    salary_assignment_details = serializers.SerializerMethodField()
    component_details = RunComponentDetailSerializer(many=True, read_only=True)

    class Meta:
        model = PayrollRunEmployee
        fields = [
            'id', 'employee', 'employee_name', 'employee_code',
            'salary_assignment', 'salary_assignment_details',
            'eligible_calendar_days', 'days_in_month', 'salary_divisor_days', 'payable_days',
            'lop_days', 'paid_leave_days',
            'gross_pay', 'total_earnings', 'total_deductions',
            'total_reimbursements', 'total_employer_cost', 'total_ctc', 'net_pay',
            'input_snapshot', 'component_details', 'status', 'error_message',
        ]

    def get_employee_name(self, obj):
        e = obj.employee
        return f'{e.first_name} {e.last_name}' if e else None

    def get_employee_code(self, obj):
        return obj.employee.employee_id if obj.employee else None

    def get_salary_assignment_details(self, obj):
        assignment = obj.salary_assignment
        if not assignment:
            return None
        return {
            'structure_name': assignment.structure.name,
            'ctc_annual': str(assignment.ctc_annual),
            'ctc_monthly': str(assignment.ctc_monthly),
            'fixed_salary_monthly': (
                str(assignment.fixed_salary_monthly)
                if assignment.fixed_salary_monthly is not None else None
            ),
            'effective_from': str(assignment.effective_from),
            'effective_to': str(assignment.effective_to) if assignment.effective_to else None,
        }


class PayrollAuditLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PayrollAuditLog
        fields = [
            'id', 'run', 'employee', 'action',
            'run_status_from', 'run_status_to',
            'old_values', 'new_values', 'reason',
            'performed_by', 'performed_by_name', 'timestamp',
        ]

    def get_performed_by_name(self, obj):
        return obj.performed_by.full_name if obj.performed_by else None


class PayrollRunAdjustmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)

    class Meta:
        model = PayrollRunAdjustment
        fields = [
            'id', 'run', 'employee', 'employee_name', 'employee_code',
            'adjustment_type', 'category', 'label', 'amount', 'taxable',
            'reference_period_start', 'reference_period_end', 'source_claim',
            'arrears_item', 'reason', 'created_by', 'created_at',
        ]
        read_only_fields = ['id', 'run', 'source_claim', 'arrears_item', 'created_by', 'created_at']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value

    def validate(self, attrs):
        start = attrs.get('reference_period_start')
        end = attrs.get('reference_period_end')
        if start and end and start > end:
            raise serializers.ValidationError({'reference_period_end': 'End date must be on or after the start date.'})
        adjustment_type = attrs.get('adjustment_type')
        category = attrs.get('category', 'REIMBURSEMENT' if adjustment_type == 'REIMBURSEMENT' else 'OTHER')
        attrs['category'] = category
        if adjustment_type == 'REIMBURSEMENT' and category != 'REIMBURSEMENT':
            raise serializers.ValidationError({'category': 'Choose Reimbursement for a reimbursement payment.'})
        if adjustment_type == 'REIMBURSEMENT':
            attrs['taxable'] = False
        if adjustment_type == 'DEDUCTION' and category not in ('DEDUCTION_CORRECTION', 'OTHER'):
            raise serializers.ValidationError({'category': 'Choose Deduction correction for a deduction.'})
        if adjustment_type == 'VARIABLE_EARNING' and category in ('DEDUCTION_CORRECTION', 'REIMBURSEMENT'):
            raise serializers.ValidationError({'category': 'Choose an earning category for an earning payment.'})
        return attrs


class PayslipRequestCreateSerializer(serializers.Serializer):
    run_id = serializers.UUIDField()
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)

    def validate_reason(self, value):
        if not value:
            raise serializers.ValidationError('Please provide a reason for requesting this payslip.')
        return value


class PayslipRequestApprovalActionSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    acted_by_name = serializers.CharField(source='acted_by.full_name', read_only=True, allow_null=True)

    class Meta:
        model = PayslipRequestApprovalAction
        fields = [
            'id', 'step_number', 'step_name', 'assigned_to', 'assigned_to_name',
            'status', 'acted_by', 'acted_by_name', 'comments', 'acted_at',
        ]


class PayslipRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    run_id = serializers.UUIDField(read_only=True)
    year = serializers.IntegerField(source='run.pay_calendar.year', read_only=True)
    month = serializers.IntegerField(source='run.pay_calendar.month', read_only=True)
    run_type = serializers.CharField(source='run.run_type', read_only=True)
    run_type_display = serializers.CharField(source='run.get_run_type_display', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True, allow_null=True)
    approval_actions = PayslipRequestApprovalActionSerializer(many=True, read_only=True)
    can_review = serializers.SerializerMethodField()
    is_requester = serializers.SerializerMethodField()

    class Meta:
        model = PayslipRequest
        fields = [
            'id', 'employee', 'employee_name', 'employee_code', 'run_id',
            'year', 'month', 'run_type', 'run_type_display', 'status', 'reason', 'requested_at',
            'approved_by', 'approved_by_name', 'approved_at', 'rejection_reason',
            'approval_actions', 'can_review', 'is_requester',
        ]
        read_only_fields = fields

    def get_can_review(self, obj):
        employee = getattr(getattr(self.context.get('request'), 'user', None), 'employee', None)
        if employee is None or obj.status != 'PENDING_APPROVAL':
            return False
        current_step = obj.approval_actions.filter(status='PENDING').order_by(
            'step_number',
        ).values_list('step_number', flat=True).first()
        if current_step is None:
            return False
        return obj.approval_actions.filter(
            assigned_to=employee, step_number=current_step, status='PENDING',
        ).exists()

    def get_is_requester(self, obj):
        employee = getattr(getattr(self.context.get('request'), 'user', None), 'employee', None)
        return employee is not None and obj.employee_id == employee.id


class PayRunCreateSerializer(serializers.Serializer):
    pay_calendar = serializers.UUIDField()
    run_type = serializers.ChoiceField(
        choices=['REGULAR', 'OFF_CYCLE', 'ARREARS']
    )
    payment_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get('run_type') in ('OFF_CYCLE', 'ARREARS') and not attrs.get('payment_date'):
            raise serializers.ValidationError({'payment_date': 'A payment date is required for an off-cycle or arrears run.'})
        return attrs


class EmployeeExitApprovalActionSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    acted_by_name = serializers.CharField(source='acted_by.full_name', read_only=True)

    class Meta:
        model = EmployeeExitApprovalAction
        fields = ['id', 'step_number', 'step_name', 'assigned_to', 'assigned_to_name', 'acted_by', 'acted_by_name', 'status', 'comments', 'acted_at', 'created_at']
        read_only_fields = fields


class EmployeeExitRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)
    approval_actions = EmployeeExitApprovalActionSerializer(many=True, read_only=True)
    can_decide = serializers.SerializerMethodField()
    fnf_run = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeExitRequest
        fields = ['id', 'employee', 'employee_name', 'employee_code', 'requested_by', 'requested_by_name', 'workflow', 'proposed_exit_date', 'exit_type', 'reason', 'settlement_inputs', 'status', 'current_step_number', 'rejection_reason', 'approved_by', 'approved_by_name', 'approved_at', 'frozen_snapshot', 'approval_actions', 'can_decide', 'fnf_run', 'created_at', 'updated_at']
        read_only_fields = ['id', 'requested_by', 'workflow', 'status', 'current_step_number', 'rejection_reason', 'approved_by', 'approved_at', 'frozen_snapshot', 'approval_actions', 'created_at', 'updated_at']

    def get_can_decide(self, obj):
        employee = getattr(getattr(self.context.get('request'), 'user', None), 'employee', None)
        if employee is None or obj.status != 'PENDING_APPROVAL':
            return False
        return obj.approval_actions.filter(
            assigned_to=employee, step_number=obj.current_step_number, status='PENDING',
        ).exists()

    def get_fnf_run(self, obj):
        run = obj.fnf_runs.exclude(status='REVERSED').order_by('-created_at').first()
        if not run:
            return None
        return {'id': str(run.id), 'status': run.status, 'run_type': run.run_type}
