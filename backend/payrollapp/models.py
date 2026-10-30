from django.db import models

# Create your models here.
"""
Payroll module models.
All monetary fields use Decimal (never float).
All PKs are UUID 
Encrypted fields use django_cryptography (same as Employee PII).
"""

import uuid
from django.db import models
from django_cryptography.fields import encrypt


# ==============================================================================
# 1. SALARY COMPONENT (Master pay heads)
# ==============================================================================

class SalaryComponent(models.Model):
    """
    Master list of pay heads: Basic, HRA, Conveyance, PF, ESI, PT, TDS, etc.
    """

    TYPE_CHOICES = [
        ('EARNING', 'Earning'),
        ('DEDUCTION', 'Deduction'),
        ('EMPLOYER_COST', 'Employer Statutory Cost'),
        ('REIMBURSEMENT', 'Reimbursement'),
        ('ONE_TIME', 'One-Time Payment'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    component_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    is_taxable = models.BooleanField(default=True)
    is_fixed = models.BooleanField(
        default=True,
        help_text="Fixed amount vs formula/percentage based",
    )
    formula = models.CharField(
        max_length=500, blank=True,
        help_text="Whitelisted expression e.g. 'basic * 0.40'. No eval().",
    )
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_salary_components'
        ordering = ['component_type', 'display_order', 'code']

    def __str__(self):
        return f"{self.code} - {self.name}"


# ==============================================================================
# 2. SALARY STRUCTURE (Named pay structure with versioning)
# ==============================================================================

class SalaryStructure(models.Model):
    """
    Named pay structure e.g. 'Level 3 - Standard'.
    Version is incremented when components change so old runs stay reproducible.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    version = models.CharField(
        max_length=20, default='1.0',
        help_text="Increment when components change (e.g. 1.0 → 1.1)",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_salary_structures'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} (v{self.version})"


# ==============================================================================
# 3. SALARY STRUCTURE COMPONENT (M2M through table)
# ==============================================================================

class SalaryStructureComponent(models.Model):
    """
    Links a structure to its components with fixed amounts or percentages.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    structure = models.ForeignKey(
        SalaryStructure, on_delete=models.CASCADE, related_name='components',
    )
    component = models.ForeignKey(SalaryComponent, on_delete=models.PROTECT)
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Fixed monthly amount (used when component.is_fixed=True)",
    )
    percentage_of_basic = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="e.g. 40.00 for 40% of Basic",
    )
    is_enabled = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_structure_components'
        ordering = ['structure', 'component__component_type', 'display_order']
        unique_together = [('structure', 'component')]

    def __str__(self):
        return f"{self.structure.name} → {self.component.code}"


# ==============================================================================
# 4. STATUTORY RULE (Versioned, jurisdiction-aware)
# ==============================================================================

class StatutoryRule(models.Model):
    """
    Effective-dated statutory rules. Multiple rules can coexist:
    - PF 2025 vs PF 2026 (different rates)
    - Old vs New TDS regime
    """

    TYPE_CHOICES = [
        ('PF', 'Provident Fund'),
        ('ESI', 'Employee State Insurance'),
        ('PT', 'Professional Tax'),
        ('TDS', 'Tax Deducted at Source'),
        ('GRATUITY', 'Gratuity'),
    ]

    REGIME_CHOICES = [
        ('ALL', 'All Regimes'),
        ('OLD', 'Old Tax Regime'),
        ('NEW', 'New Tax Regime'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    statutory_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    name = models.CharField(
        max_length=200,
        help_text="e.g. 'PF Rule FY2026', 'Karnataka PT 2026'",
    )
    jurisdiction = models.CharField(
        max_length=50, blank=True, default='ALL',
        help_text="State code for PT (e.g. 'KA', 'MH'). 'ALL' for national.",
    )
    tax_regime = models.CharField(
        max_length=10, choices=REGIME_CHOICES, default='ALL',
    )

    # Rates
    employee_rate = models.DecimalField(
        max_digits=6, decimal_places=3, default=0,
        help_text="Employee contribution percentage",
    )
    employer_rate = models.DecimalField(
        max_digits=6, decimal_places=3, default=0,
        help_text="Employer contribution percentage",
    )
    employer_pension_rate = models.DecimalField(
        max_digits=6, decimal_places=3, default=8.330,
        help_text="Employer PF share allocated to EPS; remaining employer_rate is EPF.",
    )
    wage_ceiling = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Max wage for calculation. 0 = no ceiling.",
    )
    threshold = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Min gross for applicability. 0 = applies to all.",
    )
    min_employees = models.IntegerField(
        default=0,
        help_text="Min employees for applicability (e.g. PF: 20, ESI: 10)",
    )

    # Slabs (JSON for PT brackets, TDS slabs)
    # PT example: [{"min": 0, "max": 15000, "amount": 0},
    #              {"min": 15001, "max": 20000, "amount": 150},
    #              {"min": 20001, "max": null, "amount": 200}]
    slabs = models.JSONField(
        default=list, blank=True,
        help_text="Array of {min, max, rate/amount} objects for slab-based rules",
    )

    # Effective dating
    effective_from = models.DateField(db_index=True)
    effective_to = models.DateField(
        null=True, blank=True, db_index=True,
        help_text="NULL = currently active",
    )

    # Approval
    approved_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='approved_statutory_rules',
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_statutory_rules'
        ordering = ['statutory_type', '-effective_from']

    def __str__(self):
        return f"{self.statutory_type} - {self.name} (from {self.effective_from})"


# ==============================================================================
# 5. PAY CALENDAR (Monthly pay periods)
# ==============================================================================

class PayCalendar(models.Model):
    """
    Defines each month's pay period, cutoff, and pay date.
    days_in_month is stored explicitly (28/29/30/31) for the divisor formula.
    """

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('OPEN', 'Open for Input'),
        ('LOCKED', 'Inputs Locked'),
        ('CLOSED', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    year = models.IntegerField()
    month = models.IntegerField()
    period_start = models.DateField()
    period_end = models.DateField()
    days_in_month = models.IntegerField(
        help_text="Calendar days: 28, 29, 30, or 31",
    )
    saturday_is_working = models.BooleanField(
        default=False,
        help_text="If enabled, Saturdays are scheduled workdays for this pay period. Sundays remain off unless attendance records work.",
    )
    cutoff_date = models.DateField(
        help_text="After this date, attendance/leave changes don't affect this period",
    )
    pay_date = models.DateField(help_text="Scheduled payment date")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='DRAFT',
    )
    input_locked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_calendar'
        ordering = ['-year', '-month']
        unique_together = [('year', 'month')]

    def __str__(self):
        return f"{self.year}-{self.month:02d} ({self.get_status_display()})"


# ==============================================================================
# 6. EMPLOYEE SALARY ASSIGNMENT (Immutable CTC history — NO bank details)
# ==============================================================================

class EmployeeSalaryAssignment(models.Model):
    """
    Immutable CTC history per employee.
    - effective_to=NULL means currently active.
    - New assignment closes the old one with explicit effective_to.
    - Overlapping date ranges are rejected at application level.
    - Bank details live in EmployeePayrollProfile (separate lifecycle).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.CASCADE,
        related_name='salary_assignments',
    )
    structure = models.ForeignKey(SalaryStructure, on_delete=models.PROTECT)
    ctc_annual = models.DecimalField(max_digits=12, decimal_places=2)
    ctc_monthly = models.DecimalField(max_digits=12, decimal_places=2)
    fixed_salary_monthly = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text='Full-month fixed gross earnings, excluding run-specific variable pay.',
    )
    effective_from = models.DateField(db_index=True)
    effective_to = models.DateField(
        null=True, blank=True, db_index=True,
        help_text="NULL = currently active",
    )
    reason = models.CharField(
        max_length=200, blank=True,
        help_text="e.g. 'Annual increment', 'Joining', 'Promotion'",
    )
    created_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_salary_assignments',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_salary_assignments'
        ordering = ['employee', '-effective_from']
        indexes = [
            models.Index(fields=['employee', 'effective_from', 'effective_to']),
        ]

    def __str__(self):
        end = self.effective_to or 'present'
        return f"{self.employee} — ₹{self.ctc_monthly} ({self.effective_from} → {end})"


# ==============================================================================
# 7. EMPLOYEE PAYROLL PROFILE (Encrypted bank + statutory IDs, versioned)
# ==============================================================================

class EmployeePayrollProfile(models.Model):
    """
    Encrypted bank and statutory identity details.
    Versioned separately from salary — bank details change on different timelines.
    Payment batches snapshot the profile version used.
    """

    TAX_REGIME_CHOICES = [
        ('OLD', 'Old Regime'),
        ('NEW', 'New Regime'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.CASCADE,
        related_name='payroll_profiles',
    )

    # Bank details (encrypted at rest)
    bank_name = models.CharField(max_length=200, blank=True)
    account_holder_name = models.CharField(max_length=200, blank=True)
    bank_account = encrypt(models.CharField(max_length=50, blank=True))
    ifsc_code = encrypt(models.CharField(max_length=20, blank=True))

    # Statutory IDs (encrypted at rest)
    uan = encrypt(models.CharField(
        max_length=30, blank=True,
        help_text="Universal Account Number (PF)",
    ))
    pf_number = encrypt(models.CharField(max_length=30, blank=True))
    esi_number = encrypt(models.CharField(max_length=30, blank=True))
    pan = encrypt(models.CharField(max_length=15, blank=True))

    # Tax preference
    tax_regime = models.CharField(
        max_length=10, choices=TAX_REGIME_CHOICES, default='NEW',
    )
    tax_resident = models.BooleanField(
        null=True, blank=True, default=None,
        help_text='Indian tax residency status for rebate eligibility. Unknown status does not apply resident-only rebate.',
    )

    # Versioning
    effective_from = models.DateField(db_index=True)
    effective_to = models.DateField(
        null=True, blank=True, db_index=True,
        help_text="NULL = currently active",
    )
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_payroll_profiles',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_employee_profiles'
        ordering = ['employee', '-effective_from']

    def __str__(self):
        return f"{self.employee} — Payroll Profile ({self.effective_from})"


# ==============================================================================
# 8. PAYROLL RUN (Monthly pay run header)
# ==============================================================================

class PayrollRun(models.Model):
    """
    Monthly pay run with full SOP lifecycle:
    OPEN → LOCKED → CALCULATED → UNDER_REVIEW → APPROVED → FINALIZED → PAID
    Reversal and Return are tracked via fields, not extra statuses.
    """

    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('LOCKED', 'Inputs Locked'),
        ('CALCULATED', 'Calculated'),
        ('UNDER_REVIEW', 'Under Review'),
        ('APPROVED', 'Approved'),
        ('FINALIZED', 'Finalized'),
        ('PAID', 'Paid'),
        ('REVERSED', 'Reversed'),
    ]

    RUN_TYPE_CHOICES = [
        ('REGULAR', 'Regular Monthly'),
        ('OFF_CYCLE', 'Off-Cycle (Bonus/Increment)'),
        ('FNF', 'Full & Final Settlement'),
        ('ARREARS', 'Arrears'),
        ('REVERSAL', 'Reversal'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pay_calendar = models.ForeignKey(
        PayCalendar, on_delete=models.PROTECT, related_name='runs',
    )
    exit_request = models.ForeignKey(
        'EmployeeExitRequest', null=True, blank=True, on_delete=models.PROTECT,
        related_name='fnf_runs',
        help_text='Exit case this F&F run settles; required for F&F runs.',
    )
    run_type = models.CharField(
        max_length=20, choices=RUN_TYPE_CHOICES, default='REGULAR',
    )
    payment_date = models.DateField(
        null=True, blank=True,
        help_text='Expected or actual disbursement date. For off-cycle runs, this determines the TDS tax month and financial year; the pay calendar remains the reference period.',
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='OPEN',
    )
    formula_version = models.CharField(max_length=20, default='1.0')

    # Segregation of duties
    prepared_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='prepared_runs',
    )
    approved_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='approved_runs',
    )
    finalized_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='finalized_runs',
    )

    # Return tracking (UNDER_REVIEW → back to CALCULATED)
    return_reason = models.TextField(blank=True)
    returned_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='returned_runs',
    )

    # Totals (populated after calculation)
    total_employees = models.IntegerField(default=0)
    total_gross = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_reimbursements = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_net = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_employer_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_ctc = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Lifecycle timestamps
    input_locked_at = models.DateTimeField(null=True, blank=True)
    calculation_completed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    finalized_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    reversed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_runs'
        ordering = ['-pay_calendar__year', '-pay_calendar__month']

    def __str__(self):
        return f"Run {self.pay_calendar} ({self.get_status_display()})"


class PayrollRunApprovalAction(models.Model):
    """Immutable per-approver record for each configured payroll approval step."""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('RETURNED', 'Returned'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        PayrollRun, on_delete=models.CASCADE, related_name='approval_actions',
    )
    workflow = models.ForeignKey(
        'HRMSapp.ApprovalWorkflow', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='payroll_approval_actions',
    )
    cycle = models.PositiveIntegerField(default=1)
    step_number = models.PositiveIntegerField()
    step_name = models.CharField(max_length=100)
    assigned_to = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.PROTECT,
        related_name='payroll_approvals_assigned',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    acted_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payroll_approvals_acted',
    )
    acted_at = models.DateTimeField(null=True, blank=True)
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_run_approval_actions'
        ordering = ['cycle', 'step_number', 'assigned_to__employee_id']
        indexes = [
            models.Index(fields=['run', 'cycle', 'step_number', 'status']),
            models.Index(fields=['assigned_to', 'status']),
        ]

    def __str__(self):
        return f'{self.run} — {self.step_name} ({self.status})'


# ==============================================================================
# 9. PAYROLL RUN EMPLOYEE (Per-employee result + input snapshot)
# ==============================================================================

class PayrollRunEmployee(models.Model):
    """
    Per-employee result in a pay run.
    Stores the exact input snapshot so payslips are reproducible years later.
    All day counts use the calendar-day basis.
    """

    STATUS_CHOICES = [
        ('PENDING', 'Pending Calculation'),
        ('CALCULATED', 'Calculated'),
        ('ERROR', 'Calculation Error'),
        ('EXCLUDED', 'Excluded'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        PayrollRun, on_delete=models.CASCADE, related_name='employees',
    )
    employee = models.ForeignKey('HRMSapp.Employee', on_delete=models.PROTECT)
    salary_assignment = models.ForeignKey(
        EmployeeSalaryAssignment, on_delete=models.PROTECT,
        null=True, blank=True,
    )

    # Day counts (calendar-day basis, NOT working days)
    eligible_calendar_days = models.DecimalField(
        max_digits=5, decimal_places=1, default=0,
        help_text="Calendar days employee is eligible (DOJ→DOE within period)",
    )
    days_in_month = models.IntegerField(
        default=30,
        help_text="Total calendar days in the pay month (28/29/30/31)",
    )
    salary_divisor_days = models.PositiveSmallIntegerField(
        default=0,
        help_text="Scheduled working days in this pay period; the monthly salary divisor frozen at input lock.",
    )
    payable_days = models.DecimalField(
        max_digits=5, decimal_places=1, default=0,
        help_text="eligible_calendar_days - lop_days",
    )
    lop_days = models.DecimalField(
        max_digits=5, decimal_places=1, default=0,
        help_text="Unpaid absence days (from reconciled day-by-day status)",
    )
    paid_leave_days = models.DecimalField(
        max_digits=5, decimal_places=1, default=0,
    )

    # Amounts (Decimal, rounded to paise at final step only)
    gross_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_reimbursements = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_employer_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_ctc = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Reproducibility: freeze ALL inputs used
    # {
    #   "salary_assignment_id": "uuid",
    #   "ctc_monthly": "12500.00",
    #   "structure_version": "1.0",
    #   "attendance": {"present": 17, "absent": 2, "weekends": 8, "holidays": 2},
    #   "leaves": [{"type": "CL", "days": 1, "is_lop": false}],
    #   "statutory_rules": {"PF": "rule-uuid", "ESI": "rule-uuid"},
    #   "formula_version": "1.0",
    #   "frozen_at": "2026-11-01T10:30:00+05:30"
    # }
    input_snapshot = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_run_employees'
        ordering = ['run', 'employee__employee_id']
        unique_together = [('run', 'employee')]

    def __str__(self):
        return f"{self.employee} in {self.run} — ₹{self.net_pay}"


# ==============================================================================
# 10. PAYROLL RUN COMPONENT DETAIL (Per-component breakdown)
# ==============================================================================

class PayrollRunComponentDetail(models.Model):
    """
    Per-component amount for each employee in a run.
    Stores the formula used and statutory rule reference for auditability.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_employee = models.ForeignKey(
        PayrollRunEmployee, on_delete=models.CASCADE,
        related_name='component_details',
    )
    component = models.ForeignKey(
        SalaryComponent, null=True, blank=True, on_delete=models.PROTECT,
    )
    component_label = models.CharField(max_length=150, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_earning = models.BooleanField(default=True)
    is_employer_cost = models.BooleanField(default=False)
    is_reimbursement = models.BooleanField(default=False)
    formula_used = models.CharField(max_length=500, blank=True)
    rule_reference = models.CharField(
        max_length=200, blank=True,
        help_text="Statutory rule UUID if this component used a statutory rule",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_run_component_details'
        ordering = [
            'run_employee',
            'component__component_type',
            'component__display_order',
        ]
        unique_together = [('run_employee', 'component')]

    def __str__(self):
        label = self.component.code if self.component_id else self.component_label
        return f"{label or 'Adjustment'}: ₹{self.amount}"


# ==============================================================================
# 11. RUN ADJUSTMENTS (Variable pay, deductions, reimbursements)
# ============================================================================== 

class PayrollRunAdjustment(models.Model):
    """Run-specific variable pay, deductions, and reimbursement lines."""

    TYPE_CHOICES = [
        ('VARIABLE_EARNING', 'Variable Earning'),
        ('DEDUCTION', 'Employee Deduction'),
        ('REIMBURSEMENT', 'Reimbursement'),
    ]
    CATEGORY_CHOICES = [
        ('BONUS', 'Bonus'),
        ('INCREMENT_DIFFERENCE', 'Increment difference'),
        ('ARREARS', 'Salary arrears'),
        ('EARNING_CORRECTION', 'Earning correction'),
        ('FNF_SALARY', 'F&F salary balance'),
        ('DEDUCTION_CORRECTION', 'Deduction correction'),
        ('REIMBURSEMENT', 'Reimbursement'),
        ('OTHER', 'Other adjustment'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name='adjustments')
    employee = models.ForeignKey('HRMSapp.Employee', on_delete=models.PROTECT)
    adjustment_type = models.CharField(max_length=24, choices=TYPE_CHOICES)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='OTHER')
    label = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    taxable = models.BooleanField(default=True)
    reference_period_start = models.DateField(null=True, blank=True)
    reference_period_end = models.DateField(null=True, blank=True)
    reason = models.TextField(blank=True)
    source_claim = models.OneToOneField(
        'reimbursementapp.ReimbursementClaim', null=True, blank=True,
        on_delete=models.PROTECT, related_name='payroll_adjustment',
    )
    arrears_item = models.OneToOneField(
        'ArrearsLog', null=True, blank=True, on_delete=models.PROTECT,
        related_name='payroll_adjustment',
    )
    created_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_payroll_adjustments',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_run_adjustments'
        ordering = ['employee__employee_id', 'adjustment_type', 'label']

    def __str__(self):
        return f"{self.employee} - {self.label}: {self.amount}"


# ============================================================================== 
# 12. PAYMENT BATCH
# ==============================================================================

class PaymentBatch(models.Model):
    """
    Bank payment batch for a finalized run.
    """

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('UPLOADED', 'Uploaded to Bank'),
        ('PARTIALLY_RECONCILED', 'Partially Reconciled'),
        ('RECONCILED', 'Fully Reconciled'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        PayrollRun, on_delete=models.PROTECT, related_name='payment_batches',
    )
    batch_number = models.CharField(max_length=50, unique=True)
    bank_name = models.CharField(max_length=200, blank=True)
    payment_mode = models.CharField(max_length=20, default='NEFT')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    file_generated = models.BooleanField(default=False)
    status = models.CharField(
        max_length=25, choices=STATUS_CHOICES, default='PENDING',
    )
    is_repayment = models.BooleanField(default=False)
    original_batch = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='repayment_batches',
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_payment_batches'
        ordering = ['-created_at']

    def __str__(self):
        return f"Batch {self.batch_number} ({self.get_status_display()})"


# ==============================================================================
# 12. PAYMENT BATCH LINE (Per-employee, manual settlement)
# ==============================================================================

class PaymentBatchLine(models.Model):
    """
    Per-employee payment line.
    Status is updated MANUALLY by Finance after checking bank portal.
    Bank details are snapshotted (encrypted) at batch creation time.
    """

    STATUS_CHOICES = [
        ('PENDING', 'Pending Upload'),
        ('UPLOADED', 'Uploaded to Bank'),
        ('SETTLED', 'Settled'),
        ('FAILED', 'Failed'),
        ('RETURNED', 'Returned'),
        ('REPAYMENT_PENDING', 'Repayment Pending'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(
        PaymentBatch, on_delete=models.CASCADE, related_name='lines',
    )
    run_employee = models.ForeignKey(PayrollRunEmployee, on_delete=models.PROTECT)

    # Snapshot of bank details at payment time (encrypted)
    bank_account = encrypt(models.CharField(max_length=50))
    ifsc_code = encrypt(models.CharField(max_length=20))
    account_holder_name = models.CharField(max_length=200)

    amount = models.DecimalField(max_digits=12, decimal_places=2)

    # Settlement tracking (manual update by Finance)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING',
    )
    utr_number = models.CharField(max_length=50, blank=True, db_index=True)
    settlement_date = models.DateField(null=True, blank=True)
    failure_reason = models.TextField(blank=True)
    bank_reason_code = models.CharField(max_length=10, blank=True)

    # Audit
    status_updated_at = models.DateTimeField(null=True, blank=True)
    status_updated_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='updated_payment_lines',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_payment_lines'
        ordering = ['batch', 'run_employee__employee__employee_id']

    def __str__(self):
        return f"{self.run_employee.employee} — ₹{self.amount} ({self.get_status_display()})"


# ==============================================================================
# 13. PAYSLIP REQUEST (Employee-initiated access)
# ==============================================================================

class PayslipRequest(models.Model):
    """
    Employee requests access to a paid payroll month's payslip.
    Configured PAYSLIP workflow steps approve or reject the request.
    """

    STATUS_CHOICES = [
        ('SUBMITTED', 'Submitted'),
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CLOSED', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.CASCADE,
        related_name='payslip_requests',
    )
    run = models.ForeignKey(PayrollRun, on_delete=models.PROTECT)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='SUBMITTED',
    )
    reason = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='approved_payslip_requests',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'payroll_payslip_requests'
        ordering = ['-requested_at']

    def __str__(self):
        return f"{self.employee} — {self.run} ({self.get_status_display()})"


class PayslipRequestApprovalAction(models.Model):
    """Immutable step assignments and decisions for a payslip request."""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(
        PayslipRequest, on_delete=models.CASCADE, related_name='approval_actions',
    )
    workflow = models.ForeignKey(
        'HRMSapp.ApprovalWorkflow', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='payslip_approval_actions',
    )
    step_number = models.PositiveSmallIntegerField()
    step_name = models.CharField(max_length=100)
    assigned_to = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.PROTECT,
        related_name='payslip_approvals_assigned',
    )
    acted_by = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='payslip_approvals_acted',
    )
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='PENDING')
    comments = models.TextField(blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_payslip_approval_actions'
        ordering = ['step_number', 'created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['request', 'step_number', 'assigned_to'],
                name='unique_payslip_request_step_approver',
            ),
        ]

    def __str__(self):
        return f'{self.request_id} — step {self.step_number}: {self.status}'


# ==============================================================================
# 14. PAYROLL AUDIT LOG (7-year immutable trail)
# ==============================================================================

class PayrollAuditLog(models.Model):
    """
    Immutable audit trail. Never delete, never update.
    Records every status change, salary assignment, payment update.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        PayrollRun, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='audit_logs',
    )
    employee = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL,
    )
    action = models.CharField(
        max_length=100,
        help_text="e.g. RUN_STATUS_CHANGE, SALARY_ASSIGNED, PAYMENT_SETTLED",
    )
    run_status_from = models.CharField(max_length=20, blank=True)
    run_status_to = models.CharField(max_length=20, blank=True)
    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='payroll_audit_actions',
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'payroll_audit_log'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} by {self.performed_by} at {self.timestamp}"


# ==============================================================================
# 15. ARREARS LOG (Retroactive pay adjustments)
# ==============================================================================

class ArrearsLog(models.Model):
    """
    Tracks retroactive pay differences when salary changes are backdated.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        'HRMSapp.Employee', on_delete=models.CASCADE, related_name='arrears',
    )
    component = models.ForeignKey(
        SalaryComponent, null=True, blank=True, on_delete=models.PROTECT,
    )
    component_label = models.CharField(max_length=150, blank=True)
    from_period = models.DateField()
    to_period = models.DateField()
    old_amount = models.DecimalField(max_digits=12, decimal_places=2)
    new_amount = models.DecimalField(max_digits=12, decimal_places=2)
    arrears_amount = models.DecimalField(max_digits=12, decimal_places=2)
    settled_in_run = models.ForeignKey(
        PayrollRun, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='arrears_settled',
    )
    reserved_in_run = models.ForeignKey(
        PayrollRun, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='arrears_reserved',
    )
    source_assignment = models.ForeignKey(
        EmployeeSalaryAssignment, null=True, blank=True, on_delete=models.PROTECT,
        related_name='generated_arrears',
    )
    source_run = models.ForeignKey(
        PayrollRun, null=True, blank=True, on_delete=models.PROTECT,
        related_name='arrears_source_items',
    )
    calculation_snapshot = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_arrears_log'
        ordering = ['-from_period']

    def __str__(self):
        component_label = self.component.code if self.component_id else self.component_label
        return f"{self.employee} — {component_label or 'Payroll adjustment'} ₹{self.arrears_amount}"


class EmployeeExitRequest(models.Model):
    """HR initiated exit request. Approved inputs are frozen for later F&F."""
    STATUS_CHOICES = [
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey('HRMSapp.Employee', on_delete=models.PROTECT, related_name='exit_requests')
    requested_by = models.ForeignKey('HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL, related_name='created_exit_requests')
    workflow = models.ForeignKey('HRMSapp.ApprovalWorkflow', on_delete=models.PROTECT, related_name='exit_requests')
    proposed_exit_date = models.DateField()
    exit_type = models.CharField(max_length=30)
    reason = models.TextField(blank=True)
    settlement_inputs = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='PENDING_APPROVAL')
    current_step_number = models.PositiveSmallIntegerField(default=1)
    rejection_reason = models.TextField(blank=True)
    approved_by = models.ForeignKey('HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL, related_name='approved_exit_requests')
    approved_at = models.DateTimeField(null=True, blank=True)
    frozen_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_employee_exit_requests'
        ordering = ['-created_at']


class EmployeeExitApprovalAction(models.Model):
    """Approval decision trail for an employee exit request."""
    STATUS_CHOICES = [('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected'), ('CANCELLED', 'Cancelled')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(EmployeeExitRequest, on_delete=models.CASCADE, related_name='approval_actions')
    workflow = models.ForeignKey('HRMSapp.ApprovalWorkflow', null=True, blank=True, on_delete=models.SET_NULL)
    step_number = models.PositiveSmallIntegerField()
    step_name = models.CharField(max_length=100)
    assigned_to = models.ForeignKey('HRMSapp.Employee', on_delete=models.PROTECT, related_name='exit_approvals_assigned')
    acted_by = models.ForeignKey('HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL, related_name='exit_approvals_acted')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='PENDING')
    comments = models.TextField(blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_employee_exit_approval_actions'
        ordering = ['step_number', 'created_at']
        constraints = [models.UniqueConstraint(fields=['request', 'step_number', 'assigned_to'], name='unique_exit_request_step_approver')]


class EmployeeExitClearanceItem(models.Model):
    """Persistent stage-2 clearance task, linked to existing module records where possible."""
    CATEGORY_CHOICES = [
        ('ASSET', 'Asset return'), ('REIMBURSEMENT', 'Reimbursement'),
        ('HANDOVER', 'Work handover'), ('OTHER', 'Other clearance'),
    ]
    STATUS_CHOICES = [('PENDING', 'Pending'), ('COMPLETED', 'Completed'), ('WAIVED', 'Exception approved')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(EmployeeExitRequest, on_delete=models.CASCADE, related_name='clearance_items')
    source_key = models.CharField(max_length=120)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    responsible_person = models.CharField(max_length=150, blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    resolution_notes = models.TextField(blank=True)
    exception_reason = models.TextField(blank=True)
    created_by = models.ForeignKey('HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    resolved_by = models.ForeignKey('HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_employee_exit_clearance_items'
        ordering = ['status', 'due_date', 'created_at']
        constraints = [models.UniqueConstraint(fields=['request', 'source_key'], name='unique_exit_clearance_source')]

    def __str__(self):
        return f'{self.request.employee} - {self.title} ({self.status})'


class EmployeeExitDocument(models.Model):
    """Issued exit document metadata; the file itself lives in EmployeeDocument."""
    DOCUMENT_TYPES = [
        ('EXPERIENCE', 'Experience Certificate'),
        ('RELIEVING_LETTER', 'Relieving Letter'),
        ('FNF_STATEMENT', 'Full & Final Settlement Statement'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(EmployeeExitRequest, on_delete=models.PROTECT, related_name='issued_documents')
    employee = models.ForeignKey('HRMSapp.Employee', on_delete=models.PROTECT, related_name='exit_documents')
    employee_document = models.OneToOneField('HRMSapp.EmployeeDocument', on_delete=models.PROTECT, related_name='exit_document_record')
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES)
    issued_by = models.ForeignKey('HRMSapp.Employee', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    issued_at = models.DateTimeField(auto_now_add=True)
    download_count = models.PositiveIntegerField(default=0)
    last_downloaded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'payroll_employee_exit_documents'
        ordering = ['-issued_at']
        constraints = [models.UniqueConstraint(fields=['request', 'document_type'], name='unique_exit_document_type')]

    def __str__(self):
        return f'{self.employee} - {self.get_document_type_display()}'
