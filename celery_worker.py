# -*- coding: utf-8 -*-
import os
from myflaskapp.app import celery, create_app
"""
start celery with:
	celery worker -A celery_worker.celery --loglevel=info
"""
app = create_app(os.getenv('FLASK_CONFIG'))
app.app_context().push()
