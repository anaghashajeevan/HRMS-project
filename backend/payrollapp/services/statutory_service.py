"""
Statutory calculation service.

Resolves the correct StatutoryRule for a given pay period + jurisdiction,
then calculates PF, ESI, PT amounts.

TDS projection is DEFERRED to Phase 7 — Phase 3 produces TDS = 0
unless manually overridden via SalaryStructureComponent.amount.
"""

import logging
from decimal import Decimal, ROUND_HALF_UP
from django.db.models import Q

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

        # Tax regime filter (for TDS)
        if statutory_type == 'TDS':
            qs = qs.filter(Q(tax_regime=tax_regime) | Q(tax_regime='ALL'))

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
                'reason': 'No active ESI rule found',
            }

        # Applicability threshold
        if rule.threshold > 0 and gross > rule.threshold:
            return {
                'employee': Decimal('0'),
                'employer': Decimal('0'),
                'rule_id': str(rule.id),
                'rule_name': rule.name,
                'applicable': False,
                'reason': f'Gross ₹{gross} exceeds ESI threshold ₹{rule.threshold}',
            }

        employee_rate = rule.employee_rate if employee_rate is None else Decimal(str(employee_rate))
        employer_rate = rule.employer_rate if employer_rate is None else Decimal(str(employer_rate))

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
    def calculate_tds(gross, as_of_date, employee=None, tax_regime='NEW'):
        """
        PLACEHOLDER. Full TDS projection logic is Phase 7.
        For Phase 3, returns 0 unless HR manually overrides via component.
        """
        return {
            'amount': Decimal('0'),
            'rule_id': None,
            'applicable': False,
            'reason': 'TDS calculation deferred to Phase 7',
        }
