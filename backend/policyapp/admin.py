from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import (
    PolicyCategory, Policy, PolicyVersion,
    PolicyApproval, PolicyDistribution,
    PolicyReadLog, PolicyReminderLog, PolicyComment,
)


@admin.register(PolicyCategory)
class PolicyCategoryAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'color_code', 'display_order', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('code', 'name')
    ordering = ('display_order',)


class PolicyVersionInline(admin.TabularInline):
    model = PolicyVersion
    extra = 0
    readonly_fields = ('created_at',)
    fields = ('version_number', 'content_type', 'is_published', 'effective_from', 'created_by', 'created_at')


@admin.register(Policy)
class PolicyAdmin(admin.ModelAdmin):
    list_display = (
        'policy_number', 'title', 'category', 'status',
        'requires_acknowledgment', 'is_mandatory',
        'effective_date', 'expiry_date', 'is_active',
    )
    list_filter = ('status', 'category', 'is_mandatory', 'requires_acknowledgment', 'is_active')
    search_fields = ('policy_number', 'title', 'summary', 'tags')
    date_hierarchy = 'created_at'
    filter_horizontal = ('applicable_departments', 'applicable_positions', 'applicable_locations')
    autocomplete_fields = ('policy_owner', 'created_by')
    inlines = [PolicyVersionInline]
    readonly_fields = ('policy_number', 'published_at', 'created_at', 'updated_at')


@admin.register(PolicyVersion)
class PolicyVersionAdmin(admin.ModelAdmin):
    list_display = ('policy', 'version_number', 'content_type', 'is_published', 'effective_from', 'created_at')
    list_filter = ('is_published', 'content_type')
    search_fields = ('policy__title', 'policy__policy_number', 'version_number')
    autocomplete_fields = ('created_by',)


class PolicyApprovalInline(admin.TabularInline):
    model = PolicyApproval
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(PolicyApproval)
class PolicyApprovalAdmin(admin.ModelAdmin):
    list_display = ('version', 'step_number', 'step_name', 'approver', 'status', 'acted_at')
    list_filter = ('status',)
    autocomplete_fields = ('approver',)


@admin.register(PolicyDistribution)
class PolicyDistributionAdmin(admin.ModelAdmin):
    list_display = (
        'employee', 'policy', 'version',
        'acknowledged', 'acknowledged_at',
        'deadline', 'is_overdue',
        'total_views', 'reminders_sent',
    )
    list_filter = ('acknowledged', 'is_overdue', 'email_sent', 'is_invalidated')
    search_fields = (
        'employee__employee_id', 'employee__first_name',
        'policy__title', 'policy__policy_number',
    )
    autocomplete_fields = ('employee',)
    date_hierarchy = 'distributed_at'


@admin.register(PolicyReadLog)
class PolicyReadLogAdmin(admin.ModelAdmin):
    list_display = ('employee', 'distribution', 'viewed_at', 'time_spent_seconds', 'ip_address')
    list_filter = ('viewed_at',)
    date_hierarchy = 'viewed_at'


@admin.register(PolicyReminderLog)
class PolicyReminderLogAdmin(admin.ModelAdmin):
    list_display = ('distribution', 'reminder_type', 'sent_at', 'sent_to_email', 'days_before_deadline')
    list_filter = ('reminder_type',)


@admin.register(PolicyComment)
class PolicyCommentAdmin(admin.ModelAdmin):
    list_display = ('policy', 'employee', 'is_resolved', 'is_visible', 'created_at')
    list_filter = ('is_resolved', 'is_visible')
    search_fields = ('content', 'employee__first_name', 'policy__title')