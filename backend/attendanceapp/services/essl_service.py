"""
eSSL device SOAP API service.
Handles fetching punch data from the biometric device.
"""

import logging
from datetime import datetime, time
from xml.etree import ElementTree
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from django.utils import timezone
import requests

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")


class EsslConfigurationError(Exception):
    pass


class EsslServiceError(Exception):
    pass


def _require(value, label):
    if not value:
        raise EsslConfigurationError(f"{label} is not configured.")
    return value


def build_soap_request_for_range(settings_obj, from_datetime, to_datetime):
    api_url = _require(settings_obj.essl_api_url, "eSSL API URL")
    serial_number = _require(settings_obj.device_serial_number, "Device Serial Number")
    username = _require(settings_obj.api_username, "API Username")
    password = _require(settings_obj.get_api_password(), "API Password")

    from_datetime_text = from_datetime.strftime("%Y-%m-%d %H:%M:%S")
    to_datetime_text = to_datetime.strftime("%Y-%m-%d %H:%M:%S")

    soap_body = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <FromDateTime>{from_datetime_text}</FromDateTime>
      <ToDateTime>{to_datetime_text}</ToDateTime>
      <SerialNumber>{escape(serial_number)}</SerialNumber>
      <UserName>{escape(username)}</UserName>
      <UserPassword>{escape(password)}</UserPassword>
      <strDataList></strDataList>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>"""

    headers = {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": '"http://tempuri.org/GetTransactionsLog"',
    }

    return api_url, soap_body, headers


def build_soap_request(settings_obj, report_date):
    return build_soap_request_for_range(
        settings_obj,
        datetime.combine(report_date, time.min),
        datetime.combine(report_date, time(23, 59, 59)),
    )


def call_essl_api_for_range(settings_obj, from_datetime, to_datetime):
    api_url, soap_body, headers = build_soap_request_for_range(
        settings_obj,
        from_datetime,
        to_datetime,
    )

    try:
        session = requests.Session()
        session.trust_env = False
        response = session.post(
            api_url,
            data=soap_body.encode("utf-8"),
            headers=headers,
            timeout=30,
            proxies={"http": None, "https": None},
        )
        response.raise_for_status()
    except requests.exceptions.Timeout as exc:
        logger.exception("eSSL API request timed out.")
        raise EsslServiceError("eSSL API request timed out.") from exc
    except requests.exceptions.ConnectionError as exc:
        logger.exception("Could not connect to the eSSL API server.")
        raise EsslServiceError("Could not connect to the eSSL API server.") from exc
    except requests.exceptions.RequestException as exc:
        logger.exception("eSSL API request failed.")
        raise EsslServiceError("eSSL API request failed.") from exc

    return response.text


def call_essl_api(settings_obj, report_date):
    return call_essl_api_for_range(
        settings_obj,
        datetime.combine(report_date, time.min),
        datetime.combine(report_date, time(23, 59, 59)),
    )


def extract_str_data_list(xml_text):
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError as exc:
        raise EsslServiceError("eSSL API returned invalid XML.") from exc

    result_text = ""
    str_data = ""

    for element in root.iter():
        if element.tag.endswith("GetTransactionsLogResult"):
            result_text = element.text or ""
        if element.tag.endswith("strDataList"):
            str_data = element.text or ""

    return result_text, str_data


def parse_punch_logs(str_data):
    logs = []
    for line in str_data.splitlines():
        line = line.strip()
        if not line:
            continue

        parts = line.split()
        if len(parts) < 3:
            continue

        punch_text = f"{parts[1]} {parts[2]}"
        try:
            punch_time = timezone.make_aware(
                datetime.strptime(punch_text, "%Y-%m-%d %H:%M:%S"),
                IST,
            )
        except ValueError:
            continue

        logs.append(
            {
                "employee_code": parts[0],
                "punch_time": punch_time,
                "raw_line": line,
            }
        )
    return logs


def test_connection(settings_obj):
    xml_text = call_essl_api(settings_obj, datetime.combine(datetime.today(), time.min).date())
    result_text, str_data = extract_str_data_list(xml_text)
    return {
        "result": result_text or "Connected",
        "log_count": len(parse_punch_logs(str_data)),
    }