"""
Celery tasks for HRMS.
"""
import logging
from celery import shared_task
from django.core.mail import EmailMultiAlternatives, send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def scan_document_expiries(self):
    """
    Daily task: scans all documents and sends alerts for those
    expiring in 90, 60, or 30 days.

    Uses `alert_fired_count` on each document to prevent duplicate emails:
    - 0 = no alerts sent yet
    - 1 = 90-day alert sent
    - 2 = 60-day alert sent
    - 3 = 30-day alert sent
    """
    from .models import EmployeeDocument

    today = timezone.now().date()
    logger.info(f"🔍 Starting document expiry scan on {today}")

    stats = {'scanned': 0, 'alerts_sent': 0, 'errors': 0}

    documents = EmployeeDocument.objects.filter(
        expiry_date__isnull=False,
        expiry_date__gte=today,
    ).select_related('employee')

    stats['scanned'] = documents.count()

    for doc in documents:
        try:
            days_until_expiry = (doc.expiry_date - today).days

            threshold = None
            required_count = 0

            if days_until_expiry <= 30 and doc.alert_fired_count < 3:
                threshold = 30
                required_count = 3
            elif days_until_expiry <= 60 and doc.alert_fired_count < 2:
                threshold = 60
                required_count = 2
            elif days_until_expiry <= 90 and doc.alert_fired_count < 1:
                threshold = 90
                required_count = 1

            if threshold is None:
                continue

            # Queue email task
            send_expiry_alert.delay(str(doc.id), days_until_expiry, threshold)

            # Update count to prevent duplicates
            doc.alert_fired_count = required_count
            doc.save(update_fields=['alert_fired_count'])

            stats['alerts_sent'] += 1
            logger.info(
                f"✅ Alert queued for doc {doc.id} ({doc.document_name}), "
                f"{days_until_expiry} days remaining"
            )

        except Exception as e:
            stats['errors'] += 1
            logger.error(f"❌ Error processing doc {doc.id}: {e}")

    logger.info(f"📊 Scan complete: {stats}")
    return stats


# @shared_task(bind=True, max_retries=3, default_retry_delay=60)
# def send_expiry_alert(self, document_id, days_remaining, threshold):
#     """
#     Send email alerts for a single expiring document.
#     Notifies BOTH the employee AND HR.
#     """
#     from .models import EmployeeDocument

#     try:
#         doc = EmployeeDocument.objects.select_related('employee').get(id=document_id)
#     except EmployeeDocument.DoesNotExist:
#         logger.warning(f"⚠️ Document {document_id} no longer exists")
#         return {'sent': 0, 'error': 'Document not found'}

#     employee = doc.employee
#     portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')

#     context = {
#         'employee_name': employee.full_name,
#         'employee_id': employee.employee_id,
#         'employee_uuid': str(employee.id),
#         'document_name': doc.document_name,
#         'document_type': doc.get_document_type_display(),
#         'expiry_date': doc.expiry_date,
#         'days_remaining': days_remaining,
#         'threshold': threshold,
#         'portal_url': portal_url,
#         'current_year': timezone.now().year,
#     }

#     sent_count = 0

#     # ---------- Email #1: Notify Employee ----------
#     try:
#         subject = f"⏰ Reminder: Your {doc.get_document_type_display()} expires in {days_remaining} days"
#         html_body = render_to_string('emails/document_expiry_employee.html', context)
#         text_body = render_to_string('emails/document_expiry_employee.txt', context)

#         email = EmailMultiAlternatives(
#             subject=subject,
#             body=text_body,
#             from_email=settings.DEFAULT_FROM_EMAIL,
#             to=[employee.official_email],
#         )
#         email.attach_alternative(html_body, "text/html")
#         email.send(fail_silently=False)
#         sent_count += 1
#         logger.info(f"📧 Employee alert sent to {employee.official_email}")

#     except Exception as e:
#         logger.error(f"❌ Failed to send employee email: {e}")

#     # ---------- Email #2: Notify HR ----------
#     try:
#         hr_email = getattr(settings, 'HR_NOTIFICATION_EMAIL', None)
#         if hr_email:
#             subject = f"⚠️ HR Alert: {employee.full_name}'s {doc.get_document_type_display()} expires in {days_remaining} days"
#             html_body = render_to_string('emails/document_expiry_hr.html', context)
#             text_body = render_to_string('emails/document_expiry_hr.txt', context)

#             email = EmailMultiAlternatives(
#                 subject=subject,
#                 body=text_body,
#                 from_email=settings.DEFAULT_FROM_EMAIL,
#                 to=[hr_email],
#             )
#             email.attach_alternative(html_body, "text/html")
#             email.send(fail_silently=False)
#             sent_count += 1
#             logger.info(f"📧 HR alert sent to {hr_email}")

#     except Exception as e:
#         logger.error(f"❌ Failed to send HR email: {e}")

#     return {'sent': sent_count, 'document_id': document_id}

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_expiry_alert(self, document_id, days_remaining, threshold, required_count=None):
    """
    Send email alerts for a single expiring document.
    
    Recipients:
    - Employee (owner of the document) — they need to renew
    - All active HR_ADMIN users — they handle compliance follow-up
    """
    from .models import EmployeeDocument, UserAccount

    try:
        doc = EmployeeDocument.objects.select_related('employee').get(id=document_id)
    except EmployeeDocument.DoesNotExist:
        logger.warning(f"⚠️ Document {document_id} no longer exists")
        return {'sent': 0, 'error': 'Document not found'}

    employee = doc.employee
    portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')

    context = {
        'employee_name': employee.full_name,
        'employee_id': employee.employee_id,
        'employee_uuid': str(employee.id),
        'document_name': doc.document_name,
        'document_type': doc.get_document_type_display(),
        'expiry_date': doc.expiry_date,
        'days_remaining': days_remaining,
        'threshold': threshold,
        'portal_url': portal_url,
        'current_year': timezone.now().year,
    }

    sent_count = 0

    # ==========================================================================
    # Email #1: Notify the Employee (document owner)
    # ==========================================================================
    try:
        subject = f"⏰ Reminder: Your {doc.get_document_type_display()} expires in {days_remaining} days"
        html_body = render_to_string('emails/document_expiry_employee.html', context)
        text_body = render_to_string('emails/document_expiry_employee.txt', context)

        email = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[employee.official_email],
        )
        email.attach_alternative(html_body, "text/html")
        email.send(fail_silently=False)
        sent_count += 1
        logger.info(f"📧 Employee alert sent to {employee.official_email}")

    except Exception as e:
        logger.error(f"❌ Failed to send employee email: {e}")

    # ==========================================================================
    # Email #2: Notify all HR Admins (they handle document compliance)
    # System Admins are NOT included — this is HR business, not IT
    # ==========================================================================
    try:
        hr_users = UserAccount.objects.filter(
            is_active=True,
            roles__role_name='HR_ADMIN',   # ← HR admins only
        ).distinct().select_related('employee')

        # Collect their emails (prefer employee email, fallback to user email)
        hr_emails = []
        for user in hr_users:
            if user.employee and user.employee.official_email:
                hr_emails.append(user.employee.official_email)
            elif user.email:
                hr_emails.append(user.email)

        # Remove duplicates
        hr_emails = list(set(hr_emails))

        if not hr_emails:
            logger.warning("⚠️ No HR admins found in database — no HR alert sent")
        else:
            subject = f"⚠️ HR Alert: {employee.full_name}'s {doc.get_document_type_display()} expires in {days_remaining} days"
            html_body = render_to_string('emails/document_expiry_hr.html', context)
            text_body = render_to_string('emails/document_expiry_hr.txt', context)

            email = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=hr_emails,   # ← List of all HR admin emails
            )
            email.attach_alternative(html_body, "text/html")
            email.send(fail_silently=False)
            sent_count += 1
            logger.info(f"📧 HR alert sent to {len(hr_emails)} HR admin(s): {', '.join(hr_emails)}")

    except Exception as e:
        logger.error(f"❌ Failed to send HR email: {e}")

    # ==========================================================================
    # Update alert_fired_count ONLY if at least one email succeeded
    # ==========================================================================
    if sent_count > 0 and required_count is not None:
        doc.alert_fired_count = required_count
        doc.save(update_fields=['alert_fired_count'])
        logger.info(f"✅ Updated alert_fired_count to {required_count}")
    elif sent_count == 0:
        logger.warning(f"⚠️ No emails sent — alert_fired_count NOT updated (will retry next scan)")

    return {'sent': sent_count, 'document_id': document_id}

@shared_task
def test_email(recipient_email):
    """
    Test task to verify email + Celery work.
    """
    send_mail(
        subject='🧪 HRMS Test Email',
        message='If you see this, Celery + Email are working! 🎉',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient_email],
        fail_silently=False,
    )
    logger.info(f"📧 Test email sent to {recipient_email}")
    return f'Test email sent to {recipient_email}'



# requests 

# Add these to tasks.py

from django.core.files.base import ContentFile


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_approval_notification_email(self, action_id):
    """Email approver that their action is required."""
    from .models import LifecycleApprovalAction
    
    try:
        action = LifecycleApprovalAction.objects.select_related(
            'request', 'request__employee', 'assigned_to'
        ).get(id=action_id)
    except LifecycleApprovalAction.DoesNotExist:
        logger.warning(f"Action {action_id} not found")
        return
    
    approver = action.assigned_to
    req = action.request
    portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
    
    subject = f"⏳ Approval Required: {req.get_change_type_display()} - {req.request_number}"
    
    text_body = f"""
Hello {approver.full_name},

A {req.get_change_type_display()} request needs your approval.

Request Details:
- Request #: {req.request_number}
- Employee: {req.employee.full_name} ({req.employee.employee_id})
- Change Type: {req.get_change_type_display()}
- Effective Date: {req.effective_date}
- Reason: {req.reason}
- Requested By: {req.requested_by.full_name}
- Step: {action.step_number} - {action.step_name}
- Due By: {action.due_at.strftime('%d %B %Y, %H:%M')}

Please review and take action:
{portal_url}/approvals/{req.id}

Regards,
HRMS System
"""
    
    try:
        send_mail(
            subject=subject,
            message=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[approver.official_email],
            fail_silently=False,
        )
        logger.info(f"📧 Approval email sent to {approver.official_email}")
    except Exception as e:
        logger.error(f"❌ Failed to send approval email: {e}")
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def apply_lifecycle_changes_and_generate_letter(self, request_id):
    """
    Called after full workflow approval:
    1. Apply changes to Employee record
    2. Generate PDF letter
    3. Save as EmployeeDocument
    4. Email letter to employee
    """
    from .models import LifecycleChangeRequest, EmployeeDocument, Notification
    from .services.pdf_generator import generate_lifecycle_letter_pdf
    
    try:
        request = LifecycleChangeRequest.objects.select_related(
            'employee', 'proposed_position', 'proposed_manager', 
            'proposed_location', 'letter_template'
        ).get(id=request_id)
    except LifecycleChangeRequest.DoesNotExist:
        logger.error(f"Request {request_id} not found")
        return
    
    # ---------- 1. Apply changes to Employee ----------
    employee = request.employee
    changes_made = []
    
    if request.proposed_position and request.proposed_position != employee.position:
        employee.position = request.proposed_position
        changes_made.append('position')
    
    if request.proposed_manager and request.proposed_manager != employee.reporting_manager:
        employee.reporting_manager = request.proposed_manager
        changes_made.append('reporting_manager')
    
    if request.proposed_location and request.proposed_location != employee.structure_location:
        employee.structure_location = request.proposed_location
        changes_made.append('structure_location')
    
    if request.proposed_status and request.proposed_status != employee.status:
        employee.status = request.proposed_status
        changes_made.append('status')
    
    if changes_made:
        # Set modifier so audit signal knows who made this change
        employee._modified_by = request.requested_by
        employee.save()
        logger.info(f"✅ Applied changes to {employee.employee_id}: {changes_made}")
    
    # ---------- 2. Generate PDF ----------
    if not request.letter_template:
        logger.warning(f"No letter template — skipping PDF generation for {request.request_number}")
        return
    
    try:
        pdf_bytes = generate_lifecycle_letter_pdf(request)
    except Exception as e:
        logger.error(f"❌ PDF generation failed: {e}")
        return
    
    # ---------- 3. Save as EmployeeDocument ----------
    doc_type_map = {
        'PROMOTION': 'LETTER_PROMOTION',
        'TRANSFER': 'LETTER_TRANSFER',
        'REDESIGNATION': 'LETTER_REDESIGNATION',
        'CONFIRMATION': 'LETTER_CONFIRMATION',
        'MANAGER_CHANGE': 'LETTER_MANAGER_CHANGE',
    }
    
    filename = f"{request.request_number}_{request.change_type}.pdf"
    doc = EmployeeDocument(
        employee=employee,
        document_type=doc_type_map.get(request.change_type, 'OTHER'),
        document_name=f"{request.get_change_type_display()} Letter - {request.request_number}",
        uploaded_by=request.requested_by,
        file_size_kb=round(len(pdf_bytes) / 1024),
        mime_type='application/pdf',
    )
    doc.file_path.save(filename, ContentFile(pdf_bytes), save=True)
    
    # Link the generated doc back to request
    request.generated_document = doc
    request.save(update_fields=['generated_document'])
    
    # ---------- 4. Email letter to employee ----------
    try:
        email = EmailMultiAlternatives(
            subject=f"Your {request.get_change_type_display()} Letter - {request.request_number}",
            body=(
                f"Hello {employee.full_name},\n\n"
                f"Please find attached your {request.get_change_type_display()} letter.\n\n"
                f"Effective Date: {request.effective_date}\n\n"
                f"Regards,\nHR Department"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[employee.official_email],
        )
        email.attach(filename, pdf_bytes, 'application/pdf')
        email.send(fail_silently=False)
        logger.info(f"📧 Letter emailed to {employee.official_email}")
    except Exception as e:
        logger.error(f"❌ Failed to email letter: {e}")
    
    # ---------- 5. Notify employee in-app ----------
    Notification.objects.create(
        recipient=employee,
        notification_type='LETTER_GENERATED',
        title=f'New Letter: {request.get_change_type_display()}',
        message=f'Your {request.get_change_type_display().lower()} letter has been generated and saved to your documents.',
        link=f'/employees/{employee.id}',
    )

# Add to tasks.py

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def finalize_scorecard_and_send_letter(self, scorecard_id):
    """
    Called when HR finalizes a scorecard:
    1. Generate PDF rating letter (uses PerformanceLetter template)
    2. Save PDF as EmployeeDocument
    3. Email PDF to employee
    4. Link doc back to scorecard
    """
    from django.core.files.base import ContentFile
    from .models import EmployeeScorecard, EmployeeDocument, Notification
    from .services.pdf_generator import generate_performance_letter_pdf

    try:
        scorecard = EmployeeScorecard.objects.select_related(
            'employee', 'cycle'
        ).get(id=scorecard_id)
    except EmployeeScorecard.DoesNotExist:
        logger.error(f"Scorecard {scorecard_id} not found")
        return

    employee = scorecard.employee

    # 1. Generate PDF
    try:
        pdf_bytes = generate_performance_letter_pdf(scorecard)
    except ValueError as e:
        logger.error(f"❌ PDF gen failed: {e}")
        return
    except Exception as e:
        logger.error(f"❌ PDF gen exception: {e}")
        return

    # 2. Determine doc type based on rating
    doc_type = 'PIP_LETTER' if (scorecard.final_rating and scorecard.final_rating <= 2) else 'PERFORMANCE_LETTER'

    # 3. Save as EmployeeDocument
    filename = f"Performance_{scorecard.cycle.name.replace(' ', '_')}_{employee.employee_id}.pdf"
    doc = EmployeeDocument(
        employee=employee,
        document_type=doc_type,
        document_name=f"{scorecard.cycle.name} - Rating Letter",
        uploaded_by=None,  # System-generated
        file_size_kb=round(len(pdf_bytes) / 1024),
        mime_type='application/pdf',
    )
    doc.file_path.save(filename, ContentFile(pdf_bytes), save=True)

    logger.info(f"✅ Rating letter saved: {filename}")

    # 4. Email letter to employee
    try:
        email = EmailMultiAlternatives(
            subject=f"Your Performance Rating - {scorecard.cycle.name}",
            body=(
                f"Hello {employee.full_name},\n\n"
                f"Your performance evaluation for {scorecard.cycle.name} has been finalized.\n\n"
                f"Final Score: {scorecard.final_score}%\n"
                f"Rating: {scorecard.final_rating}/5\n\n"
                f"Please find your detailed rating letter attached.\n\n"
                f"Regards,\nHR Department"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[employee.official_email],
        )
        email.attach(filename, pdf_bytes, 'application/pdf')
        email.send(fail_silently=False)
        logger.info(f"📧 Letter emailed to {employee.official_email}")
    except Exception as e:
        logger.error(f"❌ Email send failed: {e}")

    # 5. In-app notification
    Notification.objects.create(
        recipient=employee,
        notification_type='LETTER_GENERATED',
        title=f"Performance Rating Ready — {scorecard.cycle.name}",
        message=(
            f"Your performance evaluation for {scorecard.cycle.name} is complete. "
            f"Final rating: {scorecard.final_rating}/5. Letter has been emailed to you and "
            f"saved to your documents."
        ),
        link=f'/employees/{employee.id}',
    )