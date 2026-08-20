from django.shortcuts import render

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

from .models import AssetCategory, Asset, AssetAllocation
from .serializers import (
    AssetCategorySerializer,
    AssetListSerializer, AssetDetailSerializer,
    AssetAllocationSerializer,
    AllocateAssetPayloadSerializer, ReturnAssetPayloadSerializer,
)
from HRMSapp.permissions import IsHRAdmin
from HRMSapp.models import Employee


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
            status='ALLOCATED',
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
            status='ALLOCATED',
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
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

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
        )

        # Update asset status
        asset.status = 'ALLOCATED'
        asset.save(update_fields=['status'])

        return Response(
            AssetAllocationSerializer(allocation, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

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