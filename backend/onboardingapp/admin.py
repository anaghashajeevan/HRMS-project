from django.contrib import admin

from .models import OnboardingTemplate, OnboardingTemplateTask


class OnboardingTemplateTaskInline(admin.TabularInline):
    model = OnboardingTemplateTask
    extra = 0


@admin.register(OnboardingTemplate)
class OnboardingTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'department', 'position', 'is_active', 'updated_at')
    list_filter = ('is_active', 'department')
    search_fields = ('name', 'description')
    inlines = [OnboardingTemplateTaskInline]
