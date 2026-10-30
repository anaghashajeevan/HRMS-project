"""Stage-2 exit clearance tasks backed by existing asset and reimbursement records."""
from django.utils import timezone

from ..models import EmployeeExitClearanceItem


def sync_linked_clearance_items(exit_request, actor=None):
    from assetapp.models import AssetAllocation
    from reimbursementapp.models import ReimbursementClaim

    active_allocations = AssetAllocation.objects.filter(
        employee=exit_request.employee, status='ALLOCATED', allocated_date__lte=exit_request.proposed_exit_date,
    ).select_related('asset')
    active_allocation_ids = {str(row.pk) for row in active_allocations}
    for allocation in active_allocations:
        EmployeeExitClearanceItem.objects.get_or_create(
            request=exit_request, source_key=f'asset:{allocation.pk}',
            defaults={
                'category': 'ASSET', 'title': f'Return {allocation.asset.name} ({allocation.asset.asset_tag})',
                'description': f'Asset allocated {allocation.allocated_date}. Record the return in Asset Management.',
                'responsible_person': 'Employee / Asset Management', 'created_by': getattr(actor, 'employee', None),
            },
        )

    for item in exit_request.clearance_items.filter(category='ASSET', status='PENDING'):
        allocation_id = item.source_key.removeprefix('asset:')
        if allocation_id not in active_allocation_ids:
            item.status = 'COMPLETED'
            item.resolution_notes = 'Asset allocation is no longer active; current status verified in Asset Management.'
            item.save(update_fields=['status', 'resolution_notes', 'updated_at'])

    claims = ReimbursementClaim.objects.filter(
        employee=exit_request.employee,
        batch__year__lte=exit_request.proposed_exit_date.year,
    ).exclude(status='REJECTED').exclude(batch__status__in=['SENT', 'CLOSED']).select_related('batch')
    active_claim_ids = set()
    for claim in claims:
        if claim.batch.year == exit_request.proposed_exit_date.year and claim.batch.month > exit_request.proposed_exit_date.month:
            continue
        active_claim_ids.add(str(claim.pk))
        EmployeeExitClearanceItem.objects.get_or_create(
            request=exit_request, source_key=f'reimbursement:{claim.pk}',
            defaults={
                'category': 'REIMBURSEMENT',
                'title': f'Reimbursement claim · {claim.batch.year}-{claim.batch.month:02d}',
                'description': f'{claim.status.replace("_", " ").title()} · approved ₹{claim.total_approved_amount}. Resolve through Reimbursements.',
                'responsible_person': 'Employee / Reimbursement Finance', 'created_by': getattr(actor, 'employee', None),
            },
        )

    for item in exit_request.clearance_items.filter(category='REIMBURSEMENT', status='PENDING'):
        claim_id = item.source_key.removeprefix('reimbursement:')
        if claim_id not in active_claim_ids:
            item.status = 'COMPLETED'
            item.resolution_notes = 'Reimbursement is no longer outstanding; current status verified in Reimbursements.'
            item.save(update_fields=['status', 'resolution_notes', 'updated_at'])


def clearance_payload(exit_request, actor=None):
    sync_linked_clearance_items(exit_request, actor)
    rows = list(exit_request.clearance_items.select_related('resolved_by').all())
    items = [{
        'id': str(item.id), 'category': item.category, 'title': item.title,
        'description': item.description, 'responsible_person': item.responsible_person,
        'due_date': item.due_date.isoformat() if item.due_date else None,
        'status': item.status, 'resolution_notes': item.resolution_notes,
        'exception_reason': item.exception_reason,
        'resolved_by': item.resolved_by.full_name if item.resolved_by else None,
        'updated_at': item.updated_at.isoformat(),
    } for item in rows]
    pending = sum(item['status'] == 'PENDING' for item in items)
    return {'items': items, 'summary': {
        'total': len(items), 'pending': pending,
        'completed': sum(item['status'] == 'COMPLETED' for item in items),
        'exceptions': sum(item['status'] == 'WAIVED' for item in items),
        'ready_for_settlement': pending == 0,
    }}


def log_clearance_change(item, actor, action, reason=''):
    from ..models import PayrollAuditLog
    PayrollAuditLog.objects.create(
        employee=item.request.employee,
        action=action,
        old_values={'title': item.title},
        new_values={
            'title': item.title, 'category': item.category, 'status': item.status,
            'responsible_person': item.responsible_person,
        },
        reason=reason or item.resolution_notes,
        performed_by=getattr(actor, 'employee', None),
    )
