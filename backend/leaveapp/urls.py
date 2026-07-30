"""
Leave app URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (LeaveBalanceViewSet, LeaveTypeViewSet, HolidayViewSet,LeaveApplicationViewSet,AnnualCalendarViewSet,WhatsAppTestSendView,WhatsAppLogsView,WhatsAppStatusView,
    WhatsAppQRView,
    WhatsAppConnectView,
    WhatsAppDisconnectView,CompOffScanView, CompOffLogsView
   )

router = DefaultRouter()
router.register(r'leave-types', LeaveTypeViewSet, basename='leave-types')
router.register(r'holidays', HolidayViewSet, basename='holidays')
router.register(r'leave-balances', LeaveBalanceViewSet, basename='leave-balances')
router.register(r'leave-applications', LeaveApplicationViewSet, basename='leave-applications')
router.register(r'annual-calendars', AnnualCalendarViewSet, basename='annual-calendars')

urlpatterns = [
    path('whatsapp/status/', WhatsAppStatusView.as_view(), name='whatsapp-status'),
    path('whatsapp/qr/', WhatsAppQRView.as_view(), name='whatsapp-qr'),
    path('whatsapp/connect/', WhatsAppConnectView.as_view(), name='whatsapp-connect'),
    path('whatsapp/disconnect/', WhatsAppDisconnectView.as_view(), name='whatsapp-disconnect'),
    path('whatsapp/test/', WhatsAppTestSendView.as_view(), name='whatsapp-test'),
    path('whatsapp/logs/', WhatsAppLogsView.as_view(), name='whatsapp-logs'),
    path('compoff/scan/', CompOffScanView.as_view(), name='compoff-scan'),
    path('compoff/logs/', CompOffLogsView.as_view(), name='compoff-logs'),
    path('', include(router.urls)),
]