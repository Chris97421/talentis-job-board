from django.contrib import admin
from .models import User, Company, Category, Ad, Application, Message

# Register your models here.

for m in (User, Company, Category, Ad, Application, Message):
    admin.site.register(m)
