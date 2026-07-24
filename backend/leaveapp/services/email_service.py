"""
Email notifications for leave applications.
Includes PDF letter attachments using templates from HRMS Settings.
"""

import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)


class LeaveEmailService:
    """Send email notifications for leave workflow events."""

    @staticmethod
    def send_approval_request(application, approver, is_escalation=False):
        """
        Send email to approver with leave application letter PDF attached.
        
        Args:
            application: LeaveApplication instance
            approver: Employee who needs to approve
            is_escalation: True if this is a Step 2+ escalation (mentions previous approval)
        """
        try:
            from .pdf_generator import generate_leave_letter_pdf
            
            employee = application.employee
            portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
            company_name = getattr(settings, 'COMPANY_NAME', 'Company')
            
            # Get previous approvals (for escalation context)
            previous_approvals = []
            if is_escalation:
                previous_approvals = list(
                    application.approvals.filter(status='APPROVED').select_related('approver')
                )

            context = {
                'approver_name': approver.full_name,
                'employee_name': employee.full_name,
                'employee_code': employee.employee_id,
                'employee_email': employee.official_email,
                'employee_department': (
                    employee.structure_location.name
                    if employee.structure_location else '—'
                ),
                'employee_position': (
                    employee.position.title
                    if employee.position else '—'
                ),
                'application_number': application.application_number,
                'leave_type_name': application.leave_type.name,
                'leave_type_code': application.leave_type.code,
                'start_date': application.start_date.strftime('%d %B %Y'),
                'end_date': application.end_date.strftime('%d %B %Y'),
                'total_days': application.total_days,
                'is_half_day': application.is_half_day,
                'half_day_period': application.get_half_day_period_display() if application.is_half_day else '',
                'reason': application.reason,
                'contact_during_leave': application.contact_during_leave,
                'handover_to': application.handover_to.full_name if application.handover_to else '—',
                'handover_notes': application.handover_notes or '—',
                'is_lop': application.is_lop,
                'lop_days': application.lop_days,
                'portal_url': portal_url,
                'action_url': f"{portal_url}/leave/approvals",
                'applied_at': timezone.localtime(application.applied_at).strftime('%d %B %Y, %H:%M'),
                'current_year': timezone.now().year,
                'company_name': company_name,
                'is_escalation': is_escalation,
                'previous_approvals': previous_approvals,
            }

            # Subject differs for escalation
            if is_escalation:
                subject = f"🔔 [ESCALATED] Leave Approval Required: {employee.full_name} - {application.leave_type.code}"
            else:
                subject = f"⏳ Leave Approval Required: {employee.full_name} - {application.leave_type.code}"

            html_body = render_to_string('leaveapp/emails/approval_request.html', context)
            text_body = render_to_string('leaveapp/emails/approval_request.txt', context)

            email = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[approver.official_email],
            )
            email.attach_alternative(html_body, "text/html")
            
            # 🆕 ATTACH LEAVE APPLICATION LETTER PDF
            try:
                pdf_bytes = generate_leave_letter_pdf(
                    application,
                    template_type='LEAVE_APPLICATION',
                    approver=approver,
                )
                filename = f"Leave_Application_{application.application_number}.pdf"
                email.attach(filename, pdf_bytes, 'application/pdf')
                logger.info(f"📎 Attached leave application PDF: {filename}")
            except Exception as pdf_err:
                logger.exception(f"Failed to attach PDF: {pdf_err}")
            
            email.send(fail_silently=False)

            logger.info(
                f"✅ Approval request email sent to {approver.official_email} for {application.application_number}"
            )
        except Exception as exc:
            logger.exception(f"❌ Failed to send approval email: {exc}")

    @staticmethod
    def send_approval_notification(application, approver):
        """Notify employee that their leave was approved (with approval letter PDF)."""
        try:
            from .pdf_generator import generate_leave_letter_pdf
            
            employee = application.employee
            portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
            company_name = getattr(settings, 'COMPANY_NAME', 'Company')

            context = {
                'employee_name': employee.full_name,
                'employee_code': employee.employee_id,
                'application_number': application.application_number,
                'leave_type_name': application.leave_type.name,
                'leave_type_code': application.leave_type.code,
                'start_date': application.start_date.strftime('%d %B %Y'),
                'end_date': application.end_date.strftime('%d %B %Y'),
                'total_days': application.total_days,
                'is_half_day': application.is_half_day,
                'approved_by': approver.full_name,
                'approved_at': timezone.localtime(application.approved_at).strftime('%d %B %Y, %H:%M') if application.approved_at else '',
                'reason': application.reason,
                'is_lop': application.is_lop,
                'lop_days': application.lop_days,
                'portal_url': portal_url,
                'action_url': f"{portal_url}/leave",
                'current_year': timezone.now().year,
                'company_name': company_name,
            }

            subject = f"✅ Leave Approved: {application.application_number}"

            html_body = render_to_string('leaveapp/emails/leave_approved.html', context)
            text_body = render_to_string('leaveapp/emails/leave_approved.txt', context)

            email = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[employee.official_email],
            )
            email.attach_alternative(html_body, "text/html")

            # 🆕 ATTACH LEAVE APPROVAL LETTER PDF
            try:
                pdf_bytes = generate_leave_letter_pdf(
                    application,
                    template_type='LEAVE_APPROVAL',
                    approver=approver,
                )
                filename = f"Leave_Approval_{application.application_number}.pdf"
                email.attach(filename, pdf_bytes, 'application/pdf')
                logger.info(f"📎 Attached leave approval PDF: {filename}")
            except Exception as pdf_err:
                logger.exception(f"Failed to attach PDF: {pdf_err}")

            email.send(fail_silently=False)
            logger.info(f"✅ Approval notification sent to {employee.official_email}")
        except Exception as exc:
            logger.exception(f"❌ Failed to send approval notification: {exc}")

    @staticmethod
    def send_rejection_notification(application, rejector, reason):
        """Notify employee that their leave was rejected."""
        try:
            employee = application.employee
            portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
            company_name = getattr(settings, 'COMPANY_NAME', 'Company')

            context = {
                'employee_name': employee.full_name,
                'employee_code': employee.employee_id,
                'application_number': application.application_number,
                'leave_type_name': application.leave_type.name,
                'start_date': application.start_date.strftime('%d %B %Y'),
                'end_date': application.end_date.strftime('%d %B %Y'),
                'total_days': application.total_days,
                'rejected_by': rejector.full_name,
                'rejection_reason': reason,
                'portal_url': portal_url,
                'action_url': f"{portal_url}/leave",
                'current_year': timezone.now().year,
                'company_name': company_name,
            }

            subject = f"❌ Leave Rejected: {application.application_number}"

            html_body = render_to_string('leaveapp/emails/leave_rejected.html', context)
            text_body = render_to_string('leaveapp/emails/leave_rejected.txt', context)

            email = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[employee.official_email],
            )
            email.attach_alternative(html_body, "text/html")
            email.send(fail_silently=False)

            logger.info(f"✅ Rejection email sent to {employee.official_email}")
        except Exception as exc:
            logger.exception(f"❌ Failed to send rejection email: {exc}")