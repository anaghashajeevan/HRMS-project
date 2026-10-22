"""
Main payroll calculation engine.

Salary structure components are displayed at their full assigned monthly
amounts. LOP is deducted separately using monthly gross × LOP days ÷ calendar
days. Verified weekend/holiday work is added as a separate extra-pay line.
"""

import logging
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Q
from django.db import transaction
from django.utils import timezone

from .formula_parser import FormulaParser, FormulaError
from .day_reconciliation_service import DayReconciliationService
from .statutory_service import StatutoryService

logger = logging.getLogger(__name__)

# Policy constants
FORMULA_VERSION = '1.0'
QUANTIZE_PAISE = Decimal('0.01')


class PayrollCalculationError(Exception):
    pass


class PayrollCalculationService:
    """
    Deterministic payroll calculator.

    Can be called in two modes:
    1. preview_calculate() — read-only, returns dict (no DB writes)
    2. calculate_for_run() — writes PayrollRunEmployee + Component rows
    """

    # ==========================================================================
    # PREVIEW MODE (no DB writes)
    # ==========================================================================

    @staticmethod
    def preview_calculate(
        employee, period_start, period_end, days_in_month=None, run=None,
        frozen_day_data=None, assignment_override=None,
    ):
        """
        Calculate payroll for one employee without persisting results.
        Useful for 'what-if' previews before locking a run.
        """
        from ..services.assignment_service import AssignmentService

        if days_in_month is None:
            days_in_month = (period_end - period_start).days + 1

        # 1. Get active salary assignment for the period
        assignments = AssignmentService.get_assignment_for_period(
            employee, period_start, period_end,
        )

        if assignment_override is None and not assignments.exists():
            return {
                'ok': False,
                'error': 'No salary assignment active in this period',
                'employee_id': employee.employee_id,
            }

        # Phase 3 policy: use the assignment active on the LAST day of the period
        active_assignment = assignment_override or assignments.filter(
            effective_from__lte=period_end,
        ).filter(
            __import__('django.db.models', fromlist=['Q']).Q(
                effective_to__isnull=True,
            ) | __import__('django.db.models', fromlist=['Q']).Q(
                effective_to__gte=period_end,
            )
        ).order_by('-effective_from').first()

        if active_assignment is None and assignment_override is None:
            # No assignment on last day — use the latest overlapping one
            active_assignment = assignments.order_by('-effective_from').first()

        # 2. Reconcile days
        day_data = frozen_day_data or DayReconciliationService.reconcile(
            employee, period_start, period_end,
            saturday_is_working=run.pay_calendar.saturday_is_working if run else False,
        )
        if frozen_day_data:
            day_data = {
                **day_data,
                'eligible_calendar_days': Decimal(str(day_data['eligible_calendar_days'])),
                'payable_days': Decimal(str(day_data['payable_days'])),
                'lop_days': Decimal(str(day_data['lop_days'])),
                'paid_leave_days': Decimal(str(day_data['paid_leave_days'])),
                'salary_divisor_days': (
                    int(day_data['salary_divisor_days'])
                    if day_data.get('salary_divisor_days') is not None else None
                ),
            }

        # 3. Calculate components
        return PayrollCalculationService._compute(
            employee=employee,
            assignment=active_assignment,
            day_data=day_data,
            days_in_month=days_in_month,
            period_end=period_end,
            run=run,
        )

    # ==========================================================================
    # RUN MODE (writes to DB)
    # ==========================================================================

    @staticmethod
    @transaction.atomic
    def calculate_for_run(run, employee):
        """
        Calculate payroll for one employee within a PayrollRun.
        Creates PayrollRunEmployee + PayrollRunComponentDetail rows.
        """
        from ..models import PayrollRunEmployee, PayrollRunComponentDetail

        period_start = run.pay_calendar.period_start
        period_end = run.pay_calendar.period_end
        days_in_month = run.pay_calendar.days_in_month

        # Off-cycle runs pay only explicitly entered one-time adjustments; they
        # never repeat the employee's monthly salary or attendance calculation.
        run_emp = PayrollRunEmployee.objects.filter(run=run, employee=employee).first()
        if run.run_type == 'OFF_CYCLE':
            result = PayrollCalculationService._compute_offcycle(run, employee, run_emp)
            if not result.get('ok'):
                run_emp, _ = PayrollRunEmployee.objects.update_or_create(
                    run=run, employee=employee,
                    defaults={
                        'status': 'ERROR', 'error_message': result.get('error', 'Off-cycle calculation failed.'),
                        'days_in_month': days_in_month,
                    },
                )
                return run_emp
            run_emp, _ = PayrollRunEmployee.objects.update_or_create(
                run=run, employee=employee,
                defaults={
                    'salary_assignment_id': result['assignment_id'],
                    'eligible_calendar_days': 0, 'days_in_month': days_in_month,
                    'salary_divisor_days': 0, 'payable_days': 0, 'lop_days': 0,
                    'paid_leave_days': 0, 'gross_pay': result['gross_pay'],
                    'total_earnings': result['total_earnings'],
                    'total_deductions': result['total_deductions'],
                    'total_employer_cost': result['total_employer_cost'],
                    'total_reimbursements': result['total_reimbursements'],
                    'total_ctc': result['total_ctc'], 'net_pay': result['net_pay'],
                    'input_snapshot': result['input_snapshot'],
                    'status': 'CALCULATED', 'error_message': '',
                },
            )
            run_emp.component_details.all().delete()
            for component in result['components']:
                PayrollRunComponentDetail.objects.create(
                    run_employee=run_emp,
                    component_id=component.get('component_id'),
                    component_label=component.get('name', ''),
                    amount=component['amount'],
                    is_earning=component['is_earning'],
                    is_employer_cost=component.get('is_employer_cost', False),
                    is_reimbursement=component.get('is_reimbursement', False),
                    formula_used=component.get('formula_used', ''),
                    rule_reference=component.get('rule_reference', ''),
                )
            return run_emp

        # Compute regular monthly, arrears, and F&F runs through the salary engine.
        locked_inputs = (run_emp.input_snapshot or {}).get('locked_inputs', {}) if run_emp else {}
        result = PayrollCalculationService.preview_calculate(
            employee, period_start, period_end, days_in_month, run=run,
            frozen_day_data=locked_inputs.get('day_data'),
            assignment_override=run_emp.salary_assignment if run_emp else None,
        )

        if not result.get('ok'):
            # Create ERROR record for visibility
            run_emp, _ = PayrollRunEmployee.objects.update_or_create(
                run=run,
                employee=employee,
                defaults={
                    'status': 'ERROR',
                    'error_message': result.get('error', 'Unknown error'),
                    'days_in_month': days_in_month,
                    'input_snapshot': {
                        'error': result.get('error'),
                        **({'locked_inputs': locked_inputs} if locked_inputs else {}),
                    },
                },
            )
            return run_emp

        # Create/update run employee
        run_emp, _ = PayrollRunEmployee.objects.update_or_create(
            run=run,
            employee=employee,
            defaults={
                'salary_assignment_id': result['assignment_id'],
                'eligible_calendar_days': result['eligible_calendar_days'],
                'days_in_month': days_in_month,
                'salary_divisor_days': result['salary_divisor_days'],
                'payable_days': result['payable_days'],
                'lop_days': result['lop_days'],
                'paid_leave_days': result['paid_leave_days'],
                'gross_pay': result['gross_pay'],
                'total_earnings': result['total_earnings'],
                'total_deductions': result['total_deductions'],
                'total_employer_cost': result['total_employer_cost'],
                'total_reimbursements': result['total_reimbursements'],
                'total_ctc': result['total_ctc'],
                'net_pay': result['net_pay'],
                'input_snapshot': {
                    **result['input_snapshot'],
                    **({'locked_inputs': locked_inputs} if locked_inputs else {}),
                },
                'status': 'CALCULATED',
                'error_message': '',
            },
        )

        # Replace component details
        run_emp.component_details.all().delete()
        for comp in result['components']:
            PayrollRunComponentDetail.objects.create(
                run_employee=run_emp,
                component_id=comp['component_id'],
                amount=comp['amount'],
                is_earning=comp['is_earning'],
                is_employer_cost=comp['is_employer_cost'],
                is_reimbursement=comp.get('is_reimbursement', False),
                formula_used=comp['formula_used'],
                rule_reference=comp.get('rule_reference', ''),
                component_label=comp.get('name', ''),
            )

        return run_emp

    @staticmethod
    def _compute_offcycle(run, employee, run_employee):
        """Compute an off-cycle payout without repeating ordinary monthly pay."""
        from ..models import EmployeePayrollProfile, PayrollRunAdjustment
        from .assignment_service import AssignmentService

        reference_period_start = run.pay_calendar.period_start
        reference_period_end = run.pay_calendar.period_end
        payment_date = run.payment_date or run.pay_calendar.pay_date
        payment_period_start = date(payment_date.year, payment_date.month, 1)
        assignment = run_employee.salary_assignment if run_employee else None
        if assignment is None:
            assignment = AssignmentService.get_assignment_for_period(
                employee, reference_period_start, reference_period_end,
            ).order_by('-effective_from').first()
        if assignment is None:
            return {'ok': False, 'error': 'An active salary assignment is required for off-cycle tax calculation.'}

        adjustments = list(PayrollRunAdjustment.objects.filter(run=run, employee=employee))
        if not adjustments:
            return {'ok': False, 'error': 'Add at least one bonus, increment difference, correction, or reimbursement before calculating this off-cycle run.'}

        taxable_earnings = sum((
            item.amount for item in adjustments
            if item.adjustment_type == 'VARIABLE_EARNING' and item.taxable
        ), Decimal('0'))
        gross_pay = sum((
            item.amount for item in adjustments if item.adjustment_type == 'VARIABLE_EARNING'
        ), Decimal('0')).quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)
        total_reimbursements = sum((
            item.amount for item in adjustments if item.adjustment_type == 'REIMBURSEMENT'
        ), Decimal('0')).quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)
        total_deductions = sum((
            item.amount for item in adjustments if item.adjustment_type == 'DEDUCTION'
        ), Decimal('0')).quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)
        components = []
        adjustment_snapshot = []
        for item in adjustments:
            adjustment_snapshot.append({
                'id': str(item.id), 'category': item.category, 'label': item.label,
                'amount': str(item.amount), 'taxable': item.taxable,
                'reference_period_start': str(item.reference_period_start) if item.reference_period_start else None,
                'reference_period_end': str(item.reference_period_end) if item.reference_period_end else None,
                'reason': item.reason,
            })
            if item.adjustment_type == 'VARIABLE_EARNING':
                item_label = f'{item.get_category_display()}: {item.label}'
                if item.reference_period_start and item.reference_period_end:
                    item_label += f' ({item.reference_period_start} to {item.reference_period_end})'
                components.append({
                    'component_id': None, 'name': item_label, 'amount': item.amount,
                    'is_earning': True, 'is_employer_cost': False,
                })
            elif item.adjustment_type == 'DEDUCTION':
                components.append({
                    'component_id': None, 'name': item.label, 'amount': item.amount,
                    'is_earning': False, 'is_employer_cost': False,
                })
            elif item.adjustment_type == 'REIMBURSEMENT':
                components.append({
                    'component_id': None, 'name': item.label, 'amount': item.amount,
                    'is_earning': False, 'is_employer_cost': False, 'is_reimbursement': True,
                })

        profile = EmployeePayrollProfile.objects.filter(
            employee=employee, is_active=True, effective_from__lte=payment_date,
        ).filter(
            __import__('django.db.models', fromlist=['Q']).Q(effective_to__isnull=True)
            | __import__('django.db.models', fromlist=['Q']).Q(effective_to__gte=payment_date),
        ).order_by('-effective_from').first()
        tax_regime = profile.tax_regime if profile else 'NEW'
        tax_assignment = AssignmentService.get_assignment_for_period(
            employee, payment_period_start, payment_date,
        ).order_by('-effective_from').first() or assignment
        structure_components = tax_assignment.structure.components.select_related('component').all()
        tds_component = next((
            item for item in structure_components if item.component.code == 'TDS'
        ), None)
        tds_result = None
        if taxable_earnings > 0:
            if tds_component is None:
                return {'ok': False, 'error': 'This employee has taxable off-cycle earnings, but their active salary structure has no TDS component. Add/configure TDS before calculating.'}
            taxable_monthly_projection = Decimal('0')
            breakdown = AssignmentService.preview_breakdown(
                tax_assignment.structure, tax_assignment.ctc_monthly, as_of_date=payment_date,
            )
            taxable_monthly_projection = sum((
                Decimal(str(item.get('amount', 0))) for item in breakdown.get('earnings', [])
                if item.get('is_taxable', True)
            ), Decimal('0'))
            tds_result = StatutoryService.calculate_tds(
                taxable_earnings, taxable_monthly_projection,
                payment_period_start, payment_date, employee=employee,
                tax_regime=tax_regime,
                tax_resident=profile.tax_resident if profile else None,
                current_run_id=run.id,
                current_period_basis={
                    'run_type': 'OFF_CYCLE',
                    'taxable_offcycle_earnings': str(taxable_earnings),
                    'regular_monthly_taxable_projection': str(taxable_monthly_projection),
                    'reference_period_start': str(reference_period_start),
                    'reference_period_end': str(reference_period_end),
                    'payment_date': str(payment_date),
                },
                off_cycle=True,
            )
            if tds_result.get('reason'):
                return {'ok': False, 'error': f"TDS could not be calculated for this taxable off-cycle pay: {tds_result['reason']}"}
            tds_amount = tds_result['amount'].quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)
            total_deductions += tds_amount
            components.append({
                'component_id': tds_component.component_id,
                'name': tds_component.component.name,
                'amount': tds_amount, 'is_earning': False,
                'is_employer_cost': False, 'rule_reference': tds_result.get('rule_id') or '',
            })

        total_deductions = total_deductions.quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)
        net_pay = (gross_pay + total_reimbursements - total_deductions).quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)
        snapshot = {
            'run_type': 'OFF_CYCLE', 'salary_assignment_id': str(assignment.id),
            'structure_name': assignment.structure.name, 'tax_regime': tax_regime,
            'adjustments': adjustment_snapshot,
            'tds': ({**tds_result, 'amount': str(tds_result['amount'])} if tds_result else None),
            'offcycle_taxable_earnings': str(taxable_earnings),
            'fixed_gross_pay_prorated': '0', 'esi_wage_base': '0',
            'formula_version': FORMULA_VERSION, 'frozen_at': timezone.now().isoformat(),
        }
        return {
            'ok': True, 'assignment_id': str(assignment.id),
            'gross_pay': gross_pay, 'total_earnings': gross_pay,
            'total_deductions': total_deductions, 'total_employer_cost': Decimal('0'),
            'total_reimbursements': total_reimbursements, 'total_ctc': gross_pay,
            'net_pay': net_pay, 'components': components, 'input_snapshot': snapshot,
        }

    # ==========================================================================
    # CORE COMPUTATION
    # ==========================================================================

    @staticmethod
    def _compute(employee, assignment, day_data, days_in_month, period_end, run=None):
        """
        Internal: pure computation. No DB writes.
        Returns a dict with everything needed to persist or preview.
        """
        from ..models import SalaryStructureComponent, EmployeePayrollProfile

        parser = FormulaParser()

        structure = assignment.structure
        ctc_monthly = assignment.ctc_monthly
        eligible_days = day_data['eligible_calendar_days']
        payable_days = day_data['payable_days']
        lop_days = day_data['lop_days']
        # Show the assigned monthly component values as-is. LOP is represented
        # by a separate deduction and off-day work by a separate earning line.
        salary_divisor_days = days_in_month
        salary_divisor_days_dec = Decimal(str(salary_divisor_days))

        if salary_divisor_days_dec == 0:
            raise PayrollCalculationError('Pay period must contain at least one calendar day.')

        # Get structure components (ordered)
        structure_comps = SalaryStructureComponent.objects.filter(
            structure=structure, is_enabled=True,
        ).select_related('component').order_by(
            'component__component_type', 'component__display_order',
        )

        # Get employee's payroll profile for tax regime + jurisdiction
        profile = EmployeePayrollProfile.objects.filter(
            employee=employee, is_active=True,
            effective_from__lte=period_end,
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=period_end),
        ).order_by('-effective_from').first()

        tax_regime = profile.tax_regime if profile else 'NEW'
        jurisdiction = PayrollCalculationService._resolve_jurisdiction(employee)

        # ------------------------------------------------------------------
        # PASS 1: Compute BASIC (full month value)
        # ------------------------------------------------------------------
        basic_full = Decimal('0')
        for sc in structure_comps:
            if sc.component.code == 'BASIC':
                if sc.amount > 0:
                    basic_full = sc.amount
                elif sc.percentage_of_basic > 0:
                    # Basic as % of CTC
                    basic_full = (
                        ctc_monthly * sc.percentage_of_basic / Decimal('100')
                    )
                elif sc.component.formula:
                    basic_full = parser.evaluate(
                        sc.component.formula,
                        {'basic': Decimal('0'), 'ctc': ctc_monthly, 'gross': Decimal('0')},
                    )
                break

        if basic_full == 0:
            # Default: Basic = 40% of CTC
            basic_full = ctc_monthly * Decimal('0.40')

        basic_full = basic_full.quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)

        # ------------------------------------------------------------------
        # PASS 2: Compute all EARNINGS (full month values)
        # ------------------------------------------------------------------
        earnings_full = {}  # {component_id: {name, code, full_amount, formula, ...}}
        total_earnings_full = Decimal('0')

        # Running context for formulas (updated as we compute)
        formula_context = {
            'basic': basic_full,
            'ctc': ctc_monthly,
            'gross': Decimal('0'),  # Updated after all earnings calculated
        }

        for sc in structure_comps:
            comp = sc.component
            if comp.component_type != 'EARNING':
                continue

            full_amount = PayrollCalculationService._calc_component_value(
                sc, basic_full, ctc_monthly, formula_context, parser,
            )

            earnings_full[comp.id] = {
                'component_id': comp.id,
                'code': comp.code,
                'name': comp.name,
                'full_amount': full_amount,
                'formula_used': sc.component.formula if not sc.component.is_fixed else '',
                'is_earning': True,
                'is_employer_cost': False,
                'is_taxable': comp.is_taxable,
            }
            total_earnings_full += full_amount

            # Update context for subsequent formulas
            if comp.code == 'HRA':
                formula_context['hra'] = full_amount

        # CTC is gross earnings plus employer costs. Use Special Allowance as
        # the balancing component only when the structure explicitly includes it.
        special_sc = structure_comps.filter(component__code='SPECIAL').first()
        if special_sc and special_sc.component.id in earnings_full:
            special = earnings_full[special_sc.component.id]
            non_special = total_earnings_full - special['full_amount']
            candidate = max(
                Decimal('0'),
                ctc_monthly - non_special,
            )
            for _ in range(12):
                candidate_gross = non_special + candidate
                er_cost = PayrollCalculationService._estimate_employer_cost(
                    structure_comps, basic_full, candidate_gross, ctc_monthly,
                    period_end, parser,
                )
                # Employer statutory costs can change with their effective
                # rules between assignment creation and this pay period. Keep
                # the assigned CTC balanced using this period's active rules;
                # SPECIAL is the structure's balancing line for that purpose.
                next_candidate = max(Decimal('0'), ctc_monthly - non_special - er_cost)
                if next_candidate == candidate:
                    break
                candidate = next_candidate
            special['full_amount'] = candidate.quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)
            total_earnings_full = non_special + special['full_amount']

        package_cost = total_earnings_full + PayrollCalculationService._estimate_employer_cost(
            structure_comps, basic_full, total_earnings_full, ctc_monthly,
            period_end, parser,
        )
        if abs(package_cost - ctc_monthly) > QUANTIZE_PAISE:
            raise PayrollCalculationError(
                'Salary structure does not reconcile to assigned CTC. '
                f'Gross plus employer costs is ₹{package_cost}, while assigned '
                f'monthly CTC is ₹{ctc_monthly}. Review the structure and its '
                'employer-cost components.'
            )

        # ------------------------------------------------------------------
        # Update gross in formula context
        # ------------------------------------------------------------------
        formula_context['gross'] = total_earnings_full

        # ------------------------------------------------------------------
        # PASS 3: Keep monthly structure components unchanged on the payslip.
        # Apply LOP as its own deduction and add off-day attendance separately.
        # ------------------------------------------------------------------
        prorated_earnings = []
        off_day_worked = Decimal(str(day_data.get('summary', {}).get('off_day_worked', 0)))
        eligible_paid_days = max(eligible_days - lop_days, Decimal('0'))
        non_eligible_days = max(Decimal(str(days_in_month)) - eligible_days, Decimal('0'))
        unpaid_salary_days = non_eligible_days + lop_days
        lop_deduction = PayrollCalculationService.prorate_monthly_amount(
            total_earnings_full, unpaid_salary_days, salary_divisor_days_dec,
        )
        off_day_extra_pay = PayrollCalculationService.prorate_monthly_amount(
            total_earnings_full, off_day_worked, salary_divisor_days_dec,
        )
        paid_salary_days = eligible_paid_days + off_day_worked
        paid_wage_factor = paid_salary_days / salary_divisor_days_dec
        paid_wage_gross = PayrollCalculationService.prorate_monthly_amount(
            total_earnings_full, paid_salary_days, salary_divisor_days_dec,
        )
        total_earnings_reported = total_earnings_full + off_day_extra_pay

        for comp_id, data in earnings_full.items():
            data['amount'] = data['full_amount'].quantize(
                QUANTIZE_PAISE, rounding=ROUND_HALF_UP,
            )
            prorated_earnings.append(data)

        if off_day_extra_pay > 0:
            prorated_earnings.append({
                'component_id': None,
                'code': None,
                'name': f'Weekend/Holiday Work ({off_day_worked} days)',
                'amount': off_day_extra_pay,
                'formula_used': '',
                'is_earning': True,
                'is_employer_cost': False,
            })

        # ------------------------------------------------------------------
        # PASS 4: PF uses assigned Basic; ESI uses full fixed monthly gross.
        # ------------------------------------------------------------------
        basic_paid = PayrollCalculationService.prorate_monthly_amount(
            basic_full, paid_salary_days, salary_divisor_days_dec,
        )

        # Formula based deductions use the payable wage base, while the salary
        # earnings rows continue to show their full assigned monthly amounts.
        deduction_context = {
            'basic': basic_paid,
            'ctc': ctc_monthly,
            'gross': paid_wage_gross,
        }

        deductions = []
        employer_costs = []
        total_deductions = lop_deduction
        total_employer = Decimal('0')
        tds_breakdown = None
        from ..models import PayrollRunAdjustment
        run_adjustments = list(PayrollRunAdjustment.objects.filter(
            run=run, employee=employee,
        )) if run else []
        taxable_adjustments = sum((
            item.amount for item in run_adjustments
            if item.adjustment_type == 'VARIABLE_EARNING' and item.taxable
        ), Decimal('0'))
        # LOP and run-specific variable earnings do not change the fixed ESI base.
        esi_wage_base = total_earnings_full
        split_pf = any(sc.component.code in ('EPS_ER', 'EPF_ER') for sc in structure_comps)

        if lop_deduction > 0:
            deductions.append({
                'component_id': None,
                'code': None,
                'name': f'Leave / LOP Deduction ({unpaid_salary_days} unpaid days)',
                'amount': lop_deduction,
                'formula_used': f'{total_earnings_full} × {unpaid_salary_days} ÷ {salary_divisor_days}',
                'rule_reference': '',
                'is_earning': False,
                'is_employer_cost': False,
            })

        for sc in structure_comps:
            comp = sc.component
            if comp.component_type not in ('DEDUCTION', 'EMPLOYER_COST'):
                continue
            if comp.code == 'PF_ER' and split_pf:
                continue

            # Statutory override: PF/ESI/PT use StatutoryService
            amount = None
            rule_ref = ''

            if comp.code in ('PF_EMP', 'PF_ER', 'EPS_ER', 'EPF_ER'):
                # PF/EPS/EPF are structure percentages of the assigned full
                # monthly Basic. LOP reduces salary earnings, not this basis.
                configured_rate = sc.percentage_of_basic if sc.percentage_of_basic > 0 else None
                pf = StatutoryService.calculate_pf(
                    basic_full,
                    period_end,
                    employee_rate=configured_rate if comp.code == 'PF_EMP' else None,
                    employer_rate=configured_rate if comp.code == 'PF_ER' else None,
                    pension_rate=configured_rate if comp.code == 'EPS_ER' else None,
                    epf_rate=configured_rate if comp.code == 'EPF_ER' else None,
                )
                if comp.code == 'PF_EMP':
                    amount = pf['employee']
                elif comp.code == 'EPS_ER':
                    amount = pf.get('pension', Decimal('0'))
                elif comp.code == 'EPF_ER':
                    amount = pf.get('employer_epf', pf['employer'])
                else:
                    amount = pf['employer']
                rule_ref = pf.get('rule_id') or ''

            elif comp.code in ('ESI_EMP', 'ESI_ER'):
                configured_rate = sc.percentage_of_basic if sc.percentage_of_basic > 0 else None
                esi = StatutoryService.calculate_esi(
                    esi_wage_base,
                    period_end,
                    employee_rate=configured_rate if comp.code == 'ESI_EMP' else None,
                    employer_rate=configured_rate if comp.code == 'ESI_ER' else None,
                )
                amount = esi['employee'] if comp.code == 'ESI_EMP' else esi['employer']
                rule_ref = esi.get('rule_id') or ''

            elif comp.code == 'PT':
                pt = StatutoryService.calculate_pt(
                    paid_wage_gross, period_end, jurisdiction,
                )
                amount = pt['amount']
                rule_ref = pt.get('rule_id') or ''

            elif comp.code == 'TDS':
                taxable_full_month = sum(
                    (item['full_amount'] for item in earnings_full.values() if item.get('is_taxable')),
                    Decimal('0'),
                )
                taxable_current_period = PayrollCalculationService.prorate_monthly_amount(
                    taxable_full_month, paid_salary_days, salary_divisor_days_dec,
                )
                taxable_current_period += taxable_adjustments
                tax_payment_date = (
                    (run.payment_date or run.pay_calendar.pay_date)
                    if run else period_end
                )
                tax_period_start = date(
                    tax_payment_date.year, tax_payment_date.month, 1,
                )
                tds = StatutoryService.calculate_tds(
                    taxable_current_period, taxable_full_month,
                    tax_period_start,
                    tax_payment_date,
                    employee=employee, tax_regime=tax_regime,
                    tax_resident=profile.tax_resident if profile else None,
                    current_run_id=run.id if run else None,
                    current_period_basis={
                        'full_month_taxable_salary': str(taxable_full_month),
                        'taxable_run_adjustments': str(taxable_adjustments),
                        'eligible_calendar_days': str(eligible_days),
                        'lop_days': str(lop_days),
                        'attendance_payable_days': str(payable_days),
                        'off_day_worked': str(off_day_worked),
                        'salary_calendar_day_equivalent': str(paid_salary_days),
                        'calendar_day_divisor': str(salary_divisor_days_dec),
                    },
                )
                amount = tds['amount']
                rule_ref = tds.get('rule_id') or ''
                tds_breakdown = tds

            else:
                # Non-statutory: use structure amount or formula
                amount = PayrollCalculationService._calc_component_value(
                    sc, basic_paid, ctc_monthly, deduction_context, parser,
                )

            amount = amount.quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)

            entry = {
                'component_id': comp.id,
                'code': comp.code,
                'name': comp.name,
                'amount': amount,
                'formula_used': comp.formula if not comp.is_fixed else '',
                'rule_reference': rule_ref,
                'is_earning': False,
                'is_employer_cost': comp.component_type == 'EMPLOYER_COST',
            }

            if comp.component_type == 'DEDUCTION':
                deductions.append(entry)
                total_deductions += amount
            else:
                employer_costs.append(entry)
                total_employer += amount

        # ------------------------------------------------------------------
        # TOTALS (sum of rounded components, then quantize for safety)
        # ------------------------------------------------------------------
        gross_pay = total_earnings_reported.quantize(QUANTIZE_PAISE)
        # Structure earnings are the employee's fixed gross salary. Monthly
        # variable earnings are paid on top and are not part of the assigned
        # fixed CTC package (employer contributions are calculated on fixed
        # gross above, before these run-specific adjustments are added).
        fixed_gross_pay = paid_wage_gross
        total_variable_earnings = Decimal('0')
        # Run adjustments are explicit month-only lines. Approved reimbursements
        # add to payout but remain outside CTC and gross earnings.
        adjustments = run_adjustments
        total_reimbursements = Decimal('0')
        for adjustment in adjustments:
            amount = adjustment.amount.quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)
            if adjustment.adjustment_type == 'VARIABLE_EARNING':
                gross_pay += amount
                total_variable_earnings += amount
                data = {
                    'component_id': None, 'code': None, 'name': adjustment.label,
                    'amount': amount, 'formula_used': '', 'is_earning': True,
                    'is_employer_cost': False,
                }
                prorated_earnings.append(data)
            elif adjustment.adjustment_type == 'DEDUCTION':
                total_deductions += amount
                deductions.append({
                    'component_id': None, 'code': None, 'name': adjustment.label,
                    'amount': amount, 'formula_used': '', 'rule_reference': '',
                    'is_earning': False, 'is_employer_cost': False,
                })
            elif adjustment.adjustment_type == 'REIMBURSEMENT':
                total_reimbursements += amount
                prorated_earnings.append({
                    'component_id': None, 'code': None, 'name': adjustment.label,
                    'amount': amount, 'formula_used': '', 'is_earning': False,
                    'is_employer_cost': False, 'is_reimbursement': True,
                })
        net_pay = (gross_pay + total_reimbursements - total_deductions).quantize(QUANTIZE_PAISE)
        total_ctc = (fixed_gross_pay + total_employer).quantize(QUANTIZE_PAISE)

        # ------------------------------------------------------------------
        # BUILD INPUT SNAPSHOT (for reproducibility)
        # ------------------------------------------------------------------
        snapshot = {
            'salary_assignment_id': str(assignment.id),
            'ctc_monthly': str(ctc_monthly),
            'structure_id': str(structure.id),
            'structure_name': structure.name,
            'structure_version': structure.version,
            'tax_regime': tax_regime,
            'tds': ({**tds_breakdown, 'amount': str(tds_breakdown['amount'])} if tds_breakdown else None),
            'jurisdiction': jurisdiction,
            'period_start': str(assignment.effective_from),
            'eligible_calendar_days': str(eligible_days),
            'days_in_month': days_in_month,
            'salary_divisor_days': salary_divisor_days,
            'payable_days': str(payable_days),
            'lop_days': str(lop_days),
            'paid_leave_days': str(day_data['paid_leave_days']),
            'basic_full_month': str(basic_full),
            'basic_prorated': str(basic_paid),
            'basic_full_month_displayed': str(basic_full),
            'fixed_salary_monthly': str(total_earnings_full),
            'fixed_gross_pay_prorated': str(fixed_gross_pay),
            'leave_deduction': str(lop_deduction),
            'non_eligible_days': str(non_eligible_days),
            'unpaid_salary_days': str(unpaid_salary_days),
            'off_day_worked': str(off_day_worked),
            'off_day_extra_pay': str(off_day_extra_pay),
            'variable_earnings': str(total_variable_earnings),
            'esi_wage_base': str(esi_wage_base),
            'prorate_factor': str(paid_wage_factor),
            'attendance_summary': day_data['summary'],
            'leaves': day_data['leave_breakdown'],
            'formula_version': FORMULA_VERSION,
            'frozen_at': timezone.now().isoformat(),
        }

        # ------------------------------------------------------------------
        # RESULT
        # ------------------------------------------------------------------
        all_components = prorated_earnings + deductions + employer_costs

        return {
            'ok': True,
            'employee_id': employee.employee_id,
            'assignment_id': str(assignment.id),
            'eligible_calendar_days': eligible_days,
            'days_in_month': days_in_month,
            'salary_divisor_days': salary_divisor_days,
            'payable_days': payable_days,
            'lop_days': lop_days,
            'paid_leave_days': day_data['paid_leave_days'],
            'gross_pay': gross_pay,
            'total_earnings': gross_pay,
            'fixed_salary_monthly': total_earnings_full,
            'fixed_gross_pay_prorated': fixed_gross_pay,
            'total_variable_earnings': total_variable_earnings.quantize(QUANTIZE_PAISE),
            'esi_wage_base': esi_wage_base.quantize(QUANTIZE_PAISE),
            'total_deductions': total_deductions.quantize(QUANTIZE_PAISE),
            'total_employer_cost': total_employer.quantize(QUANTIZE_PAISE),
            'total_reimbursements': total_reimbursements.quantize(QUANTIZE_PAISE),
            'total_ctc': total_ctc,
            'net_pay': net_pay,
            'components': all_components,
            'input_snapshot': snapshot,
        }

    # ==========================================================================
    # HELPERS
    # ==========================================================================

    @staticmethod
    def prorate_monthly_amount(monthly_amount, payable_days, salary_divisor_days):
        """Calculate a calendar-day amount, rounding only the final result."""
        divisor = Decimal(str(salary_divisor_days))
        if divisor <= 0:
            return Decimal('0.00')
        return (
            Decimal(str(monthly_amount)) * Decimal(str(payable_days)) / divisor
        ).quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)

    @staticmethod
    def _calc_component_value(sc, basic, ctc, context, parser):
        """
        Calculate a single component's full-month amount.
        Order of precedence:
          1. sc.amount (fixed)
          2. sc.percentage_of_basic (percent)
          3. sc.component.formula (formula)
        """
        if sc.amount and sc.amount > 0:
            return sc.amount

        if sc.percentage_of_basic and sc.percentage_of_basic > 0:
            return (basic * sc.percentage_of_basic / Decimal('100')).quantize(
                QUANTIZE_PAISE, rounding=ROUND_HALF_UP,
            )

        if sc.component.formula:
            try:
                return parser.evaluate(sc.component.formula, context).quantize(
                    QUANTIZE_PAISE, rounding=ROUND_HALF_UP,
                )
            except FormulaError as e:
                logger.warning(
                    f"Formula failed for {sc.component.code}: {e}"
                )
                raise PayrollCalculationError(
                    f"Formula failed for {sc.component.code}: {e}"
                )

        return Decimal('0')

    @staticmethod
    def _estimate_employer_cost(structure_comps, basic, gross, ctc, as_of_date, parser):
        """Estimate configured employer costs while solving the CTC balancing allowance."""
        codes = {sc.component.code for sc in structure_comps}
        split_pf = 'EPS_ER' in codes or 'EPF_ER' in codes
        context = {'basic': basic, 'ctc': ctc, 'gross': gross}
        total = Decimal('0')
        for sc in structure_comps:
            comp = sc.component
            if comp.component_type != 'EMPLOYER_COST':
                continue
            if comp.code == 'PF_ER' and split_pf:
                continue
            if comp.code in ('PF_ER', 'EPS_ER', 'EPF_ER'):
                configured_rate = sc.percentage_of_basic if sc.percentage_of_basic > 0 else None
                pf = StatutoryService.calculate_pf(
                    basic,
                    as_of_date,
                    employer_rate=configured_rate if comp.code == 'PF_ER' else None,
                    pension_rate=configured_rate if comp.code == 'EPS_ER' else None,
                    epf_rate=configured_rate if comp.code == 'EPF_ER' else None,
                )
                amount = pf['employer'] if comp.code == 'PF_ER' else (
                    pf.get('pension', Decimal('0')) if comp.code == 'EPS_ER'
                    else pf.get('employer_epf', pf['employer'])
                )
            elif comp.code == 'ESI_ER':
                configured_rate = sc.percentage_of_basic if sc.percentage_of_basic > 0 else None
                amount = StatutoryService.calculate_esi(
                    gross, as_of_date, employer_rate=configured_rate,
                )['employer']
            else:
                amount = PayrollCalculationService._calc_component_value(
                    sc, basic, ctc, context, parser,
                )
            total += amount
        return total.quantize(QUANTIZE_PAISE, rounding=ROUND_HALF_UP)

    @staticmethod
    def _resolve_jurisdiction(employee):
        """
        Resolve the state code for an employee (used for PT).
        Falls back to 'ALL' if no state found.
        """
        location = employee.location or employee.structure_location
        if location and hasattr(location, 'state_code') and location.state_code:
            return location.state_code
        if location and hasattr(location, 'name'):
            # Fallback: parse state from name if available
            # This is a weak heuristic — ideally HR Admin sets state_code on CompanyStructure
            pass
        return 'ALL'
