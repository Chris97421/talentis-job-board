from django.urls import path
from rest_framework.routers import SimpleRouter
from . import admin_api
from . import views

router = SimpleRouter(trailing_slash=False)
router.register("ads", views.AdViewSet, basename="ad")
router.register("admin/companies", admin_api.CompanyAdminViewSet, basename="admin-companies")
router.register("admin/categories", admin_api.CategoryAdminViewSet, basename="admin-categories")
router.register("admin/ads", admin_api.AdAdminViewSet, basename="admin-ads")
router.register("admin/applications", admin_api.ApplicationAdminViewSet, basename="admin-applications")
router.register("admin/messages", admin_api.MessageAdminViewSet, basename="admin-messages")
router.register("admin/users", admin_api.UserAdminViewSet, basename="admin-users")

urlpatterns = [
    path("applications/<int:pk>/cv", views.ApplicationCVView.as_view()),
    path("auth/register", views.RegisterView.as_view()),
    path("auth/login", views.LoginView.as_view()),          # URLs retourne du JSON
    path("auth/me", views.MeView.as_view()),
    path("auth/logout", views.LogoutView.as_view()),
    path("categories", views.CategoryListView.as_view()),
    path("ads/<int:ad_id>/apply", views.ApplyView.as_view()),
    path("recruiter/applications", views.RecruiterApplicationsView.as_view()),
    path("ads/<int:ad_id>/messages", views.MessageCreateView.as_view()),
    path("candidate/applications", views.CandidateApplicationsView.as_view()),
    path("candidate/applications/<int:pk>", views.CandidateApplicationDetailView.as_view()),
    path("applications/<int:pk>/status", views.UpdateApplicationStatusView.as_view()),
    path("messages/<int:pk>/read", views.MessageMarkReadView.as_view()),
    path("auth/forgot-password", views.ForgotPasswordView.as_view()),
    path("auth/reset-password", views.ResetPasswordView.as_view()),
    path("auth/password", views.ChangePasswordView.as_view()),
] + router.urls