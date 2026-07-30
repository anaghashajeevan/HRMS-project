
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import PolicyCategoryViewSet, PolicyViewSet, PolicyCommentViewSet

router = DefaultRouter()
router.register(r'categories', PolicyCategoryViewSet, basename='policy-categories')
router.register(r'policies', PolicyViewSet, basename='policies')
router.register(r'comments', PolicyCommentViewSet, basename='policy-comments')

urlpatterns = [
    path('', include(router.urls)),
]