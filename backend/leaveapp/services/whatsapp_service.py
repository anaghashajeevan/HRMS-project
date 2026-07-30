"""
WhatsApp service — communicates with Node.js gateway supporting multi-session.
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


def _url(endpoint: str) -> str:
    base = settings.WHATSAPP_GATEWAY_BASE_URL.rstrip('/')
    return f"{base}{endpoint}"


# ==============================================================================
# GATEWAY STATUS & SESSION MANAGEMENT
# ==============================================================================

def get_gateway_status() -> dict:
    """Get overall gateway status including primary + fallback sessions."""
    try:
        response = requests.get(_url('/api/status'), timeout=10)
        return response.json()
    except requests.exceptions.ConnectionError:
        return {
            'gateway_online': False,
            'connected': False,
            'error': 'Gateway not reachable. Is node server.js running?',
        }
    except Exception as exc:
        return {'gateway_online': False, 'error': str(exc)}


def get_session_qr(session_key: str = 'primary') -> dict:
    """Get QR code for a session (returns base64 data URL)."""
    try:
        response = requests.get(_url(f'/api/session/{session_key}/qr'), timeout=10)
        return response.json()
    except Exception as exc:
        return {'error': str(exc), 'has_qr': False}


def connect_session(session_key: str = 'primary') -> dict:
    """Start a session — call this then poll for QR."""
    try:
        response = requests.post(_url(f'/api/session/{session_key}/connect'), timeout=10)
        return response.json()
    except Exception as exc:
        return {'success': False, 'error': str(exc)}


def disconnect_session(session_key: str = 'primary') -> dict:
    """Disconnect a session (deletes auth)."""
    try:
        response = requests.post(_url(f'/api/session/{session_key}/disconnect'), timeout=10)
        return response.json()
    except Exception as exc:
        return {'success': False, 'error': str(exc)}


def switch_active_session(session_key: str) -> dict:
    """Switch which session is active for sending."""
    try:
        response = requests.post(
            _url('/api/session/switch'),
            json={'session': session_key},
            timeout=10,
        )
        return response.json()
    except Exception as exc:
        return {'success': False, 'error': str(exc)}


# ==============================================================================
# SEND MESSAGE
# ==============================================================================

def send_whatsapp_message(to_phone: str, message: str) -> dict:
    """Send WhatsApp message via active session."""
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
            logger.info(f"✅ WhatsApp sent to {cleaned} via {data.get('sent_via', 'unknown')}")
            return {
                'success': True,
                'message_id': data.get('messageId', ''),
                'to': cleaned,
                'sent_via': data.get('sent_via'),
            }
        
        error_data = response.json() if response.text else {}
        return {
            'success': False,
            'error': error_data.get('error', f'HTTP {response.status_code}'),
        }
    
    except requests.exceptions.ConnectionError:
        return {'success': False, 'error': 'Gateway not reachable'}
    except Exception as exc:
        logger.exception(f"WhatsApp send failed: {exc}")
        return {'success': False, 'error': str(exc)}


# ==============================================================================
# LEAVE-SPECIFIC MESSAGES (unchanged from before)
# ==============================================================================

def send_leave_approval_request_whatsapp(application, approver):
    if not approver.phone_number:
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