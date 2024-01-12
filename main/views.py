from datetime import datetime

from django.http import HttpResponse, FileResponse, Http404
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


# def view_resume(request):
#     try:
#         return FileResponse(open('global_static/pdf/Stone_Yang_Resume.pdf', 'rb'), content_type='application/pdf')
#     except FileNotFoundError:
#         raise Http404()
