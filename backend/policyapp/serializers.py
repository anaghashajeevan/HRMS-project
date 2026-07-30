
from rest_framework import serializers
from .models import (
    PolicyCategory, Policy, PolicyVersion,
    PolicyApproval, PolicyDistribution,
    PolicyReadLog, PolicyComment,
)


# ==============================================================================
# CATEGORY
# ==============================================================================

class PolicyCategorySerializer(serializers.ModelSerializer):
    policy_count = serializers.SerializerMethodField()

    class Meta:
        model = PolicyCategory
        fields = [
            'id', 'code', 'name', 'description',
            'icon', 'color_code', 'display_order',
            'is_active', 'policy_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'policy_count', 'created_at', 'updated_at']

    def get_policy_count(self, obj):
        return obj.policies.filter(is_active=True).count()


# ==============================================================================
# VERSION
# ==============================================================================

class PolicyVersionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True, default=None
    )
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = PolicyVersion
        fields = [
            'id', 'policy', 'version_number',
            'content_html', 'content_file', 'file_url', 'content_type',
            'change_summary',
            'created_by', 'created_by_name',
            'is_published', 'published_at',
            'effective_from', 'effective_to',
            'created_at',
        ]
        read_only_fields = [
            'id', 'is_published', 'published_at', 'created_at',
        ]

    def get_file_url(self, obj):
        if obj.content_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.content_file.url)
        return None


class PolicyVersionMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = PolicyVersion
        fields = ['id', 'version_number', 'is_published', 'effective_from', 'created_at']


# ==============================================================================
# APPROVAL
# ==============================================================================

class PolicyApprovalSerializer(serializers.ModelSerializer):
    approver_name = serializers.CharField(source='approver.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PolicyApproval
        fields = [
            'id', 'version', 'step_number', 'step_name',
            'approver', 'approver_name',
            'status', 'status_display',
            'acted_at', 'comments', 'created_at',
        ]
        read_only_fields = fields


# ==============================================================================
# DISTRIBUTION + ACKNOWLEDGMENT
# ==============================================================================

class PolicyDistributionSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_department = serializers.SerializerMethodField()
    policy_title = serializers.CharField(source='policy.title', read_only=True)
    policy_number = serializers.CharField(source='policy.policy_number', read_only=True)
    version_number = serializers.CharField(source='version.version_number', read_only=True)
    days_until_deadline = serializers.IntegerField(read_only=True)

    class Meta:
        model = PolicyDistribution
        fields = [
            'id', 'policy', 'version', 'employee',
            'employee_code', 'employee_name', 'employee_department',
            'policy_title', 'policy_number', 'version_number',
            'distributed_at', 'email_sent', 'email_sent_at',
            'first_opened_at', 'last_viewed_at', 'total_views',
            'total_time_spent_seconds',
            'acknowledged', 'acknowledged_at', 'acknowledgment_method',
            'deadline', 'days_until_deadline', 'is_overdue',
            'reminders_sent', 'last_reminder_at',
            'is_invalidated', 'invalidated_at',
            'created_at',
        ]
        read_only_fields = fields

    def get_employee_department(self, obj):
        if obj.employee and obj.employee.structure_location:
            return obj.employee.structure_location.name
        return None


# ==============================================================================
# POLICY (List + Detail)
# ==============================================================================

class PolicyListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_code = serializers.CharField(source='category.code', read_only=True)
    category_color = serializers.CharField(source='category.color_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    policy_owner_name = serializers.CharField(
        source='policy_owner.full_name', read_only=True, default=None
    )
    current_version_number = serializers.CharField(
        source='current_version.version_number', read_only=True, default=None
    )
    version_count = serializers.SerializerMethodField()
    ack_stats = serializers.SerializerMethodField()

    class Meta:
        model = Policy
        fields = [
            'id', 'policy_number', 'title', 'summary',
            'category', 'category_name', 'category_code', 'category_color',
            'priority', 'priority_display', 'tags',
            'status', 'status_display',
            'current_version_number', 'version_count',
            'requires_acknowledgment', 'is_mandatory',
            'effective_date', 'expiry_date', 'published_at',
            'policy_owner', 'policy_owner_name',
            'ack_stats','return_count',           # ← ADD
            'returned_at',  
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_version_count(self, obj):
        return obj.versions.count()

    def get_ack_stats(self, obj):
        if not obj.requires_acknowledgment:
            return None
        total = obj.distributions.filter(is_invalidated=False).count()
        acked = obj.distributions.filter(acknowledged=True, is_invalidated=False).count()
        overdue = obj.distributions.filter(is_overdue=True, acknowledged=False, is_invalidated=False).count()
        return {
            'total': total,
            'acknowledged': acked,
            'pending': total - acked,
            'overdue': overdue,
            'percentage': round((acked / total * 100), 1) if total > 0 else 0,
        }


class PolicyDetailSerializer(serializers.ModelSerializer):
    category = PolicyCategorySerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    policy_owner_name = serializers.CharField(
        source='policy_owner.full_name', read_only=True, default=None
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True, default=None
    )
    current_version = PolicyVersionSerializer(read_only=True)
    versions = PolicyVersionMiniSerializer(many=True, read_only=True)
    applicable_department_names = serializers.SerializerMethodField()
    applicable_position_titles = serializers.SerializerMethodField()
    applicable_location_names = serializers.SerializerMethodField()
    ack_stats = serializers.SerializerMethodField()
    returned_by_name = serializers.CharField(
        source='returned_by.full_name', read_only=True, default=None
    )
    class Meta:
        model = Policy
        fields = [
            'id', 'policy_number', 'title', 'summary',
            'category', 'priority', 'priority_display', 'tags',
            'status', 'status_display',
            'current_version', 'versions',
            'applies_to_all',
            'applicable_departments', 'applicable_department_names',
            'applicable_positions', 'applicable_position_titles',
            'applicable_locations', 'applicable_location_names',
            'applicable_employee_statuses',
            'requires_acknowledgment', 'acknowledgment_deadline_days',
            'is_mandatory', 'acknowledgment_text',
            'review_interval_months', 'next_review_date', 'last_reviewed_at',
            'effective_date', 'expiry_date', 'published_at',
            'policy_owner', 'policy_owner_name',
            'created_by', 'created_by_name',
            'ack_stats',
            'is_active', 'created_at', 'updated_at','return_comments', 'returned_at',           # ← ADD
            'returned_by', 'returned_by_name',           # ← ADD
            'return_count', 
        ]
        read_only_fields = [
            'id', 'policy_number', 'current_version', 'versions',
            'published_at', 'created_at', 'updated_at','return_comments', 'returned_at', 'returned_by', 'return_count', 
        ]

    def get_applicable_department_names(self, obj):
        return [{'id': str(d.id), 'name': d.name} for d in obj.applicable_departments.all()]

    def get_applicable_position_titles(self, obj):
        return [{'id': str(p.id), 'title': p.title} for p in obj.applicable_positions.all()]

    def get_applicable_location_names(self, obj):
        return [{'id': str(l.id), 'name': l.name} for l in obj.applicable_locations.all()]

    def get_ack_stats(self, obj):
        if not obj.requires_acknowledgment:
            return None
        total = obj.distributions.filter(is_invalidated=False).count()
        acked = obj.distributions.filter(acknowledged=True, is_invalidated=False).count()
        overdue = obj.distributions.filter(is_overdue=True, acknowledged=False, is_invalidated=False).count()
        return {
            'total': total,
            'acknowledged': acked,
            'pending': total - acked,
            'overdue': overdue,
            'percentage': round((acked / total * 100), 1) if total > 0 else 0,
        }


class PolicyCreateSerializer(serializers.ModelSerializer):
    """For creating/updating policies."""

    class Meta:
        model = Policy
        fields = [
            'title', 'summary', 'category', 'priority', 'tags',
            'applies_to_all', 'applicable_departments',
            'applicable_positions', 'applicable_locations',
            'applicable_employee_statuses',
            'requires_acknowledgment', 'acknowledgment_deadline_days',
            'is_mandatory', 'acknowledgment_text',
            'review_interval_months',
            'effective_date', 'expiry_date',
            'policy_owner',
            'is_active',
        ]


# ==============================================================================
# COMMENT
# ==============================================================================

class PolicyCommentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_id', read_only=True)
    resolved_by_name = serializers.CharField(
        source='resolved_by.full_name', read_only=True, default=None
    )
    replies = serializers.SerializerMethodField()

    class Meta:
        model = PolicyComment
        fields = [
            'id', 'policy', 'employee', 'employee_name', 'employee_code',
            'parent', 'content',
            'is_resolved', 'resolved_by', 'resolved_by_name', 'resolved_at',
            'is_visible',
            'replies',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'employee', 'is_resolved', 'resolved_by',
            'resolved_at', 'is_visible', 'created_at', 'updated_at',
        ]

    def get_replies(self, obj):
        if obj.parent is not None:
            return []
        replies = obj.replies.filter(is_visible=True).order_by('created_at')
        return PolicyCommentSerializer(replies, many=True).data