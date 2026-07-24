"""
Leave app URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import LeaveBalanceViewSet, LeaveTypeViewSet, HolidayViewSet,LeaveApplicationViewSet

router = DefaultRouter()
router.register(r'leave-types', LeaveTypeViewSet, basename='leave-types')
router.register(r'holidays', HolidayViewSet, basename='holidays')
router.register(r'leave-balances', LeaveBalanceViewSet, basename='leave-balances')
router.register(r'leave-applications', LeaveApplicationViewSet, basename='leave-applications')
urlpatterns = [
    path('', include(router.urls)),
]