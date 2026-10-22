"""
Statutory calculation service.

Resolves the correct StatutoryRule for a given pay period + jurisdiction,
then calculates PF, ESI, PT amounts.

TDS is projected from effective-dated regime rules and the employee's
taxable salary available in payroll.
"""

import logging
import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from django.db.models import DateField, Q
from django.db.models.functions import Coalesce

logger = logging.getLogger(__name__)


class StatutoryService:
    """Resolves and calculates statutory contributions."""

    @staticmethod
    def get_active_rule(statutory_type, as_of_date, jurisdiction='ALL', tax_regime='ALL'):
        """
        Find the applicable rule for a given type + date + jurisdiction.
        Prefers jurisdiction match, falls back to 'ALL'.
        """
        from ..models import StatutoryRule

        qs = StatutoryRule.objects.filter(
            statutory_type=statutory_type,
            is_active=True,
            effective_from__lte=as_of_date,
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=as_of_date)
        )

        # Prefer a regime-specific TDS rule before falling back to ALL.
        if statutory_type == 'TDS':
            regime_qs = qs.filter(tax_regime=tax_regime)
            generic_qs = qs.filter(tax_regime='ALL')
            qs = regime_qs if regime_qs.exists() else generic_qs

        # Try exact jurisdiction match first
        rule = qs.filter(jurisdiction=jurisdiction).order_by('-effective_from').first()
        if rule:
            return rule

        # Fall back to ALL jurisdiction
        rule = qs.filter(jurisdiction='ALL').order_by('-effective_from').first()
        return rule

    # ==========================================================================
    # PF (Provident Fund)
    # ==========================================================================

    @staticmethod
    def calculate_pf(
        basic, as_of_date, *, employee_rate=None, employer_rate=None,
        pension_rate=None, epf_rate=None,
    ):
        """
        PF = 12% of min(Basic, wage_ceiling)
        Returns dict with employee + employer amounts and the rule used.
        """
        rule = StatutoryService.get_active_rule('PF', as_of_date)
        if not rule:
            return {
                'employee': Decimal('0'),
                'employer': Decimal('0'),
                'rule_id': None,
                'reason': 'No active PF rule found',
            }

        # Apply ceiling
        pf_wage = basic
        if rule.wage_ceiling > 0:
            pf_wage = min(basic, rule.wage_ceiling)

        employee_rate = rule.employee_rate if employee_rate is None else Decimal(str(employee_rate))
        employer_rate = rule.employer_rate if employer_rate is None else Decimal(str(employer_rate))
        pension_rate = rule.employer_pension_rate if pension_rate is None else Decimal(str(pension_rate))

        emp_amount = (
            pf_wage * employee_rate / Decimal('100')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        er_amount = (
            pf_wage * employer_rate / Decimal('100')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        pension_rate = min(pension_rate, employer_rate)
        pension_amount = (
            pf_wage * pension_rate / Decimal('100')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        return {
            'employee': emp_amount,
            'employer': er_amount,
            'pension': pension_amount,
            'employer_epf': (
                (pf_wage * Decimal(str(epf_rate)) / Decimal('100')).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP,
                ) if epf_rate is not None else er_amount - pension_amount
            ),
            'rule_id': str(rule.id),
            'rule_name': rule.name,
            'wage_used': pf_wage,
        }

    # ==========================================================================
    # ESI (Employee State Insurance)
    # ==========================================================================

    @staticmethod
    def calculate_esi(gross, as_of_date, *, employee_rate=None, employer_rate=None):
        """
        ESI applies ONLY if gross <= threshold (e.g., ₹21,000).
        Employee: 0.75% of gross
        Employer: 3.25% of gross
        """
        rule = StatutoryService.get_active_rule('ESI', as_of_date)
        if not rule:
            return {
                'employee': Decimal('0'),
                'employer': Decimal('0'),
                'rule_id': None,
                'applicable': False,
                'wage_used': gross,
                'threshold': None,
                'employee_rate': Decimal(str(employee_rate or 0)),
                'employer_rate': Decimal(str(employer_rate or 0)),
                'reason': 'No active ESI rule found',
            }

        employee_rate = rule.employee_rate if employee_rate is None else Decimal(str(employee_rate))
        employer_rate = rule.employer_rate if employer_rate is None else Decimal(str(employer_rate))

        # Applicability threshold
        if rule.threshold > 0 and gross > rule.threshold:
            return {
                'employee': Decimal('0'),
                'employer': Decimal('0'),
                'rule_id': str(rule.id),
                'rule_name': rule.name,
                'applicable': False,
                'wage_used': gross,
                'threshold': rule.threshold,
                'employee_rate': employee_rate,
                'employer_rate': employer_rate,
                'reason': f'Gross ₹{gross} exceeds ESI threshold ₹{rule.threshold}',
            }

        emp_amount = (
            gross * employee_rate / Decimal('100')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        er_amount = (
            gross * employer_rate / Decimal('100')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        return {
            'employee': emp_amount,
            'employer': er_amount,
            'rule_id': str(rule.id),
            'rule_name': rule.name,
            'applicable': True,
            'wage_used': gross,
            'threshold': rule.threshold,
            'employee_rate': employee_rate,
            'employer_rate': employer_rate,
        }

    # ==========================================================================
    # PT (Professional Tax) — Slab-based
    # ==========================================================================

    @staticmethod
    def calculate_pt(gross, as_of_date, jurisdiction='ALL'):
        """
        PT uses slabs stored as JSON on the rule:
            [
                {'min': 0,     'max': 15000, 'amount': 0},
                {'min': 15001, 'max': 20000, 'amount': 150},
                {'min': 20001, 'max': None,  'amount': 200},
            ]
        """
        rule = StatutoryService.get_active_rule('PT', as_of_date, jurisdiction)
        if not rule or not rule.slabs:
            return {
                'amount': Decimal('0'),
                'rule_id': None,
                'applicable': False,
                'reason': f'No PT rule for jurisdiction {jurisdiction}',
            }

        pt_amount = Decimal('0')
        matched_slab = None

        for slab in rule.slabs:
            slab_min = Decimal(str(slab.get('min', 0)))
            slab_max_raw = slab.get('max')
            slab_max = Decimal(str(slab_max_raw)) if slab_max_raw is not None else None
            slab_amount = Decimal(str(slab.get('amount', 0)))

            if gross >= slab_min and (slab_max is None or gross <= slab_max):
                pt_amount = slab_amount
                matched_slab = slab
                break

        return {
            'amount': pt_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'rule_id': str(rule.id),
            'rule_name': rule.name,
            'applicable': pt_amount > 0,
            'matched_slab': matched_slab,
        }

    # ==========================================================================
    # TDS — Placeholder for Phase 7
    # ==========================================================================

    @staticmethod
    def calculate_tds(
        current_taxable_amount, monthly_taxable_projection, period_start,
        as_of_date, employee=None, tax_regime='NEW', tax_resident=None,
        current_run_id=None, current_period_basis=None,
        off_cycle=False,
    ):
        """Project annual salary tax and spread the remaining liability monthly.

        Tax declarations, previous-employer income and non-salary income are
        not currently captured; only salary, prior payroll TDS and the
        configured standard deduction are included in this estimate.
        """
        from ..models import PayrollRunComponentDetail, PayrollRunEmployee

        rule = StatutoryService.get_active_rule('TDS', as_of_date, tax_regime=tax_regime)
        if not rule or not isinstance(rule.slabs, dict) or not rule.slabs.get('slabs'):
            return {
                'amount': Decimal('0'), 'rule_id': str(rule.id) if rule else None,
                'applicable': False,
                'reason': 'No valid effective TDS rule exists for this tax regime.',
            }

        payload = rule.slabs
        financial_year_start = date(as_of_date.year if as_of_date.month >= 4 else as_of_date.year - 1, 4, 1)
        financial_year_end = date(financial_year_start.year + 1, 3, 31)
        current_period_start = max(date(as_of_date.year, as_of_date.month, 1), financial_year_start)
        remaining_periods = 1
        future_period_count = 0
        future_salary_projection = Decimal('0')
        future_projection_details = []
        settled_by_month = {}
        prior_taxable = Decimal('0')
        prior_tds = Decimal('0')
        if employee:
            settled_rows = PayrollRunEmployee.objects.filter(
                employee=employee,
                status__in=('CALCULATED', 'EXCLUDED'),
                run__status__in=('FINALIZED', 'PAID'),
            ).exclude(run_id=current_run_id).select_related(
                'run', 'run__pay_calendar',
            ).prefetch_related('component_details__component')
            settled_rows = settled_rows.annotate(
                tax_payment_date=Coalesce(
                    'run__payment_date', 'run__pay_calendar__pay_date',
                    output_field=DateField(),
                ),
            ).filter(
                tax_payment_date__gte=financial_year_start,
                tax_payment_date__lte=financial_year_end,
            )

            for settled_row in settled_rows:
                saved_tds = (settled_row.input_snapshot or {}).get('tds') or {}
                taxable_value = saved_tds.get('current_period_taxable_salary')
                row_taxable = Decimal(str(taxable_value)) if taxable_value is not None else None
                row_tds = Decimal('0')
                if settled_row.status == 'EXCLUDED':
                    row_taxable = Decimal('0')
                    row_tds = Decimal('0')
                elif row_taxable is None:
                    row_taxable = Decimal('0')
                    for detail in settled_row.component_details.all():
                        code = detail.component.code if detail.component_id else ''
                        if code == 'TDS':
                            row_tds += detail.amount
                        elif detail.is_earning and detail.is_reimbursement is False:
                            if detail.component_id and detail.component.is_taxable:
                                row_taxable += detail.amount
                            elif not detail.component_id and detail.component_label.startswith('Weekend/Holiday Work'):
                                row_taxable += detail.amount
                        elif not detail.component_id and detail.component_label.startswith('Leave / LOP Deduction'):
                            row_taxable -= detail.amount
                else:
                    row_tds = sum((
                        detail.amount for detail in settled_row.component_details.all()
                        if detail.component_id and detail.component.code == 'TDS'
                    ), Decimal('0'))

                payment_date = settled_row.tax_payment_date
                month_key = (payment_date.year, payment_date.month)
                month_data = settled_by_month.setdefault(month_key, {
                    'taxable_salary': Decimal('0'),
                    'tds': Decimal('0'),
                    'regular_run_settled': False,
                    'runs': [],
                })
                month_data['taxable_salary'] += row_taxable
                month_data['tds'] += row_tds
                month_data['regular_run_settled'] = (
                    month_data['regular_run_settled'] or settled_row.run.run_type == 'REGULAR'
                )
                month_data['runs'].append({
                    'run_type': settled_row.run.run_type,
                    'status': settled_row.run.status,
                    'taxable_salary': str(row_taxable),
                    'tds_deducted': str(row_tds),
                })
                prior_tds += row_tds
                if payment_date < current_period_start:
                    prior_taxable += row_taxable

        assignments = []
        if employee:
            from ..models import EmployeeSalaryAssignment
            assignments = list(EmployeeSalaryAssignment.objects.filter(
                employee=employee,
                effective_from__lte=financial_year_end,
            ).filter(
                Q(effective_to__isnull=True) | Q(effective_to__gte=current_period_start),
            ).select_related('structure').order_by('effective_from'))

        # Calculate a full-month taxable earning amount from the salary
        # structure assigned for that future period, rather than carrying
        # today's salary forward through the end of the financial year.
        from .assignment_service import AssignmentService
        month_cursor = date(current_period_start.year, current_period_start.month, 1)
        while True:
            if month_cursor.month == 12:
                month_cursor = date(month_cursor.year + 1, 1, 1)
            else:
                month_cursor = date(month_cursor.year, month_cursor.month + 1, 1)
            if month_cursor > financial_year_end:
                break
            month_days = calendar.monthrange(month_cursor.year, month_cursor.month)[1]
            month_end = date(month_cursor.year, month_cursor.month, month_days)
            projection_end = min(month_end, employee.date_of_exit) if employee and employee.date_of_exit else month_end
            month_total = Decimal('0')
            month_assignments = []
            actual_month = settled_by_month.get((month_cursor.year, month_cursor.month))
            regular_run_settled = bool(actual_month and actual_month['regular_run_settled'])
            actual_taxable = actual_month['taxable_salary'] if actual_month else Decimal('0')
            if regular_run_settled:
                # A finalized/paid regular run is the source of actual earnings
                # for this month. Do not add an assignment forecast on top.
                month_total = actual_taxable
            elif projection_end >= month_cursor:
                for assignment in assignments:
                    covered_start = max(month_cursor, assignment.effective_from)
                    covered_end = min(projection_end, assignment.effective_to or projection_end)
                    if covered_start > covered_end:
                        continue

                    breakdown = AssignmentService.preview_breakdown(
                        assignment.structure,
                        assignment.ctc_monthly,
                        as_of_date=month_end,
                    )
                    full_month_taxable = sum(
                        (Decimal(str(row.get('amount', 0))) for row in breakdown.get('earnings', [])
                         if row.get('is_taxable', True)),
                        Decimal('0'),
                    )
                    covered_days = (covered_end - covered_start).days + 1
                    projected_amount = (
                        full_month_taxable * Decimal(covered_days) / Decimal(month_days)
                    ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    month_total += projected_amount
                    month_assignments.append({
                        'structure_name': assignment.structure.name,
                        'effective_from': str(assignment.effective_from),
                        'effective_to': str(assignment.effective_to) if assignment.effective_to else None,
                        'covered_days': covered_days,
                        'calendar_days': month_days,
                        'full_month_taxable_salary': str(full_month_taxable),
                        'projected_taxable_salary': str(projected_amount),
                    })

            # If an off-cycle run was settled but the regular month is still
            # open, include its actual taxable pay and forecast the regular
            # salary assignment separately.
            if not regular_run_settled:
                month_total += actual_taxable
            has_payroll_period = bool(month_assignments) or bool(actual_month)
            if month_assignments:
                remaining_periods += 1
            if has_payroll_period:
                future_period_count += 1
            future_salary_projection += month_total
            future_projection_details.append({
                'period': month_cursor.strftime('%B %Y'),
                'month_start': str(month_cursor),
                'month_end': str(month_end),
                'assignments': month_assignments,
                'settled_payroll': actual_month['runs'] if actual_month else [],
                'projected_taxable_salary': str(month_total),
                'has_payroll_period': has_payroll_period,
                'source': (
                    'ACTUAL_PAYROLL' if regular_run_settled else
                    'ACTUAL_AND_ASSIGNMENT_FORECAST' if actual_month and month_assignments else
                    'ACTUAL_OFF_CYCLE' if actual_month else
                    'ASSIGNMENT_FORECAST' if month_assignments else 'NO_PAYROLL_DATA'
                ),
                'is_forecast': bool(month_assignments),
            })

        current_month_settled = settled_by_month.get((period_start.year, period_start.month))
        current_month_other_taxable = (
            current_month_settled['taxable_salary'] if current_month_settled else Decimal('0')
        )
        offcycle_regular_projection = Decimal('0')
        if off_cycle and not (current_month_settled and current_month_settled['regular_run_settled']):
            offcycle_regular_projection = Decimal(str(monthly_taxable_projection or 0))
        projected_salary = (
            prior_taxable + current_month_other_taxable
            + offcycle_regular_projection
            + Decimal(str(current_taxable_amount)) + future_salary_projection
        )
        standard_deduction_limit = max(Decimal('0'), Decimal(str(payload.get('standard_deduction', 0))))
        standard_deduction = min(standard_deduction_limit, max(Decimal('0'), projected_salary))
        taxable_income = max(Decimal('0'), projected_salary - standard_deduction)
        tax_slabs = payload['slabs']
        age_band = None
        if tax_regime == 'OLD' and tax_resident is True and employee and employee.date_of_birth:
            age = financial_year_end.year - employee.date_of_birth.year
            if (financial_year_end.month, financial_year_end.day) < (employee.date_of_birth.month, employee.date_of_birth.day):
                age -= 1
            age_band = 'super_senior' if age >= 80 else 'senior' if age >= 60 else None
            if age_band:
                tax_slabs = payload.get('age_slabs', {}).get(age_band, tax_slabs)
        rebate = payload.get('rebate', {})
        rebate_eligible = not rebate.get('resident_only', True) or tax_resident is True
        cess_rate = Decimal(str(payload.get('cess_rate', 4)))
        def annual_tax_for(income):
            standard = min(standard_deduction_limit, max(Decimal('0'), income))
            taxable = max(Decimal('0'), income - standard)
            base_tax = StatutoryService._progressive_tax(taxable, tax_slabs)
            tax_rebate = Decimal('0')
            threshold = Decimal(str(rebate.get('threshold', 0)))
            maximum = Decimal(str(rebate.get('max_amount', 0)))
            if rebate_eligible and taxable <= threshold:
                tax_rebate = min(base_tax, maximum)
            elif rebate_eligible and rebate.get('marginal_relief', False) and taxable > threshold:
                tax_rebate = min(maximum, max(Decimal('0'), base_tax - (taxable - threshold)))
            after_rebate = max(Decimal('0'), base_tax - tax_rebate)
            extra = Decimal('0')
            for band in payload.get('surcharge', []):
                lower = Decimal(str(band.get('min', 0)))
                upper = Decimal(str(band['max'])) if band.get('max') is not None else None
                if taxable >= lower and (upper is None or taxable <= upper):
                    extra = after_rebate * Decimal(str(band.get('rate', 0))) / Decimal('100')
                    cap = payload.get('surcharge_cap_rate')
                    if cap is not None:
                        extra = min(extra, base_tax * Decimal(str(cap)) / Decimal('100'))
                    break
            annual = ((after_rebate + extra) * (Decimal('1') + cess_rate / Decimal('100'))).quantize(
                Decimal('1'), rounding=ROUND_HALF_UP,
            )
            return annual, base_tax, tax_rebate, extra

        annual_tax, income_tax, rebate_amount, surcharge = annual_tax_for(projected_salary)
        annual_tax_without_offcycle = None
        if off_cycle:
            # Withhold the estimated incremental annual liability caused by
            # this one-time taxable payment. Regular payroll later spreads any
            # remaining annual liability across the remaining salary periods.
            annual_tax_without_offcycle = annual_tax_for(
                max(Decimal('0'), projected_salary - Decimal(str(current_taxable_amount))),
            )[0]
            amount = max(Decimal('0'), annual_tax - annual_tax_without_offcycle)
        else:
            amount = max(Decimal('0'), annual_tax - prior_tds) / Decimal(remaining_periods)
        amount = amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return {
            'amount': amount, 'rule_id': str(rule.id), 'rule_name': rule.name,
            'applicable': amount > 0, 'tax_regime': tax_regime,
            'age_band': age_band,
            'financial_year_start': str(financial_year_start),
            'financial_year_end': str(financial_year_end),
            'prior_taxable_salary': str(prior_taxable),
            'current_month_other_settled_taxable_salary': str(current_month_other_taxable),
            'current_month_regular_salary_projection': str(offcycle_regular_projection),
            'current_period_taxable_salary': str(current_taxable_amount),
            'current_period_basis': current_period_basis or {},
            'monthly_taxable_projection': str(monthly_taxable_projection),
            'future_projected_salary': str(future_salary_projection),
            'future_periods': future_period_count,
            'future_projection_details': future_projection_details,
            'projected_salary': str(projected_salary),
            'standard_deduction': str(standard_deduction),
            'taxable_income': str(taxable_income),
            'income_tax_before_rebate': str(income_tax),
            'rebate': str(rebate_amount), 'surcharge': str(surcharge),
            'cess_rate': str(cess_rate), 'annual_tax': str(annual_tax),
            'annual_tax_without_offcycle': (
                str(annual_tax_without_offcycle)
                if annual_tax_without_offcycle is not None else None
            ),
            'prior_tds': str(prior_tds),
            'remaining_periods': remaining_periods,
            'employee_declarations_included': False,
            'tax_resident': tax_resident,
            'rebate_not_applied_reason': (
                'Resident status is not confirmed in the payroll profile.'
                if rebate.get('resident_only', True) and tax_resident is not True else None
            ),
        }

    @staticmethod
    def _progressive_tax(taxable_income, slabs):
        tax = Decimal('0')
        for slab in sorted(slabs, key=lambda item: Decimal(str(item.get('min', 0)))):
            lower = Decimal(str(slab.get('min', 0)))
            upper = Decimal(str(slab['max'])) if slab.get('max') is not None else None
            if taxable_income <= lower:
                continue
            taxable_in_band = taxable_income - lower if upper is None else min(taxable_income, upper) - lower
            if taxable_in_band > 0:
                tax += taxable_in_band * Decimal(str(slab.get('rate', 0))) / Decimal('100')
        return tax
