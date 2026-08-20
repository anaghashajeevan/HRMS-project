"""
Asset Management Serializers.
"""
from rest_framework import serializers
from .models import AssetCategory, Asset, AssetAllocation
from HRMSapp.models import Employee


# ------------------------------------------------------------------------------
# CATEGORY SERIALIZER
# ------------------------------------------------------------------------------

class AssetCategorySerializer(serializers.ModelSerializer):
    asset_count = serializers.SerializerMethodField()
    allocated_count = serializers.SerializerMethodField()
    available_count = serializers.SerializerMethodField()

    class Meta:
        model = AssetCategory
        fields = [
            'id', 'name', 'description', 'icon', 'is_active',
            'asset_count', 'allocated_count', 'available_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_asset_count(self, obj):
        return obj.assets.count()

    def get_allocated_count(self, obj):
        return obj.assets.filter(status='ALLOCATED').count()

    def get_available_count(self, obj):
        return obj.assets.filter(status='AVAILABLE').count()


# ------------------------------------------------------------------------------
# EMPLOYEE MINI (for nested display)
# ------------------------------------------------------------------------------

class EmployeeMiniAssetSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    department_name = serializers.SerializerMethodField()
    position_title = serializers.CharField(
        source='position.title', read_only=True, default=None
    )

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'full_name',
            'official_email', 'department_name', 'position_title',
        ]

    def get_department_name(self, obj):
        if obj.department:
            return obj.department.name
        if obj.structure_location:
            return obj.structure_location.name
        return None


# ------------------------------------------------------------------------------
# ASSET LIST SERIALIZER (lightweight)
# ------------------------------------------------------------------------------

class AssetListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_icon = serializers.CharField(source='category.icon', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    current_assignee = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = [
            'id', 'asset_tag', 'name',
            'category', 'category_name', 'category_icon',
            'brand', 'model_number', 'serial_number',
            'purchase_date', 'status', 'status_display',
            'condition', 'current_assignee',
        ]

    def get_current_assignee(self, obj):
        active = obj.allocations.filter(status='ALLOCATED').select_related('employee').first()
        if active:
            return {
                'id': str(active.employee.id),
                'employee_id': active.employee.employee_id,
                'full_name': active.employee.full_name,
                'allocated_date': active.allocated_date,
                'allocation_id': str(active.id),
            }
        return None


# ------------------------------------------------------------------------------
# ASSET DETAIL SERIALIZER
# ------------------------------------------------------------------------------

class AssetDetailSerializer(serializers.ModelSerializer):
    category_detail = AssetCategorySerializer(source='category', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)
    current_allocation = serializers.SerializerMethodField()
    is_warranty_valid = serializers.BooleanField(read_only=True)
    image_url = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True, default=None
    )

    class Meta:
        model = Asset
        fields = [
            'id', 'asset_tag', 'name',
            'category', 'category_detail',
            'brand', 'model_number', 'serial_number',
            'purchase_date', 'purchase_cost', 'vendor', 'invoice_number',
            'warranty_expiry', 'is_warranty_valid',
            'status', 'status_display',
            'condition', 'condition_display', 'condition_notes',
            'image', 'image_url',
            'current_allocation',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_current_allocation(self, obj):
        active = obj.allocations.filter(status='ALLOCATED').select_related(
            'employee', 'allocated_by'
        ).first()
        if not active:
            return None
        return {
            'id': str(active.id),
            'employee_id': str(active.employee.id),
            'employee_code': active.employee.employee_id,
            'employee_name': active.employee.full_name,
            'employee_email': active.employee.official_email,
            'allocated_date': active.allocated_date,
            'expected_return_date': active.expected_return_date,
            'duration_days': active.duration_days,
            'handover_notes': active.handover_notes,
            'allocated_by_name': active.allocated_by.full_name if active.allocated_by else 'System',
        }

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


# ------------------------------------------------------------------------------
# ASSET ALLOCATION SERIALIZER
# ------------------------------------------------------------------------------

class AssetAllocationSerializer(serializers.ModelSerializer):
    asset_detail = AssetListSerializer(source='asset', read_only=True)
    employee_detail = EmployeeMiniAssetSerializer(source='employee', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    allocated_by_name = serializers.CharField(
        source='allocated_by.full_name', read_only=True, default=None
    )
    returned_to_name = serializers.CharField(
        source='returned_to.full_name', read_only=True, default=None
    )
    duration_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = AssetAllocation
        fields = [
            'id', 'asset', 'asset_detail',
            'employee', 'employee_detail',
            'allocated_date', 'expected_return_date', 'returned_date',
            'status', 'status_display', 'duration_days',
            'handover_notes', 'return_notes', 'recovery_cost',
            'allocated_by', 'allocated_by_name',
            'returned_to', 'returned_to_name',
            'created_at',
        ]
        read_only_fields = [
            'id', 'allocated_by', 'returned_to', 'created_at',
        ]


# ------------------------------------------------------------------------------
# ACTION PAYLOAD SERIALIZERS
# ------------------------------------------------------------------------------

class AllocateAssetPayloadSerializer(serializers.Serializer):
    asset_id = serializers.UUIDField()
    employee_id = serializers.UUIDField()
    allocated_date = serializers.DateField(required=False)
    expected_return_date = serializers.DateField(required=False, allow_null=True)
    handover_notes = serializers.CharField(required=False, allow_blank=True)


class ReturnAssetPayloadSerializer(serializers.Serializer):
    returned_date = serializers.DateField(required=False)
    status = serializers.ChoiceField(
        choices=['RETURNED', 'DAMAGED', 'LOST'],
        default='RETURNED',
    )
    return_notes = serializers.CharField(required=False, allow_blank=True)
    recovery_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=0
    )