# example/urls.py
from django.urls import path

from main.views import index
# from main.views import index, view_resume

app_name = "main"
urlpatterns = [
    path('', index, name="main"),
    # path('view_resume/', view_resume, name="view_resume")
]
