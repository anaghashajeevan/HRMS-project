# """
# Annual Performance Plan Service.
# Handles auto-generation of 12 monthly plans, quarterly rollups,
# auto-injection of Common and Departmental KRAs, and score calculations.
# """
# import logging
# from datetime import date
# from decimal import Decimal
# from django.db import transaction
# from django.utils import timezone

# from HRMSapp.models import (
#     Employee, CommonKRAMaster, DepartmentalKRAMaster,
#     AnnualPerformancePlan, QuarterlyReview, MonthlyPerformancePlan,
#     MonthlyKRA, MonthlyKPI, CarryForwardRecord
# )

# logger = logging.getLogger(__name__)


# class AnnualPlanService:
#     """Core business logic for Annual & Monthly Performance Plans."""

#     @staticmethod
#     def derive_fy_dates(financial_year: str) -> tuple[date, date]:
#         """
#         Parses "2026-27" or "2026" into start/end dates.
#         FY runs from April 1 to March 31.
#         """
#         try:
#             start_year = int(financial_year.split('-')[0])
#         except Exception:
#             start_year = timezone.now().year

#         start_date = date(start_year, 4, 1)        # Apr 1
#         end_date = date(start_year + 1, 3, 31)     # Mar 31
#         return start_date, end_date

#     @classmethod
#     @transaction.atomic
#     def generate_annual_plan(cls, employee_id: str, financial_year: str, created_by_user=None) -> AnnualPerformancePlan:
#         """
#         Generates a complete Annual Performance Plan for an employee:
#         - 1 Annual Plan
#         - 4 Quarterly Reviews (Q1-Q4)
#         - 12 Monthly Plans (Apr-Mar)
#         - Auto-injected Common KRAs & KPIs
#         - Auto-injected Departmental KRAs & KPIs
#         """
#         employee = Employee.objects.select_related('department', 'position', 'structure_location').get(id=employee_id)
        
#         # 1. Check if plan already exists for this FY
#         existing = AnnualPerformancePlan.objects.filter(employee=employee, financial_year=financial_year).first()
#         if existing:
#             raise ValueError(f"Annual plan for {employee.full_name} for FY {financial_year} already exists.")

#         start_date, end_date = cls.derive_fy_dates(financial_year)
#         creator_employee = getattr(created_by_user, 'employee', None) if created_by_user else None

#         # 2. Create Parent Annual Plan
#         annual_plan = AnnualPerformancePlan.objects.create(
#             employee=employee,
#             financial_year=financial_year,
#             plan_start_date=start_date,
#             plan_end_date=end_date,
#             status='DRAFT',
#             created_by=creator_employee,
#         )

#         # 3. Create 4 Quarterly Reviews
#         quarters = [
#             ('Q1', date(start_date.year, 4, 1), date(start_date.year, 6, 30)),
#             ('Q2', date(start_date.year, 7, 1), date(start_date.year, 9, 30)),
#             ('Q3', date(start_date.year, 10, 1), date(start_date.year, 12, 31)),
#             ('Q4', date(start_date.year + 1, 1, 1), date(start_date.year + 1, 3, 31)),
#         ]

#         quarter_obj_map = {}
#         for q_code, q_start, q_end in quarters:
#             q_obj = QuarterlyReview.objects.create(
#                 annual_plan=annual_plan,
#                 quarter=q_code,
#                 status='PENDING',
#             )
#             quarter_obj_map[q_code] = q_obj

#         # 4. Fetch Master Blueprints for Auto-Injection
#         common_kras = CommonKRAMaster.objects.filter(
#             financial_year=financial_year, is_active=True
#         ).prefetch_related('kpis')

#         dept = employee.department or employee.structure_location
#         dept_kras = []
#         if dept and dept.type == 'DEPARTMENT':
#             dept_kras = DepartmentalKRAMaster.objects.filter(
#                 financial_year=financial_year, department=dept, is_active=True
#             ).prefetch_related('kpis')

#         # 5. Create 12 Monthly Plans (Apr through Mar)
#         # Months sequence: 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3
#         monthly_sequence = [
#             (4, start_date.year, 'Q1'), (5, start_date.year, 'Q1'), (6, start_date.year, 'Q1'),
#             (7, start_date.year, 'Q2'), (8, start_date.year, 'Q2'), (9, start_date.year, 'Q2'),
#             (10, start_date.year, 'Q3'), (11, start_date.year, 'Q3'), (12, start_date.year, 'Q3'),
#             (1, start_date.year + 1, 'Q4'), (2, start_date.year + 1, 'Q4'), (3, start_date.year + 1, 'Q4'),
#         ]

#         for m_num, m_year, q_code in monthly_sequence:
#             m_start = date(m_year, m_num, 1)
#             # Last day of month calculation
#             if m_num in [1, 3, 5, 7, 8, 10, 12]:
#                 m_end = date(m_year, m_num, 31)
#             elif m_num in [4, 6, 9, 11]:
#                 m_end = date(m_year, m_num, 30)
#             else:
#                 # Feb leap year check
#                 is_leap = (m_year % 4 == 0 and m_year % 100 != 0) or (m_year % 400 == 0)
#                 m_end = date(m_year, 2, 29 if is_leap else 28)

#             m_plan = MonthlyPerformancePlan.objects.create(
#                 annual_plan=annual_plan,
#                 quarterly_review=quarter_obj_map[q_code],
#                 month=m_num,
#                 year=m_year,
#                 month_start_date=m_start,
#                 month_end_date=m_end,
#                 status='DRAFT',
#             )

#             # --- AUTO-INJECT COMMON KRAs ---
#             order = 0
#             for c_kra in common_kras:
#                 if c_kra.applies_to_all:
#                     mkra = MonthlyKRA.objects.create(
#                         monthly_plan=m_plan,
#                         kra_type='COMMON',
#                         source_library_kra=None,
#                         name=c_kra.name,
#                         description=c_kra.description,
#                         weight=c_kra.default_weight,
#                         kra_start_date=m_start,
#                         kra_end_date=m_end,
#                         display_order=order,
#                     )
#                     order += 1
#                     for c_kpi in c_kra.kpis.all():
#                         MonthlyKPI.objects.create(
#                             monthly_kra=mkra,
#                             name=c_kpi.name,
#                             metric_type=c_kpi.metric_type,
#                             weight_in_kra=c_kpi.weight_in_kra,
#                             target_value=c_kpi.default_target,
#                         )

#             # --- AUTO-INJECT DEPARTMENTAL KRAs ---
#             for d_kra in dept_kras:
#                 mkra = MonthlyKRA.objects.create(
#                     monthly_plan=m_plan,
#                     kra_type='DEPARTMENTAL',
#                     source_dept_kra=d_kra,
#                     name=d_kra.name,
#                     description=d_kra.description,
#                     weight=d_kra.default_weight,
#                     kra_start_date=m_start,
#                     kra_end_date=m_end,
#                     display_order=order,
#                 )
#                 order += 1
#                 for d_kpi in d_kra.kpis.all():
#                     MonthlyKPI.objects.create(
#                         monthly_kra=mkra,
#                         name=d_kpi.name,
#                         metric_type=d_kpi.metric_type,
#                         weight_in_kra=d_kpi.weight_in_kra,
#                         target_value=d_kpi.default_target,
#                     )

#         logger.info(f"✅ Generated annual plan for {employee.full_name} ({financial_year}) with 12 monthly plans.")
#         return annual_plan

#     # ==========================================================================
#     # CALCULATIONS ENGINE
#     # ==========================================================================

#     @staticmethod
#     def calculate_kpi_score(kpi: MonthlyKPI) -> float:
#         """Calculates achievement % and weighted score for a single KPI."""
#         if not kpi.actual_value or not kpi.target_value:
#             return 0.0

#         try:
#             if kpi.metric_type == 'BOOLEAN':
#                 actual = kpi.actual_value.strip().lower()
#                 ach_pct = 100.0 if actual in ['yes', 'true', '1', 'y'] else 0.0
#             else:
#                 actual = float(kpi.actual_value.replace(',', '').replace('%', '').strip())
#                 target = float(kpi.target_value.replace(',', '').replace('%', '').strip())
                
#                 if target == 0:
#                     ach_pct = 0.0
#                 elif kpi.metric_type == 'NUMERIC_DOWN':
#                     ach_pct = (target / actual) * 100 if actual > 0 else 200.0
#                 else:
#                     ach_pct = (actual / target) * 100

#             ach_pct = min(round(ach_pct, 2), 200.0)  # cap at 200%
#             kpi.achievement_percentage = Decimal(str(ach_pct))
            
#             # Weighted score within KRA
#             kpi_weighted = (ach_pct * float(kpi.weight_in_kra)) / 100.0
#             kpi.weighted_score = Decimal(str(round(kpi_weighted, 2)))
#             kpi.save(update_fields=['achievement_percentage', 'weighted_score'])
#             return kpi_weighted

#         except (ValueError, TypeError, ZeroDivisionError):
#             return 0.0

#     @classmethod
#     def recalculate_monthly_score(cls, monthly_plan: MonthlyPerformancePlan) -> float:
#         """Calculates monthly score as weighted sum of all KRAs."""
#         total_monthly_score = 0.0
        
#         for kra in monthly_plan.kras.all():
#             kpi_score_sum = 0.0
#             for kpi in kra.kpis.all():
#                 kpi_score_sum += cls.calculate_kpi_score(kpi)
            
#             kra.kra_score = Decimal(str(round(kpi_score_sum, 2)))
#             kra.save(update_fields=['kra_score'])

#             # Add KRA score weighted by KRA weight in month
#             total_monthly_score += (kpi_score_sum * float(kra.weight)) / 100.0

#         monthly_plan.monthly_score = Decimal(str(round(total_monthly_score, 2)))
#         monthly_plan.save(update_fields=['monthly_score'])
#         return total_monthly_score

#     @classmethod
#     def recalculate_quarterly_score(cls, quarterly_review: QuarterlyReview) -> float:
#         """Calculates quarterly score as weighted sum of its 3 months."""
#         m_plans = quarterly_review.monthly_plans.filter(monthly_score__isnull=False)
#         if not m_plans.exists():
#             return 0.0

#         q_score = sum(float(m.monthly_score) for m in m_plans) / m_plans.count()
#         quarterly_review.quarterly_score = Decimal(str(round(q_score, 2)))
#         quarterly_review.save(update_fields=['quarterly_score'])
#         return q_score


"""
Annual Performance Plan Service.
Handles auto-generation of 12 monthly plans, quarterly rollups,
auto-injection of Common and Departmental KRAs, and score calculations.
"""
import logging
from datetime import date
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from HRMSapp.models import (
    Employee, CommonKRAMaster, DepartmentalKRAMaster,
    AnnualPerformancePlan, QuarterlyReview, MonthlyPerformancePlan,
    MonthlyKRA, MonthlyKPI, CarryForwardRecord
)

logger = logging.getLogger(__name__)


class AnnualPlanService:
    """Core business logic for Annual & Monthly Performance Plans."""

    @staticmethod
    def derive_fy_dates(financial_year: str) -> tuple[date, date]:
        """
        Parses "2026-27" or "2026" into start/end dates.
        FY runs from April 1 to March 31.
        """
        try:
            start_year = int(financial_year.split('-')[0])
        except Exception:
            start_year = timezone.now().year

        start_date = date(start_year, 4, 1)        # Apr 1
        end_date = date(start_year + 1, 3, 31)     # Mar 31
        return start_date, end_date

    @classmethod
    @transaction.atomic
    def generate_annual_plan(cls, employee_id: str, financial_year: str, created_by_user=None) -> AnnualPerformancePlan:
        """
        Generates a complete Annual Performance Plan for an employee:
        - 1 Annual Plan
        - 4 Quarterly Reviews (Q1-Q4)
        - 12 Monthly Plans (Apr-Mar)
        - Auto-injected Common KRAs & KPIs
        - Auto-injected Departmental KRAs & KPIs
        """
        employee = Employee.objects.select_related('department', 'position', 'structure_location').get(id=employee_id)
        
        # 1. Check if plan already exists for this FY
        existing = AnnualPerformancePlan.objects.filter(employee=employee, financial_year=financial_year).first()
        if existing:
            raise ValueError(f"Annual plan for {employee.full_name} for FY {financial_year} already exists.")

        start_date, end_date = cls.derive_fy_dates(financial_year)
        creator_employee = getattr(created_by_user, 'employee', None) if created_by_user else None

        # 2. Create Parent Annual Plan
        annual_plan = AnnualPerformancePlan.objects.create(
            employee=employee,
            financial_year=financial_year,
            plan_start_date=start_date,
            plan_end_date=end_date,
            status='DRAFT',
            created_by=creator_employee,
        )

        # 3. Create 4 Quarterly Reviews
        quarters = [
            ('Q1', date(start_date.year, 4, 1), date(start_date.year, 6, 30)),
            ('Q2', date(start_date.year, 7, 1), date(start_date.year, 9, 30)),
            ('Q3', date(start_date.year, 10, 1), date(start_date.year, 12, 31)),
            ('Q4', date(start_date.year + 1, 1, 1), date(start_date.year + 1, 3, 31)),
        ]

        quarter_obj_map = {}
        for q_code, q_start, q_end in quarters:
            q_obj = QuarterlyReview.objects.create(
                annual_plan=annual_plan,
                quarter=q_code,
                status='PENDING',
            )
            quarter_obj_map[q_code] = q_obj

        # 4. Fetch Master Blueprints for Auto-Injection
        common_kras = CommonKRAMaster.objects.filter(
            financial_year=financial_year, is_active=True
        ).prefetch_related('kpis')

        dept = employee.department or employee.structure_location
        dept_kras = []
        if dept and dept.type == 'DEPARTMENT':
            dept_kras = DepartmentalKRAMaster.objects.filter(
                financial_year=financial_year, department=dept, is_active=True
            ).prefetch_related('kpis')

        # 5. Create 12 Monthly Plans (Apr through Mar)
        monthly_sequence = [
            (4, start_date.year, 'Q1'), (5, start_date.year, 'Q1'), (6, start_date.year, 'Q1'),
            (7, start_date.year, 'Q2'), (8, start_date.year, 'Q2'), (9, start_date.year, 'Q2'),
            (10, start_date.year, 'Q3'), (11, start_date.year, 'Q3'), (12, start_date.year, 'Q3'),
            (1, start_date.year + 1, 'Q4'), (2, start_date.year + 1, 'Q4'), (3, start_date.year + 1, 'Q4'),
        ]

        for m_num, m_year, q_code in monthly_sequence:
            m_start = date(m_year, m_num, 1)
            # Last day of month calculation
            if m_num in [1, 3, 5, 7, 8, 10, 12]:
                m_end = date(m_year, m_num, 31)
            elif m_num in [4, 6, 9, 11]:
                m_end = date(m_year, m_num, 30)
            else:
                is_leap = (m_year % 4 == 0 and m_year % 100 != 0) or (m_year % 400 == 0)
                m_end = date(m_year, 2, 29 if is_leap else 28)

            m_plan = MonthlyPerformancePlan.objects.create(
                annual_plan=annual_plan,
                quarterly_review=quarter_obj_map[q_code],
                month=m_num,
                year=m_year,
                month_start_date=m_start,
                month_end_date=m_end,
                status='DRAFT',
            )

            # --- AUTO-INJECT COMMON KRAs ---
            order = 0
            for c_kra in common_kras:
                if c_kra.applies_to_all:
                    mkra = MonthlyKRA.objects.create(
                        monthly_plan=m_plan,
                        kra_type='COMMON',
                        source_common_kra=c_kra,  # 👈 FIXED: uses source_common_kra
                        source_dept_kra=None,
                        name=c_kra.name,
                        description=c_kra.description,
                        weight=c_kra.default_weight,
                        kra_start_date=m_start,
                        kra_end_date=m_end,
                        display_order=order,
                    )
                    order += 1
                    for c_kpi in c_kra.kpis.all():
                        MonthlyKPI.objects.create(
                            monthly_kra=mkra,
                            name=c_kpi.name,
                            metric_type=c_kpi.metric_type,
                            weight_in_kra=c_kpi.weight_in_kra,
                            target_value=c_kpi.default_target,
                        )

            # --- AUTO-INJECT DEPARTMENTAL KRAs ---
            for d_kra in dept_kras:
                mkra = MonthlyKRA.objects.create(
                    monthly_plan=m_plan,
                    kra_type='DEPARTMENTAL',
                    source_common_kra=None,
                    source_dept_kra=d_kra,  # 👈 FIXED: uses source_dept_kra
                    name=d_kra.name,
                    description=d_kra.description,
                    weight=d_kra.default_weight,
                    kra_start_date=m_start,
                    kra_end_date=m_end,
                    display_order=order,
                )
                order += 1
                for d_kpi in d_kra.kpis.all():
                    MonthlyKPI.objects.create(
                        monthly_kra=mkra,
                        name=d_kpi.name,
                        metric_type=d_kpi.metric_type,
                        weight_in_kra=d_kpi.weight_in_kra,
                        target_value=d_kpi.default_target,
                    )

        logger.info(f"✅ Generated annual plan for {employee.full_name} ({financial_year}) with 12 monthly plans.")
        return annual_plan

    # ==========================================================================
    # CALCULATIONS ENGINE
    # ==========================================================================

    @staticmethod
    def calculate_kpi_score(kpi: MonthlyKPI) -> float:
        """Calculates achievement % and weighted score for a single KPI."""
        # Use manager's verified actual if provided, fallback to employee's actual
        actual_val_str = kpi.manager_actual.strip() if kpi.manager_actual else (kpi.actual_value.strip() if kpi.actual_value else '')
        target_val_str = kpi.target_value.strip() if kpi.target_value else ''

        if not actual_val_str or not target_val_str:
            return 0.0

        try:
            if kpi.metric_type == 'BOOLEAN':
                act_lower = actual_val_str.lower()
                ach_pct = 100.0 if act_lower in ['yes', 'true', '1', 'y', '100', '100%'] else 0.0
            else:
                actual = float(actual_val_str.replace(',', '').replace('%', ''))
                target = float(target_val_str.replace(',', '').replace('%', ''))

                if target == 0:
                    ach_pct = 0.0
                elif kpi.metric_type == 'NUMERIC_DOWN':
                    ach_pct = (target / actual) * 100.0 if actual > 0 else 200.0
                else:
                    ach_pct = (actual / target) * 100.0

            ach_pct = min(round(ach_pct, 2), 200.0)  # cap at 200%
            kpi.achievement_percentage = Decimal(str(ach_pct))

            # Weighted score of this KPI inside its KRA
            weighted = (ach_pct * float(kpi.weight_in_kra)) / 100.0
            kpi.weighted_score = Decimal(str(round(weighted, 2)))
            kpi.save(update_fields=['achievement_percentage', 'weighted_score'])
            return weighted

        except (ValueError, TypeError, ZeroDivisionError):
            return 0.0

    @classmethod
    def recalculate_monthly_score(cls, monthly_plan: MonthlyPerformancePlan) -> float:
        """
        Calculates KRA scores and Monthly plan score.
        If peer rating is required and submitted, incorporates 40% Peer + 60% Manager score.
        """
        total_monthly_score = 0.0

        for kra in monthly_plan.kras.all():
            kpis = kra.kpis.all()
            if not kpis.exists():
                kra.kra_score = Decimal('0.00')
                kra.save(update_fields=['kra_score'])
                continue

            # 1. Sum weighted KPI scores
            manager_kpi_score_sum = sum(cls.calculate_kpi_score(kpi) for kpi in kpis)

            # 2. Check if peer feedback exists for this KRA
            final_kra_score = manager_kpi_score_sum
            if kra.peer_rating_required:
                from HRMSapp.models import MonthlyPeerRating
                submitted_ratings = MonthlyPeerRating.objects.filter(
                    nomination__monthly_kra=kra,
                    status='SUBMITTED',
                    rating__isnull=False
                )
                if submitted_ratings.exists():
                    avg_peer = sum(r.rating for r in submitted_ratings) / submitted_ratings.count()
                    peer_pct = (avg_peer / 5.0) * 100.0  # 5 stars = 100%
                    # Combine: 40% peer + 60% manager KPI score
                    final_kra_score = (0.4 * peer_pct) + (0.6 * manager_kpi_score_sum)

            kra.kra_score = Decimal(str(round(final_kra_score, 2)))
            kra.save(update_fields=['kra_score'])

            # 3. Add to monthly score weighted by KRA's weight in the month
            total_monthly_score += (final_kra_score * float(kra.weight)) / 100.0

        monthly_plan.monthly_score = Decimal(str(round(total_monthly_score, 2)))
        monthly_plan.save(update_fields=['monthly_score'])

        # 4. Roll up to Quarterly Review
        if monthly_plan.quarterly_review:
            cls.recalculate_quarterly_score(monthly_plan.quarterly_review)

        return total_monthly_score

    @classmethod
    def recalculate_annual_score(cls, annual_plan: AnnualPerformancePlan) -> float:
        """Calculates final annual score from all 4 quarters and maps to RatingScale."""
        from HRMSapp.models import RatingScale

        completed_quarters = annual_plan.quarterly_reviews.filter(quarterly_score__isnull=False)
        if not completed_quarters.exists():
            return 0.0

        annual_avg = sum(float(q.quarterly_score) for q in completed_quarters) / completed_quarters.count()
        annual_avg = round(annual_avg, 2)

        annual_plan.annual_score = Decimal(str(annual_avg))

        # Map to RatingScale (1-5)
        band = RatingScale.objects.filter(
            is_active=True,
            min_percent__lte=Decimal(str(annual_avg)),
            max_percent__gte=Decimal(str(annual_avg)),
        ).first()

        if band:
            annual_plan.annual_rating = band.rating

        annual_plan.save(update_fields=['annual_score', 'annual_rating'])
        return annual_avg

    @classmethod
    def recalculate_quarterly_score(cls, quarterly_review: QuarterlyReview) -> float:
        """Calculates quarterly score as average of its 3 months."""
        m_plans = quarterly_review.monthly_plans.filter(monthly_score__isnull=False)
        if not m_plans.exists():
            return 0.0

        q_score = sum(float(m.monthly_score) for m in m_plans) / m_plans.count()
        quarterly_review.quarterly_score = Decimal(str(round(q_score, 2)))
        quarterly_review.save(update_fields=['quarterly_score'])

        # 🚀 Roll up to Annual Score!
        cls.recalculate_annual_score(quarterly_review.annual_plan)

        return q_score

    @classmethod
    def validate_monthly_plan_weights(cls, monthly_plan: MonthlyPerformancePlan) -> tuple[bool, list[str]]:
        """
        Validates:
        1. Total KRA weights in the month = 100%
        2. Total KPI weights inside EACH KRA = 100%
        Returns (is_valid: bool, errors: list[str])
        """
        errors = []
        kras = monthly_plan.kras.prefetch_related('kpis').all()

        if not kras.exists():
            return False, ["No KRAs assigned for this month."]

        # 1. Validate KRA total weight
        total_kra_weight = sum(float(kra.weight) for kra in kras)
        if abs(total_kra_weight - 100.0) > 0.01:
            errors.append(f"Total KRA weight must equal 100%. Currently {total_kra_weight}%.")

        # 2. Validate KPI total weights for each KRA
        for kra in kras:
            kpis = kra.kpis.all()
            if not kpis.exists():
                errors.append(f"KRA '{kra.name}' has no KPIs assigned.")
            else:
                total_kpi_weight = sum(float(kpi.weight_in_kra) for kpi in kpis)
                if abs(total_kpi_weight - 100.0) > 0.01:
                    errors.append(f"KPI weights in KRA '{kra.name}' must equal 100%. Currently {total_kpi_weight}%.")

        return len(errors) == 0, errors