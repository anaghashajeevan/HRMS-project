"""
Celery application instance for HRMS project.
"""
import os
from celery import Celery
from celery.schedules import crontab

# Set default Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'HRMS.settings')

# Create Celery app
app = Celery('HRMS')

# Load settings from Django, using CELERY_ namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed apps (looks for tasks.py in each app)
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'sync-live-attendance-every-5-mins': {
        'task': 'attendanceapp.tasks.sync_live_attendance_task',
        'schedule': crontab(minute='*/5'),  # Runs every 5 minutes
    },
}

@app.task(bind=True)
def debug_task(self):
    """Test task to verify Celery is working."""
    print(f'Request: {self.request!r}')