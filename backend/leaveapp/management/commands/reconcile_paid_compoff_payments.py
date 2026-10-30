from django.core.management.base import BaseCommand

from payrollapp.models import PayrollRun
from leaveapp.models import CompOffCreditLog
from leaveapp.services.compoff_payroll_service import _off_day_dates, post_paid_compoff_for_run


class Command(BaseCommand):
    help = 'Reconcile comp-off balances against already-paid regular payroll runs (dry-run unless --apply).'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Write balance postings and audit entries.')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        runs = PayrollRun.objects.filter(run_type='REGULAR', status='PAID').select_related('pay_calendar').order_by(
            'pay_calendar__period_start', 'created_at',
        )
        candidates = 0
        missing_snapshot = 0
        for run in runs:
            run_candidates = []
            for row in run.employees.filter(status='CALCULATED').select_related('employee'):
                dates = _off_day_dates(row)
                if not dates:
                    snapshot = row.input_snapshot or {}
                    if not ((snapshot.get('locked_inputs') or {}).get('day_data') or snapshot.get('day_data')):
                        missing_snapshot += 1
                    continue
                run_candidates.extend(CompOffCreditLog.objects.filter(
                    employee=row.employee, credit_date__in=dates, paid_in_payroll_run_id='',
                ))
            if not run_candidates:
                continue
            candidates += len(run_candidates)
            self.stdout.write(f'{run.pay_calendar}: {len(run_candidates)} comp-off credit(s) for {run_candidates[0].employee.full_name}')
            if apply_changes:
                result = post_paid_compoff_for_run(run)
                self.stdout.write(f"  Posted {result['posted_days']} days.")

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                f'Dry run: {candidates} credit(s) appear eligible. Use --apply to post them. '
                f'{missing_snapshot} employee row(s) had no frozen day map and were skipped.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Reconciliation complete. Processed {candidates} previously unpaid credit(s). '
                f'{missing_snapshot} employee row(s) had no frozen day map and were skipped.'
            ))
