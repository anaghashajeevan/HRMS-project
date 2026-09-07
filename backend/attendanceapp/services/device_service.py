"""
eSSL device helpers — single (BOTH) vs dual (IN + OUT).
Credentials always from AutomationSettings.
"""
from __future__ import annotations

from attendanceapp.models import AutomationSettings, EsslDevice


class DeviceConfigError(Exception):
    pass


def get_active_devices():
    return list(EsslDevice.objects.filter(is_active=True).order_by("role", "name"))


def get_device_mode(devices=None):
    """
    Multi-device mode:
      - "EMPTY"     : No active devices (fallback to .env)
      - "SINGLE"    : Exactly 1 active device (any role)
      - "MULTI"     : 2+ active devices (any combination)
    """
    devices = devices if devices is not None else get_active_devices()
    if not devices:
        return "EMPTY"
    if len(devices) == 1:
        return "SINGLE"
    return "MULTI"

def get_shared_credentials():
    """URL / user / password from AutomationSettings only."""
    s = AutomationSettings.get_solo()
    return {
        "api_url": s.essl_api_url,
        "username": s.api_username,
        "password": s.get_api_password(),
    }


def get_fetch_plan():
    """
    What to call on eSSL.
    Returns list of dicts: {device, role, serial, api_url, username, password}
    """
    devices = get_active_devices()
    mode = get_device_mode(devices)
    creds = get_shared_credentials()

    if mode == "EMPTY":
        # Legacy fallback: AutomationSettings.serial only
        s = AutomationSettings.get_solo()
        if not s.device_serial_number:
            return mode, []
        return "SINGLE", [
            {
                "device": None,
                "role": EsslDevice.ROLE_BOTH,
                "serial": s.device_serial_number,
                **creds,
            }
        ]

    if mode == "INVALID":
        raise DeviceConfigError(
            "Invalid device setup. Use one device with role Both, "
            "OR one Punch In + one Punch Out."
        )

    plan = []
    for d in devices:
        plan.append(
            {
                "device": d,
                "role": d.role,
                "serial": d.serial_number,
                **creds,
            }
        )
    return mode, plan