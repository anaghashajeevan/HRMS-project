"""
Salary assignment service.
Handles: overlap validation, effective-dating, auto-close, preview.
"""

import logging
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


class AssignmentError(Exception):
    pass


class AssignmentService:
    """Manages employee salary assignments with immutable history."""

    # ==========================================================================
    # OVERLAP VALIDATION
    # ==========================================================================

    @staticmethod
    def check_overlap(employee, effective_from, effective_to=None, exclude_id=None):
        """
        Check if a new assignment would overlap with existing ones.

        Two ranges [A_from, A_to] and [B_from, B_to] overlap when:
            A_from <= B_to AND B_from <= A_to
        (treating NULL effective_to as infinity)

        Returns: list of overlapping assignment objects (empty = no overlap)
        """
        from ..models import EmployeeSalaryAssignment

        existing = EmployeeSalaryAssignment.objects.filter(employee=employee)
        if exclude_id:
            existing = existing.exclude(id=exclude_id)

        overlaps = []
        for assignment in existing:
            a_from = assignment.effective_from
            a_to = assignment.effective_to  # None = infinity

            # Check overlap
            # New range: [effective_from, effective_to or infinity]
            # Existing range: [a_from, a_to or infinity]
            # Overlap if: effective_from <= a_to AND a_from <= effective_to

            if a_to is not None and effective_from > a_to:
                continue  # New starts after existing ends

            if effective_to is not None and a_from > effective_to:
                continue  # Existing starts after new ends

            overlaps.append(assignment)

        return overlaps

    # ==========================================================================
    # CREATE ASSIGNMENT
    # ==========================================================================

    @staticmethod
    @transaction.atomic
    def assign_salary(
        employee, structure, ctc_annual, ctc_monthly,
        effective_from, reason='', created_by=None, effective_to=None,
        fixed_salary_monthly=None,
    ):
        """
        Create a new salary assignment with overlap handling.

        Rules:
        1. Check for overlaps with CLOSED assignments → reject
        2. If there's an ACTIVE assignment (effective_to=NULL) that starts
           BEFORE the new one → auto-close it at effective_from - 1 day
        3. If there's an ACTIVE assignment that starts ON OR AFTER the new
           one → reject (ambiguous)
        4. Create the new assignment
        """
        from ..models import EmployeeSalaryAssignment

        # Step 1: Check overlaps with closed assignments
        overlaps = AssignmentService.check_overlap(
            employee, effective_from, effective_to,
        )

        for overlap in overlaps:
            if overlap.effective_to is not None:
                # Overlap with a CLOSED assignment → reject
                raise AssignmentError(
                    f"Overlaps with existing assignment "
                    f"({overlap.effective_from} → {overlap.effective_to}, "
                    f"₹{overlap.ctc_monthly}/mo). "
                    f"Adjust dates to avoid overlap."
                )

            # Overlap with an ACTIVE assignment (effective_to = NULL)
            if overlap.effective_from >= effective_from:
                raise AssignmentError(
                    f"An active assignment already exists from "
                    f"{overlap.effective_from} (₹{overlap.ctc_monthly}/mo). "
                    f"New assignment cannot start on or before an active one."
                )

            # Active assignment starts BEFORE new one → auto-close it
            overlap.effective_to = effective_from - timedelta(days=1)
            overlap.save(update_fields=['effective_to', 'updated_at'])
            logger.info(
                f"Auto-closed assignment {overlap.id} for {employee.employee_id} "
                f"at {overlap.effective_to}"
            )

        # Step 2: Create new assignment
        assignment = EmployeeSalaryAssignment.objects.create(
            employee=employee,
            structure=structure,
            ctc_annual=ctc_annual,
            ctc_monthly=ctc_monthly,
            fixed_salary_monthly=fixed_salary_monthly,
            effective_from=effective_from,
            effective_to=effective_to,
            reason=reason,
            created_by=created_by,
        )

        # Step 3: Audit log
        from ..models import PayrollAuditLog
        PayrollAuditLog.objects.create(
            employee=employee,
            action='SALARY_ASSIGNED',
            new_values={
                'assignment_id': str(assignment.id),
                'structure': structure.name,
                'ctc_annual': str(ctc_annual),
                'ctc_monthly': str(ctc_monthly),
                'fixed_salary_monthly': str(fixed_salary_monthly) if fixed_salary_monthly is not None else None,
                'effective_from': str(effective_from),
            },
            reason=reason,
            performed_by=created_by,
        )

        logger.info(
            f"✅ Salary assigned: {employee.employee_id} → "
            f"₹{ctc_monthly}/mo from {effective_from}"
        )
        return assignment

    # ==========================================================================
    # GET ACTIVE ASSIGNMENT
    # ==========================================================================

    @staticmethod
    def get_active_assignment(employee, as_of_date=None):
        """
        Get the salary assignment active on a given date.
        If as_of_date is None, uses today.
        """
        from ..models import EmployeeSalaryAssignment

        if as_of_date is None:
            as_of_date = timezone.localdate()

        return EmployeeSalaryAssignment.objects.filter(
            employee=employee,
            effective_from__lte=as_of_date,
        ).filter(
            models_Q_effective_to_gte_or_null(as_of_date)
        ).order_by('-effective_from').first()

    @staticmethod
    def get_assignment_for_period(employee, period_start, period_end):
        """
        Get the assignment(s) covering a pay period.
        Returns a list (usually 1, but 2 if mid-month change).
        """
        from ..models import EmployeeSalaryAssignment

        return EmployeeSalaryAssignment.objects.filter(
            employee=employee,
            effective_from__lte=period_end,
        ).filter(
            models_Q_effective_to_gte_or_null(period_start)
        ).order_by('effective_from')

    # ==========================================================================
    # PREVIEW BREAKDOWN
    # ==========================================================================

    @staticmethod
    def preview_breakdown(structure, ctc_monthly, as_of_date=None):
        """
        Preview monthly salary breakdown for a structure + CTC.
        This is a simplified preview — the full calculation engine
        with formulas and statutory rules comes in Phase 3.

        Returns: {
            'earnings': [{'code', 'name', 'amount'}, ...],
            'deductions': [{'code', 'name', 'amount'}, ...],
            'employer_costs': [{'code', 'name', 'amount'}, ...],
            'gross': Decimal,
            'total_deductions': Decimal,
            'net': Decimal,
            'total_employer_cost': Decimal,
        }
        """
        from ..models import SalaryStructureComponent
        from .formula_parser import FormulaParser
        from .statutory_service import StatutoryService
        from django.utils import timezone

        as_of_date = as_of_date or timezone.localdate()

        components = SalaryStructureComponent.objects.filter(
            structure=structure, is_enabled=True,
        ).select_related('component').order_by(
            'component__component_type', 'component__display_order',
        )

        parser = FormulaParser()
        # First pass: find Basic amount (needed for percentage calculations)
        basic_amount = Decimal('0')
        for sc in components:
            if sc.component.code == 'BASIC':
                if sc.amount > 0:
                    basic_amount = sc.amount
                elif sc.percentage_of_basic > 0:
                    # Basic as % of CTC: solve for Basic
                    # If percentage_of_basic = 40, Basic = CTC × 40/100
                    basic_amount = (
                        ctc_monthly * sc.percentage_of_basic / Decimal('100')
                    ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                elif sc.component.formula:
                    basic_amount = parser.evaluate(
                        sc.component.formula,
                        {'basic': Decimal('0'), 'ctc': ctc_monthly, 'gross': Decimal('0')},
                    ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                break

        # If no Basic component found, use 40% of CTC as default
        if basic_amount == 0:
            basic_amount = (
                ctc_monthly * Decimal('0.40')
            ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Calculate fixed earnings first so deductions such as ESI can use
        # gross fixed salary even though DEDUCTION sorts before EARNING.
        formula_context = {'basic': basic_amount, 'ctc': ctc_monthly, 'gross': Decimal('0')}
        earnings = []
        deductions = []
        employer_costs = []
        total_deductions = Decimal('0')
        earnings_components = [sc for sc in components if sc.component.component_type == 'EARNING']
        deduction_components = [sc for sc in components if sc.component.component_type == 'DEDUCTION']
        employer_components = [sc for sc in components if sc.component.component_type == 'EMPLOYER_COST']

        def component_amount(sc, context):
            if sc.amount > 0:
                return sc.amount
            if sc.percentage_of_basic > 0:
                return (basic_amount * sc.percentage_of_basic / Decimal('100')).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP,
                )
            if sc.component.formula:
                return parser.evaluate(sc.component.formula, context).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP,
                )
            return Decimal('0')

        special_component = next(
            (sc for sc in earnings_components if sc.component.code == 'SPECIAL'), None,
        )
        split_pf = any(sc.component.code in ('EPS_ER', 'EPF_ER') for sc in employer_components)
        for sc in earnings_components:
            if sc.component.code == 'SPECIAL':
                continue  # SPECIAL is the CTC balancing line, as in payroll runs.
            amount = component_amount(sc, formula_context)
            earnings.append({
                'code': sc.component.code,
                'name': sc.component.name,
                'amount': str(amount),
                'is_taxable': sc.component.is_taxable,
            })
            formula_context['gross'] += amount
            if sc.component.code == 'HRA':
                formula_context['hra'] = amount

        non_special_earnings = formula_context['gross']

        def calculate_employer_costs(gross):
            context = {'basic': basic_amount, 'ctc': ctc_monthly, 'gross': gross}
            rows = []
            total = Decimal('0')
            for employer_component in employer_components:
                code = employer_component.component.code
                calculation_details = {}
                if code == 'PF_ER' and split_pf:
                    continue
                if code in ('PF_ER', 'EPS_ER', 'EPF_ER'):
                    configured_rate = (
                        employer_component.percentage_of_basic
                        if employer_component.percentage_of_basic > 0 else None
                    )
                    pf = StatutoryService.calculate_pf(
                        basic_amount,
                        as_of_date,
                        employer_rate=configured_rate if code == 'PF_ER' else None,
                        pension_rate=configured_rate if code == 'EPS_ER' else None,
                        epf_rate=configured_rate if code == 'EPF_ER' else None,
                    )
                    if code == 'EPS_ER':
                        amount = pf.get('pension', Decimal('0'))
                    elif code == 'EPF_ER':
                        amount = pf.get('employer_epf', pf['employer'])
                    else:
                        amount = pf['employer']
                elif code == 'ESI_ER':
                    configured_rate = (
                        employer_component.percentage_of_basic
                        if employer_component.percentage_of_basic > 0 else None
                    )
                    esi = StatutoryService.calculate_esi(
                        gross, as_of_date, employer_rate=configured_rate,
                    )
                    amount = esi['employer']
                    calculation_details = {
                        'applicable': esi['applicable'],
                        'rate': str(esi['employer_rate']),
                        'wage_base': str(esi['wage_used']),
                        'threshold': str(esi['threshold']) if esi.get('threshold') is not None else None,
                        'reason': esi.get('reason', ''),
                    }
                else:
                    amount = component_amount(employer_component, context)
                rows.append({
                    'code': employer_component.component.code,
                    'name': employer_component.component.name,
                    'amount': str(amount),
                    'is_taxable': employer_component.component.is_taxable,
                    **calculation_details,
                })
                total += amount
            return rows, total

        # ESI employer contribution depends on gross fixed salary, while gross
        # is the CTC remainder after employer costs. Iterate to paise precision.
        total_earnings = non_special_earnings
        total_employer = Decimal('0')
        employer_costs = []
        for _ in range(20):
            employer_costs, total_employer = calculate_employer_costs(total_earnings)
            special_amount = max(Decimal('0'), ctc_monthly - total_employer - non_special_earnings)
            new_total_earnings = non_special_earnings + special_amount
            if new_total_earnings == total_earnings:
                break
            total_earnings = new_total_earnings
        employer_costs, total_employer = calculate_employer_costs(total_earnings)
        special_amount = max(Decimal('0'), ctc_monthly - total_employer - non_special_earnings)
        total_earnings = non_special_earnings + special_amount

        if special_component or special_amount:
            earnings.append({
                'code': 'SPECIAL',
                'name': special_component.component.name if special_component else 'Special Allowance (Balancing)',
                'amount': str(special_amount),
                'is_taxable': special_component.component.is_taxable if special_component else True,
            })

        # Evaluate deductions only after final gross fixed earnings is known.
        deduction_context = {'basic': basic_amount, 'ctc': ctc_monthly, 'gross': total_earnings}
        for sc in deduction_components:
            calculation_details = {}
            if sc.component.code == 'PF_EMP':
                configured_rate = sc.percentage_of_basic if sc.percentage_of_basic > 0 else None
                amount = StatutoryService.calculate_pf(
                    basic_amount, as_of_date, employee_rate=configured_rate,
                )['employee']
            elif sc.component.code == 'ESI_EMP':
                configured_rate = sc.percentage_of_basic if sc.percentage_of_basic > 0 else None
                esi = StatutoryService.calculate_esi(
                    total_earnings, as_of_date, employee_rate=configured_rate,
                )
                amount = esi['employee']
                calculation_details = {
                    'applicable': esi['applicable'],
                    'rate': str(esi['employee_rate']),
                    'wage_base': str(esi['wage_used']),
                    'threshold': str(esi['threshold']) if esi.get('threshold') is not None else None,
                    'reason': esi.get('reason', ''),
                }
            elif sc.component.code == 'TDS':
                # A structure preview has no employee tax profile, tax regime,
                # declarations, or payroll-period history. Do not present a
                # zero placeholder as an actual TDS calculation.
                amount = Decimal('0')
                calculation_details = {
                    'calculated_in_employee_payroll': True,
                    'reason': 'TDS is calculated in employee payroll using the employee tax profile and effective rule.',
                }
            else:
                amount = component_amount(sc, deduction_context)
            deductions.append({
                'code': sc.component.code,
                'name': sc.component.name,
                'amount': None if sc.component.code == 'TDS' else str(amount),
                'is_taxable': sc.component.is_taxable,
                **calculation_details,
            })
            total_deductions += amount

        net = (total_earnings - total_deductions).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP,
        )

        return {
            'earnings': earnings,
            'deductions': deductions,
            'employer_costs': employer_costs,
            'gross': str(total_earnings),
            'fixed_salary_monthly': str(total_earnings),
            'esi_wage_base': str(total_earnings),
            'total_deductions': str(total_deductions),
            'net': str(net),
            'net_monthly': str(net),
            'net_excludes_tds': any(sc.component.code == 'TDS' for sc in deduction_components),
            'total_employer_cost': str(total_employer),
            'total_ctc': str(total_earnings + total_employer),
            'total_reimbursements': '0.00',
            'ctc_monthly': str(ctc_monthly),
            'basic_used': str(basic_amount),
        }


def models_Q_effective_to_gte_or_null(date):
    """Helper: Q object for effective_to >= date OR effective_to IS NULL."""
    from django.db.models import Q
    return Q(effective_to__gte=date) | Q(effective_to__isnull=True)
