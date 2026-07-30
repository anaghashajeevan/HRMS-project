"""
WhatsApp service with fallback support.
- Primary: connected WhatsApp session via gateway
- Fallback: static phone number in .env — receives alerts if primary fails
"""

import logging
import re
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _clean_phone_number(phone: str) -> str:
    if not phone:
        return ''
    digits = re.sub(r'\D', '', phone)
    if not digits:
        return ''
    if digits.startswith('0'):
        digits = digits[1:]
    default_cc = getattr(settings, 'WHATSAPP_DEFAULT_COUNTRY_CODE', '91')
    if len(digits) == 10:
        digits = f"{default_cc}{digits}"
    return digits


def is_whatsapp_enabled() -> bool:
    return bool(
        getattr(settings, 'WHATSAPP_ENABLED', False)
        and getattr(settings, 'WHATSAPP_GATEWAY_BASE_URL', '')
    )


def get_fallback_phone() -> str:
    """Get fallback phone from .env."""
    return getattr(settings, 'WHATSAPP_FALLBACK_PHONE', '') or ''


def _url(endpoint: str) -> str:
    base = settings.WHATSAPP_GATEWAY_BASE_URL.rstrip('/')
    return f"{base}{endpoint}"


# ==============================================================================
# GATEWAY STATUS & SESSION MANAGEMENT
# ==============================================================================

def get_gateway_status() -> dict:
    """Get overall gateway + session status."""
    try:
        response = requests.get(_url('/api/status'), timeout=10)
        data = response.json()
        # Add fallback info
        data['fallback_phone'] = get_fallback_phone()
        data['fallback_configured'] = bool(get_fallback_phone())
        return data
    except requests.exceptions.ConnectionError:
        return {
            'gateway_online': False,
            'connected': False,
            'fallback_phone': get_fallback_phone(),
            'fallback_configured': bool(get_fallback_phone()),
            'error': 'Gateway not reachable. Is node server.js running?',
        }
    except Exception as exc:
        return {'gateway_online': False, 'error': str(exc)}


def get_qr_code() -> dict:
    """Get QR code data URL from gateway."""
    try:
        response = requests.get(_url('/api/qr'), timeout=10)
        return response.json()
    except Exception as exc:
        return {'error': str(exc), 'has_qr': False}


def connect_whatsapp() -> dict:
    """Start WhatsApp connection (needs QR scan)."""
    try:
        response = requests.post(_url('/api/connect'), timeout=10)
        return response.json()
    except Exception as exc:
        return {'success': False, 'error': str(exc)}


def disconnect_whatsapp() -> dict:
    """Disconnect WhatsApp (deletes auth)."""
    try:
        response = requests.post(_url('/api/disconnect'), timeout=10)
        return response.json()
    except Exception as exc:
        return {'success': False, 'error': str(exc)}


# ==============================================================================
# SEND MESSAGE (with fallback logic)
# ==============================================================================

def _send_direct(to_phone: str, message: str) -> dict:
    """Send message directly via gateway (no fallback)."""
    if not is_whatsapp_enabled():
        return {'success': False, 'error': 'WhatsApp not enabled'}
    
    cleaned = _clean_phone_number(to_phone)
    if not cleaned:
        return {'success': False, 'error': f'Invalid phone: {to_phone}'}
    
    try:
        response = requests.post(
            _url('/api/sendMessage'),
            json={'phone': cleaned, 'message': message},
            timeout=20,
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                'success': True,
                'message_id': data.get('messageId', ''),
                'to': cleaned,
            }
        
        error_data = response.json() if response.text else {}
        return {
            'success': False,
            'error': error_data.get('error', f'HTTP {response.status_code}'),
        }
    
    except requests.exceptions.ConnectionError:
        return {'success': False, 'error': 'Gateway not reachable'}
    except Exception as exc:
        return {'success': False, 'error': str(exc)}


def send_whatsapp_message(to_phone: str, message: str, allow_fallback: bool = True) -> dict:
    """
    Send WhatsApp message with fallback support.
    
    Flow:
    1. Try to send to `to_phone` via primary WhatsApp
    2. If fails AND allow_fallback → send to WHATSAPP_FALLBACK_PHONE
    3. Fallback message includes info about who it was originally meant for
    
    Args:
        to_phone: Recipient phone
        message: Message text
        allow_fallback: Whether to use fallback on failure (default: True)
    
    Returns:
        {
            'success': bool,
            'message_id': str,
            'to': str,
            'sent_via': 'primary' | 'fallback',
            'fallback_used': bool,
            'original_error': str (if fallback used),
        }
    """
    # First attempt — primary
    primary_result = _send_direct(to_phone, message)
    
    if primary_result.get('success'):
        logger.info(f"✅ WhatsApp sent to {to_phone} via PRIMARY")
        return {
            **primary_result,
            'sent_via': 'primary',
            'fallback_used': False,
        }
    
    # Primary failed
    primary_error = primary_result.get('error', 'Unknown error')
    logger.warning(f"⚠️ Primary WhatsApp failed for {to_phone}: {primary_error}")
    
    # Try fallback if enabled + configured
    fallback_phone = get_fallback_phone()
    
    if not allow_fallback:
        return primary_result
    
    if not fallback_phone:
        logger.warning("No fallback phone configured — message lost")
        return {
            **primary_result,
            'sent_via': 'primary',
            'fallback_used': False,
            'fallback_reason': 'not_configured',
        }
    
    # Build fallback message with context
    fallback_message = (
        f"⚠️ *WhatsApp Fallback Alert*\n\n"
        f"Primary WhatsApp couldn't reach the intended recipient.\n\n"
        f"📱 *Intended for:* {_clean_phone_number(to_phone)}\n"
        f"❌ *Error:* {primary_error[:150]}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"*Original Message:*\n\n"
        f"{message}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n\n"
        f"_Please forward this to the intended recipient or fix the WhatsApp connection._"
    )
    
    fallback_result = _send_direct(fallback_phone, fallback_message)
    
    if fallback_result.get('success'):
        logger.info(f"✅ WhatsApp sent to FALLBACK {fallback_phone} (primary failed)")
        return {
            'success': True,
            'message_id': fallback_result.get('message_id', ''),
            'to': fallback_phone,
            'sent_via': 'fallback',
            'fallback_used': True,
            'original_recipient': to_phone,
            'original_error': primary_error,
        }
    
    # Both failed
    logger.error(f"❌ BOTH primary AND fallback failed")
    return {
        'success': False,
        'error': f'Primary: {primary_error} | Fallback: {fallback_result.get("error")}',
        'sent_via': None,
        'fallback_used': True,
        'fallback_failed': True,
    }


# ==============================================================================
# LEAVE-SPECIFIC MESSAGES
# ==============================================================================

def send_leave_approval_request_whatsapp(application, approver):
    """WhatsApp approver about pending leave. Fallback to admin if fails."""
    if not approver.phone_number:
        # No phone — send to fallback directly
        fallback = get_fallback_phone()
        if fallback:
            msg = (
                f"⚠️ *No Phone Number Alert*\n\n"
                f"Leave approver *{approver.full_name}* has no phone number.\n\n"
                f"Employee *{application.employee.full_name}* applied for "
                f"{application.leave_type.name}\n"
                f"Please notify {approver.full_name} manually.\n\n"
                f"_Ref: {application.application_number}_"
            )
            return _send_direct(fallback, msg)
        return {'success': False, 'error': 'Approver has no phone number'}
    
    portal_url = getattr(settings, 'PORTAL_URL', 'http://localhost:5173')
    
    message = (
        f"📋 *Leave Approval Required*\n\n"
        f"Hi {approver.full_name},\n\n"
        f"*{application.employee.full_name}* ({application.employee.employee_id}) "
        f"has applied for leave:\n\n"
        f"📌 *Leave Type:* {application.leave_type.name}\n"
        f"📅 *From:* {application.start_date.strftime('%d %b %Y')}\n"
        f"📅 *To:* {application.end_date.strftime('%d %b %Y')}\n"
        f"⏱ *Duration:* {application.total_days} day(s)\n"
    )
    
    if application.is_half_day:
        message += f"🕐 *Half Day:* {application.get_half_day_period_display()}\n"
    
    message += f"\n📝 *Reason:* {application.reason[:150]}\n"
    
    if application.handover_to:
        message += f"🤝 *Handover To:* {application.handover_to.full_name}\n"
    
    if application.is_lop:
        message += f"\n⚠️ *Note:* {application.lop_days} day(s) LOP\n"
    
    message += (
        f"\n👉 Review & approve:\n{portal_url}/leave/approvals\n\n"
        f"_Ref: {application.application_number}_"
    )
    
    return send_whatsapp_message(approver.phone_number, message)


def send_leave_approved_whatsapp(application, approver):
    """WhatsApp employee about approval."""
    if not application.employee.phone_number:
        return {'success': False, 'error': 'Employee has no phone number'}
    
    message = (
        f"✅ *Leave Approved!*\n\n"
        f"Hi {application.employee.full_name},\n\n"
        f"Your leave has been *approved*.\n\n"
        f"📌 *Type:* {application.leave_type.name}\n"
        f"📅 *From:* {application.start_date.strftime('%d %b %Y')}\n"
        f"📅 *To:* {application.end_date.strftime('%d %b %Y')}\n"
        f"⏱ *Duration:* {application.total_days} day(s)\n"
        f"👤 *Approved By:* {approver.full_name}\n"
        f"\n_Ref: {application.application_number}_\n"
        f"_Enjoy your time off! 😊_"
    )
    
    return send_whatsapp_message(application.employee.phone_number, message)


def send_leave_rejected_whatsapp(application, rejector, reason):
    """WhatsApp employee about rejection."""
    if not application.employee.phone_number:
        return {'success': False, 'error': 'Employee has no phone number'}
    
    message = (
        f"❌ *Leave Rejected*\n\n"
        f"Hi {application.employee.full_name},\n\n"
        f"Your leave request has been rejected.\n\n"
        f"📌 *Type:* {application.leave_type.name}\n"
        f"📅 *From:* {application.start_date.strftime('%d %b %Y')}\n"
        f"📅 *To:* {application.end_date.strftime('%d %b %Y')}\n"
        f"👤 *Rejected By:* {rejector.full_name}\n"
        f"\n📝 *Reason:* {reason[:200]}\n"
        f"\n_Ref: {application.application_number}_"
    )
    
    return send_whatsapp_message(application.employee.phone_number, message)