from django.db import models
from django.utils import timezone


class Visit(models.Model):
    count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
