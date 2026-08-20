from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import AssetCategory, Asset, AssetAllocation


@admin.register(AssetCategory)
class AssetCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'description']


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = [
        'asset_tag', 'name', 'category', 'serial_number',
        'status', 'condition', 'purchase_date'
    ]
    list_filter = ['status', 'condition', 'category']
    search_fields = ['asset_tag', 'name', 'serial_number', 'brand', 'model_number']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(AssetAllocation)
class AssetAllocationAdmin(admin.ModelAdmin):
    list_display = [
        'asset', 'employee', 'allocated_date', 'returned_date',
        'status', 'allocated_by'
    ]
    list_filter = ['status', 'allocated_date']
    search_fields = [
        'asset__asset_tag', 'asset__name',
        'employee__employee_id', 'employee__first_name'
    ]
    readonly_fields = ['id', 'created_at', 'updated_at']