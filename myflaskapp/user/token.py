# -*- coding: utf-8 -*-
import os, requests, jwt
from datetime import datetime, timedelta
from flask import Blueprint, flash, redirect, url_for, g, jsonify, request, make_response
from flask_login import current_user
from flask_restful import Resource, Api
from flask_mail import Message
from jwt import DecodeError, ExpiredSignature
from itsdangerous import URLSafeTimedSerializer
from myflaskapp.user.models import User
from myflaskapp.extensions import Mail, login_manager, bcrypt
from myflaskapp.settings import Config as config
from functools import wraps


mail = Mail()

# email confirmation at signup token and email

def generate_confirmation_token(email):
    serializer = URLSafeTimedSerializer(config.EMAIL_KEY)
    return serializer.dumps(email, salt=config.EMAIL_SALT)


def confirm_token(token, expiration=3600):
    serializer = URLSafeTimedSerializer(config.EMAIL_KEY)
    try:
        email = serializer.loads(
            token,
            salt=config.EMAIL_SALT,
            max_age=expiration
            )
    except:
        return False
    return email

#Send email using flask-mail
def send_email(to, subject, template):
    msg = Message(
        subject,
        recipients=[to],
        html=template,
        sender=''
    )
    mail.send(msg)

#Send email using Mailgun Api

def send_mailgun_email(to, subject, template):
    return requests.post(
        "https://api.mailgun.net/v3/app.parkable.ch/messages",
        auth=("api", "key-773add185ebcc24810d9b6bb3c2589bb"),
        data={"from": "Parkable <mailgun@app.parkable.ch>",
              "to": [to],
              "subject": subject,
              "html": template})

# email confirmation decorator for user views.

def check_confirmed(func):
    @wraps(func)
    def decorated_function(*args, **kwargs):
        if current_user.confirmed is False:
            """flash('Please confirm your account!', 'warning')
            remove this duplicate or remove the other one"""
            return redirect(url_for('public.unconfirmed'))
        return func(*args, **kwargs)

    return decorated_function

# api login token


def create_token(user):
    payload = {
        # subject
        'sub': user.id,
        #issued at
        'iat': datetime.utcnow(),
        #expiry
        'exp': datetime.utcnow() + timedelta(days=1)
    }

    token = jwt.encode(payload, config.API_SALT, algorithm='HS256')
    return token.decode('unicode_escape')


def parse_token(req):
    token = req.headers.get('Authorization').split()[1]
    return jwt.decode(token, config.API_SALT, algorithms=['HS256'])
