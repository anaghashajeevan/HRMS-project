"""
Policy lifecycle service.
Handles: creation, versioning, approval, publishing, distribution, acknowledgment.
"""

import logging
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)


class PolicyServiceError(Exception):
    pass


class PolicyService:
    """Complete policy lifecycle management."""

    # ==========================================================================
    # POLICY NUMBER GENERATION
    # ==========================================================================

    @staticmethod
    def generate_policy_number(category):
        """Generate unique policy number: POL-HR-001"""
        from ..models import Policy

        prefix = f"POL-{category.code}-"
        last = Policy.objects.filter(
            policy_number__startswith=prefix
        ).order_by('-policy_number').first()

        if last:
            try:
                seq = int(last.policy_number.split('-')[-1]) + 1
            except (ValueError, IndexError):
                seq = Policy.objects.filter(category=category).count() + 1
        else:
            seq = 1

        return f"{prefix}{seq:03d}"

    # ==========================================================================
    # CREATE POLICY
    # ==========================================================================

    @staticmethod
    @transaction.atomic
    def create_policy(category, title, summary, content_html, effective_date,
                    created_by, content_file=None, content_type='HTML',
                    **extra_fields):
        """Create a new policy with initial version (v1.0)."""
        from ..models import Policy, PolicyVersion

        policy_number = PolicyService.generate_policy_number(category)

        # Extract M2M fields — can't pass to create()
        applicable_departments = extra_fields.pop('applicable_departments', None)
        applicable_positions = extra_fields.pop('applicable_positions', None)
        applicable_locations = extra_fields.pop('applicable_locations', None)

        policy = Policy.objects.create(
            policy_number=policy_number,
            title=title,
            summary=summary,
            category=category,
            status='DRAFT',
            effective_date=effective_date,
            created_by=created_by,
            **extra_fields,
        )

        # Set M2M fields AFTER create
        if applicable_departments:
            policy.applicable_departments.set(applicable_departments)
        if applicable_positions:
            policy.applicable_positions.set(applicable_positions)
        if applicable_locations:
            policy.applicable_locations.set(applicable_locations)

        # Create initial version
        version = PolicyVersion.objects.create(
            policy=policy,
            version_number='1.0',
            content_html=content_html,
            content_file=content_file,
            content_type=content_type,
            effective_from=effective_date,
            created_by=created_by,
        )

        policy.current_version = version
        policy.save(update_fields=['current_version'])

        logger.info(f"✅ Created policy {policy_number} v1.0 by {created_by.employee_id}")
        return policy

    # ==========================================================================
    # CREATE NEW VERSION
    # ==========================================================================

    @staticmethod
    @transaction.atomic
    def create_new_version(policy, content_html, change_summary, created_by,
                        effective_from=None, content_file=None, content_type='HTML'):
        """
        Create/update a policy version.
        
        Logic:
        - If policy was NEVER published → REPLACE existing draft version (keep same number)
        - If policy WAS published → CREATE new version with incremented number
        """
        from ..models import PolicyVersion

        if not effective_from:
            effective_from = timezone.localdate()

        # 🔥 Check if policy has EVER been published
        has_been_published = policy.versions.filter(is_published=True).exists()
        current_version = policy.current_version

        if not has_been_published and current_version:
            # 📝 REPLACE existing draft — never published, so just update it
            logger.info(
                f"🔄 Replacing draft v{current_version.version_number} "
                f"for {policy.policy_number} (never published)"
            )

            # Update in-place
            current_version.content_html = content_html
            if content_file:
                # Delete old file if replacing
                if current_version.content_file:
                    current_version.content_file.delete(save=False)
                current_version.content_file = content_file
            current_version.content_type = content_type
            current_version.change_summary = change_summary
            current_version.effective_from = effective_from
            current_version.created_by = created_by
            current_version.save()

            # Reset status to DRAFT for re-approval
            policy.status = 'DRAFT'
            policy.save(update_fields=['status'])

            return current_version

        # 🆕 CREATE NEW VERSION — policy was published, needs new version number
        last_published = policy.versions.filter(is_published=True).order_by('-created_at').first()
        
        if last_published:
            parts = last_published.version_number.split('.')
            try:
                major = int(parts[0])
                minor = int(parts[1]) if len(parts) > 1 else 0
                new_version = f"{major}.{minor + 1}"
            except (ValueError, IndexError):
                new_version = f"{policy.versions.count() + 1}.0"
        else:
            new_version = '1.0'

        version = PolicyVersion.objects.create(
            policy=policy,
            version_number=new_version,
            content_html=content_html,
            content_file=content_file,
            content_type=content_type,
            change_summary=change_summary,
            effective_from=effective_from,
            created_by=created_by,
        )

        # Point policy to new version + reset to DRAFT
        policy.current_version = version
        policy.status = 'DRAFT'
        policy.save(update_fields=['current_version', 'status'])

        logger.info(
            f"✅ Created NEW version {new_version} for {policy.policy_number} "
            f"(previous published version exists)"
        )
        return version

    # ==========================================================================
    # SUBMIT FOR APPROVAL
    # ==========================================================================

    @staticmethod
    @transaction.atomic
    def submit_for_approval(policy, submitted_by):
        """Submit policy for approval workflow."""
        from ..models import Policy, PolicyApproval
        from HRMSapp.models import ApprovalWorkflow
        from HRMSapp.services.workflow_service import WorkflowService

        if policy.status not in ['DRAFT']:
            raise PolicyServiceError(
                f"Cannot submit {policy.get_status_display()} policy for review"
            )

        if not policy.current_version:
            raise PolicyServiceError("Policy has no content version")

        # Get active POLICY workflow
        workflow = ApprovalWorkflow.objects.filter(
            module='POLICY', is_active=True
        ).prefetch_related('steps').first()

        if not workflow:
            raise PolicyServiceError(
                "No active POLICY approval workflow configured. "
                "Go to Settings → Approval Workflows → Policy tab."
            )

        first_step = workflow.steps.order_by('step_number').first()
        if not first_step:
            raise PolicyServiceError("Policy workflow has no steps configured.")

        # Resolve first approver
        approvers = WorkflowService.resolve_approvers(first_step, submitted_by)
        if not approvers:
            raise PolicyServiceError(
                f"Could not resolve approver for step '{first_step.step_name}'"
            )

        first_approver = approvers[0]

        # Update status
        policy.status = 'IN_REVIEW'
        policy.return_comments = ''      # ← ADD
        policy.returned_at = None         # ← ADD
        policy.returned_by = None         # ← ADD
        policy.save(update_fields=[
            'status', 'return_comments', 'returned_at', 'returned_by'  # ← UPDATE
        ])
        policy.save(update_fields=['status'])

        # Create approval record
        PolicyApproval.objects.create(
            version=policy.current_version,
            step_number=first_step.step_number,
            step_name=first_step.step_name,
            approver=first_approver,
            status='PENDING',
        )

        # Notify
        PolicyService._notify_approver(policy, first_approver)

        logger.info(
            f"✅ Policy {policy.policy_number} submitted for review. "
            f"First approver: {first_approver.full_name}"
        )
        return policy

    # ==========================================================================
    # APPROVE / REJECT
    # ==========================================================================

    @staticmethod
    @transaction.atomic
    def approve_policy(policy, approver, comments=''):
        """Approve current step. Route to next or finalize."""
        from ..models import PolicyApproval
        from HRMSapp.models import ApprovalWorkflow
        from HRMSapp.services.workflow_service import WorkflowService

        if policy.status != 'IN_REVIEW':
            raise PolicyServiceError("Policy is not in review")

        version = policy.current_version
        pending = PolicyApproval.objects.filter(
            version=version, approver=approver, status='PENDING'
        ).first()

        if not pending:
            raise PolicyServiceError("No pending approval for you")

        pending.status = 'APPROVED'
        pending.acted_at = timezone.now()
        pending.comments = comments
        pending.save()

        # Check next step
        workflow = ApprovalWorkflow.objects.filter(
            module='POLICY', is_active=True
        ).prefetch_related('steps').first()

        if workflow:
            next_step = workflow.steps.filter(
                step_number__gt=pending.step_number
            ).order_by('step_number').first()

            if next_step:
                next_approvers = WorkflowService.resolve_approvers(
                    next_step, policy.created_by or policy.policy_owner
                )
                if next_approvers:
                    PolicyApproval.objects.create(
                        version=version,
                        step_number=next_step.step_number,
                        step_name=next_step.step_name,
                        approver=next_approvers[0],
                        status='PENDING',
                    )
                    PolicyService._notify_approver(policy, next_approvers[0], is_escalation=True)
                    return policy

        # All steps done — mark as approved
        policy.status = 'APPROVED'
        policy.save(update_fields=['status'])

        # Notify creator
        PolicyService._notify_policy_approved(policy, approver)

        logger.info(f"✅ Policy {policy.policy_number} fully approved")
        return policy

    @staticmethod
    @transaction.atomic
    def reject_policy(policy, approver, reason):
        """Reject policy — send back to draft."""
        from ..models import PolicyApproval

        if policy.status != 'IN_REVIEW':
            raise PolicyServiceError("Policy is not in review")

        version = policy.current_version
        pending = PolicyApproval.objects.filter(
            version=version, approver=approver, status='PENDING'
        ).first()

        if not pending:
            raise PolicyServiceError("No pending approval for you")

        pending.status = 'REJECTED'
        pending.acted_at = timezone.now()
        pending.comments = reason
        pending.save()

        policy.status = 'DRAFT'
        policy.save(update_fields=['status'])

        PolicyService._notify_policy_rejected(policy, approver, reason)

        return policy

    # ==========================================================================
# RETURN FOR CHANGES (NEW)
# ==========================================================================

    @staticmethod
    @transaction.atomic
    def return_policy_for_changes(policy, approver, comments):
        """
        Approver returns policy to creator for revisions.
        Policy goes back to DRAFT with comments visible to creator.
        Creator revises and resubmits, workflow restarts from step 1.
        """
        from ..models import PolicyApproval

        if policy.status != 'IN_REVIEW':
            raise PolicyServiceError("Policy is not in review")

        if not comments or len(comments.strip()) < 5:
            raise PolicyServiceError("Please provide detailed comments (min 5 characters)")

        version = policy.current_version
        pending = PolicyApproval.objects.filter(
            version=version, approver=approver, status='PENDING'
        ).first()

        if not pending:
            raise PolicyServiceError("No pending approval for you")

        # Mark this approval as returned
        pending.status = 'RETURNED'
        pending.acted_at = timezone.now()
        pending.comments = comments
        pending.save()

        # Update policy — back to draft with return info
        policy.status = 'DRAFT'
        policy.return_comments = comments
        policy.returned_at = timezone.now()
        policy.returned_by = approver
        policy.return_count = (policy.return_count or 0) + 1
        policy.save(update_fields=[
            'status', 'return_comments', 'returned_at',
            'returned_by', 'return_count',
        ])

        # Notify the creator (NOT approver, but original creator)
        PolicyService._notify_policy_returned(policy, approver, comments)

        logger.info(
            f"🔄 Policy {policy.policy_number} returned by {approver.full_name}. "
            f"Return count: {policy.return_count}"
        )
        return policy


    @staticmethod
    def _notify_policy_returned(policy, approver, comments):
        """Notify creator that policy was returned for changes."""
        try:
            from HRMSapp.models import Notification
            from django.conf import settings as django_settings
            from django.core.mail import EmailMultiAlternatives

            creator = policy.created_by or policy.policy_owner
            if not creator:
                logger.warning(f"No creator found for policy {policy.policy_number}")
                return

            portal_url = getattr(django_settings, 'PORTAL_URL', 'http://localhost:5173')
            company_name = getattr(django_settings, 'COMPANY_NAME', 'Company')

            # In-app notification
            Notification.objects.create(
                recipient=creator,
                notification_type='APPROVAL_REJECTED',  # Reuse existing type
                title=f'🔄 Changes Requested: {policy.title}',
                message=(
                    f'{approver.full_name} has requested changes to "{policy.title}". '
                    f'Please review the comments and revise.'
                ),
                link=f'/policies/{policy.id}',
            )

            # Email to creator
            subject = f"🔄 Changes Requested: {policy.title}"

            text_body = f"""Hello {creator.full_name},

    Your policy has been returned for changes. Please review the comments below and revise.

    POLICY DETAILS
    --------------
    Title          : {policy.title}
    Policy Number  : {policy.policy_number}
    Returned By    : {approver.full_name}
    Return Count   : {policy.return_count}

    REVIEWER'S COMMENTS
    -------------------
    {comments}

    NEXT STEPS
    ----------
    1. Open the policy in the portal
    2. Review the reviewer's comments
    3. Upload a new version with the requested changes
    4. Submit for approval again

    Open Policy: {portal_url}/policies/{policy.id}

    ---
    {company_name}
    """

            html_body = f'''<!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fa;margin:0;padding:20px;">
    <div style="max-width:640px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
        <div style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:32px;text-align:center;color:white;">
            <h1 style="margin:0;font-size:24px;">🔄 Changes Requested</h1>
            <p style="margin:8px 0 0 0;opacity:0.9;">{policy.policy_number}</p>
        </div>
        <div style="padding:32px;">
            <p>Hello <strong>{creator.full_name}</strong>,</p>
            <p>Your policy has been returned for changes by the reviewer.</p>

            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <tr><th style="background:#f9fafb;padding:12px 16px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:40%;font-size:13px;">Title</th><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;"><strong>{policy.title}</strong></td></tr>
                <tr><th style="background:#f9fafb;padding:12px 16px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:40%;font-size:13px;">Returned By</th><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;">{approver.full_name}</td></tr>
                <tr><th style="background:#f9fafb;padding:12px 16px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:40%;font-size:13px;">Return Count</th><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;">{policy.return_count}</td></tr>
            </table>

            <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;margin:20px 0;border-radius:4px;">
                <p style="margin:0 0 8px 0;font-weight:600;color:#92400e;">📝 Reviewer's Comments:</p>
                <p style="margin:0;color:#78350f;white-space:pre-wrap;">{comments}</p>
            </div>

            <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;margin:16px 0;border-radius:4px;">
                <p style="margin:0;font-size:13px;color:#1e40af;">
                    <strong>Next Steps:</strong> Review the comments, upload a new version
                    with the requested changes, then submit for approval again.
                </p>
            </div>

            <div style="text-align:center;margin:32px 0;">
                <a href="{portal_url}/policies/{policy.id}" style="display:inline-block;background:#2563eb;color:white !important;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Open Policy →</a>
            </div>
        </div>
        <div style="background:#f9fafb;padding:24px;text-align:center;color:#6b7280;font-size:12px;">
            <p><strong>{company_name}</strong></p>
            <p>Automated notification from HRMS Policy Management</p>
        </div>
    </div>
    </body>
    </html>'''

            email = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                to=[creator.official_email],
            )
            email.attach_alternative(html_body, "text/html")
            email.send(fail_silently=False)

            logger.info(f"✅ Return email sent to {creator.official_email}")

        except Exception as exc:
            logger.exception(f"❌ Failed to notify creator: {exc}")
    # ==========================================================================
    # PUBLISH + DISTRIBUTE
    # ==========================================================================

    @staticmethod
    def publish_policy(policy, published_by):
        """Publish approved policy and distribute to applicable employees."""
        from ..models import PolicyDistribution
        from HRMSapp.models import Employee

        if policy.status != 'APPROVED':
            raise PolicyServiceError(
                "Only approved policies can be published. "
                f"Current status: {policy.get_status_display()}"
            )

        version = policy.current_version
        if not version:
            raise PolicyServiceError("No version to publish")

        # --- DB OPERATIONS (fast) ---

        # Mark version as published
        version.is_published = True
        version.published_at = timezone.now()
        version.save()

        # Invalidate old distributions
        old_distributions = PolicyDistribution.objects.filter(
            policy=policy, is_invalidated=False,
        ).exclude(version=version)

        if old_distributions.exists():
            old_distributions.update(
                is_invalidated=True,
                invalidated_at=timezone.now(),
                invalidation_reason=f'Policy updated to version {version.version_number}',
            )

        # Update policy status
        policy.status = 'PUBLISHED'
        policy.published_at = timezone.now()
        if policy.review_interval_months and policy.review_interval_months > 0:
            try:
                from dateutil.relativedelta import relativedelta
                policy.next_review_date = (
                    timezone.localdate() +
                    relativedelta(months=policy.review_interval_months)
                )
            except ImportError:
                pass
        policy.save()

        # Determine applicable employees
        employees = PolicyService._get_applicable_employees(policy)

        # Create distributions
        deadline = timezone.localdate() + timedelta(days=policy.acknowledgment_deadline_days)

        created_count = 0
        for employee in employees:
            try:
                dist, created = PolicyDistribution.objects.get_or_create(
                    policy=policy,
                    version=version,
                    employee=employee,
                    defaults={'deadline': deadline}
                )
                if created:
                    created_count += 1
            except Exception as exc:
                logger.warning(f"Failed to create distribution for {employee.employee_id}: {exc}")

        logger.info(
            f"✅ Published {policy.policy_number} v{version.version_number}. "
            f"Distributed to {created_count} employees."
        )

        # --- EMAILS (slow — done AFTER all DB work) ---
        # This runs outside any transaction so DB is NOT locked
        # Detect if this is an update (there are previous versions)
        is_update = policy.versions.count() > 1

        # --- EMAILS (slow — done AFTER all DB work) ---
        try:
            PolicyService._send_distribution_emails(
                policy, version, employees, is_update=is_update
            )
        except Exception as exc:
            logger.warning(f"Some distribution emails failed: {exc}")
        except Exception as exc:
            logger.warning(f"Some distribution emails failed: {exc}")
            # Don't fail the publish — emails are non-critical

        return {
            'policy': policy,
            'version': version,
            'distributed_to': created_count,
            'deadline': deadline,
        }

    @staticmethod
    def _get_applicable_employees(policy):
        """Determine which employees should receive this policy."""
        from HRMSapp.models import Employee
        from django.db.models import Q

        statuses = [s.strip() for s in policy.applicable_employee_statuses.split(',') if s.strip()]
        if not statuses:
            statuses = ['ACTIVE', 'PROBATION']

        qs = Employee.objects.filter(is_deleted=False, status__in=statuses)

        if not policy.applies_to_all:
            filters = Q()

            depts = policy.applicable_departments.all()
            positions = policy.applicable_positions.all()
            locations = policy.applicable_locations.all()

            if depts.exists():
                filters |= Q(structure_location__in=depts)

            if positions.exists():
                filters |= Q(position__in=positions)

            if locations.exists():
                filters |= Q(structure_location__in=locations)

            # If no filters set but applies_to_all is False, return nobody
            if not (depts.exists() or positions.exists() or locations.exists()):
                logger.warning(
                    f"Policy {policy.policy_number} applies_to_all=False but no departments/positions selected. "
                    f"No employees will receive this policy."
                )
                return Employee.objects.none()

            qs = qs.filter(filters)

        return qs.distinct()

    # ==========================================================================
    # ACKNOWLEDGMENT
    # ==========================================================================

    @staticmethod
    @transaction.atomic
    def acknowledge_policy(distribution, ip_address=None):
        """Employee acknowledges a policy."""
        if distribution.acknowledged:
            raise PolicyServiceError("Already acknowledged")

        if distribution.is_invalidated:
            raise PolicyServiceError("This version has been superseded by a newer version")

        distribution.acknowledged = True
        distribution.acknowledged_at = timezone.now()
        distribution.acknowledgment_ip = ip_address
        distribution.is_overdue = False
        distribution.save()

        logger.info(
            f"✅ {distribution.employee.employee_id} acknowledged "
            f"{distribution.policy.policy_number} v{distribution.version.version_number}"
        )
        return distribution

    @staticmethod
    def record_view(distribution, time_spent_seconds=0, ip_address=None, user_agent=''):
        """Record that employee viewed the policy."""
        from ..models import PolicyReadLog

        now = timezone.now()

        if not distribution.first_opened_at:
            distribution.first_opened_at = now

        distribution.last_viewed_at = now
        distribution.total_views += 1
        distribution.total_time_spent_seconds += time_spent_seconds
        distribution.save()

        PolicyReadLog.objects.create(
            distribution=distribution,
            employee=distribution.employee,
            time_spent_seconds=time_spent_seconds,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    # ==========================================================================
    # COMPLIANCE STATS
    # ==========================================================================

    @staticmethod
    def get_policy_compliance(policy):
        """Get acknowledgment statistics for a policy."""
        from ..models import PolicyDistribution

        distributions = PolicyDistribution.objects.filter(
            policy=policy, is_invalidated=False
        )
        total = distributions.count()
        acknowledged = distributions.filter(acknowledged=True).count()
        overdue = distributions.filter(
            acknowledged=False,
            deadline__lt=timezone.localdate(),
        ).count()

        # Update overdue status
        distributions.filter(
            acknowledged=False,
            deadline__lt=timezone.localdate(),
            is_overdue=False,
        ).update(is_overdue=True)

        by_department = {}
        for dist in distributions.select_related('employee__structure_location'):
            dept = (
                dist.employee.structure_location.name
                if dist.employee.structure_location else 'No Department'
            )
            if dept not in by_department:
                by_department[dept] = {'total': 0, 'acknowledged': 0}
            by_department[dept]['total'] += 1
            if dist.acknowledged:
                by_department[dept]['acknowledged'] += 1

        dept_stats = [
            {
                'department': dept,
                'total': stats['total'],
                'acknowledged': stats['acknowledged'],
                'percentage': round(
                    (stats['acknowledged'] / stats['total'] * 100), 1
                ) if stats['total'] > 0 else 0,
            }
            for dept, stats in by_department.items()
        ]

        return {
            'total': total,
            'acknowledged': acknowledged,
            'pending': total - acknowledged,
            'overdue': overdue,
            'percentage': round((acknowledged / total * 100), 1) if total > 0 else 0,
            'by_department': sorted(dept_stats, key=lambda x: x['department']),
        }

    # ==========================================================================
    # REMINDERS
    # ==========================================================================

    @staticmethod
    def send_reminders(days_before_deadline=None):
        """Send acknowledgment reminders. Called by management command."""
        from ..models import PolicyDistribution, PolicyReminderLog
        from HRMSapp.models import Notification

        today = timezone.localdate()
        reminder_thresholds = days_before_deadline or [7, 3, 1, 0, -1, -3, -7]

        sent_count = 0

        for threshold in reminder_thresholds:
            target_date = today + timedelta(days=threshold)

            pending = PolicyDistribution.objects.filter(
                acknowledged=False,
                is_invalidated=False,
                deadline=target_date,
            ).select_related('employee', 'policy')

            for dist in pending:
                # Check if reminder already sent at this threshold
                already_sent = PolicyReminderLog.objects.filter(
                    distribution=dist,
                    days_before_deadline=threshold,
                ).exists()

                if already_sent:
                    continue

                # Send reminder
                if threshold > 0:
                    title = f"⏰ Reminder: Acknowledge '{dist.policy.title}' — {threshold} days remaining"
                elif threshold == 0:
                    title = f"⛔ TODAY: Acknowledge '{dist.policy.title}' — Deadline today!"
                else:
                    title = f"🔴 OVERDUE: '{dist.policy.title}' acknowledgment overdue by {abs(threshold)} days"
                    dist.is_overdue = True
                    dist.save(update_fields=['is_overdue'])

                # In-app notification
                try:
                    Notification.objects.create(
                        recipient=dist.employee,
                        notification_type='SYSTEM',
                        title=title,
                        message=f'Please read and acknowledge "{dist.policy.title}" (v{dist.version.version_number}).',
                        link='/policies/my-acknowledgments',
                    )
                except Exception:
                    pass

                # Log reminder
                PolicyReminderLog.objects.create(
                    distribution=dist,
                    reminder_type='NOTIFICATION_EMPLOYEE',
                    sent_to_name=dist.employee.full_name,
                    days_before_deadline=threshold,
                )

                # Escalate to manager if overdue
                if threshold <= -3 and dist.employee.reporting_manager:
                    manager = dist.employee.reporting_manager
                    try:
                        Notification.objects.create(
                            recipient=manager,
                            notification_type='SYSTEM',
                            title=f"📢 Team member hasn't acknowledged policy",
                            message=(
                                f'{dist.employee.full_name} has not acknowledged '
                                f'"{dist.policy.title}" — {abs(threshold)} days overdue.'
                            ),
                            link='/policies/admin/compliance',
                        )
                        PolicyReminderLog.objects.create(
                            distribution=dist,
                            reminder_type='NOTIFICATION_MANAGER',
                            sent_to_name=manager.full_name,
                            days_before_deadline=threshold,
                        )
                    except Exception:
                        pass

                sent_count += 1

        logger.info(f"Sent {sent_count} policy reminders")
        return sent_count

    # ==========================================================================
    # NOTIFICATION HELPERS
    # ==========================================================================

    @staticmethod
    def _notify_approver(policy, approver, is_escalation=False):
        """Send in-app notification + EMAIL to approver."""
        try:
            from HRMSapp.models import Notification
            from django.conf import settings as django_settings
            from django.core.mail import EmailMultiAlternatives

            prefix = "[ESCALATED] " if is_escalation else ""

            # In-app notification
            Notification.objects.create(
                recipient=approver,
                notification_type='APPROVAL_REQUEST',
                title=f'{prefix}Policy Review: {policy.title}',
                message=f'Policy "{policy.title}" ({policy.policy_number}) needs your approval.',
                link='/policies/pending-approvals',
            )

            # Email
            portal_url = getattr(django_settings, 'PORTAL_URL', 'http://localhost:5173')
            company_name = getattr(django_settings, 'COMPANY_NAME', 'Company')
            owner_name = policy.created_by.full_name if policy.created_by else 'HR Team'

            subject = f"{'🔔 [ESCALATED] ' if is_escalation else '⏳ '}Policy Review Required: {policy.title}"

            text_body = f"""Hello {approver.full_name},

    A company policy requires your review and approval.

    POLICY DETAILS
    --------------
    Title          : {policy.title}
    Policy Number  : {policy.policy_number}
    Category       : {policy.category.name}
    Priority       : {policy.get_priority_display()}
    Submitted By   : {owner_name}
    Version        : v{policy.current_version.version_number if policy.current_version else '1.0'}

    Please review and approve/reject at:
    {portal_url}/policies/pending-approvals

    ---
    {company_name}
    """

            html_body = f'''<!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fa;margin:0;padding:20px;">
    <div style="max-width:640px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
        <div style="background:linear-gradient(135deg,{'#f59e0b' if is_escalation else '#2563eb'} 0%,{'#d97706' if is_escalation else '#1e40af'} 100%);padding:32px;text-align:center;color:white;">
            <h1 style="margin:0;font-size:24px;">{'🔔 Escalated Policy Review' if is_escalation else '⏳ Policy Review Required'}</h1>
            <p style="margin:8px 0 0 0;opacity:0.9;font-size:14px;">{policy.policy_number}</p>
        </div>
        <div style="padding:32px;">
            <p>Hello <strong>{approver.full_name}</strong>,</p>
            <p>A company policy requires your review and approval.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <tr><th style="background:#f9fafb;padding:12px 16px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:40%;font-size:13px;">Title</th><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;"><strong>{policy.title}</strong></td></tr>
                <tr><th style="background:#f9fafb;padding:12px 16px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:40%;font-size:13px;">Category</th><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;">{policy.category.name}</td></tr>
                <tr><th style="background:#f9fafb;padding:12px 16px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:40%;font-size:13px;">Priority</th><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;">{policy.get_priority_display()}</td></tr>
                <tr><th style="background:#f9fafb;padding:12px 16px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:40%;font-size:13px;">Submitted By</th><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;">{owner_name}</td></tr>
            </table>
            {f'<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;border-radius:4px;"><strong>🔔 Escalation:</strong> This policy was approved by previous reviewers and now needs your final approval.</div>' if is_escalation else ''}
            <div style="text-align:center;margin:32px 0;">
                <a href="{portal_url}/policies/pending-approvals" style="display:inline-block;background:#2563eb;color:white !important;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Review & Take Action →</a>
            </div>
        </div>
        <div style="background:#f9fafb;padding:24px;text-align:center;color:#6b7280;font-size:12px;">
            <p><strong>{company_name}</strong></p>
            <p>Automated notification from HRMS Policy Management</p>
        </div>
    </div>
    </body>
    </html>'''

            email = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                to=[approver.official_email],
            )
            email.attach_alternative(html_body, "text/html")
            email.send(fail_silently=False)

            logger.info(f"✅ Policy approval email sent to {approver.official_email}")

        except Exception as exc:
            logger.exception(f"❌ Failed to notify approver: {exc}")

    @staticmethod
    def _notify_policy_approved(policy, approver):
        try:
            from HRMSapp.models import Notification
            owner = policy.created_by or policy.policy_owner
            if owner:
                Notification.objects.create(
                    recipient=owner,
                    notification_type='APPROVAL_APPROVED',
                    title=f'Policy Approved: {policy.title}',
                    message=f'"{policy.title}" has been approved by {approver.full_name}. Ready to publish.',
                    link=f'/policies/admin/{policy.id}',
                )
        except Exception as exc:
            logger.exception(f"Notification failed: {exc}")

    @staticmethod
    def _notify_policy_rejected(policy, approver, reason):
        try:
            from HRMSapp.models import Notification
            owner = policy.created_by or policy.policy_owner
            if owner:
                Notification.objects.create(
                    recipient=owner,
                    notification_type='APPROVAL_REJECTED',
                    title=f'Policy Rejected: {policy.title}',
                    message=f'"{policy.title}" was rejected by {approver.full_name}. Reason: {reason}',
                    link=f'/policies/admin/{policy.id}',
                )
        except Exception as exc:
            logger.exception(f"Notification failed: {exc}")

    @staticmethod
    def _send_distribution_emails(policy, version, employees, is_update=False):
        """Send email to distributed employees about new/updated policy."""
        from django.conf import settings as django_settings
        from django.core.mail import EmailMultiAlternatives
        from HRMSapp.models import Notification

        portal_url = getattr(django_settings, 'PORTAL_URL', 'http://localhost:5173')
        company_name = getattr(django_settings, 'COMPANY_NAME', 'Company')

        for employee in employees:
            try:
                # In-app notification
                Notification.objects.create(
                    recipient=employee,
                    notification_type='SYSTEM',
                    title=(
                        f'🔄 Policy Updated: {policy.title}'
                        if is_update else
                        f'📋 New Policy: {policy.title}'
                    ),
                    message=(
                        f'"{policy.title}" has been updated to v{version.version_number}. '
                        f'Please re-read and acknowledge the new version.'
                        if is_update else
                        f'A new policy "{policy.title}" has been published. '
                        f'Please read and acknowledge by the deadline.'
                    ),
                    link='/policies/my-acknowledgments',
                )

                # Email
                if is_update:
                    subject = f"🔄 Policy Updated: {policy.title} — Re-acknowledgment Required"
                    header_title = "🔄 Policy Updated"
                    intro_msg = f"An updated version of a company policy requires your re-acknowledgment."
                    gradient = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                    alert_msg = (
                        f"⚠️ <strong>Re-acknowledgment Required:</strong> This policy has been "
                        f"updated. Your previous acknowledgment is no longer valid. Please read "
                        f"the new version and acknowledge within <strong>"
                        f"{policy.acknowledgment_deadline_days} days</strong>."
                    )
                    change_note = (
                        f'<div style="background:#f0f9ff;border-left:4px solid #0284c7;'
                        f'padding:12px 16px;margin:16px 0;border-radius:4px;">'
                        f'<strong>📝 What Changed:</strong><br/>'
                        f'{version.change_summary or "See document for details"}</div>'
                        if version.change_summary else ''
                    )
                else:
                    subject = f"📋 New Policy Published: {policy.title}"
                    header_title = "📋 New Policy Published"
                    intro_msg = "A new company policy has been published that requires your attention."
                    gradient = "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    alert_msg = (
                        f"⚠️ <strong>Action Required:</strong> Please read and acknowledge "
                        f"this policy within <strong>{policy.acknowledgment_deadline_days} "
                        f"days</strong>."
                    )
                    change_note = ''

                text_body = f"""Hello {employee.full_name},

    {intro_msg}

    POLICY DETAILS
    --------------
    Title          : {policy.title}
    Policy Number  : {policy.policy_number}
    Category       : {policy.category.name}
    Version        : v{version.version_number}
    Effective Date : {policy.effective_date.strftime('%d %B %Y') if policy.effective_date else 'Immediate'}
    {f'Change Summary: {version.change_summary}' if version.change_summary else ''}

    {'⚠️ Your previous acknowledgment is no longer valid. Please re-read and acknowledge.' if is_update else f'⚠️ You must read and acknowledge this policy within {policy.acknowledgment_deadline_days} days.'}

    Read & Acknowledge: {portal_url}/policies/{policy.id}

    ---
    {company_name}
    """

                html_body = f'''<!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fa;margin:0;padding:20px;">
    <div style="max-width:640px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
        <div style="background:{gradient};padding:32px;text-align:center;color:white;">
            <h1 style="margin:0;font-size:24px;">{header_title}</h1>
            <p style="margin:8px 0 0 0;opacity:0.9;">{policy.policy_number} • v{version.version_number}</p>
        </div>
        <div style="padding:32px;">
            <p>Hello <strong>{employee.full_name}</strong>,</p>
            <p>{intro_msg}</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <tr><th style="background:#f9fafb;padding:12px 16px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;width:40%;font-size:13px;">Title</th><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;"><strong>{policy.title}</strong></td></tr>
                <tr><th style="background:#f9fafb;padding:12px 16px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;width:40%;font-size:13px;">Category</th><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;">{policy.category.name}</td></tr>
                <tr><th style="background:#f9fafb;padding:12px 16px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;width:40%;font-size:13px;">Version</th><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;">v{version.version_number} {'(UPDATED)' if is_update else '(NEW)'}</td></tr>
            </table>
            {change_note}
            <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;border-radius:4px;">
                {alert_msg}
            </div>
            <div style="text-align:center;margin:32px 0;">
                <a href="{portal_url}/policies/{policy.id}" style="display:inline-block;background:#2563eb;color:white !important;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Read & Acknowledge →</a>
            </div>
        </div>
        <div style="background:#f9fafb;padding:24px;text-align:center;color:#6b7280;font-size:12px;">
            <p><strong>{company_name}</strong></p>
        </div>
    </div>
    </body>
    </html>'''

                email = EmailMultiAlternatives(
                    subject=subject,
                    body=text_body,
                    from_email=django_settings.DEFAULT_FROM_EMAIL,
                    to=[employee.official_email],
                )
                email.attach_alternative(html_body, "text/html")
                email.send(fail_silently=True)

            except Exception as exc:
                logger.warning(f"Failed to email {employee.employee_id}: {exc}")

        logger.info(
            f"✅ {'Update' if is_update else 'Distribution'} emails sent for "
            f"{policy.policy_number} v{version.version_number}"
        )