
import logging
from datetime import timedelta

from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django.db import models
from HRMSapp.permissions import IsHRAdmin

from .models import (
    PolicyCategory, Policy, PolicyVersion,
    PolicyApproval, PolicyDistribution, PolicyComment,
)
from .serializers import (
    PolicyCategorySerializer,
    PolicyListSerializer, PolicyDetailSerializer, PolicyCreateSerializer,
    PolicyVersionSerializer, PolicyApprovalSerializer,
    PolicyDistributionSerializer,
    PolicyCommentSerializer,
)
from .services.policy_service import PolicyService, PolicyServiceError

logger = logging.getLogger(__name__)


# ==============================================================================
# CATEGORY
# ==============================================================================

class PolicyCategoryViewSet(ModelViewSet):
    queryset = PolicyCategory.objects.all()
    serializer_class = PolicyCategorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['code', 'name']
    ordering = ['display_order', 'name']
    pagination_class = None

    def get_permissions(self):
        if self.action in [
            'list', 'retrieve',
            'employee_library', 'my_acknowledgments',
            'acknowledge', 'record_view',
            'compliance', 'distributions',
        ]:
            return [IsAuthenticated()]

        # Approval workflow — any authenticated
        if self.action in [
            'approve', 'reject', 'return_for_changes',  # ← ADD
            'pending_approvals'
        ]:
            return [IsAuthenticated()]

        return [IsAuthenticated(), IsHRAdmin()]

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        user = request.user
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'HR Admin only'}, status=403)

        if PolicyCategory.objects.exists():
            return Response({'ok': False, 'message': 'Categories already exist.'}, status=400)

        defaults = [
            {'code': 'HR', 'name': 'HR Policies', 'icon': 'users', 'color_code': '#3B82F6', 'display_order': 1},
            {'code': 'IT', 'name': 'IT & Security', 'icon': 'laptop', 'color_code': '#8B5CF6', 'display_order': 2},
            {'code': 'SAFETY', 'name': 'Safety & Health', 'icon': 'shield', 'color_code': '#EF4444', 'display_order': 3},
            {'code': 'COMPLIANCE', 'name': 'Compliance & Legal', 'icon': 'scale', 'color_code': '#F59E0B', 'display_order': 4},
            {'code': 'FINANCE', 'name': 'Finance', 'icon': 'dollar-sign', 'color_code': '#10B981', 'display_order': 5},
            {'code': 'GENERAL', 'name': 'General', 'icon': 'file-text', 'color_code': '#6B7280', 'display_order': 6},
        ]
        for d in defaults:
            PolicyCategory.objects.create(**d)

        return Response({'ok': True, 'message': f'Created {len(defaults)} categories'})


# ==============================================================================
# POLICY (CRUD + Workflow)
# ==============================================================================

class PolicyViewSet(ModelViewSet):
    queryset = Policy.objects.all().select_related(
        'category', 'current_version', 'policy_owner', 'created_by'
    ).prefetch_related('versions', 'applicable_departments', 'applicable_positions', 'applicable_locations')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'category', 'is_mandatory', 'is_active', 'requires_acknowledgment']
    search_fields = ['policy_number', 'title', 'summary', 'tags']
    ordering_fields = ['created_at', 'updated_at', 'title', 'policy_number']
    ordering = ['-updated_at']
    pagination_class = None
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return PolicyListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return PolicyCreateSerializer
        return PolicyDetailSerializer

    def get_permissions(self):
        # Read actions — any authenticated user
        if self.action in [
            'list', 'retrieve',
            'employee_library', 'my_acknowledgments',
            'acknowledge', 'record_view',
            'compliance', 'distributions',
        ]:
            return [IsAuthenticated()]

        # Approval workflow — any authenticated
        if self.action in ['approve', 'reject', 'pending_approvals']:
            return [IsAuthenticated()]

        # Everything else — HR Admin only
        return [IsAuthenticated(), IsHRAdmin()]
    
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # HR / System Admin — see everything
        if user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN'):
            return qs

        if not hasattr(user, 'employee'):
            return qs.filter(status='PUBLISHED', is_active=True)

        # Get policies distributed to this user (for acknowledgment)
        from .models import PolicyDistribution, PolicyApproval

        distributed_policy_ids = PolicyDistribution.objects.filter(
            employee=user.employee,
            is_invalidated=False,
        ).values_list('policy_id', flat=True)

        # Manager — also see policies pending their approval
        if user.has_role('MANAGER'):
            pending_policy_ids = PolicyApproval.objects.filter(
                approver=user.employee,
                status='PENDING',
            ).values_list('version__policy_id', flat=True)

            return qs.filter(
                models.Q(status='PUBLISHED', is_active=True) |
                models.Q(id__in=distributed_policy_ids) |
                models.Q(id__in=pending_policy_ids)
            )

        # Employee — published + distributed to them
        return qs.filter(
            models.Q(status='PUBLISHED', is_active=True) |
            models.Q(id__in=distributed_policy_ids)
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        try:
            content_html = request.data.get('content_html', '')
            content_file = request.FILES.get('content_file')
            content_type = request.data.get('content_type', 'HTML')
            effective_date = serializer.validated_data.get('effective_date') or timezone.localdate()

            simple_fields = {}
            for key in ['priority', 'tags', 'applies_to_all', 'requires_acknowledgment',
                        'acknowledgment_deadline_days', 'is_mandatory', 'acknowledgment_text',
                        'review_interval_months', 'expiry_date', 'policy_owner',
                        'applicable_employee_statuses', 'is_active']:
                if key in serializer.validated_data:
                    simple_fields[key] = serializer.validated_data[key]

            # 🔥 FIX: Ensure is_active is always True by default
            if 'is_active' not in simple_fields:
                simple_fields['is_active'] = True

            # Handle boolean fields from FormData
            for bool_field in ['applies_to_all', 'requires_acknowledgment', 'is_mandatory', 'is_active']:
                if bool_field in simple_fields:
                    val = simple_fields[bool_field]
                    if isinstance(val, str):
                        simple_fields[bool_field] = val.lower() in ('true', '1', 'on', 'yes')

            applicable_departments = serializer.validated_data.get('applicable_departments')
            applicable_positions = serializer.validated_data.get('applicable_positions')
            applicable_locations = serializer.validated_data.get('applicable_locations')

            policy = PolicyService.create_policy(
                category=serializer.validated_data['category'],
                title=serializer.validated_data['title'],
                summary=serializer.validated_data.get('summary', ''),
                content_html=content_html,
                effective_date=effective_date,
                created_by=user.employee,
                content_file=content_file,
                content_type=content_type,
                applicable_departments=applicable_departments,
                applicable_positions=applicable_positions,
                applicable_locations=applicable_locations,
                **simple_fields,
            )

            detail = PolicyDetailSerializer(policy, context={'request': request})
            return Response(detail.data, status=201)
        except PolicyServiceError as exc:
            return Response({'detail': str(exc)}, status=400)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            return Response({'detail': str(exc)}, status=500)

    # ---------- WORKFLOW ACTIONS ----------

    @action(detail=True, methods=['post'], url_path='submit-for-review')
    def submit_for_review(self, request, pk=None):
        policy = self.get_object()
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)
        try:
            PolicyService.submit_for_approval(policy, user.employee)
            return Response({'ok': True, 'message': 'Submitted for review', 'status': policy.status})
        except PolicyServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Only the assigned approver can approve."""
        policy = self.get_object()
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        # Check if this user is actually the pending approver
        from .models import PolicyApproval
        pending = PolicyApproval.objects.filter(
            version=policy.current_version,
            approver=user.employee,
            status='PENDING',
        ).first()

        if not pending:
            return Response(
                {'detail': 'You are not the assigned approver for this policy.'},
                status=403,
            )

        comments = request.data.get('comments', '')
        try:
            PolicyService.approve_policy(policy, user.employee, comments)
            return Response({'ok': True, 'message': 'Policy approved', 'status': policy.status})
        except PolicyServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """Only the assigned approver can reject."""
        policy = self.get_object()
        user = request.user
        reason = request.data.get('reason', '')
        if not reason:
            return Response({'detail': 'Reason is required'}, status=400)
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        # Check if this user is actually the pending approver
        from .models import PolicyApproval
        pending = PolicyApproval.objects.filter(
            version=policy.current_version,
            approver=user.employee,
            status='PENDING',
        ).first()

        if not pending:
            return Response(
                {'detail': 'You are not the assigned approver for this policy.'},
                status=403,
            )

        try:
            PolicyService.reject_policy(policy, user.employee, reason)
            return Response({'ok': True, 'message': 'Policy rejected', 'status': policy.status})
        except PolicyServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=True, methods=['post'], url_path='return-for-changes')
    def return_for_changes(self, request, pk=None):
        """Only the assigned approver can return the policy for changes."""
        policy = self.get_object()
        user = request.user
        comments = request.data.get('comments', '').strip()

        if not comments:
            return Response({'detail': 'Comments are required'}, status=400)
        if len(comments) < 5:
            return Response(
                {'detail': 'Please provide detailed comments (min 5 characters)'},
                status=400,
            )
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        # Check if user is actually the pending approver
        from .models import PolicyApproval
        pending = PolicyApproval.objects.filter(
            version=policy.current_version,
            approver=user.employee,
            status='PENDING',
        ).first()

        if not pending:
            return Response(
                {'detail': 'You are not the assigned approver for this policy.'},
                status=403,
            )

        try:
            PolicyService.return_policy_for_changes(policy, user.employee, comments)
            return Response({
                'ok': True,
                'message': 'Policy returned to creator for changes',
                'status': policy.status,
            })
        except PolicyServiceError as exc:
            return Response({'detail': str(exc)}, status=400)
    

    
    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        policy = self.get_object()
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)
        try:
            result = PolicyService.publish_policy(policy, user.employee)
            return Response({
                'ok': True,
                'message': f'Published and distributed to {result["distributed_to"]} employees',
                'distributed_to': result['distributed_to'],
                'deadline': str(result['deadline']),
            })
        except PolicyServiceError as exc:
            return Response({'detail': str(exc)}, status=400)
    @action(detail=False, methods=['get'], url_path='pending-approvals')
    def pending_approvals(self, request):
        """Get policies pending my approval."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])

        from .models import PolicyApproval
        pending_version_ids = PolicyApproval.objects.filter(
            approver=user.employee,
            status='PENDING',
        ).values_list('version__policy_id', flat=True)

        policies = Policy.objects.filter(
            id__in=pending_version_ids,
            status='IN_REVIEW',
        ).select_related('category', 'current_version')

        serializer = PolicyListSerializer(policies, many=True)
        return Response(serializer.data)
    # ---------- VERSION MANAGEMENT ----------

    @action(detail=True, methods=['post'], url_path='create-version')
    def create_version(self, request, pk=None):
        policy = self.get_object()
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        content_html = request.data.get('content_html', '')
        change_summary = request.data.get('change_summary', '')
        effective_from = request.data.get('effective_from')
        content_file = request.FILES.get('content_file')

        if not content_html and not content_file:
            return Response({'detail': 'Content is required'}, status=400)

        try:
            if effective_from:
                from datetime import datetime
                effective_from = datetime.strptime(effective_from, '%Y-%m-%d').date()

            version = PolicyService.create_new_version(
                policy, content_html, change_summary, user.employee,
                effective_from=effective_from, content_file=content_file,
            )
            serializer = PolicyVersionSerializer(version, context={'request': request})
            return Response(serializer.data, status=201)
        except PolicyServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=True, methods=['get'], url_path='compliance')
    def compliance(self, request, pk=None):
        policy = self.get_object()
        stats = PolicyService.get_policy_compliance(policy)
        return Response(stats)

    @action(detail=True, methods=['get'], url_path='distributions')
    def distributions(self, request, pk=None):
        policy = self.get_object()
        dists = PolicyDistribution.objects.filter(
            policy=policy, is_invalidated=False
        ).select_related('employee', 'version')
        serializer = PolicyDistributionSerializer(dists, many=True)
        return Response(serializer.data)

    # ---------- EMPLOYEE-FACING ----------

    # policyapp/views.py

    @action(detail=False, methods=['get'], url_path='library')
    def employee_library(self, request):
        """
        Employee's policy library.
        Returns ALL published policies (regardless of distribution).
        Attaches my_status for the current user.
        """
        from .models import Policy, PolicyDistribution
        from .serializers import PolicyListSerializer

        user = request.user

        # 🔥 Fetch ALL published policies — bypass get_queryset filtering
        policies = Policy.objects.filter(
            status='PUBLISHED',
            is_active=True,
        ).select_related('category', 'current_version').order_by('-published_at')

        print(f"[LIBRARY] User: {user.email}")
        print(f"[LIBRARY] Total published policies: {policies.count()}")

        # Get user's distributions
        my_dists = {}
        if hasattr(user, 'employee'):
            distributions = PolicyDistribution.objects.filter(
                employee=user.employee,
                is_invalidated=False,
            )
            print(f"[LIBRARY] User's distributions: {distributions.count()}")

            my_dists = {
                str(d.policy_id): d
                for d in distributions
            }

        result = []
        for policy in policies:
            data = PolicyListSerializer(policy, context={'request': request}).data
            dist = my_dists.get(str(policy.id))

            data['my_status'] = {
                'distributed': dist is not None,
                'acknowledged': dist.acknowledged if dist else False,
                'acknowledged_at': (
                    dist.acknowledged_at.isoformat()
                    if dist and dist.acknowledged_at else None
                ),
                'deadline': str(dist.deadline) if dist else None,
                'is_overdue': dist.is_overdue if dist else False,
            }
            result.append(data)

        print(f"[LIBRARY] Returning {len(result)} policies")
        return Response(result)

    @action(detail=False, methods=['get'], url_path='my-acknowledgments')
    def my_acknowledgments(self, request):
        """Employee's pending + completed acknowledgments."""
        user = request.user
        if not hasattr(user, 'employee'):
            return Response([])

        distributions = PolicyDistribution.objects.filter(
            employee=user.employee,
            is_invalidated=False,
        ).select_related('policy', 'policy__category', 'version').order_by(
            'acknowledged', 'deadline'
        )

        serializer = PolicyDistributionSerializer(distributions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='acknowledge')
    def acknowledge(self, request, pk=None):
        """Employee acknowledges a policy."""
        policy = self.get_object()
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        dist = PolicyDistribution.objects.filter(
            policy=policy,
            employee=user.employee,
            is_invalidated=False,
        ).first()

        if not dist:
            return Response({'detail': 'This policy is not assigned to you'}, status=400)

        ip = request.META.get('REMOTE_ADDR')

        try:
            PolicyService.acknowledge_policy(dist, ip_address=ip)
            return Response({
                'ok': True,
                'message': f'Successfully acknowledged "{policy.title}"',
            })
        except PolicyServiceError as exc:
            return Response({'detail': str(exc)}, status=400)

    @action(detail=True, methods=['post'], url_path='record-view')
    def record_view(self, request, pk=None):
        """Record that employee viewed the policy content."""
        policy = self.get_object()
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)

        dist = PolicyDistribution.objects.filter(
            policy=policy,
            employee=user.employee,
            is_invalidated=False,
        ).first()

        if dist:
            PolicyService.record_view(
                dist,
                time_spent_seconds=int(request.data.get('time_spent_seconds', 0)),
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )

        return Response({'ok': True})


# ==============================================================================
# POLICY COMMENTS
# ==============================================================================

class PolicyCommentViewSet(ModelViewSet):
    queryset = PolicyComment.objects.filter(is_visible=True).select_related('employee', 'resolved_by')
    serializer_class = PolicyCommentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['policy', 'is_resolved']
    pagination_class = None

    def get_queryset(self):
        # Only show top-level comments (replies are nested)
        return super().get_queryset().filter(parent__isnull=True)

    def perform_create(self, serializer):
        user = self.request.user
        if hasattr(user, 'employee'):
            serializer.save(employee=user.employee)

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        comment = self.get_object()
        user = request.user
        if not hasattr(user, 'employee'):
            return Response({'detail': 'No employee record'}, status=400)
        if not (user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')):
            return Response({'detail': 'HR Admin only'}, status=403)
        comment.is_resolved = True
        comment.resolved_by = user.employee
        comment.resolved_at = timezone.now()
        comment.save()
        return Response({'ok': True, 'message': 'Comment resolved'})