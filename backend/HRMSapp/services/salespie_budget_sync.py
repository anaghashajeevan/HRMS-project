"""Import monthly SalesPie budgets into employee monthly performance plans."""
from decimal import Decimal, InvalidOperation
import logging

import requests
from django.conf import settings
from django.db import transaction
from django.utils.dateparse import parse_date

from HRMSapp.models import Employee, MonthlyKRA, MonthlyKPI, MonthlyPerformancePlan


class SalesPieSyncError(Exception):
    pass


logger = logging.getLogger(__name__)


def _financial_year_api_value(value):
    """Convert HRMS FY forms (2026-27 or 2026-2027) to SalesPie YYYY-YYYY."""
    try:
        start, end = value.split('-', 1)
        start_year = int(start)
        end_year = int(end)
    except (AttributeError, TypeError, ValueError):
        raise SalesPieSyncError('financial_year must be in YYYY-YY or YYYY-YYYY format.')
    if len(start) == 4 and len(end) == 2:
        end_year += (start_year // 100) * 100
        if end_year <= start_year:
            end_year += 100
    if len(start) != 4 or end_year != start_year + 1:
        raise SalesPieSyncError('financial_year must identify one April-to-March year.')
    return f'{start_year}-{start_year + 1}'


def _fetch_rows(tenant_id, financial_year):
    base_url = str(getattr(settings, 'SALESPIE_BACKEND_URL', '') or '').rstrip('/')
    token = str(getattr(settings, 'HRMS_BUDGET_FEED_TOKEN', '') or '').strip()
    if not base_url or not token:
        raise SalesPieSyncError('SalesPie budget sync is not configured (URL or token missing).')
    url = f"{base_url}/{str(getattr(settings, 'SALESPIE_BUDGET_FEED_PATH', 'budgets/monthly/')).strip('/')}"
    try:
        response = requests.get(
            url,
            params={'tenant_company_id': tenant_id, 'financial_year': financial_year},
            headers={'X-HRMS-Budget-Token': token},
            timeout=settings.SALESPIE_BUDGET_TIMEOUT_SECONDS,
        )
        if not response.ok:
            upstream_detail = ''
            try:
                error_payload = response.json()
                if isinstance(error_payload, dict):
                    upstream_detail = str(error_payload.get('detail') or error_payload.get('error') or '')
            except ValueError:
                pass
            # Keep HTML debug pages and arbitrary upstream bodies out of the
            # API response; the SalesPie server log has the full traceback.
            if upstream_detail:
                detail = f' HTTP {response.status_code}: {upstream_detail[:500]}'
            else:
                detail = f' HTTP {response.status_code}; inspect SalesPie server logs for its traceback.'
            logger.error(
                'SalesPie budget feed failed (tenant=%s, status=%s, content_type=%s)',
                tenant_id, response.status_code, response.headers.get('Content-Type', ''),
            )
            raise SalesPieSyncError(f'Could not fetch SalesPie tenant {tenant_id}:{detail}')
        payload = response.json()
    except SalesPieSyncError:
        raise
    except (requests.RequestException, ValueError) as exc:
        raise SalesPieSyncError(f'Could not fetch SalesPie tenant {tenant_id}: {exc}') from exc
    rows = payload.get('results') if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise SalesPieSyncError(f'SalesPie tenant {tenant_id} returned an invalid response.')
    return rows


@transaction.atomic
def sync_salespie_budgets(financial_year):
    api_fy = _financial_year_api_value(financial_year)
    tenant_ids = settings.SALESPIE_BUDGET_TENANT_IDS
    if not tenant_ids:
        raise SalesPieSyncError('Configure SALESPIE_BUDGET_TENANT_IDS with one or more tenant IDs.')

    stats = {'tenants': list(tenant_ids), 'created': 0, 'updated': 0, 'skipped': 0, 'errors': []}
    for tenant_id in tenant_ids:
        for row in _fetch_rows(tenant_id, api_fy):
            employee_code = str(row.get('employee_id') or '').strip()
            external_id = str(row.get('external_id') or '').strip()
            try:
                month, year = int(row['month_number']), int(row['year'])
                target = Decimal(str(row['target_value']))
                if not employee_code or not external_id or not 1 <= month <= 12 or target < 0:
                    raise ValueError('missing identity or invalid month/target')
                if row.get('tenant_company_id') != tenant_id:
                    raise ValueError('tenant in row does not match requested tenant')
            except (KeyError, TypeError, ValueError, InvalidOperation) as exc:
                stats['errors'].append(f'Tenant {tenant_id}: invalid budget row ({exc}).')
                continue

            employee = Employee.objects.filter(employee_id__iexact=employee_code).select_related('department').first()
            if not employee or not employee.department or employee.department.name.strip().casefold() != 'sales':
                stats['skipped'] += 1
                continue
            plan = MonthlyPerformancePlan.objects.filter(
                annual_plan__employee=employee,
                annual_plan__financial_year=financial_year,
                year=year,
                month=month,
            ).first()
            if not plan:
                stats['skipped'] += 1
                continue

            start = parse_date(str(row.get('period_start') or '')) or plan.month_start_date
            end = parse_date(str(row.get('period_end') or '')) or plan.month_end_date
            title = str(row.get('kra_title') or f'Sales budget - {start:%B %Y}')[:200]
            currency = str(row.get('currency') or 'INR').strip().upper()
            line_items = row.get('line_items') or []
            description = f"Imported from SalesPie tenant {tenant_id}."
            if line_items:
                description += ' Items: ' + '; '.join(
                    f"{item.get('category', 'Budget')}"
                    f"{(' / ' + item['subcategory']) if item.get('subcategory') else ''}: {item.get('amount', '0')} {currency}"
                    for item in line_items if isinstance(item, dict)
                )

            kra = MonthlyKRA.objects.filter(external_source_id=external_id).first()
            created = kra is None
            if created:
                kra = MonthlyKRA(external_source_id=external_id)
            kra.monthly_plan = plan
            kra.kra_type = 'DEPARTMENTAL'
            kra.source_common_kra = None
            kra.source_dept_kra = None
            kra.name = title
            kra.description = description
            kra.weight = Decimal('0')
            kra.kra_start_date = start
            kra.kra_end_date = end
            kra.display_order = 900
            kra.save()

            kpi, _ = MonthlyKPI.objects.get_or_create(
                monthly_kra=kra,
                defaults={'name': f'Monthly sales budget ({currency})', 'metric_type': 'NUMERIC_UP', 'weight_in_kra': 100, 'target_value': str(target)},
            )
            kpi.name = f'Monthly sales budget ({currency})'
            kpi.metric_type = 'NUMERIC_UP'
            kpi.weight_in_kra = 100
            kpi.target_value = format(target, 'f')
            kpi.save()
            stats['created' if created else 'updated'] += 1
    return stats
