"""Quick test to verify ReportLab PDF works."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'HRMS.settings')
django.setup()

from HRMSapp.models import LifecycleChangeRequest
from HRMSapp.services.pdf_generator import generate_lifecycle_letter_pdf

# Get the latest approved request
req = LifecycleChangeRequest.objects.filter(
    letter_template__isnull=False
).order_by('-created_at').first()

if not req:
    print("❌ No lifecycle request with template found. Approve one first.")
else:
    print(f"Testing with request: {req.request_number}")
    try:
        pdf = generate_lifecycle_letter_pdf(req)
        with open('test_output.pdf', 'wb') as f:
            f.write(pdf)
        print(f"✅ Generated test_output.pdf ({len(pdf)} bytes)")
        print("👉 Open test_output.pdf to verify")
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()