import logging
from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)


@shared_task
def sync_live_attendance_task():
    """
    Celery task that runs every 5 minutes to pull punches from eSSL.
    """
    try:
        call_command('sync_live_attendance', days=2)
        logger.info("Celery: Sync live attendance task completed successfully.")
    except Exception as exc:
        logger.exception(f"Celery: Sync live attendance task failed: {exc}")