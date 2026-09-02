# # ==============================================================================
# # HRMS Backend — Django + Gunicorn
# # ==============================================================================

# # FROM python:3.11-slim
# FROM python:3.12-slim

# # ---- Environment ----
# ENV PYTHONDONTWRITEBYTECODE=1 \
#     PYTHONUNBUFFERED=1 \
#     PIP_NO_CACHE_DIR=1 \
#     PIP_DISABLE_PIP_VERSION_CHECK=1 \
#     RUNNING_IN_DOCKER=True

# # ---- System Dependencies ----
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     build-essential \
#     libpq-dev \
#     libmagic1 \
#     curl \
#     && rm -rf /var/lib/apt/lists/*

# # ---- Working Directory ----
# WORKDIR /app

# # ---- Install Python Dependencies (cached layer) ----
# COPY requirements.txt .
# RUN pip install --upgrade pip && pip install -r requirements.txt

# # ---- Copy Application Code ----
# COPY . .

# # ---- Create runtime directories ----
# RUN mkdir -p /app/staticfiles /app/media /app/logs

# # ---- Expose port ----
# EXPOSE 8000

# # ---- Start command (migrations + static + gunicorn in one line) ----
# CMD python manage.py migrate --noinput && \
#     python manage.py collectstatic --noinput --clear && \
#     gunicorn HRMS.wsgi:application \
#         --bind 0.0.0.0:8000 \
#         --workers 4 \
#         --threads 2 \
#         --timeout 120 \
#         --access-logfile - \
#         --error-logfile -



# ==============================================================================
# HRMS Backend — Django + Gunicorn + Celery
# ==============================================================================

FROM python:3.12-slim

# ---- Environment ----
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    RUNNING_IN_DOCKER=True

# ---- System Dependencies (Includes OCR & PDF tools) ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    curl \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# ---- Working Directory ----
WORKDIR /app

# ---- Install Python Dependencies (cached layer) ----
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# ---- Copy Application Code ----
COPY . .

# ---- Create runtime directories ----
RUN mkdir -p /app/staticfiles /app/media /app/logs

# ---- Expose port ----
EXPOSE 8000

# ---- Start command (migrations + static + gunicorn in one line) ----
CMD python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput --clear && \
    gunicorn HRMS.wsgi:application \
        --bind 0.0.0.0:8000 \
        --workers 4 \
        --threads 2 \
        --timeout 120 \
        --access-logfile - \
        --error-logfile -
