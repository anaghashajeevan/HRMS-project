from django.db import models

# Create your models here.
"""
Asset Management Models.
Tracks corporate hardware and equipment allocated to employees.
"""
import uuid
from django.db import models
from django.utils import timezone
from HRMSapp.models import Employee


# ==============================================================================
# ASSET CATEGORY
# ==============================================================================

class AssetCategory(models.Model):
    """Categories for corporate hardware (Laptops, Monitors, ID Cards, etc.)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    icon = models.CharField(
        max_length=50, default='package',
        help_text="Lucide icon name for UI (e.g., 'laptop', 'monitor', 'phone')"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'asset_categories'
        ordering = ['name']
        verbose_name_plural = 'Asset Categories'

    def __str__(self):
        return self.name


# ==============================================================================
# ASSET MASTER
# ==============================================================================

class Asset(models.Model):
    """Master registry of every trackable physical asset."""
    STATUS_CHOICES = [
        ('AVAILABLE', 'Available'),
        ('ALLOCATED', 'Allocated'),
        ('MAINTENANCE', 'Under Maintenance'),
        ('DISPOSED', 'Disposed / Written Off'),
    ]
    CONDITION_CHOICES = [
        ('NEW', 'New'),
        ('GOOD', 'Good'),
        ('FAIR', 'Fair'),
        ('POOR', 'Poor'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset_tag = models.CharField(
        max_length=50, unique=True,
        help_text="Internal tag/barcode (e.g. AST-LAP-001)"
    )
    name = models.CharField(max_length=150, help_text="e.g. MacBook Pro 16 Inch")
    category = models.ForeignKey(
        AssetCategory, on_delete=models.PROTECT, related_name='assets'
    )
    brand = models.CharField(max_length=50, blank=True, null=True)
    model_number = models.CharField(max_length=100, blank=True, null=True)
    serial_number = models.CharField(max_length=100, unique=True)

    # Financial details
    purchase_date = models.DateField(null=True, blank=True)
    purchase_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    vendor = models.CharField(max_length=100, blank=True, null=True)
    invoice_number = models.CharField(max_length=100, blank=True, null=True)
    warranty_expiry = models.DateField(null=True, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='AVAILABLE')
    condition = models.CharField(max_length=10, choices=CONDITION_CHOICES, default='NEW')
    condition_notes = models.TextField(blank=True, null=True)

    # Optional attachments
    image = models.ImageField(upload_to='assets/images/%Y/%m/', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )

    class Meta:
        db_table = 'assets'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['serial_number']),
            models.Index(fields=['asset_tag']),
            models.Index(fields=['status']),
            models.Index(fields=['category', 'status']),
        ]

    def __str__(self):
        return f"{self.asset_tag} - {self.name}"

    @property
    def is_allocated(self):
        return self.status == 'ALLOCATED'

    @property
    def current_allocation(self):
        return self.allocations.filter(status='ALLOCATED').first()

    @property
    def is_warranty_valid(self):
        if not self.warranty_expiry:
            return False
        return self.warranty_expiry >= timezone.now().date()


# ==============================================================================
# ASSET ALLOCATION
# ==============================================================================

class AssetAllocation(models.Model):
    """Records asset assignments to employees + full return history."""
    STATUS_CHOICES = [
        ('ALLOCATED', 'Allocated'),
        ('RETURNED', 'Returned'),
        ('DAMAGED', 'Damaged'),
        ('LOST', 'Lost / Stolen'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset = models.ForeignKey(
        Asset, on_delete=models.CASCADE, related_name='allocations'
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='asset_allocations'
    )

    allocated_date = models.DateField(default=timezone.now)
    expected_return_date = models.DateField(null=True, blank=True)
    returned_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ALLOCATED')

    # Handover notes
    handover_notes = models.TextField(
        blank=True, null=True,
        help_text="Notes at time of allocation (accessories, condition)"
    )
    return_notes = models.TextField(
        blank=True, null=True,
        help_text="Notes at time of return (condition, damages)"
    )

    # Optional recovery cost for damaged/lost items
    recovery_cost = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Amount to recover from employee (for damaged/lost items)"
    )

    allocated_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+'
    )
    returned_to = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'asset_allocations'
        ordering = ['-allocated_date']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['asset', 'status']),
            models.Index(fields=['status', '-allocated_date']),
        ]

    def __str__(self):
        return f"{self.asset.asset_tag} → {self.employee.full_name} ({self.get_status_display()})"

    @property
    def duration_days(self):
        end_date = self.returned_date or timezone.now().date()
        return (end_date - self.allocated_date).days