from datetime import timedelta

from django.shortcuts import render
from django.conf import settings
# Create your views here.
"""
Leave app DRF views.
"""

import logging

from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.decorators import APIView, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from HRMSapp.permissions import IsHRAdmin

from .models import LeaveType, Holiday
from .serializers import (
    LeaveTypeSerializer, LeaveTypeMiniSerializer,
    HolidaySerializer,
)

logger = logging.getLogger(__name__)


class LeaveTypeViewSet(ModelViewSet):
    """CRUD for leave types. HR Admin only for writes."""
    queryset = LeaveType.objects.all()
    serializer_class = LeaveTypeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'is_paid', 'accrual_type']
    search_fields = ['code', 'name', 'description']
    ordering_fields = ['display_order', 'code', 'name']
    ordering = ['display_order', 'code']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'mini']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    @action(detail=False, methods=['get'], url_path='mini')
    def mini(self, request):
        """Lightweight list for dropdowns."""
        qs = LeaveType.objects.filter(is_active=True).order_by('display_order', 'code')
        serializer = LeaveTypeMiniSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        """Create default leave types (HR Admin only)."""
        user = request.user
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'HR Admin only'}, status=403)

        if LeaveType.objects.exists():
            return Response({
                'ok': False,
                'message': f'Leave types already exist ({LeaveType.objects.count()}). Skipping.',
            }, status=400)

        defaults = [
            {'code': 'CL', 'name': 'Casual Leave', 'is_paid': True,
             'accrual_type': 'YEARLY', 'yearly_quota': 12,
             'max_consecutive_days': 3, 'allowed_during_probation': True,
             'color_code': '#3B82F6', 'display_order': 1},
            {'code': 'SL', 'name': 'Sick Leave', 'is_paid': True,
             'accrual_type': 'YEARLY', 'yearly_quota': 10,
             'requires_document': True, 'max_consecutive_days': 5,
             'allowed_during_probation': True,
             'color_code': '#EF4444', 'display_order': 2},
            {'code': 'EL', 'name': 'Earned Leave', 'is_paid': True,
             'accrual_type': 'MONTHLY', 'yearly_quota': 15,
             'accrual_per_period': 1.25,
             'can_carry_forward': True, 'max_carry_forward': 30,
             'can_encash': True, 'max_encashment_days': 15,
             'min_days_before_apply': 3, 'max_consecutive_days': 15,
             'min_service_months': 6,
             'color_code': '#10B981', 'display_order': 3},
            {'code': 'COMP_OFF', 'name': 'Compensatory Off', 'is_paid': True,
             'accrual_type': 'ON_DEMAND', 'min_days_before_apply': 1,
             'color_code': '#F59E0B', 'display_order': 4},
            {'code': 'LOP', 'name': 'Loss of Pay', 'is_paid': False,
             'accrual_type': 'ON_DEMAND', 'allowed_during_probation': True,
             'color_code': '#6B7280', 'display_order': 99},
        ]

        created = []
        for data in defaults:
            leave_type = LeaveType.objects.create(**data)
            created.append(leave_type.code)

        return Response({
            'ok': True,
            'message': f'Created {len(created)} default leave types',
            'created': created,
        })


class HolidayViewSet(ModelViewSet):
    """CRUD for holidays. HR Admin only for writes."""
    queryset = Holiday.objects.all().prefetch_related('applicable_locations')
    serializer_class = HolidaySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['year', 'holiday_type', 'is_optional', 'is_active']
    search_fields = ['name']
    ordering_fields = ['date', 'name']
    ordering = ['date']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'by_year', 'upcoming']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    @action(detail=False, methods=['get'], url_path='by-year')
    def by_year(self, request):
        year = request.query_params.get('year', timezone.now().year)
        try:
            year = int(year)
        except ValueError:
            return Response({'detail': 'Invalid year'}, status=400)

        holidays = self.get_queryset().filter(year=year, is_active=True).order_by('date')
        serializer = self.get_serializer(holidays, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='upcoming')
    def upcoming(self, request):
        from datetime import timedelta
        today = timezone.localdate()
        end_date = today + timedelta(days=90)
        holidays = self.get_queryset().filter(
            date__gte=today, date__lte=end_date, is_active=True,
        ).order_by('date')
        serializer = self.get_serializer(holidays, many=True)
        return Response(serializer.data)


# ==============================================================================
# LEAVE BALANCE VIEWSET (Read + HR Actions)
# ==============================================================================

from .models import LeaveBalance
from .serializers import LeaveBalanceSerializer
from .services.balance_service import LeaveBalanceService


class LeaveBalanceViewSet(ModelViewSet):
    """
    Leave balance queries + HR admin actions.
    """
    queryset = LeaveBalance.objects.all().select_related('employee', 'leave_type')
    serializer_class = LeaveBalanceSerializer
    pagination_class = None 
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'leave_type', 'year']
    ordering_fields = ['year', 'employee__employee_id']
    ordering = ['-year', 'employee__employee_id']
    http_method_names = ['get', 'patch','post']  # Read-only + adjustments

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'my_balance']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # HR/System Admin sees all
        if user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN'):
            return qs

        # Managers see their team's balances
        if user.has_role('MANAGER') and hasattr(user, 'employee'):
            return qs.filter(employee__reporting_manager=user.employee)

        # Employees see only their own
        if hasattr(user, 'employee'):
            return qs.filter(employee=user.employee)

        return qs.none()

    @action(detail=False, methods=['get'], url_path='my-balance')
    def my_balance(self, request):
        """Get current user's leave balances for current year."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        year = int(request.query_params.get('year', timezone.now().year))
        balances = LeaveBalance.objects.filter(
            employee=user.employee, year=year,
        ).select_related('leave_type').order_by('leave_type__display_order')

        serializer = self.get_serializer(balances, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='allocate-all')
    def allocate_all(self, request):
        """
        HR Admin: Bulk-allocate leave balances for ALL active employees.
        Skips employees who already have balances for current year.
        """
        from HRMSapp.models import Employee

        user = request.user
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'HR Admin only'}, status=403)

        year = int(request.data.get('year', timezone.now().year))

        # Get all active employees
        employees = Employee.objects.filter(
            is_deleted=False,
            status__in=['ACTIVE', 'PROBATION'],
        )

        results = {
            'total_employees': employees.count(),
            'newly_allocated': 0,
            'skipped_existing': 0,
            'errors': [],
            'allocated_details': [],
        }

        for emp in employees:
            try:
                balances = LeaveBalanceService.allocate_initial_balance(emp, year=year)
                if balances:
                    results['newly_allocated'] += 1
                    results['allocated_details'].append({
                        'employee_id': emp.employee_id,
                        'full_name': emp.full_name,
                        'balances_created': len(balances),
                    })
                else:
                    results['skipped_existing'] += 1
            except Exception as exc:
                results['errors'].append({
                    'employee_id': emp.employee_id,
                    'error': str(exc),
                })

        return Response({
            'ok': True,
            'message': (
                f"Allocation complete: {results['newly_allocated']} employees allocated, "
                f"{results['skipped_existing']} already had balances"
            ),
            **results,
        })

    @action(detail=False, methods=['post'], url_path='allocate-employee')
    def allocate_employee(self, request):
        """
        HR Admin: Allocate leave balance for a specific employee.
        Body: { "employee_id": "uuid", "year": 2026 }
        """
        from HRMSapp.models import Employee

        user = request.user
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'HR Admin only'}, status=403)

        employee_id = request.data.get('employee_id')
        year = int(request.data.get('year', timezone.now().year))

        try:
            employee = Employee.objects.get(id=employee_id, is_deleted=False)
        except Employee.DoesNotExist:
            return Response({'detail': 'Employee not found'}, status=404)

        try:
            balances = LeaveBalanceService.allocate_initial_balance(employee, year=year)
            return Response({
                'ok': True,
                'message': f"Allocated {len(balances)} leave balances for {employee.full_name}",
                'balances_created': len(balances),
            })
        except Exception as exc:
            return Response({'ok': False, 'message': str(exc)}, status=500)

    @action(detail=True, methods=['post'], url_path='adjust')
    def adjust(self, request, pk=None):
        """
        HR Admin: Manually adjust a specific leave balance.
        Body: { "adjustment": 2.5, "reason": "Reward for extra work" }
        """
        user = request.user
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'HR Admin only'}, status=403)

        balance = self.get_object()
        adjustment = request.data.get('adjustment')
        reason = request.data.get('reason', '')

        if adjustment is None:
            return Response({'detail': 'adjustment value required'}, status=400)

        try:
            from decimal import Decimal
            balance.adjustment = (balance.adjustment or Decimal('0')) + Decimal(str(adjustment))
            balance.save()
            return Response({
                'ok': True,
                'message': f"Adjusted by {adjustment} days. New available: {balance.available}",
                'balance': LeaveBalanceSerializer(balance).data,
            })
        except Exception as exc:
            return Response({'ok': False, 'message': str(exc)}, status=500)



# ==============================================================================
# LEAVE APPLICATION VIEWSET
# ==============================================================================

from .models import LeaveApplication
from .serializers import (
    LeaveApplicationListSerializer, LeaveApplicationDetailSerializer,
    LeaveApplicationCreateSerializer,
    LeaveApprovalActionSerializer, LeaveRejectActionSerializer,
)
from .services.leave_service import LeaveApplicationService, LeaveApplicationError, TeamCalendarService
from django.db import models as django_models


class LeaveApplicationViewSet(ModelViewSet):
    """Leave applications with approval workflow."""
    queryset = LeaveApplication.objects.all().select_related(
        'employee', 'leave_type', 'current_approver', 'approved_by', 'handover_to'
    ).prefetch_related('approvals')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'leave_type', 'employee']
    ordering_fields = ['applied_at', 'start_date']
    ordering = ['-applied_at']
    http_method_names = ['get', 'post', 'delete']
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'list':
            return LeaveApplicationListSerializer
        if self.action == 'create':
            return LeaveApplicationCreateSerializer
        return LeaveApplicationDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN'):
            return qs

        if user.has_role('MANAGER') and hasattr(user, 'employee'):
            return qs.filter(
                django_models.Q(employee=user.employee) |
                django_models.Q(employee__reporting_manager=user.employee) |
                django_models.Q(current_approver=user.employee)
            )

        if hasattr(user, 'employee'):
            return qs.filter(employee=user.employee)

        return qs.none()

    def create(self, request, *args, **kwargs):
        """Employee creates leave application."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            application = LeaveApplicationService.create_application(
                employee=user.employee,
                leave_type=serializer.validated_data['leave_type'],
                start_date=serializer.validated_data['start_date'],
                end_date=serializer.validated_data['end_date'],
                reason=serializer.validated_data['reason'],
                is_half_day=serializer.validated_data.get('is_half_day', False),
                half_day_period=serializer.validated_data.get('half_day_period', ''),
                contact_during_leave=serializer.validated_data.get('contact_during_leave', ''),
                supporting_document=serializer.validated_data.get('supporting_document'),
                handover_to=serializer.validated_data.get('handover_to'),
                handover_notes=serializer.validated_data.get('handover_notes', ''),
            )
        except LeaveApplicationError as exc:
            return Response({'detail': str(exc)}, status=400)

        detail_serializer = LeaveApplicationDetailSerializer(
            application, context={'request': request}
        )
        return Response(detail_serializer.data, status=201)

    @action(detail=False, methods=['post'], url_path='validate')
    def validate_leave(self, request):
        """Validate a leave request without creating it (for live preview)."""
        from .models import LeaveType
        from datetime import datetime

        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        try:
            leave_type_id = request.data.get('leave_type')
            leave_type = LeaveType.objects.get(id=leave_type_id)
            start_date = datetime.strptime(request.data.get('start_date'), '%Y-%m-%d').date()
            end_date = datetime.strptime(request.data.get('end_date'), '%Y-%m-%d').date()
            is_half_day = request.data.get('is_half_day', False)
            half_day_period = request.data.get('half_day_period', '')

            validation = LeaveApplicationService.validate_application(
                user.employee, leave_type, start_date, end_date,
                is_half_day, half_day_period,
            )

            return Response({
                'valid': validation['valid'],
                'errors': validation['errors'],
                'warnings': validation['warnings'],
                'total_days': str(validation['total_days']),
                'is_lop': validation['is_lop'],
                'lop_days': str(validation['lop_days']),
            })
        except LeaveType.DoesNotExist:
            return Response({'detail': 'Invalid leave type'}, status=400)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Manager/HR approves the leave."""
        application = self.get_object()
        user = request.user

        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        serializer = LeaveApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        override_clash = request.data.get('override_clash', False)
        try:
            application = LeaveApplicationService.approve_application(
                application, user.employee,
                comments=serializer.validated_data.get('comments', ''),
                override_clash=override_clash,
            )
        except LeaveApplicationError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response({
            'ok': True,
            'message': 'Leave approved successfully',
            'status': application.status,
        })

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """Manager/HR rejects the leave."""
        application = self.get_object()
        user = request.user

        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        serializer = LeaveRejectActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            application = LeaveApplicationService.reject_application(
                application, user.employee,
                reason=serializer.validated_data['reason'],
            )
        except LeaveApplicationError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response({
            'ok': True,
            'message': 'Leave rejected',
            'status': application.status,
        })

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """Employee cancels their own leave."""
        application = self.get_object()
        user = request.user

        if not hasattr(user, 'employee') or user.employee != application.employee:
            return Response({'detail': 'Only the applicant can cancel'}, status=403)

        reason = request.data.get('reason', '')

        try:
            application = LeaveApplicationService.cancel_application(application, reason)
        except LeaveApplicationError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response({
            'ok': True,
            'message': 'Leave cancelled',
            'status': application.status,
        })

    @action(detail=False, methods=['get'], url_path='my-applications')
    def my_applications(self, request):
        """Current user's leave applications."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])

        qs = LeaveApplication.objects.filter(
            employee=user.employee
        ).select_related('leave_type').order_by('-applied_at')

        serializer = LeaveApplicationListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='pending-approvals')
    def pending_approvals(self, request):
        """Leaves pending my approval."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])

        qs = LeaveApplication.objects.filter(
            current_approver=user.employee,
            status='PENDING',
        ).select_related('employee', 'leave_type').order_by('-applied_at')

        serializer = LeaveApplicationListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='team-calendar')
    def team_calendar(self, request):
        """Team leave calendar for clash prevention (SRS 4.6.2)."""
        from datetime import datetime

        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        if not start_date_str or not end_date_str:
            # Default: current month
            today = timezone.localdate()
            from datetime import date
            start_date = date(today.year, today.month, 1)
            # Last day of month
            next_month = date(today.year, today.month, 28) + timedelta(days=4)
            end_date = next_month - timedelta(days=next_month.day)
        else:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()

        calendar = TeamCalendarService.get_team_calendar(
            user.employee, start_date, end_date
        )
        return Response(calendar)



from .models import AnnualCalendar
from .serializers import (
    AnnualCalendarListSerializer, AnnualCalendarDetailSerializer,
    AnnualCalendarCreateSerializer,
)
from .services.calendar_service import AnnualCalendarService, CalendarServiceError


class AnnualCalendarViewSet(ModelViewSet):
    """Annual calendar management with approval workflow."""
    queryset = AnnualCalendar.objects.all().prefetch_related('holidays', 'approvals')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'year']
    ordering = ['-year']
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'list':
            return AnnualCalendarListSerializer
        if self.action == 'create':
            return AnnualCalendarCreateSerializer
        return AnnualCalendarDetailSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'published', 'pending_approvals']:
            return [IsAuthenticated()]
        if self.action in ['approve', 'reject', 'return_for_changes']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def create(self, request, *args, **kwargs):
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            calendar = AnnualCalendarService.create_calendar(
                year=serializer.validated_data['year'],
                title=serializer.validated_data.get('title', f"Annual Calendar {serializer.validated_data['year']}"),
                description=serializer.validated_data.get('description', ''),
                created_by=user.employee,
            )
        except CalendarServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response(
            AnnualCalendarDetailSerializer(calendar, context={'request': request}).data,
            status=201,
        )

    @action(detail=True, methods=['post'], url_path='add-holiday')
    def add_holiday(self, request, pk=None):
        """Add a holiday to this calendar."""
        calendar = self.get_object()
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        try:
            location_ids = request.data.pop('applicable_locations', [])
            holiday_data = {
                'name': request.data.get('name'),
                'date': request.data.get('date'),
                'holiday_type': request.data.get('holiday_type', 'NATIONAL'),
                'description': request.data.get('description', ''),
                'applicable_to_all_locations': request.data.get('applicable_to_all_locations', True),
                'is_optional': request.data.get('is_optional', False),
                'is_active': False,  # Activated only on publish
                'applicable_locations': location_ids,
            }

            from datetime import datetime
            holiday_data['date'] = datetime.strptime(holiday_data['date'], '%Y-%m-%d').date()

            holiday = AnnualCalendarService.add_holiday_to_calendar(
                calendar, holiday_data, user.employee
            )
            return Response(HolidaySerializer(holiday).data, status=201)
        except CalendarServiceError as exc:
            return Response({'detail': str(exc)}, status=400)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=500)

    @action(detail=True, methods=['delete'], url_path='remove-holiday/(?P<holiday_id>[^/.]+)')
    def remove_holiday(self, request, pk=None, holiday_id=None):
        """Remove a holiday from this calendar."""
        calendar = self.get_object()
        if calendar.status not in ['DRAFT']:
            return Response(
                {'detail': f'Cannot modify {calendar.get_status_display()} calendar'},
                status=400,
            )
        deleted, _ = Holiday.objects.filter(id=holiday_id, calendar=calendar).delete()
        if deleted:
            return Response({'ok': True, 'message': 'Holiday removed'})
        return Response({'detail': 'Holiday not found'}, status=404)

    @action(detail=True, methods=['post'], url_path='submit-for-review')
    def submit_for_review(self, request, pk=None):
        calendar = self.get_object()
        user = request.user
        try:
            AnnualCalendarService.submit_for_approval(calendar, user.employee)
            return Response({'ok': True, 'message': 'Submitted for approval'})
        except CalendarServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        calendar = self.get_object()
        user = request.user
        try:
            AnnualCalendarService.approve_calendar(
                calendar, user.employee,
                comments=request.data.get('comments', ''),
            )
            return Response({'ok': True, 'message': 'Approved'})
        except CalendarServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        calendar = self.get_object()
        user = request.user
        reason = request.data.get('reason', '')
        if not reason:
            return Response({'detail': 'Reason required'}, status=400)
        try:
            AnnualCalendarService.reject_calendar(calendar, user.employee, reason)
            return Response({'ok': True, 'message': 'Rejected'})
        except CalendarServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=True, methods=['post'], url_path='return-for-changes')
    def return_for_changes(self, request, pk=None):
        calendar = self.get_object()
        user = request.user
        comments = request.data.get('comments', '')
        try:
            AnnualCalendarService.return_calendar_for_changes(
                calendar, user.employee, comments
            )
            return Response({'ok': True, 'message': 'Returned for changes'})
        except CalendarServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        calendar = self.get_object()
        user = request.user
        try:
            AnnualCalendarService.publish_calendar(calendar, user.employee)
            return Response({'ok': True, 'message': 'Published successfully'})
        except CalendarServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=False, methods=['get'], url_path='published')
    def published(self, request):
        """Get the currently published calendar (for all employees)."""
        year = int(request.query_params.get('year', timezone.now().year))
        calendar = AnnualCalendar.objects.filter(
            year=year, status='PUBLISHED'
        ).first()
        if not calendar:
            return Response({'detail': f'No published calendar for {year}'}, status=404)
        return Response(AnnualCalendarDetailSerializer(calendar, context={'request': request}).data)

    @action(detail=False, methods=['get'], url_path='pending-approvals')
    def pending_approvals(self, request):
        """Calendars pending my approval."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])
        from .models import AnnualCalendarApproval
        pending_ids = AnnualCalendarApproval.objects.filter(
            approver=user.employee, status='PENDING'
        ).values_list('calendar_id', flat=True)
        calendars = AnnualCalendar.objects.filter(id__in=pending_ids, status='IN_REVIEW')
        return Response(AnnualCalendarListSerializer(calendars, many=True).data)  


    @action(detail=True, methods=['post'], url_path='amend-add-holiday')
    def amend_add_holiday(self, request, pk=None):
        """Add a holiday to a PUBLISHED calendar (HR only)."""
        calendar = self.get_object()
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        try:
            from datetime import datetime
            location_ids = request.data.get('applicable_locations', [])
            reason = request.data.get('reason', '')

            holiday_data = {
                'name': request.data.get('name', '').strip(),
                'date': datetime.strptime(request.data.get('date'), '%Y-%m-%d').date(),
                'holiday_type': request.data.get('holiday_type', 'NATIONAL'),
                'description': request.data.get('description', ''),
                'applicable_to_all_locations': request.data.get('applicable_to_all_locations', True),
                'is_optional': request.data.get('is_optional', False),
                'applicable_locations': location_ids,
            }

            if not holiday_data['name']:
                return Response({'detail': 'Holiday name required'}, status=400)

            holiday = AnnualCalendarService.amend_add_holiday(
                calendar, holiday_data, reason, user.employee
            )
            return Response(HolidaySerializer(holiday).data, status=201)
        except CalendarServiceError as exc:
            return Response({'detail': str(exc)}, status=400)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=500)


    @action(detail=True, methods=['post'], url_path='amend-remove-holiday')
    def amend_remove_holiday(self, request, pk=None):
        """Remove a holiday from a PUBLISHED calendar (HR only)."""
        calendar = self.get_object()
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        holiday_id = request.data.get('holiday_id')
        reason = request.data.get('reason', '')

        if not holiday_id:
            return Response({'detail': 'holiday_id required'}, status=400)

        try:
            result = AnnualCalendarService.amend_remove_holiday(
                calendar, holiday_id, reason, user.employee
            )
            return Response({'ok': True, **result})
        except CalendarServiceError as exc:
            return Response({'detail': str(exc)}, status=400)


    @action(detail=True, methods=['get'], url_path='amendments')
    def amendments(self, request, pk=None):
        """Get amendment history for this calendar."""
        calendar = self.get_object()
        from .models import CalendarAmendment
        from .serializers import CalendarAmendmentSerializer

        amendments = CalendarAmendment.objects.filter(
            calendar=calendar
        ).select_related('made_by').order_by('-made_at')

        return Response(CalendarAmendmentSerializer(amendments, many=True).data)  




class WhatsAppGatewayStatusView(APIView):
    """Get overall gateway + sessions status."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request):
        from .services.whatsapp_service import get_gateway_status
        return Response(get_gateway_status())


class WhatsAppSessionQRView(APIView):
    """Get QR code for a specific session."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request, session_key):
        from .services.whatsapp_service import get_session_qr
        if session_key not in ('primary', 'fallback'):
            return Response({'error': 'Invalid session'}, status=400)
        return Response(get_session_qr(session_key))


class WhatsAppSessionConnectView(APIView):
    """Start a session."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request, session_key):
        from .services.whatsapp_service import connect_session
        if session_key not in ('primary', 'fallback'):
            return Response({'error': 'Invalid session'}, status=400)
        return Response(connect_session(session_key))


class WhatsAppSessionDisconnectView(APIView):
    """Disconnect a session."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request, session_key):
        from .services.whatsapp_service import disconnect_session
        if session_key not in ('primary', 'fallback'):
            return Response({'error': 'Invalid session'}, status=400)
        return Response(disconnect_session(session_key))


class WhatsAppSwitchSessionView(APIView):
    """Manually switch active session."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        from .services.whatsapp_service import switch_active_session
        session_key = request.data.get('session')
        if session_key not in ('primary', 'fallback'):
            return Response({'error': 'Invalid session'}, status=400)
        return Response(switch_active_session(session_key))


class WhatsAppTestSendView(APIView):
    """Send a test message."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        from .services.whatsapp_service import send_whatsapp_message
        
        phone = request.data.get('phone', '')
        if not phone:
            return Response({'ok': False, 'message': 'phone required'}, status=400)
        
        result = send_whatsapp_message(
            phone,
            "🧪 *HRMS Test Message*\n\nWhatsApp integration is working! ✅"
        )
        
        return Response({
            'ok': result.get('success', False),
            'message': (
                f"Sent to {phone} via {result.get('sent_via', 'gateway')}"
                if result.get('success')
                else f"Failed: {result.get('error')}"
            ),
            **result,
        }, status=200 if result.get('success') else 400)


class WhatsAppLogsView(APIView):
    """View WhatsApp notification logs."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request):
        from .models import WhatsAppNotificationLog
        
        logs = WhatsAppNotificationLog.objects.select_related(
            'recipient_employee', 'leave_application'
        ).order_by('-sent_at')[:100]
        
        data = [{
            'id': str(log.id),
            'type': log.get_notification_type_display(),
            'recipient': (
                log.recipient_employee.full_name if log.recipient_employee else 'Unknown'
            ),
            'phone': log.recipient_phone,
            'leave_ref': (
                log.leave_application.application_number
                if log.leave_application else None
            ),
            'status': log.status,
            'message_id': log.message_id,
            'error': log.error_message,
            'sent_at': log.sent_at.isoformat(),
        } for log in logs]
        
        # Stats
        from django.db.models import Count
        stats = dict(
            WhatsAppNotificationLog.objects.values('status')
            .annotate(count=Count('id'))
            .values_list('status', 'count')
        )
        
        return Response({
            'stats': {
                'total': sum(stats.values()),
                'success': stats.get('SUCCESS', 0),
                'failed': stats.get('FAILED', 0),
                'skipped': stats.get('SKIPPED', 0),
            },
            'logs': data,
        })