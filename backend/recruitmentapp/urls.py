from rest_framework.routers import DefaultRouter
from django.urls import include, path

from .views import (
    CandidateApplicationOptionsView, CandidateApplicationResumeView, CandidateApplicationsView, CandidateApplicationScreeningView,
    CandidateInterviewEvaluationView, CandidateInterviewOptionsView, CandidateInterviewsView, CandidateInterviewOutcomeView,
    HiringRequisitionViewSet, PositionOptionsView, ReplacementEmployeeOptionsView, RecruitmentSettingsView,
    RecruitmentStageViewSet, RecruitmentEmailTemplateViewSet,
    InterviewScorecardViewSet, OfferRuleViewSet,
    CandidateBackgroundChecksView, CandidateBackgroundCheckDetailView, CandidateReferenceCheckOutcomeView,
    CandidateOffersView, CandidateOfferApprovalView, CandidateOfferActionView,
    CandidateOfferOptionsView,
    CandidateOfferEmployeeLinkView, CandidateOfferLetterView,
)

router = DefaultRouter()
router.register('requisitions', HiringRequisitionViewSet, basename='hiring-requisition')
router.register('stages', RecruitmentStageViewSet, basename='recruitment-stage')
router.register('email-templates', RecruitmentEmailTemplateViewSet, basename='recruitment-email-template')
router.register('scorecards', InterviewScorecardViewSet, basename='interview-scorecard')
router.register('offer-rules', OfferRuleViewSet, basename='recruitment-offer-rule')

urlpatterns = [
    path('settings/', RecruitmentSettingsView.as_view(), name='recruitment-settings'),
    path('position-options/', PositionOptionsView.as_view(), name='recruitment-position-options'),
    path('replacement-employee-options/', ReplacementEmployeeOptionsView.as_view(), name='replacement-employee-options'),
    path('application-options/', CandidateApplicationOptionsView.as_view(), name='candidate-application-options'),
    path('applications/', CandidateApplicationsView.as_view(), name='candidate-applications'),
    path('applications/<uuid:pk>/screen/', CandidateApplicationScreeningView.as_view(), name='candidate-application-screening'),
    path('applications/<uuid:pk>/interview-outcome/', CandidateInterviewOutcomeView.as_view(), name='candidate-interview-outcome'),
    path('applications/<uuid:pk>/reference-check-outcome/', CandidateReferenceCheckOutcomeView.as_view(), name='candidate-reference-check-outcome'),
    path('applications/<uuid:pk>/resume/', CandidateApplicationResumeView.as_view(), name='candidate-application-resume'),
    path('interview-options/', CandidateInterviewOptionsView.as_view(), name='candidate-interview-options'),
    path('interviews/', CandidateInterviewsView.as_view(), name='candidate-interviews'),
    path('interviews/<uuid:pk>/evaluate/', CandidateInterviewEvaluationView.as_view(), name='candidate-interview-evaluation'),
    path('background-checks/', CandidateBackgroundChecksView.as_view(), name='candidate-background-checks'),
    path('background-checks/<uuid:pk>/', CandidateBackgroundCheckDetailView.as_view(), name='candidate-background-check-detail'),
    path('offers/', CandidateOffersView.as_view(), name='candidate-offers'),
    path('offer-options/', CandidateOfferOptionsView.as_view(), name='candidate-offer-options'),
    path('offers/<uuid:pk>/approve/', CandidateOfferApprovalView.as_view(), name='candidate-offer-approval'),
    path('offers/<uuid:pk>/employee/', CandidateOfferEmployeeLinkView.as_view(), name='candidate-offer-employee-link'),
    path('offers/<uuid:pk>/letter/', CandidateOfferLetterView.as_view(), name='candidate-offer-letter'),
    path('offers/<uuid:pk>/<str:action>/', CandidateOfferActionView.as_view(), name='candidate-offer-action'),
    path('', include(router.urls)),
]
