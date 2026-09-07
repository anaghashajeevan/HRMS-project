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
    Returns:
      - "SINGLE" : one BOTH device (or legacy fallback)
      - "DUAL"   : one PUNCH_IN + one PUNCH_OUT
      - "INVALID": any other combo
      - "EMPTY"  : no active devices
    """
    devices = devices if devices is not None else get_active_devices()
    if not devices:
        return "EMPTY"

    roles = [d.role for d in devices]
    both = [d for d in devices if d.role == EsslDevice.ROLE_BOTH]
    ins = [d for d in devices if d.role == EsslDevice.ROLE_PUNCH_IN]
    outs = [d for d in devices if d.role == EsslDevice.ROLE_PUNCH_OUT]

    if len(devices) == 1 and both:
        return "SINGLE"
    if len(ins) == 1 and len(outs) == 1 and not both:
        return "DUAL"
    return "INVALID"


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