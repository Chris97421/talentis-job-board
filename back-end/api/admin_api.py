from django.db.models import ProtectedError
from rest_framework import serializers, status, viewsets
from rest_framework.filters import SearchFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from .models import Ad, Application, Category, Company, Message, User


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "admin"


class AdminPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


def make_viewset(model_class):
    class Serializer(serializers.ModelSerializer):
        class Meta:
            model = model_class
            fields = "__all__"

    class ViewSet(viewsets.ModelViewSet):
        queryset = model_class.objects.all().order_by("id")
        serializer_class = Serializer
        permission_classes = [IsAdminRole]
        pagination_class = AdminPagination

        def destroy(self, request, *args, **kwargs):
            try:
                return super().destroy(request, *args, **kwargs)
            except ProtectedError:
                return Response(
                    {"detail": "Suppression impossible : des offres sont rattachées à cet élément."},
                    status=status.HTTP_409_CONFLICT,
                )

    return ViewSet


class CompanyAdminViewSet(make_viewset(Company)):
    filter_backends = [SearchFilter]
    search_fields = ["name", "city", "postal_code"]

CategoryAdminViewSet = make_viewset(Category)
AdAdminViewSet = make_viewset(Ad)
ApplicationAdminViewSet = make_viewset(Application)
MessageAdminViewSet = make_viewset(Message)


class UserAdminSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=12)

    class Meta:
        model = User
        fields = ["id", "email", "password", "first_name", "last_name", "telephone",
                  "role", "city", "postal_code", "company", "cv", "is_active",
                  "date_joined", "modified_at"]
        read_only_fields = ["cv", "date_joined", "modified_at"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user


class UserAdminViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserAdminSerializer
    permission_classes = [IsAdminRole]
    pagination_class = AdminPagination
    filter_backends = [SearchFilter]
    search_fields = ["email", "first_name", "last_name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)
        return queryset