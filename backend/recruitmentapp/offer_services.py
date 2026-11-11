from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives
from django.template import Context, Template
from django.utils.html import format_html, strip_tags
from django.utils import timezone

from HRMSapp.models import EmployeeDocument, LetterTemplate
from HRMSapp.services.pdf_generator import generate_recruitment_offer_pdf, get_company


def _offer_context(offer):
    application = offer.application
    requisition = application.requisition
    return {
        'candidate_name': application.candidate.full_name,
        'candidate_email': application.candidate.email,
        'position_title': requisition.position.title,
        'department_name': requisition.department.name,
        'location_name': requisition.location.name,
        'grade_band': requisition.grade_band,
        'annual_salary': f'{offer.annual_salary:,.2f}',
        'signing_bonus': f'{offer.signing_bonus:,.2f}',
        'currency': offer.currency,
        'joining_date': offer.joining_date.strftime('%d %B %Y'),
        'offer_expiry_date': offer.expires_on.strftime('%d %B %Y'),
        'offer_date': timezone.localdate().strftime('%d %B %Y'),
        'offer_reference': str(offer.pk),
        'requisition_number': requisition.requisition_number,
        'company_name': get_company()['name'],
    }


def render_text_template(value, context):
    return Template(value).render(Context(context))


def send_candidate_offer_email(offer):
    """Send the approved offer details and request a response. No formal PDF is attached."""
    template = LetterTemplate.objects.filter(template_type='OFFER_EMAIL', is_active=True).order_by('-is_default', 'name').first()
    if template is None:
        raise ValueError('Create and activate a Recruitment Offer Email template in Settings > Letter Templates before sending.')
    context = _offer_context(offer)
    subject = render_text_template(template.subject, context).strip()
    body = render_text_template(template.body_html, context).strip()
    if not subject or not body:
        raise ValueError('The active Offer email template must include both a subject and a message body.')
    body += str(format_html(
        '<hr><h3>Offer details</h3><p><strong>Position:</strong> {}<br>'
        '<strong>Department:</strong> {}<br><strong>Annual salary:</strong> {} {}<br>'
        '<strong>Signing bonus:</strong> {} {}<br><strong>Expected joining date:</strong> {}<br>'
        'Please reply to this email to accept or decline by {}. HR will record your response and follow up.</p>',
        context['position_title'], context['department_name'], context['currency'], context['annual_salary'],
        context['currency'], context['signing_bonus'], context['joining_date'], context['offer_expiry_date'],
    ))
    email = EmailMultiAlternatives(
        subject=subject,
        body=strip_tags(body).replace('&nbsp;', ' '),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[offer.application.candidate.email],
    )
    email.attach_alternative(body, 'text/html')
    sent_count = email.send(fail_silently=False)
    if not sent_count:
        raise RuntimeError('The offer email was not accepted by the configured email backend.')


def _attach_offer_letter_to_employee(offer, uploaded_by=None):
    if not offer.offer_letter:
        return
    employee = offer.employee
    if employee is None:
        return

    # The offer letter is one specific document record. If HR later selects
    # the correct employee, move that record instead of creating a duplicate.
    if offer.employee_document_id:
        document = offer.employee_document
        if document.employee_id != employee.pk:
            document.employee = employee
            document.save(update_fields=['employee'])
        return

    with offer.offer_letter.open('rb') as source:
        pdf_bytes = source.read()
    document = EmployeeDocument(
        employee=employee,
        document_type='OFFER_LETTER',
        document_name=f'Offer Letter - {offer.application.requisition.requisition_number}',
        file_size_kb=round(len(pdf_bytes) / 1024),
        mime_type='application/pdf',
        uploaded_by=uploaded_by or offer.created_by,
    )
    filename = f'Offer_{offer.application.requisition.requisition_number}_{offer.pk.hex[:8]}.pdf'
    document.file_path.save(filename, ContentFile(pdf_bytes), save=True)
    offer.employee = employee
    offer.employee_document = document
    offer.save(update_fields=['employee', 'employee_document', 'updated_at'])


def deliver_accepted_offer_letter(offer, uploaded_by=None, force_resend=False):
    """Generate and email the formal PDF after acceptance; retain errors for HR retry."""
    if offer.status != 'ACCEPTED':
        raise ValueError('The formal offer letter is delivered only after the candidate accepts.')
    if offer.offer_letter_sent_at and not force_resend:
        return True, ''
    try:
        if not offer.offer_letter:
            pdf_bytes = generate_recruitment_offer_pdf(offer)
            filename = f'Offer_{offer.application.requisition.requisition_number}_{offer.pk.hex[:8]}.pdf'
            offer.offer_letter.save(filename, ContentFile(pdf_bytes), save=False)
            offer.save(update_fields=['offer_letter', 'updated_at'])
        _attach_offer_letter_to_employee(offer, uploaded_by=uploaded_by)
        with offer.offer_letter.open('rb') as source:
            pdf_bytes = source.read()
        filename = f'Offer_{offer.application.requisition.requisition_number}_{offer.pk.hex[:8]}.pdf'
        if settings.EMAIL_BACKEND.endswith('console.EmailBackend'):
            raise RuntimeError('The configured email backend is the console backend. The message is printed in the backend terminal, not delivered to the candidate. Configure SMTP in backend environment settings and retry.')
        email = EmailMultiAlternatives(
            subject=f'{get_company()["name"]} - Your formal offer letter',
            body=(
                f"Hello {offer.application.candidate.full_name},\n\n"
                f"Congratulations. Please find attached your formal offer letter for "
                f"the {offer.application.requisition.position.title} position.\n\n"
                'Regards,\nHuman Resources'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[offer.application.candidate.email],
        )
        email.attach(filename, pdf_bytes, 'application/pdf')
        if not email.send(fail_silently=False):
            raise RuntimeError('The formal offer letter email was not accepted by the configured email backend.')
        offer.offer_letter_sent_at = timezone.now()
        offer.offer_letter_error = ''
        offer.save(update_fields=['offer_letter_sent_at', 'offer_letter_error', 'updated_at'])
        return True, ''
    except Exception as exc:
        offer.offer_letter_error = str(exc)[:4000]
        offer.save(update_fields=['offer_letter_error', 'updated_at'])
        return False, offer.offer_letter_error


def link_accepted_offer_to_employee(offer, employee, uploaded_by=None):
    if offer.status != 'ACCEPTED':
        raise ValueError('Only an accepted offer can be linked to an employee profile.')
    offer.employee = employee
    offer.save(update_fields=['employee', 'updated_at'])
    _attach_offer_letter_to_employee(offer, uploaded_by=uploaded_by)
