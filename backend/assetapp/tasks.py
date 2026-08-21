# import logging
# from celery import shared_task
# from django.core.mail import EmailMultiAlternatives
# from django.conf import settings
# from django.template import Template, Context
# from django.utils import timezone

# from .models import AssetAllocation
# from HRMSapp.models import LetterTemplate, Notification

# logger = logging.getLogger(__name__)

# @shared_task(bind=True, max_retries=3, default_retry_delay=60)
# def notify_asset_allocation(self, allocation_id):
#     """
#     Sends an email and in-app notification to the employee 
#     when a new asset is allocated to them.
#     """
#     try:
#         allocation = AssetAllocation.objects.select_related(
#             'asset', 'asset__category', 'employee'
#         ).get(id=allocation_id)
#     except AssetAllocation.DoesNotExist:
#         logger.warning(f"Allocation {allocation_id} not found.")
#         return

#     employee = allocation.employee
#     asset = allocation.asset
#     portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')

#     # 1. CREATE IN-APP NOTIFICATION
#     Notification.objects.create(
#         recipient=employee,
#         notification_type='ASSET_ALLOCATED',
#         title='New Asset Allocated',
#         message=f'A new {asset.category.name} ({asset.name}) has been allocated to you.',
#         link='/assets/my-assets',
#         metadata={'allocation_id': str(allocation.id), 'asset_tag': asset.asset_tag}
#     )

#     # 2. FETCH LETTER TEMPLATE FOR EMAIL
#     template = LetterTemplate.objects.filter(
#         template_type='ASSET_ALLOCATION', 
#         is_active=True
#     ).order_by('-is_default', '-created_at').first()

#     # If no template is configured in settings, fallback to a standard email
#     if template:
#         # Build context variables available for HR to use in the template
#         context_dict = {
#             'employee_name': employee.full_name,
#             'employee_id': employee.employee_id,
#             'asset_name': asset.name,
#             'asset_tag': asset.asset_tag,
#             'serial_number': asset.serial_number,
#             'category': asset.category.name,
#             'allocated_date': allocation.allocated_date.strftime('%d %B %Y'),
#             'expected_return_date': allocation.expected_return_date.strftime('%d %B %Y') if allocation.expected_return_date else 'N/A',
#             'handover_notes': allocation.handover_notes or 'None',
#             'company_name': getattr(settings, 'COMPANY_NAME', 'Our Company'),
#             'portal_url': portal_url,
#             'current_date': timezone.now().strftime('%d %B %Y'),
#         }

#         # Render the HTML from HR's template
#         html_body = Template(template.body_html).render(Context(context_dict))
#         subject = Template(template.subject).render(Context(context_dict))
#     else:
#         # Standard Fallback Email if HR hasn't created a template yet
#         subject = f"New Asset Allocated: {asset.name}"
#         html_body = f"""
#         <h2>Asset Allocation Notice</h2>
#         <p>Dear {employee.full_name},</p>
#         <p>A new company asset has been allocated to you:</p>
#         <ul>
#             <li><strong>Item:</strong> {asset.name} ({asset.category.name})</li>
#             <li><strong>Asset Tag:</strong> {asset.asset_tag}</li>
#             <li><strong>Serial Number:</strong> {asset.serial_number}</li>
#             <li><strong>Allocated On:</strong> {allocation.allocated_date.strftime('%d %B %Y')}</li>
#         </ul>
#         <p>Please log in to the <a href="{portal_url}/assets/my-assets">HRMS Portal</a> to view your active assets.</p>
#         <p>Regards,<br>HR & IT Department</p>
#         """

#     # 3. SEND THE EMAIL
#     try:
#         email_msg = EmailMultiAlternatives(
#             subject=subject,
#             body="Please view this email in an HTML-compatible client.",
#             from_email=settings.DEFAULT_FROM_EMAIL,
#             to=[employee.official_email],
#         )
#         email_msg.attach_alternative(html_body, 'text/html')
#         email_msg.send(fail_silently=False)
#         logger.info(f"📧 Asset allocation email sent to {employee.official_email}")
#     except Exception as e:
#         logger.error(f"❌ Failed to send asset allocation email: {e}")
#         raise self.retry(exc=e)



import logging
from celery import shared_task
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.template import Template, Context
from django.utils import timezone

from .models import AssetAllocation
from HRMSapp.models import LetterTemplate, Notification

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def notify_asset_allocation(self, allocation_id):
    try:
        allocation = AssetAllocation.objects.select_related(
            'asset', 'asset__category', 'employee', 'allocated_by'
        ).get(id=allocation_id)
    except AssetAllocation.DoesNotExist:
        logger.warning(f"Allocation {allocation_id} not found")
        return {'error': 'allocation_not_found'}

    employee = allocation.employee
    asset = allocation.asset
    portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
    company_name = getattr(settings, 'COMPANY_NAME', 'Our Company')

    # 1) In-app notification (always)
    Notification.objects.create(
        recipient=employee,
        notification_type='ASSET_ALLOCATED',
        title='New Asset Allocated',
        message=(
            f'A new {asset.category.name} ({asset.name} — {asset.asset_tag}) '
            f'has been allocated to you.'
        ),
        link='/assets/my-assets',
        metadata={
            'allocation_id': str(allocation.id),
            'asset_tag': asset.asset_tag,
            'asset_name': asset.name,
        },
    )

    # 2) Context for letter template
    context_dict = {
        'employee_name': employee.full_name,
        'employee_id': employee.employee_id,
        'employee_position': employee.position.title if employee.position else '—',
        'employee_department': (
            employee.department.name if employee.department
            else (employee.structure_location.name if employee.structure_location else '—')
        ),
        'company_name': company_name,
        'current_date': timezone.now().strftime('%d %B %Y'),
        'reporting_manager': (
            employee.reporting_manager.full_name if employee.reporting_manager else 'HR Team'
        ),
        # Asset-specific
        'asset_name': asset.name,
        'asset_tag': asset.asset_tag,
        'serial_number': asset.serial_number,
        'category': asset.category.name,
        'brand': asset.brand or '—',
        'model_number': asset.model_number or '—',
        'allocated_date': allocation.allocated_date.strftime('%d %B %Y'),
        'expected_return_date': (
            allocation.expected_return_date.strftime('%d %B %Y')
            if allocation.expected_return_date else 'N/A'
        ),
        'handover_notes': allocation.handover_notes or 'None',
        'allocated_by': allocation.allocated_by.full_name if allocation.allocated_by else 'HR Team',
        'portal_url': portal_url,
    }

    # 3) Find ASSET_ALLOCATION template
    template = (
        LetterTemplate.objects.filter(
            template_type='ASSET_ALLOCATION',
            is_active=True,
            is_default=True,
        ).first()
        or LetterTemplate.objects.filter(
            template_type='ASSET_ALLOCATION',
            is_active=True,
        ).order_by('-updated_at').first()
    )

    if template:
        logger.info(f"Using letter template: {template.name} ({template.id})")
        subject = Template(template.subject).render(Context(context_dict))
        html_body = Template(template.body_html).render(Context(context_dict))
    else:
        logger.warning(
            "No active ASSET_ALLOCATION letter template found. "
            "Using fallback email. Create one in Settings → Letter Templates."
        )
        subject = f"New Asset Allocated: {asset.name} ({asset.asset_tag})"
        html_body = f"""
        <h2>Asset Allocation Notice</h2>
        <p>Dear {employee.full_name},</p>
        <p>A company asset has been allocated to you:</p>
        <ul>
          <li><strong>Item:</strong> {asset.name}</li>
          <li><strong>Category:</strong> {asset.category.name}</li>
          <li><strong>Asset Tag:</strong> {asset.asset_tag}</li>
          <li><strong>Serial Number:</strong> {asset.serial_number}</li>
          <li><strong>Allocated On:</strong> {context_dict['allocated_date']}</li>
        </ul>
        <p>View your assets: <a href="{portal_url}/assets/my-assets">My Assets</a></p>
        <p>Regards,<br/>HR & IT — {company_name}</p>
        """

    # 4) Send email
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body='Please view this email in an HTML-compatible client.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[employee.official_email],
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)
        logger.info(f"Asset allocation email sent to {employee.official_email}")
        return {
            'sent': True,
            'used_template': bool(template),
            'template_name': template.name if template else None,
        }
    except Exception as e:
        logger.error(f"Failed to send asset allocation email: {e}")
        raise self.retry(exc=e)



@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def notify_asset_return(self, allocation_id):
    """
    Notify employee when an allocated asset is returned / damaged / lost.
    """
    try:
        allocation = AssetAllocation.objects.select_related(
            'asset', 'asset__category', 'employee', 'returned_to'
        ).get(id=allocation_id)
    except AssetAllocation.DoesNotExist:
        logger.warning(f"Allocation {allocation_id} not found")
        return {'error': 'allocation_not_found'}

    employee = allocation.employee
    asset = allocation.asset
    portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
    company_name = getattr(settings, 'COMPANY_NAME', 'Our Company')

    status_label = allocation.get_status_display()  # Returned / Damaged / Lost

    # 1) In-app notification
    Notification.objects.create(
        recipient=employee,
        notification_type='ASSET_RETURNED',
        title=f'Asset {status_label}',
        message=(
            f'Your asset {asset.name} ({asset.asset_tag}) has been marked as '
            f'{status_label.lower()}.'
        ),
        link='/assets/my-assets',
        metadata={
            'allocation_id': str(allocation.id),
            'asset_tag': asset.asset_tag,
            'return_status': allocation.status,
        },
    )

    # 2) Template context
    context_dict = {
        'employee_name': employee.full_name,
        'employee_id': employee.employee_id,
        'company_name': company_name,
        'current_date': timezone.now().strftime('%d %B %Y'),
        'asset_name': asset.name,
        'asset_tag': asset.asset_tag,
        'serial_number': asset.serial_number,
        'category': asset.category.name,
        'brand': asset.brand or '—',
        'model_number': asset.model_number or '—',
        'allocated_date': allocation.allocated_date.strftime('%d %B %Y'),
        'returned_date': (
            allocation.returned_date.strftime('%d %B %Y')
            if allocation.returned_date else timezone.now().strftime('%d %B %Y')
        ),
        'return_status': status_label,
        'return_notes': allocation.return_notes or 'None',
        'recovery_cost': str(allocation.recovery_cost or 0),
        'returned_to': allocation.returned_to.full_name if allocation.returned_to else 'HR Team',
        'portal_url': portal_url,
    }

    # 3) Find ASSET_RETURN template
    template = (
        LetterTemplate.objects.filter(
            template_type='ASSET_RETURN',
            is_active=True,
            is_default=True,
        ).first()
        or LetterTemplate.objects.filter(
            template_type='ASSET_RETURN',
            is_active=True,
        ).order_by('-updated_at').first()
    )

    if template:
        subject = Template(template.subject).render(Context(context_dict))
        html_body = Template(template.body_html).render(Context(context_dict))
    else:
        subject = f"Asset {status_label}: {asset.name} ({asset.asset_tag})"
        html_body = f"""
        <h2>Asset {status_label} Notice</h2>
        <p>Dear {employee.full_name},</p>
        <p>The following asset has been marked as <strong>{status_label}</strong>:</p>
        <ul>
          <li><strong>Item:</strong> {asset.name}</li>
          <li><strong>Asset Tag:</strong> {asset.asset_tag}</li>
          <li><strong>Serial Number:</strong> {asset.serial_number}</li>
          <li><strong>Returned On:</strong> {context_dict['returned_date']}</li>
          <li><strong>Notes:</strong> {context_dict['return_notes']}</li>
        </ul>
        <p>Regards,<br/>HR & IT — {company_name}</p>
        """

    # 4) Send email
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body='Please view this email in an HTML-compatible client.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[employee.official_email],
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)
        logger.info(f"Asset return email sent to {employee.official_email}")
        return {'sent': True, 'used_template': bool(template)}
    except Exception as e:
        logger.error(f"Failed to send asset return email: {e}")
        raise self.retry(exc=e)