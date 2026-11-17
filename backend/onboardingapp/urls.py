from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import OnboardingCaseViewSet, OnboardingSetupOptionsView, OnboardingTaskViewSet, OnboardingTemplateViewSet

router = DefaultRouter()
router.register('templates', OnboardingTemplateViewSet, basename='onboarding-template')
router.register('cases', OnboardingCaseViewSet, basename='onboarding-case')
router.register('tasks', OnboardingTaskViewSet, basename='onboarding-task')

urlpatterns = router.urls
urlpatterns += [path('setup-options/', OnboardingSetupOptionsView.as_view(), name='onboarding-setup-options')]
