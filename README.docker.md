# HRMS — Docker Deployment Guide

## 📋 Prerequisites

- Docker Engine 24.0+
- Docker Compose 2.20+
- 4 GB RAM minimum
- 10 GB disk space

## ⚙️ Before Deployment — Update Secrets

Open `docker-compose.yml` and replace these values in **all services**:

| Placeholder | Change to |
|-------------|-----------|
| `django-insecure-CHANGE-THIS-...` | A strong 50+ character random string |
| `ChangeMe_StrongPassword_123!` | A strong database password |
| `DJANGO_ALLOWED_HOSTS` | Your actual domain(s) |
| `CORS_ALLOWED_ORIGINS` | Your frontend URL(s) |

**Generate a Django secret key:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"