"""
Service for auto-creating employee scorecards when a performance cycle activates.
Handles mandatory KRA inheritance and library KRA suggestions.
"""
import logging
from django.db import transaction, models
from ..models import (
    PerformanceCycle, EmployeeScorecard, EmployeeKRA, EmployeeKPI,
    Employee, KRALibrary,KRAPeerNomination, PeerRating
)

logger = logging.getLogger(__name__)


class ScorecardService:
    """Business logic for scorecard creation and management."""

    @staticmethod
    @transaction.atomic
    def auto_create_scorecards_for_cycle(cycle: PerformanceCycle) -> int:
        """
        Create empty scorecards for all applicable employees when cycle activates.
        Also auto-adds MANDATORY KRAs from library.
        Returns count of scorecards created.
        """
        # Determine which employees are in scope
        applicable_depts = cycle.applicable_departments.all()
        
        employees_qs = Employee.objects.filter(
            is_deleted=False,
            status__in=['ACTIVE', 'PROBATION'],
        )
        
        if applicable_depts.exists():
            employees_qs = employees_qs.filter(
                structure_location__in=applicable_depts
            )
        
        created_count = 0
        for employee in employees_qs:
            scorecard, created = EmployeeScorecard.objects.get_or_create(
                employee=employee,
                cycle=cycle,
                defaults={'status': 'DRAFT'},
            )
            
            if created:
                created_count += 1
                # Auto-add mandatory KRAs
                ScorecardService._add_mandatory_kras(scorecard)
                logger.info(f"Created scorecard for {employee.employee_id} in cycle {cycle.name}")
        
        return created_count

    @staticmethod
    def _add_mandatory_kras(scorecard: EmployeeScorecard):
        """
        Auto-add applicable KRAs from library to scorecard when cycle activates:
        
        1. MANDATORY KRAs (any type) → auto-added to everyone applicable
        2. ROLE-based KRAs → auto-added if employee's position matches
        3. DEPARTMENTAL KRAs → auto-added if employee's department matches
        4. COMMON KRAs → auto-added to everyone
        
        Employee can still manually add MORE KRAs from library after.
        """
        employee = scorecard.employee
        
        all_active_kras = KRALibrary.objects.filter(is_active=True).prefetch_related(
            'applicable_positions', 'applicable_departments', 'kpi_options'
        )
        
        # Filter by applicability
        applicable = []
        for kra in all_active_kras:
            # MANDATORY — always add if applicable
            if kra.is_mandatory:
                if ScorecardService._is_kra_applicable_to_employee(kra, employee):
                    applicable.append(kra)
            
            # ROLE-based — auto-add if employee's position matches
            elif kra.kra_source == 'ROLE' and employee.position:
                if kra.applicable_positions.filter(id=employee.position.id).exists():
                    applicable.append(kra)
                elif not kra.applicable_positions.exists():
                    # Empty positions list = applies to ALL positions
                    applicable.append(kra)
            
            # DEPARTMENTAL — auto-add if employee's department matches
            elif kra.kra_source == 'DEPARTMENTAL' and employee.structure_location:
                if kra.applicable_departments.filter(id=employee.structure_location.id).exists():
                    applicable.append(kra)
                elif not kra.applicable_departments.exists():
                    # Empty departments list = applies to ALL departments
                    applicable.append(kra)
            
            # COMMON — auto-add to everyone
            elif kra.kra_source == 'COMMON':
                applicable.append(kra)
        
        display_order = 0
        for kra in applicable:
            # Determine source label
            if kra.is_mandatory:
                source = 'MANDATORY'
            elif kra.kra_source == 'DEPARTMENTAL':
                source = 'INHERITED'
            else:
                source = 'LIBRARY'
            
            emp_kra = EmployeeKRA.objects.create(
                scorecard=scorecard,
                library_kra=kra,
                name=kra.name,
                description=kra.description,
                weight=kra.suggested_weight_min,
                peer_rating_required=kra.peer_rating_required,
                kra_source=source,
                display_order=display_order,
            )
            display_order += 1
            
            # Auto-add all active KPI options
            kpi_options = kra.kpi_options.filter(is_active=True)
            kpi_count = kpi_options.count()
            if kpi_count > 0:
                equal_weight = round(100.0 / kpi_count, 2)
                for kpi_lib in kpi_options:
                    EmployeeKPI.objects.create(
                        employee_kra=emp_kra,
                        library_kpi=kpi_lib,
                        name=kpi_lib.name,
                        description=kpi_lib.description,
                        indicator_type=kpi_lib.indicator_type,
                        kpi_type=kpi_lib.kpi_type,
                        formula=kpi_lib.default_formula,
                        baseline=kpi_lib.suggested_baseline,
                        target_minimum=kpi_lib.suggested_target_minimum,
                        target_expected=kpi_lib.suggested_target_expected,
                        target_exceptional=kpi_lib.suggested_target_exceptional,
                        data_source=kpi_lib.default_data_source,
                        weight_in_kra=equal_weight,
                    )
        
        # Recalculate total weight
        ScorecardService.recalculate_total_weight(scorecard)


    @staticmethod
    def _is_kra_applicable_to_employee(kra, employee) -> bool:
        """Check if a mandatory KRA applies to a specific employee."""
        if kra.kra_source == 'COMMON':
            return True
        
        if kra.kra_source == 'ROLE':
            if not employee.position:
                return False
            if kra.applicable_positions.exists():
                return kra.applicable_positions.filter(id=employee.position.id).exists()
            return True  # empty = all positions
        
        if kra.kra_source == 'DEPARTMENTAL':
            if not employee.structure_location:
                return False
            if kra.applicable_departments.exists():
                return kra.applicable_departments.filter(id=employee.structure_location.id).exists()
            return True  # empty = all departments
        
        return False

    @staticmethod
    def recalculate_total_weight(scorecard: EmployeeScorecard):
        """Sum all KRA weights and update scorecard.total_weight."""
        total = sum(kra.weight for kra in scorecard.kras.all())
        scorecard.total_weight = total
        scorecard.save(update_fields=['total_weight'])
        return total

    @staticmethod
    def add_library_kra_to_scorecard(
        scorecard: EmployeeScorecard,
        library_kra: KRALibrary,
        weight: float = None,
        include_all_kpis: bool = True,
    ) -> EmployeeKRA:
        """Add a library KRA to an employee's scorecard."""
        weight = weight or library_kra.suggested_weight_min
        
        # Determine display order
        max_order = scorecard.kras.aggregate(
            models.Max('display_order')
        )['display_order__max'] or 0
        
        emp_kra = EmployeeKRA.objects.create(
            scorecard=scorecard,
            library_kra=library_kra,
            name=library_kra.name,
            description=library_kra.description,
            weight=weight,
            peer_rating_required=library_kra.peer_rating_required,
            kra_source='LIBRARY',
            display_order=max_order + 1,
        )
        
        if include_all_kpis:
            kpi_options = library_kra.kpi_options.filter(is_active=True)
            for idx, kpi_lib in enumerate(kpi_options):
                EmployeeKPI.objects.create(
                    employee_kra=emp_kra,
                    library_kpi=kpi_lib,
                    name=kpi_lib.name,
                    description=kpi_lib.description,
                    indicator_type=kpi_lib.indicator_type,
                    kpi_type=kpi_lib.kpi_type,
                    formula=kpi_lib.default_formula,
                    baseline=kpi_lib.suggested_baseline,
                    target_minimum=kpi_lib.suggested_target_minimum,
                    target_expected=kpi_lib.suggested_target_expected,
                    target_exceptional=kpi_lib.suggested_target_exceptional,
                    data_source=kpi_lib.default_data_source,
                    weight_in_kra=100.0 / max(len(kpi_options), 1),
                    display_order=idx,
                )
        
        ScorecardService.recalculate_total_weight(scorecard)
        return emp_kra

    @staticmethod
    def validate_scorecard(scorecard: EmployeeScorecard) -> tuple:
        """
        Validate scorecard before submission.
        Returns (is_valid: bool, errors: list).
        """
        errors = []
        
        kras = scorecard.kras.all()
        if not kras.exists():
            errors.append("At least one KRA is required")
            return False, errors
        
        # Weight validation
        total_weight = sum(k.weight for k in kras)
        if abs(total_weight - 100) > 0.01:
            errors.append(f"Total KRA weight must be 100%, currently {total_weight}%")
        
        # Each KRA must have at least 1 KPI
        for kra in kras:
            if not kra.kpis.exists():
                errors.append(f"KRA '{kra.name}' has no KPIs")
            else:
                # KPI weights within KRA must total 100
                kpi_total = sum(k.weight_in_kra for k in kra.kpis.all())
                if abs(kpi_total - 100) > 0.01:
                    errors.append(
                        f"KRA '{kra.name}': KPI weights must total 100%, currently {kpi_total}%"
                    )
                # Each KPI must have target_expected
                for kpi in kra.kpis.all():
                    if not kpi.target_expected.strip():
                        errors.append(
                            f"KPI '{kpi.name}' in '{kra.name}' has no expected target"
                        )
        
        return (len(errors) == 0), errors
    
    @staticmethod
    @transaction.atomic
    def nominate_peers(employee_kra, peer_ids: list, nominated_by):
        """
        Manager nominates peers for a peer-rated KRA.
        Creates KRAPeerNomination + PeerRating (PENDING) for each peer.
        """
        from django.utils import timezone
        
        if not employee_kra.peer_rating_required:
            raise ValueError("This KRA does not require peer rating")

        # Remove existing nominations that are not in new list
        existing = KRAPeerNomination.objects.filter(employee_kra=employee_kra)
        to_remove = existing.exclude(nominated_peer_id__in=peer_ids)
        # Only remove if their rating is still PENDING
        for nom in to_remove:
            if hasattr(nom, 'rating') and nom.rating.status == 'PENDING':
                nom.delete()

        # Get cycle's peer rating end date for due_at
        cycle = employee_kra.scorecard.cycle
        due_at = timezone.datetime.combine(
            cycle.peer_rating_end,
            timezone.datetime.max.time(),
        )
        if timezone.is_naive(due_at):
            due_at = timezone.make_aware(due_at)

        # Add new nominations
        created_count = 0
        for peer_id in peer_ids:
            nomination, created = KRAPeerNomination.objects.get_or_create(
                employee_kra=employee_kra,
                nominated_peer_id=peer_id,
                defaults={'nominated_by': nominated_by},
            )
            if created:
                # Auto-create pending rating record
                PeerRating.objects.create(
                    nomination=nomination,
                    due_at=due_at,
                )
                created_count += 1

        return created_count

    @staticmethod
    def get_peer_rating_summary(employee_kra):
        """
        Aggregate peer ratings for a KRA.
        Returns dict: total_peers, submitted_count, avg_rating, ratings_list.
        """
        nominations = employee_kra.peer_nominations.all().select_related('rating', 'nominated_peer')
        
        submitted = []
        for nom in nominations:
            if hasattr(nom, 'rating') and nom.rating.status == 'SUBMITTED' and nom.rating.rating:
                submitted.append(nom.rating)

        avg = None
        if submitted:
            avg = sum(r.rating for r in submitted) / len(submitted)

        return {
            'total_peers': nominations.count(),
            'submitted_count': len(submitted),
            'pending_count': nominations.count() - len(submitted),
            'avg_rating': round(avg, 2) if avg is not None else None,
        }
    
    @staticmethod
    def calculate_kpi_score(kpi) -> float:
        """
        Calculate score for a single KPI based on manager_actual vs target_expected.
        Returns score % (0-200).
        """
        from decimal import Decimal, InvalidOperation
        
        if not kpi.manager_actual or not kpi.target_expected:
            return 0.0
        
        try:
            # For BOOLEAN
            if kpi.kpi_type == 'BOOLEAN':
                actual = kpi.manager_actual.strip().lower()
                if actual in ['yes', 'true', '1', 'y']:
                    return 100.0
                return 0.0
            
            # Parse numeric values (strip units, currency symbols)
            def parse_num(s):
                s = str(s).strip()
                # Remove common non-numeric chars
                for ch in ['%', '$', '₹', '€', ',', ' ']:
                    s = s.replace(ch, '')
                return float(Decimal(s))
            
            actual = parse_num(kpi.manager_actual)
            target = parse_num(kpi.target_expected)
            
            if target == 0:
                return 0.0
            
            if kpi.kpi_type == 'NUMERIC_DOWN':
                # Lower is better
                if actual <= 0:
                    return 200.0  # Perfect
                score = (target / actual) * 100
            else:
                # NUMERIC_UP, PERCENTAGE, RATING, CURRENCY
                score = (actual / target) * 100
            
            # Cap at 200%
            return min(round(score, 2), 200.0)
            
        except (InvalidOperation, ValueError, TypeError):
            return 0.0

    @staticmethod
    def calculate_kra_score(employee_kra) -> float:
        """
        Calculate weighted KRA score.
        If peer rating required: combines peer (40%) + manager (60%) scores.
        Otherwise: uses only manager-calculated KPI scores.
        """
        kpis = employee_kra.kpis.all()
        if not kpis.exists():
            return 0.0
        
        # Calculate weighted KPI scores
        total_weight = sum(float(k.weight_in_kra) for k in kpis)
        if total_weight == 0:
            return 0.0
        
        weighted_sum = 0.0
        for kpi in kpis:
            kpi_score = ScorecardService.calculate_kpi_score(kpi)
            kpi.weighted_score = kpi_score
            kpi.save(update_fields=['weighted_score'])
            weighted_sum += kpi_score * (float(kpi.weight_in_kra) / total_weight)
        
        manager_kra_score = weighted_sum
        
        # If peer rating required, combine with peer scores
        if employee_kra.peer_rating_required:
            summary = ScorecardService.get_peer_rating_summary(employee_kra)
            if summary['avg_rating'] is not None:
                # Peer rating is 1-5 → convert to %
                peer_percent = (float(summary['avg_rating']) / 5.0) * 100
                # Weighted combine: 40% peer + 60% manager
                combined = (0.4 * peer_percent) + (0.6 * manager_kra_score)
                employee_kra.kra_score = round(combined, 2)
                employee_kra.save(update_fields=['kra_score'])
                return combined
        
        employee_kra.kra_score = round(manager_kra_score, 2)
        employee_kra.save(update_fields=['kra_score'])
        return manager_kra_score

    @staticmethod
    def calculate_final_score(scorecard) -> dict:
        """
        Calculate final scorecard score = weighted sum of KRA scores.
        Also determines rating band.
        Returns dict with all scores.
        """
        from ..models import RatingScale
        
        kras = scorecard.kras.all()
        if not kras.exists():
            return {'final_score': 0, 'final_rating': None}
        
        total_kra_weight = sum(float(k.weight) for k in kras)
        if total_kra_weight == 0:
            return {'final_score': 0, 'final_rating': None}
        
        # Calculate weighted sum
        weighted_sum = 0.0
        self_weighted = 0.0
        peer_weighted = 0.0
        
        for kra in kras:
            kra_score = ScorecardService.calculate_kra_score(kra)
            weighted_sum += kra_score * (float(kra.weight) / total_kra_weight)
            
            # Also compute self-score (from self ratings for reference)
            self_kra = 0.0
            self_kpi_total_weight = 0.0
            for kpi in kra.kpis.all():
                if kpi.self_rating:
                    self_kpi_score = (float(kpi.self_rating) / 5.0) * 100
                    self_kra += self_kpi_score * float(kpi.weight_in_kra)
                    self_kpi_total_weight += float(kpi.weight_in_kra)
            if self_kpi_total_weight > 0:
                self_kra = self_kra / self_kpi_total_weight
                self_weighted += self_kra * (float(kra.weight) / total_kra_weight)
            
            # Peer score aggregation
            if kra.peer_rating_required:
                summary = ScorecardService.get_peer_rating_summary(kra)
                if summary['avg_rating']:
                    peer_kra = (float(summary['avg_rating']) / 5.0) * 100
                    peer_weighted += peer_kra * (float(kra.weight) / total_kra_weight)
        
        final_score = round(weighted_sum, 2)
        
        # Find rating band
        rating_band = RatingScale.objects.filter(
            is_active=True,
            min_percent__lte=final_score,
            max_percent__gte=final_score,
        ).first()
        
        final_rating = rating_band.rating if rating_band else None
        
        # Update scorecard
        scorecard.self_score = round(self_weighted, 2) if self_weighted > 0 else None
        scorecard.peer_score = round(peer_weighted, 2) if peer_weighted > 0 else None
        scorecard.manager_score = final_score
        scorecard.final_score = final_score
        scorecard.final_rating = final_rating
        scorecard.save(update_fields=[
            'self_score', 'peer_score', 'manager_score',
            'final_score', 'final_rating',
        ])
        
        return {
            'self_score': scorecard.self_score,
            'peer_score': scorecard.peer_score,
            'manager_score': scorecard.manager_score,
            'final_score': scorecard.final_score,
            'final_rating': scorecard.final_rating,
            'rating_label': rating_band.label if rating_band else None,
        }