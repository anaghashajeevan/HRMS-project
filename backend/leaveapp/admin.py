from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import (
    LeaveType, Holiday, LeaveBalance,
    LeaveApplication, LeaveApplicationApproval,
)


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'is_paid', 'accrual_type', 'yearly_quota',
                    'can_carry_forward', 'can_encash', 'is_active')
    list_filter = ('is_paid', 'accrual_type', 'is_active')
    search_fields = ('code', 'name')


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ('date', 'name', 'holiday_type', 'applicable_to_all_locations',
                    'is_optional', 'is_active')
    list_filter = ('year', 'holiday_type', 'is_active', 'is_optional')
    search_fields = ('name',)
    date_hierarchy = 'date'
    filter_horizontal = ('applicable_locations',)


@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ('employee', 'leave_type', 'year', 'allocated',
                    'accrued_till_date', 'used', 'pending', 'available')
    list_filter = ('year', 'leave_type')
    search_fields = ('employee__employee_id', 'employee__first_name', 'employee__last_name')
    autocomplete_fields = ('employee',)


class LeaveApplicationApprovalInline(admin.TabularInline):
    model = LeaveApplicationApproval
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(LeaveApplication)
class LeaveApplicationAdmin(admin.ModelAdmin):
    list_display = ('application_number', 'employee', 'leave_type', 'start_date',
                    'end_date', 'total_days', 'status', 'applied_at')
    list_filter = ('status', 'leave_type', 'is_lop', 'applied_at')
    search_fields = ('application_number', 'employee__employee_id',
                     'employee__first_name', 'employee__last_name')
    date_hierarchy = 'start_date'
    autocomplete_fields = ('employee', 'leave_type', 'handover_to', 'approved_by')
    readonly_fields = ('application_number', 'applied_at', 'approved_at', 'updated_at')
    inlines = [LeaveApplicationApprovalInline]


@admin.register(LeaveApplicationApproval)
class LeaveApplicationApprovalAdmin(admin.ModelAdmin):
    list_display = ('application', 'step_number', 'step_name', 'approver', 'status', 'acted_at')
    list_filter = ('status', 'step_number')
    autocomplete_fields = ('approver',)