from django.shortcuts import render

from assetapp.tasks import notify_asset_allocation,notify_asset_return

# Create your views here.
"""
Asset Management Views.
"""
from rest_framework import status, filters
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction, models
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import timedelta

from .models import AssetCategory, Asset, AssetAllocation, AssetPhoto
from .serializers import (
    AssetCategorySerializer,
    AssetListSerializer, AssetDetailSerializer,
    AssetAllocationSerializer,
    AllocateAssetPayloadSerializer, ReturnAssetPayloadSerializer,
)
from HRMSapp.permissions import IsHRAdmin
from HRMSapp.models import Employee, Notification, ApprovalWorkflow
from HRMSapp.services.workflow_service import WorkflowService


# ==============================================================================
# ASSET CATEGORY VIEWSET
# ==============================================================================

class AssetCategoryViewSet(ModelViewSet):
    """CRUD for asset categories."""
    queryset = AssetCategory.objects.all()
    serializer_class = AssetCategorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.assets.exists():
            return Response(
                {'detail': f'Cannot delete "{obj.name}" — it has {obj.assets.count()} assets.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


# ==============================================================================
# ASSET VIEWSET
# ==============================================================================

class AssetViewSet(ModelViewSet):
    """CRUD for assets + custom actions."""
    queryset = Asset.objects.select_related('category', 'created_by').prefetch_related(
        'allocations__employee'
    ).all()
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'status', 'condition', 'brand']
    search_fields = ['asset_tag', 'name', 'serial_number', 'brand', 'model_number']
    ordering_fields = ['created_at', 'asset_tag', 'purchase_date', 'name']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return AssetListSerializer
        return AssetDetailSerializer

    def get_permissions(self):
        # Everyone can view their own assets & lists
        if self.action in ['list', 'retrieve', 'my_assets', 'employee_assets']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def perform_create(self, serializer):
        employee = getattr(self.request.user, 'employee', None)
        serializer.save(created_by=employee)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status == 'ALLOCATED':
            return Response(
                {'detail': f'Cannot delete "{obj.asset_tag}" — currently allocated. Return it first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['delete'], url_path=r'photos/(?P<photo_id>[^/.]+)')
    def delete_photo(self, request, pk=None, photo_id=None):
        """Delete one gallery photo from an asset."""
        asset = self.get_object()
        photo = AssetPhoto.objects.filter(asset=asset, id=photo_id).first()
        if not photo:
            return Response({'detail': 'Photo not found for this asset.'}, status=status.HTTP_404_NOT_FOUND)

        image = photo.image
        photo.delete()
        if image:
            image.delete(save=False)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --------------------------------------------------------------------------
    # ESS: My Assets
    # --------------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='my-assets')
    def my_assets(self, request):
        """List assets currently allocated to logged-in user."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])

        allocations = AssetAllocation.objects.filter(
            employee=user.employee,
            status__in=['ALLOCATED', 'NOT_RECEIVED'],
        ).select_related('asset', 'asset__category', 'allocated_by')

        serializer = AssetAllocationSerializer(allocations, many=True, context={'request': request})
        return Response(serializer.data)

    # --------------------------------------------------------------------------
    # HR: View any employee's assets
    # --------------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='employee/(?P<employee_id>[^/.]+)')
    def employee_assets(self, request, employee_id=None):
        """View assets allocated to a specific employee (HR / Manager / Self)."""
        user = request.user
        
        # Permission check: user can view own, HR/Admin can view anyone, Manager can view team
        can_view = False
        if user.has_role('SYSTEM_ADMIN') or user.has_role('HR_ADMIN'):
            can_view = True
        elif hasattr(user, 'employee'):
            if str(user.employee.id) == employee_id:
                can_view = True
            elif user.has_role('MANAGER'):
                # Check if this employee reports to the manager
                is_team_member = Employee.objects.filter(
                    id=employee_id,
                    reporting_manager=user.employee,
                ).exists()
                if is_team_member:
                    can_view = True
        
        if not can_view:
            return Response(
                {'detail': 'You do not have permission to view this employee\'s assets.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        allocations = AssetAllocation.objects.filter(
            employee_id=employee_id,
            status__in=['ALLOCATED', 'NOT_RECEIVED'],
        ).select_related('asset', 'asset__category', 'allocated_by')

        serializer = AssetAllocationSerializer(allocations, many=True, context={'request': request})
        return Response(serializer.data)

    # --------------------------------------------------------------------------
    # HR: Available assets (for allocation dropdown)
    # --------------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='available')
    def available(self, request):
        """Get available assets, optionally filtered by category."""
        category_id = request.query_params.get('category')
        qs = self.get_queryset().filter(status='AVAILABLE')
        if category_id:
            qs = qs.filter(category_id=category_id)

        serializer = AssetListSerializer(qs, many=True)
        return Response(serializer.data)


# ==============================================================================
# ASSET ALLOCATION VIEWSET
# ==============================================================================

class AssetAllocationViewSet(ModelViewSet):
    """Manage allocations + allocate/return actions."""
    queryset = AssetAllocation.objects.select_related(
        'asset', 'asset__category', 'employee', 'employee__position',
        'allocated_by', 'returned_to',
    ).all()
    serializer_class = AssetAllocationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'employee', 'asset']
    ordering_fields = ['allocated_date', 'returned_date']
    ordering = ['-allocated_date']
    http_method_names = ['get', 'post', 'patch']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'confirm_receipt', 'receipt_reviews', 'review_receipt']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN'):
            return qs
        if hasattr(user, 'employee') and user.employee:
            if user.has_role('MANAGER'):
                return qs.filter(Q(employee=user.employee) | Q(employee__reporting_manager=user.employee))
            return qs.filter(employee=user.employee)
        return qs.none()

    # --------------------------------------------------------------------------
    # ALLOCATE (Assign asset to employee)
    # --------------------------------------------------------------------------
    @action(detail=False, methods=['post'], url_path='allocate')
    @transaction.atomic
    def allocate(self, request):
        """Allocate an AVAILABLE asset to an employee."""
        serializer = AllocateAssetPayloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        asset_id = serializer.validated_data['asset_id']
        employee_id = serializer.validated_data['employee_id']

        try:
            asset = Asset.objects.select_for_update().get(id=asset_id)
        except Asset.DoesNotExist:
            return Response({'detail': 'Asset not found.'}, status=404)

        if asset.status == 'ALLOCATED':
            return Response(
                {'detail': f'Asset {asset.asset_tag} is already allocated.'},
                status=400,
            )
        if asset.status == 'DISPOSED':
            return Response(
                {'detail': 'Cannot allocate a disposed asset.'},
                status=400,
            )
        if asset.status == 'MAINTENANCE':
            return Response(
                {'detail': 'Asset is under maintenance. Mark as AVAILABLE first.'},
                status=400,
            )

        try:
            employee = Employee.objects.get(id=employee_id, is_deleted=False)
        except Employee.DoesNotExist:
            return Response({'detail': 'Employee not found.'}, status=404)

        allocator = getattr(request.user, 'employee', None)
        allocation = AssetAllocation.objects.create(
            asset=asset,
            employee=employee,
            allocated_date=serializer.validated_data.get('allocated_date', timezone.now().date()),
            expected_return_date=serializer.validated_data.get('expected_return_date'),
            handover_notes=serializer.validated_data.get('handover_notes', ''),
            allocated_by=allocator,
            status='ALLOCATED',
            response_due_at=timezone.now() + timedelta(days=asset.category.employee_response_days),
        )

        # Update asset status
        asset.status = 'ALLOCATED'
        asset.save(update_fields=['status'])

        notify_asset_allocation.delay(str(allocation.id))
        
        return Response(
            AssetAllocationSerializer(allocation, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='confirm-receipt')
    @transaction.atomic
    def confirm_receipt(self, request, pk=None):
        """Employee confirms physical handover or flags that it did not occur."""
        allocation = AssetAllocation.objects.select_for_update().select_related('employee', 'asset').filter(pk=pk).first()
        if not allocation:
            return Response({'detail': 'Allocation not found.'}, status=404)
        employee = getattr(request.user, 'employee', None)
        if not employee or allocation.employee_id != employee.id:
            return Response({'detail': 'Only the assigned employee can respond.'}, status=403)
        is_final_confirmation = allocation.receipt_status == 'AWAITING_EMPLOYEE_CONFIRMATION'
        if allocation.status != 'ALLOCATED' or allocation.receipt_status not in ('PENDING', 'AWAITING_EMPLOYEE_CONFIRMATION'):
            return Response({'detail': 'This allocation is no longer awaiting a response.'}, status=400)
        if not is_final_confirmation and allocation.response_due_at and timezone.now() > allocation.response_due_at:
            return Response({'detail': 'The response window has expired.'}, status=400)

        response = str(request.data.get('response') or '').upper()
        note = str(request.data.get('note') or '').strip()
        if response not in ('ACCEPT', 'FLAG'):
            return Response({'detail': 'response must be ACCEPT or FLAG.'}, status=400)
        if response == 'FLAG' and not note:
            return Response({'detail': 'Explain why you did not receive the asset.'}, status=400)

        if is_final_confirmation:
            allocation.final_employee_response_at = timezone.now()
            allocation.final_employee_response_note = note
            allocation.receipt_status = 'ACCEPTED' if response == 'ACCEPT' else 'FLAGGED'
            allocation.save(update_fields=[
                'final_employee_response_at', 'final_employee_response_note',
                'receipt_status', 'updated_at',
            ])
        else:
            allocation.employee_response_at = timezone.now()
            allocation.employee_response_note = note
            allocation.receipt_status = 'ACCEPTED' if response == 'ACCEPT' else 'FLAGGED'
            allocation.save(update_fields=['employee_response_at', 'employee_response_note', 'receipt_status', 'updated_at'])
        if response == 'FLAG':
            self._notify_receipt_reviewers(allocation)
        return Response(AssetAllocationSerializer(allocation, context={'request': request}).data)

    @staticmethod
    def _notify_receipt_reviewers(allocation):
        current_flag_note = allocation.final_employee_response_note or allocation.employee_response_note
        workflow = ApprovalWorkflow.objects.filter(module='ASSET_RECEIPT_REVIEW', is_active=True).prefetch_related('steps').first()
        if workflow and workflow.steps.exists():
            reviewers = set()
            for step in workflow.steps.all():
                reviewers.update(WorkflowService.resolve_approvers(step, allocation.employee))
        else:
            reviewers = set(Employee.objects.filter(
                user_account__is_active=True,
                user_account__roles__role_name__in=['HR_ADMIN', 'SYSTEM_ADMIN'],
            ).distinct())
        for reviewer in reviewers:
            Notification.objects.create(
                recipient=reviewer,
                notification_type='ASSET_RECEIPT_REVIEW',
                title='Asset receipt flag needs review',
                message=f'{allocation.employee.full_name} says they did not receive {allocation.asset.asset_tag}: {current_flag_note}',
                link='/assets/receipt-reviews',
                metadata={'allocation_id': str(allocation.id)},
            )

    @action(detail=False, methods=['get'], url_path='receipt-reviews')
    def receipt_reviews(self, request):
        flagged = AssetAllocation.objects.filter(receipt_status='FLAGGED').select_related(
            'asset', 'asset__category', 'employee', 'allocated_by'
        )
        workflow = ApprovalWorkflow.objects.filter(module='ASSET_RECEIPT_REVIEW', is_active=True).prefetch_related('steps').first()
        if workflow and workflow.steps.exists():
            reviewer = getattr(request.user, 'employee', None)
            if not reviewer:
                return Response({'detail': 'Reviewer employee profile is required.'}, status=403)
            visible_ids = []
            for allocation in flagged:
                allowed = set()
                for step in workflow.steps.all():
                    allowed.update(person.id for person in WorkflowService.resolve_approvers(step, allocation.employee))
                if reviewer.id in allowed:
                    visible_ids.append(allocation.id)
            flagged = flagged.filter(id__in=visible_ids)
        elif not (request.user.has_role('HR_ADMIN') or request.user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'Management access required.'}, status=403)
        return Response(AssetAllocationSerializer(flagged, many=True, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='review-receipt')
    @transaction.atomic
    def review_receipt(self, request, pk=None):
        allocation = AssetAllocation.objects.select_for_update().select_related('asset', 'employee').filter(pk=pk).first()
        if not allocation:
            return Response({'detail': 'Allocation not found.'}, status=404)
        if allocation.receipt_status != 'FLAGGED':
            return Response({'detail': 'This allocation has no pending receipt flag.'}, status=400)

        reviewer = getattr(request.user, 'employee', None)
        workflow = ApprovalWorkflow.objects.filter(module='ASSET_RECEIPT_REVIEW', is_active=True).prefetch_related('steps').first()
        if workflow and workflow.steps.exists() and reviewer:
            allowed = set()
            for step in workflow.steps.all():
                allowed.update(person.id for person in WorkflowService.resolve_approvers(step, allocation.employee))
            if reviewer.id not in allowed:
                return Response({'detail': 'You are not an assigned reviewer for asset receipt flags.'}, status=403)
        elif not (request.user.has_role('HR_ADMIN') or request.user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'Management access required.'}, status=403)

        decision = str(request.data.get('decision') or '').upper()
        note = str(request.data.get('note') or '').strip()
        if decision not in ('CONFIRM_NOT_RECEIVED', 'CONFIRM_RECEIVED'):
            return Response({'detail': 'decision must be CONFIRM_NOT_RECEIVED or CONFIRM_RECEIVED.'}, status=400)
        if not note:
            return Response({'detail': 'A management decision note is required.'}, status=400)

        allocation.review_note = note
        allocation.reviewed_by = reviewer
        allocation.reviewed_at = timezone.now()
        if decision == 'CONFIRM_NOT_RECEIVED':
            allocation.receipt_status = 'REVIEW_NOT_RECEIVED'
            allocation.status = 'NOT_RECEIVED'
            allocation.asset.status = 'AVAILABLE'
            allocation.asset.save(update_fields=['status', 'updated_at'])
        else:
            allocation.receipt_status = 'AWAITING_EMPLOYEE_CONFIRMATION'
            allocation.response_due_at = None
            allocation.final_employee_response_at = None
            allocation.final_employee_response_note = ''
        allocation.save(update_fields=[
            'receipt_status', 'status', 'review_note', 'reviewed_by', 'reviewed_at',
            'response_due_at', 'final_employee_response_at', 'final_employee_response_note',
            'updated_at',
        ])
        employee_message = (
            f'Management confirmed the handover of {allocation.asset.asset_tag}. Please confirm in My Assets whether you received it.'
            if decision == 'CONFIRM_RECEIVED'
            else f'Management confirmed that {allocation.asset.asset_tag} was not received. It has been returned to available inventory.'
        )
        Notification.objects.create(
            recipient=allocation.employee,
            notification_type='ASSET_RECEIPT_REVIEW',
            title='Asset receipt review completed',
            message=f'{employee_message} Management note: {note}',
            link='/assets/my-assets',
            metadata={'allocation_id': str(allocation.id), 'decision': decision},
        )
        return Response(AssetAllocationSerializer(allocation, context={'request': request}).data)

    # --------------------------------------------------------------------------
    # RETURN (Process asset return)
    # --------------------------------------------------------------------------
    @action(detail=True, methods=['post'], url_path='return')
    @transaction.atomic
    def return_asset(self, request, pk=None):
        """Process return of an allocated asset."""
        try:
            allocation = AssetAllocation.objects.select_for_update().get(pk=pk)
        except AssetAllocation.DoesNotExist:
            return Response({'detail': 'Allocation not found.'}, status=404)

        if allocation.status != 'ALLOCATED':
            return Response(
                {'detail': f'This allocation is already {allocation.get_status_display()}.'},
                status=400,
            )

        serializer = ReturnAssetPayloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        return_status = serializer.validated_data['status']
        returned_date = serializer.validated_data.get('returned_date', timezone.now().date())
        return_notes = serializer.validated_data.get('return_notes', '')
        recovery_cost = serializer.validated_data.get('recovery_cost', 0)

        receiver = getattr(request.user, 'employee', None)

        # Update allocation
        allocation.status = return_status
        allocation.returned_date = returned_date
        allocation.return_notes = return_notes
        allocation.recovery_cost = recovery_cost
        allocation.returned_to = receiver
        allocation.save()

        # Update asset status based on return condition
        asset = allocation.asset
        if return_status == 'RETURNED':
            asset.status = 'AVAILABLE'
        elif return_status == 'DAMAGED':
            asset.status = 'MAINTENANCE'
        elif return_status == 'LOST':
            asset.status = 'DISPOSED'

        asset.save(update_fields=['status'])
        notify_asset_return.delay(str(allocation.id))
        return Response({
            'status': 'SUCCESS',
            'message': f'Asset marked as {return_status}',
            'allocation': AssetAllocationSerializer(allocation, context={'request': request}).data,
        })


# ==============================================================================
# ASSET DASHBOARD STATS
# ==============================================================================

class AssetStatsView(APIView):
    """Aggregate dashboard statistics for HR."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request):
        # Overall stats
        assets_qs = Asset.objects.all()
        total = assets_qs.count()
        allocated = assets_qs.filter(status='ALLOCATED').count()
        available = assets_qs.filter(status='AVAILABLE').count()
        maintenance = assets_qs.filter(status='MAINTENANCE').count()
        disposed = assets_qs.filter(status='DISPOSED').count()

        # Category breakdown
        categories = AssetCategory.objects.filter(is_active=True).annotate(
            total_count=Count('assets'),
            allocated_count=Count('assets', filter=Q(assets__status='ALLOCATED')),
            available_count=Count('assets', filter=Q(assets__status='AVAILABLE')),
        )

        category_data = [{
            'id': str(cat.id),
            'name': cat.name,
            'icon': cat.icon,
            'total': cat.total_count,
            'allocated': cat.allocated_count,
            'available': cat.available_count,
        } for cat in categories]

        # Recent allocations
        recent_allocations = AssetAllocation.objects.select_related(
            'asset', 'employee'
        ).order_by('-created_at')[:10]

        recent_data = [{
            'id': str(a.id),
            'asset_tag': a.asset.asset_tag,
            'asset_name': a.asset.name,
            'employee_name': a.employee.full_name,
            'employee_code': a.employee.employee_id,
            'status': a.status,
            'allocated_date': a.allocated_date,
            'returned_date': a.returned_date,
        } for a in recent_allocations]

        # Financial stats
        total_value = assets_qs.aggregate(
            total=Sum('purchase_cost')
        )['total'] or 0

        allocated_value = assets_qs.filter(status='ALLOCATED').aggregate(
            total=Sum('purchase_cost')
        )['total'] or 0

        # Warranty expiring soon (next 90 days)
        today = timezone.now().date()
        warranty_expiring = assets_qs.filter(
            warranty_expiry__isnull=False,
            warranty_expiry__gte=today,
            warranty_expiry__lte=today + timezone.timedelta(days=90),
        ).count()

        return Response({
            'summary': {
                'total': total,
                'allocated': allocated,
                'available': available,
                'maintenance': maintenance,
                'disposed': disposed,
                'utilization_rate': round((allocated / total * 100), 1) if total > 0 else 0,
            },
            'financial': {
                'total_asset_value': float(total_value),
                'allocated_asset_value': float(allocated_value),
                'warranty_expiring_soon': warranty_expiring,
            },
            'by_category': category_data,
            'recent_activity': recent_data,
        })
