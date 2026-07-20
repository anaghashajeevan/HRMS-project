"""
Performance Reports Service — analytics for KRA/KPI reporting.
"""
from django.db.models import Avg, Count, Sum, Q, F, Max
from datetime import datetime
from ..models import (
    EmployeeScorecard, EmployeeKRA, EmployeeKPI,
    PerformanceCycle, Employee, CompanyStructure,
    RatingScale, KRALibrary,
)


class PerformanceReportsService:
    """Generates analytics for various report types."""

    # ==========================================================================
    # 1. INDIVIDUAL PERFORMANCE HISTORY
    # ==========================================================================
    
    @staticmethod
    def individual_history(employee_id: str, limit: int = 8) -> dict:
        """Employee's scorecards across cycles (for trend)."""
        scorecards = EmployeeScorecard.objects.filter(
            employee_id=employee_id,
            final_score__isnull=False,
        ).select_related('cycle').order_by('-cycle__period_start')[:limit]
        
        history = [{
            'cycle_id': str(sc.cycle.id),
            'cycle_name': sc.cycle.name,
            'cycle_type': sc.cycle.cycle_type,
            'period_start': sc.cycle.period_start.isoformat(),
            'period_end': sc.cycle.period_end.isoformat(),
            'final_score': float(sc.final_score),
            'final_rating': sc.final_rating,
            'self_score': float(sc.self_score) if sc.self_score else None,
            'peer_score': float(sc.peer_score) if sc.peer_score else None,
            'manager_score': float(sc.manager_score) if sc.manager_score else None,
        } for sc in scorecards]
        
        # Trend analysis
        trend = 'STABLE'
        if len(history) >= 2:
            latest = history[0]['final_score']
            previous = history[1]['final_score']
            diff = latest - previous
            if diff > 5:
                trend = 'IMPROVING'
            elif diff < -5:
                trend = 'DECLINING'
        
        avg_score = sum(h['final_score'] for h in history) / len(history) if history else 0
        
        return {
            'employee_id': employee_id,
            'history': list(reversed(history)),  # Oldest first for charts
            'trend': trend,
            'avg_score': round(avg_score, 2),
            'total_cycles': len(history),
        }

    # ==========================================================================
    # 2. TEAM PERFORMANCE DASHBOARD
    # ==========================================================================
    
    @staticmethod
    def team_dashboard(manager_id: str, cycle_id: str = None) -> dict:
        """Manager's team overview + individual scores."""
        qs = EmployeeScorecard.objects.filter(
            employee__reporting_manager_id=manager_id,
        ).select_related('employee', 'employee__position', 'cycle')
        
        if cycle_id:
            qs = qs.filter(cycle_id=cycle_id)
        else:
            # Get latest per employee if no cycle filter
            latest_ids = list(
                EmployeeScorecard.objects.filter(
                    employee__reporting_manager_id=manager_id,
                )
                .values('employee')
                .annotate(latest_created=Max('created_at'))
                .values_list('latest_created', flat=True)
            )
            qs = qs.filter(created_at__in=latest_ids)
        
        team_data = []
        for sc in qs:
            team_data.append({
                'employee_id': str(sc.employee.id),
                'employee_name': sc.employee.full_name,
                'position': sc.employee.position.title if sc.employee.position else '-',
                'cycle_name': sc.cycle.name,
                'status': sc.status,
                'final_score': float(sc.final_score) if sc.final_score else None,
                'final_rating': sc.final_rating,
                'kra_count': sc.kras.count(),
            })
        
        # Team averages
        finalized = [d for d in team_data if d['final_score'] is not None]
        team_avg = sum(d['final_score'] for d in finalized) / len(finalized) if finalized else 0
        
        # Rating distribution
        rating_dist = {}
        for d in finalized:
            r = d['final_rating']
            if r:
                rating_dist[str(r)] = rating_dist.get(str(r), 0) + 1
        
        return {
            'team_size': len(team_data),
            'reviewed_count': len(finalized),
            'team_avg_score': round(team_avg, 2),
            'rating_distribution': rating_dist,
            'members': sorted(team_data, key=lambda x: x['final_score'] or 0, reverse=True),
        }

    # ==========================================================================
    # 3. DEPARTMENT PERFORMANCE REPORT
    # ==========================================================================
    
    @staticmethod
    def department_report(cycle_id: str) -> list:
        """Aggregate performance by department for a cycle."""
        try:
            cycle = PerformanceCycle.objects.get(id=cycle_id)
        except PerformanceCycle.DoesNotExist:
            return []
        
        scorecards = EmployeeScorecard.objects.filter(
            cycle=cycle,
            final_score__isnull=False,
        ).select_related('employee', 'employee__structure_location')
        
        dept_map = {}
        for sc in scorecards:
            dept = sc.employee.structure_location
            key = str(dept.id) if dept else 'no_dept'
            
            if key not in dept_map:
                dept_map[key] = {
                    'department_id': key,
                    'department_name': dept.name if dept else 'No Department',
                    'employees': [],
                    'scores': [],
                    'ratings': [],
                }
            
            dept_map[key]['employees'].append(sc.employee.full_name)
            dept_map[key]['scores'].append(float(sc.final_score))
            if sc.final_rating:
                dept_map[key]['ratings'].append(sc.final_rating)
        
        # Compute stats
        result = []
        for dept_data in dept_map.values():
            scores = dept_data['scores']
            ratings = dept_data['ratings']
            
            result.append({
                'department_id': dept_data['department_id'],
                'department_name': dept_data['department_name'],
                'employee_count': len(dept_data['employees']),
                'avg_score': round(sum(scores) / len(scores), 2) if scores else 0,
                'min_score': round(min(scores), 2) if scores else 0,
                'max_score': round(max(scores), 2) if scores else 0,
                'avg_rating': round(sum(ratings) / len(ratings), 2) if ratings else 0,
                'top_performer_count': sum(1 for r in ratings if r >= 4),
                'poor_performer_count': sum(1 for r in ratings if r <= 2),
            })
        
        return sorted(result, key=lambda x: x['avg_score'], reverse=True)

    # ==========================================================================
    # 4. CYCLE COMPARISON
    # ==========================================================================
    
    @staticmethod
    def cycle_comparison(cycle_ids: list) -> list:
        """Compare metrics across multiple cycles."""
        cycles = PerformanceCycle.objects.filter(id__in=cycle_ids).order_by('period_start')
        
        result = []
        for cycle in cycles:
            scorecards = cycle.scorecards.filter(final_score__isnull=False)
            
            if not scorecards.exists():
                result.append({
                    'cycle_id': str(cycle.id),
                    'cycle_name': cycle.name,
                    'period_start': cycle.period_start.isoformat(),
                    'avg_score': 0,
                    'total_scored': 0,
                    'rating_distribution': {},
                })
                continue
            
            stats = scorecards.aggregate(
                avg=Avg('final_score'),
                count=Count('id'),
            )
            
            # Rating distribution
            rating_dist = dict(
                scorecards.values_list('final_rating')
                .annotate(cnt=Count('id'))
                .values_list('final_rating', 'cnt')
            )
            
            result.append({
                'cycle_id': str(cycle.id),
                'cycle_name': cycle.name,
                'period_start': cycle.period_start.isoformat(),
                'avg_score': round(stats['avg'], 2) if stats['avg'] else 0,
                'total_scored': stats['count'],
                'rating_distribution': {str(k): v for k, v in rating_dist.items() if k},
            })
        
        return result

    # ==========================================================================
    # 5. KRA ACHIEVEMENT REPORT
    # ==========================================================================
    
    @staticmethod
    def kra_achievement_report(cycle_id: str) -> list:
        """Which KRAs (from library) are most/least achieved in a cycle."""
        emp_kras = EmployeeKRA.objects.filter(
            scorecard__cycle_id=cycle_id,
            kra_score__isnull=False,
            library_kra__isnull=False,
        ).select_related('library_kra')
        
        kra_map = {}
        for emp_kra in emp_kras:
            lib_kra = emp_kra.library_kra
            key = str(lib_kra.id)
            
            if key not in kra_map:
                kra_map[key] = {
                    'kra_id': key,
                    'kra_name': lib_kra.name,
                    'kra_source': lib_kra.kra_source,
                    'scores': [],
                    'employee_count': 0,
                }
            
            kra_map[key]['scores'].append(float(emp_kra.kra_score))
            kra_map[key]['employee_count'] += 1
        
        result = []
        for kra_data in kra_map.values():
            scores = kra_data['scores']
            if not scores:
                continue
            result.append({
                'kra_id': kra_data['kra_id'],
                'kra_name': kra_data['kra_name'],
                'kra_source': kra_data['kra_source'],
                'employee_count': kra_data['employee_count'],
                'avg_score': round(sum(scores) / len(scores), 2),
                'min_score': round(min(scores), 2),
                'max_score': round(max(scores), 2),
                'achievement_pct': round(
                    sum(1 for s in scores if s >= 90) / len(scores) * 100, 2
                ),
            })
        
        return sorted(result, key=lambda x: x['avg_score'], reverse=True)

    # ==========================================================================
    # 6. COMPANY-WIDE DASHBOARD
    # ==========================================================================
    
    @staticmethod
    def company_dashboard(cycle_id: str) -> dict:
        """Full company overview for HR."""
        scorecards = EmployeeScorecard.objects.filter(cycle_id=cycle_id)
        finalized = scorecards.filter(final_score__isnull=False)
        
        # Basic counts
        total = scorecards.count()
        completed = finalized.count()
        completion_pct = round((completed / total * 100), 2) if total else 0
        
        # Scores
        avg_score = finalized.aggregate(avg=Avg('final_score'))['avg'] or 0
        
        # Rating distribution
        rating_counts = dict(
            finalized.values_list('final_rating')
            .annotate(cnt=Count('id'))
            .values_list('final_rating', 'cnt')
        )
        
        # Top 10 performers
        top_performers = list(
            finalized.order_by('-final_score')[:10].values(
                'employee__id', 'employee__first_name', 'employee__last_name',
                'employee__employee_id', 'final_score', 'final_rating',
            )
        )
        
        # Bottom performers (needing PIP)
        low_performers = list(
            finalized.filter(final_rating__lte=2).values(
                'employee__id', 'employee__first_name', 'employee__last_name',
                'employee__employee_id', 'final_score', 'final_rating',
            )[:10]
        )
        
        return {
            'total_scorecards': total,
            'completed': completed,
            'completion_pct': completion_pct,
            'avg_score': round(avg_score, 2),
            'rating_distribution': {str(k): v for k, v in rating_counts.items() if k},
            'top_performers': [
                {
                    'employee_id': str(p['employee__id']),
                    'name': f"{p['employee__first_name']} {p['employee__last_name']}",
                    'emp_code': p['employee__employee_id'],
                    'score': float(p['final_score']),
                    'rating': p['final_rating'],
                }
                for p in top_performers
            ],
            'low_performers': [
                {
                    'employee_id': str(p['employee__id']),
                    'name': f"{p['employee__first_name']} {p['employee__last_name']}",
                    'emp_code': p['employee__employee_id'],
                    'score': float(p['final_score']),
                    'rating': p['final_rating'],
                }
                for p in low_performers
            ],
        }