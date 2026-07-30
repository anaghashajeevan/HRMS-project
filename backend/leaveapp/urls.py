"""
Leave app URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import LeaveBalanceViewSet, LeaveTypeViewSet, HolidayViewSet,LeaveApplicationViewSet,AnnualCalendarViewSet, WhatsAppLogsView,WhatsAppGatewayStatusView,WhatsAppSessionQRView,WhatsAppSessionConnectView,WhatsAppSessionDisconnectView,WhatsAppSwitchSessionView,WhatsAppTestSendView,WhatsAppLogsView

router = DefaultRouter()
router.register(r'leave-types', LeaveTypeViewSet, basename='leave-types')
router.register(r'holidays', HolidayViewSet, basename='holidays')
router.register(r'leave-balances', LeaveBalanceViewSet, basename='leave-balances')
router.register(r'leave-applications', LeaveApplicationViewSet, basename='leave-applications')
router.register(r'annual-calendars', AnnualCalendarViewSet, basename='annual-calendars')

urlpatterns = [
    path('whatsapp/status/', WhatsAppGatewayStatusView.as_view(), name='whatsapp-status'),
    path('whatsapp/session/<str:session_key>/qr/', WhatsAppSessionQRView.as_view(), name='whatsapp-qr'),
    path('whatsapp/session/<str:session_key>/connect/', WhatsAppSessionConnectView.as_view(), name='whatsapp-connect'),
    path('whatsapp/session/<str:session_key>/disconnect/', WhatsAppSessionDisconnectView.as_view(), name='whatsapp-disconnect'),
    path('whatsapp/session/switch/', WhatsAppSwitchSessionView.as_view(), name='whatsapp-switch'),
    path('whatsapp/test/', WhatsAppTestSendView.as_view(), name='whatsapp-test'),
    path('whatsapp/logs/', WhatsAppLogsView.as_view(), name='whatsapp-logs'),
    path('', include(router.urls)),
]