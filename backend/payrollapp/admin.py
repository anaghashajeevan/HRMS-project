from django.contrib import admin
from .models import (
    SalaryComponent, SalaryStructure, SalaryStructureComponent,
    StatutoryRule, PayCalendar, EmployeeSalaryAssignment,
    EmployeePayrollProfile, PayrollRun, PayrollRunEmployee,
    PayrollRunComponentDetail, PaymentBatch, PaymentBatchLine,
    PayslipRequest, PayslipRequestApprovalAction, PayrollAuditLog, ArrearsLog, PayrollRunApprovalAction,EmployeeExitRequest,
)


@admin.register(SalaryComponent)
class SalaryComponentAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'component_type', 'is_taxable', 'is_fixed', 'is_active')
    list_filter = ('component_type', 'is_taxable', 'is_active')
    search_fields = ('code', 'name')
    ordering = ('component_type', 'display_order')


class SalaryStructureComponentInline(admin.TabularInline):
    model = SalaryStructureComponent
    extra = 1
    autocomplete_fields = ('component',)


@admin.register(SalaryStructure)
class SalaryStructureAdmin(admin.ModelAdmin):
    list_display = ('name', 'version', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name',)
    inlines = [SalaryStructureComponentInline]


@admin.register(StatutoryRule)
class StatutoryRuleAdmin(admin.ModelAdmin):
    list_display = ('statutory_type', 'name', 'jurisdiction', 'employee_rate',
                    'employer_rate', 'effective_from', 'effective_to', 'is_active')
    list_filter = ('statutory_type', 'jurisdiction', 'is_active')
    search_fields = ('name',)
    autocomplete_fields = ('approved_by',)


@admin.register(PayCalendar)
class PayCalendarAdmin(admin.ModelAdmin):
    list_display = ('year', 'month', 'period_start', 'period_end',
                    'days_in_month', 'saturday_is_working', 'cutoff_date', 'pay_date', 'status')
    list_filter = ('year', 'status')
    search_fields = ('year', 'month')
    ordering = ('-year', '-month')


@admin.register(EmployeeSalaryAssignment)
class EmployeeSalaryAssignmentAdmin(admin.ModelAdmin):
    list_display = ('employee', 'structure', 'fixed_salary_monthly', 'ctc_monthly',
                    'effective_from', 'effective_to')
    list_filter = ('structure',)
    search_fields = ('employee__employee_id', 'employee__first_name', 'employee__last_name')
    autocomplete_fields = ('employee', 'structure', 'created_by')


@admin.register(EmployeePayrollProfile)
class EmployeePayrollProfileAdmin(admin.ModelAdmin):
    list_display = ('employee', 'bank_name', 'tax_regime',
                    'effective_from', 'effective_to', 'is_active')
    list_filter = ('is_active', 'tax_regime')
    search_fields = ('employee__employee_id', 'employee__first_name', 'employee__last_name')
    autocomplete_fields = ('employee', 'created_by')


class PayrollRunEmployeeInline(admin.TabularInline):
    model = PayrollRunEmployee
    extra = 0
    readonly_fields = ('employee', 'gross_pay', 'net_pay', 'lop_days', 'status')
    show_change_link = True


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ('pay_calendar', 'run_type', 'status', 'total_employees',
                    'total_gross', 'total_net', 'prepared_by', 'approved_by')
    list_filter = ('status', 'run_type', 'pay_calendar__year')
    search_fields = ('pay_calendar__year', 'pay_calendar__month', 'run_type', 'status')  # ← Added search_fields
    autocomplete_fields = ('prepared_by', 'approved_by', 'finalized_by', 'returned_by')
    inlines = [PayrollRunEmployeeInline]


@admin.register(PayrollRunEmployee)
class PayrollRunEmployeeAdmin(admin.ModelAdmin):
    list_display = ('run', 'employee', 'eligible_calendar_days', 'salary_divisor_days', 'payable_days',
                    'lop_days', 'gross_pay', 'net_pay', 'status')
    list_filter = ('status', 'run__status')
    search_fields = ('employee__employee_id', 'employee__first_name', 'employee__last_name')
    autocomplete_fields = ('run', 'employee', 'salary_assignment')


@admin.register(PaymentBatch)
class PaymentBatchAdmin(admin.ModelAdmin):
    list_display = ('batch_number', 'run', 'bank_name', 'total_amount',
                    'status', 'is_repayment', 'created_at')
    list_filter = ('status', 'is_repayment')
    search_fields = ('batch_number',)


@admin.register(PaymentBatchLine)
class PaymentBatchLineAdmin(admin.ModelAdmin):
    list_display = ('batch', 'run_employee', 'amount', 'status',
                    'utr_number', 'settlement_date')
    list_filter = ('status',)
    search_fields = ('utr_number', 'run_employee__employee__employee_id')


@admin.register(PayrollRunApprovalAction)
class PayrollRunApprovalActionAdmin(admin.ModelAdmin):
    list_display = ('run', 'cycle', 'step_number', 'step_name', 'assigned_to', 'status', 'acted_at')
    list_filter = ('status', 'step_number')
    search_fields = ('run__id', 'assigned_to__employee_id', 'assigned_to__first_name')
    readonly_fields = ('run', 'workflow', 'cycle', 'step_number', 'step_name', 'assigned_to', 'status', 'acted_by', 'acted_at', 'comments', 'created_at')


@admin.register(PayslipRequest)
class PayslipRequestAdmin(admin.ModelAdmin):
    list_display = ('employee', 'run', 'status', 'requested_at', 'approved_by')
    list_filter = ('status',)
    search_fields = ('employee__employee_id', 'employee__first_name')


@admin.register(PayslipRequestApprovalAction)
class PayslipRequestApprovalActionAdmin(admin.ModelAdmin):
    list_display = ('request', 'step_number', 'step_name', 'assigned_to', 'status', 'acted_at')
    list_filter = ('status', 'step_number')
    search_fields = ('request__employee__employee_id', 'assigned_to__employee_id')
    readonly_fields = ('request', 'workflow', 'step_number', 'step_name', 'assigned_to', 'status', 'acted_by', 'acted_at', 'comments', 'created_at')


@admin.register(PayrollAuditLog)
class PayrollAuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'run', 'employee', 'run_status_from',
                    'run_status_to', 'performed_by', 'timestamp')
    list_filter = ('action',)
    search_fields = ('employee__employee_id', 'action')
    readonly_fields = ('run', 'employee', 'action', 'old_values',
                       'new_values', 'performed_by', 'timestamp')


@admin.register(ArrearsLog)
class ArrearsLogAdmin(admin.ModelAdmin):
    list_display = ('employee', 'component_display', 'from_period', 'to_period',
                    'arrears_amount', 'settlement_state', 'source_run')
    list_filter = ('component', 'from_period')
    search_fields = ('employee__employee_id', 'employee__first_name', 'component_label')
    readonly_fields = ('calculation_snapshot', 'created_at')

    @admin.display(description='Component')
    def component_display(self, obj):
        return obj.component.code if obj.component_id else obj.component_label

    @admin.display(description='Settlement')
    def settlement_state(self, obj):
        if obj.settled_in_run_id:
            return f'Settled ({obj.settled_in_run})'
        if obj.reserved_in_run_id:
            return f'Reserved ({obj.reserved_in_run})'
        return 'Available'

@admin.register(EmployeeExitRequest)
class EmployeeExitRequestAdmin(admin.ModelAdmin):
    list_display = ('employee', 'exit_type', 'proposed_exit_date', 'status',
                    'current_step_number', 'requested_by', 'approved_by', 'created_at')
    list_filter = ('status', 'exit_type')
    search_fields = ('employee__employee_id', 'exit_type')
    readonly_fields = ('approved_by', 'approved_at', 'frozen_snapshot',
                       'created_at', 'updated_at')
