"""
DRF serializers for leave app.
"""

from rest_framework import serializers

from .models import (
    LeaveType, Holiday, LeaveBalance,
    LeaveApplication, LeaveApplicationApproval,
)


# ==============================================================================
# LEAVE TYPE
# ==============================================================================

class LeaveTypeSerializer(serializers.ModelSerializer):
    accrual_type_display = serializers.CharField(source='get_accrual_type_display', read_only=True)

    class Meta:
        model = LeaveType
        fields = [
            'id', 'code', 'name', 'description', 'is_paid', 'is_active',
            'accrual_type', 'accrual_type_display', 'yearly_quota', 'accrual_per_period',
            'can_carry_forward', 'max_carry_forward', 'carry_forward_expiry_months',
            'can_encash', 'max_encashment_days', 'encashment_basis',
            'requires_document', 'min_days_before_apply',
            'max_consecutive_days', 'can_apply_half_day', 'allowed_during_probation',
            'requires_manager_approval', 'requires_hr_approval',
            'hr_approval_threshold_days', 'auto_approve',
            'min_service_months', 'applicable_gender',
            'color_code', 'display_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class LeaveTypeMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ['id', 'code', 'name', 'is_paid', 'color_code',
                  'requires_document', 'can_apply_half_day']


# ==============================================================================
# HOLIDAY
# ==============================================================================

class HolidaySerializer(serializers.ModelSerializer):
    holiday_type_display = serializers.CharField(source='get_holiday_type_display', read_only=True)
    location_names = serializers.SerializerMethodField()

    class Meta:
        model = Holiday
        fields = [
            'id', 'name', 'date', 'year',
            'holiday_type', 'holiday_type_display',
            'description',
            'applicable_to_all_locations',
            'applicable_locations', 'location_names',
            'is_optional', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'year', 'created_at', 'updated_at']

    def get_location_names(self, obj):
        return [{'id': str(loc.id), 'name': loc.name} for loc in obj.applicable_locations.all()]


# ==============================================================================
# LEAVE BALANCE
# ==============================================================================

class LeaveBalanceSerializer(serializers.ModelSerializer):
    leave_type = LeaveTypeMiniSerializer(read_only=True)
    available = serializers.DecimalField(max_digits=6, decimal_places=1, read_only=True)
    total_eligible = serializers.DecimalField(max_digits=6, decimal_places=1, read_only=True)
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_department = serializers.SerializerMethodField()

    class Meta:
        model = LeaveBalance
        fields = [
            'id', 'employee', 'leave_type', 'year',
            'employee_code', 'employee_name', 'employee_department',
            'allocated', 'accrued_till_date', 'carried_forward',
            'used', 'pending', 'encashed', 'adjustment',
            'available', 'total_eligible',
            'last_accrual_date', 'updated_at',
        ]
        read_only_fields = fields
    def get_employee_department(self, obj):
        if obj.employee:
            if obj.employee.department:
                return obj.employee.department.name
            if obj.employee.structure_location:
                return obj.employee.structure_location.name
        return None

# ==============================================================================
# LEAVE APPLICATION
# ==============================================================================

class LeaveApplicationApprovalSerializer(serializers.ModelSerializer):
    approver_name = serializers.CharField(source='approver.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = LeaveApplicationApproval
        fields = [
            'id', 'step_number', 'step_name',
            'approver', 'approver_name',
            'status', 'status_display',
            'acted_at', 'comments', 'created_at',
        ]
        read_only_fields = fields


class LeaveApplicationListSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_code = serializers.CharField(source='leave_type.code', read_only=True)
    leave_type_color = serializers.CharField(source='leave_type.color_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = LeaveApplication
        fields = [
            'id', 'application_number',
            'employee', 'employee_name', 'employee_code',
            'leave_type', 'leave_type_name', 'leave_type_code', 'leave_type_color',
            'start_date', 'end_date', 'total_days',
            'is_half_day', 'half_day_period',
            'reason', 'status', 'status_display',
            'is_lop', 'lop_days',
            'applied_at', 'approved_at',
        ]


class LeaveApplicationDetailSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_department = serializers.CharField(
        source='employee.structure_location.name', read_only=True, default=None
    )
    manager_name = serializers.CharField(
        source='employee.reporting_manager.full_name', read_only=True, default=None
    )
    leave_type = LeaveTypeMiniSerializer(read_only=True)
    handover_to_name = serializers.CharField(
        source='handover_to.full_name', read_only=True, default=None
    )
    approved_by_name = serializers.CharField(
        source='approved_by.full_name', read_only=True, default=None
    )
    current_approver_name = serializers.CharField(
        source='current_approver.full_name', read_only=True, default=None
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approvals = LeaveApplicationApprovalSerializer(many=True, read_only=True)
    supporting_document_url = serializers.SerializerMethodField()

    class Meta:
        model = LeaveApplication
        fields = [
            'id', 'application_number',
            'employee', 'employee_name', 'employee_code', 'employee_department',
            'manager_name',
            'leave_type',
            'start_date', 'end_date', 'total_days',
            'is_half_day', 'half_day_period',
            'reason', 'contact_during_leave',
            'supporting_document', 'supporting_document_url',
            'handover_to', 'handover_to_name', 'handover_notes',
            'status', 'status_display',
            'current_approver', 'current_approver_name',
            'approved_by', 'approved_by_name', 'approved_at',
            'rejection_reason',
            'cancelled_at', 'cancellation_reason',
            'is_lop', 'lop_days',
            'applied_at', 'updated_at',
            'approvals',
        ]
        read_only_fields = [
            'id', 'application_number', 'total_days', 'status',
            'current_approver', 'approved_by', 'approved_at',
            'is_lop', 'lop_days', 'applied_at', 'updated_at', 'approvals',
        ]

    def get_supporting_document_url(self, obj):
        if obj.supporting_document:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.supporting_document.url)
        return None


class LeaveApplicationCreateSerializer(serializers.ModelSerializer):
    """For creating new leave applications."""

    class Meta:
        model = LeaveApplication
        fields = [
            'leave_type', 'start_date', 'end_date',
            'is_half_day', 'half_day_period',
            'reason', 'contact_during_leave',
            'supporting_document',
            'handover_to', 'handover_notes',
        ]

    def validate(self, attrs):
        if attrs['start_date'] > attrs['end_date']:
            raise serializers.ValidationError({
                'end_date': 'End date must be after start date.'
            })

        if attrs.get('is_half_day') and not attrs.get('half_day_period'):
            raise serializers.ValidationError({
                'half_day_period': 'Half day period is required for half-day leave.'
            })

        if attrs.get('is_half_day') and attrs['start_date'] != attrs['end_date']:
            raise serializers.ValidationError({
                'is_half_day': 'Half-day leave must be for a single day.'
            })

        return attrs


class LeaveApprovalActionSerializer(serializers.Serializer):
    """For approve/reject actions."""
    comments = serializers.CharField(required=False, allow_blank=True)


class LeaveRejectActionSerializer(serializers.Serializer):
    """For reject action."""
    reason = serializers.CharField(min_length=5)


from .models import AnnualCalendar, AnnualCalendarApproval


class AnnualCalendarApprovalSerializer(serializers.ModelSerializer):
    approver_name = serializers.CharField(source='approver.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AnnualCalendarApproval
        fields = [
            'id', 'step_number', 'step_name',
            'approver', 'approver_name',
            'status', 'status_display',
            'acted_at', 'comments', 'created_at',
        ]


class AnnualCalendarListSerializer(serializers.ModelSerializer):
    holiday_count = serializers.SerializerMethodField()   # ← CHANGED
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True, default=None
    )

    class Meta:
        model = AnnualCalendar
        fields = [
            'id', 'year', 'title', 'description',
            'status', 'status_display', 'holiday_count',
            'created_by', 'created_by_name',
            'published_at', 'created_at',
        ]

    def get_holiday_count(self, obj):    # ← NEW METHOD
        return obj.holidays.count()


class AnnualCalendarDetailSerializer(serializers.ModelSerializer):
    holidays = HolidaySerializer(many=True, read_only=True)
    approvals = AnnualCalendarApprovalSerializer(many=True, read_only=True)
    holiday_count = serializers.SerializerMethodField()   # ← CHANGED
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True, default=None
    )
    returned_by_name = serializers.CharField(
        source='returned_by.full_name', read_only=True, default=None
    )
    published_by_name = serializers.CharField(
        source='published_by.full_name', read_only=True, default=None
    )

    class Meta:
        model = AnnualCalendar
        fields = [
            'id', 'year', 'title', 'description',
            'status', 'status_display', 'holiday_count', 'holidays',
            'created_by', 'created_by_name',
            'published_at', 'published_by', 'published_by_name',
            'return_comments', 'returned_at', 'returned_by', 'returned_by_name',
            'rejection_reason', 'rejected_at',
            'approvals',
            'created_at', 'updated_at',
        ]

    def get_holiday_count(self, obj):    # ← NEW METHOD
        return obj.holidays.count()

class AnnualCalendarCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnualCalendar
        fields = ['year', 'title', 'description']



from .models import CalendarAmendment


class CalendarAmendmentSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    made_by_name = serializers.CharField(source='made_by.full_name', read_only=True, default=None)

    class Meta:
        model = CalendarAmendment
        fields = [
            'id', 'action', 'action_display',
            'holiday_name', 'holiday_date',
            'reason', 'made_by', 'made_by_name',
            'made_at', 'holiday_snapshot',
        ]