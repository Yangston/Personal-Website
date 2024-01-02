from datetime import datetime

from django.http import HttpResponse
from django.shortcuts import render
from .models import Visit


def index(request):
    visits = Visit.objects.all()
    if visits.exists():
        visit = visits.first()
        visit.count += 1
        visit.save()
    else:
        visit = Visit.objects.create()
    return render(request, 'main.html', {"visit": visit})
