# -*- coding: utf-8 -*-
import os, jwt, flask_restful, pygeoip
from datetime import datetime, timedelta
from flask import Blueprint, flash, redirect, url_for, g, jsonify, request, make_response
from flask_cors import CORS, cross_origin
from flask_login import current_user
from flask_restful import Resource, Api
from jwt import DecodeError, ExpiredSignature
from itsdangerous import URLSafeTimedSerializer
from myflaskapp.user.models import User, AddressEntry, AddressEntrySchema
from myflaskapp.database import db
from myflaskapp.extensions import login_manager, bcrypt
from myflaskapp.settings import Config as config
from functools import wraps

blueprint = Blueprint('api', __name__)
cors = CORS(blueprint, resources={r"/api/*": {"origins": "127.0.0.1:5000/"}})


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

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.headers.get('Authorization'):
            response = jsonify(message='Missing authorization header')
            response.status_code = 401
            return response

        try:
            payload = parse_token(request)
        except DecodeError:
            response = jsonify(message='Token is invalid')
            response.status_code = 401
            return response
        except ExpiredSignature:
            response = jsonify(message='Token has expired')
            response.status_code = 401
            return response

        g.user_id = payload['sub']

        return f(*args, **kwargs)

    return decorated_function

# JWT auth process end

api = Api(blueprint)

class Auth(Resource):

    def post(self):
        data = request.get_json(force=True)
        print(data)
        username = data['username']
        password = data['password']
        user = User.query.filter_by(username=username).first()
        if user == None:
            response = make_response(
                jsonify({"message": "invalid username/password"}))
            response.status_code = 401
            return response
        if bcrypt.check_password_hash(user.password, password):

            token = create_token(user)
            return {'token': token}
        else:
            response = make_response(
                jsonify({"message": "invalid username/password"}))
            response.status_code = 401
            return response

api.add_resource(Auth, '/api/v1/login')


# Adding the login decorator to the Resource class
class Resource(flask_restful.Resource):
    method_decorators = [login_required]


# Any API class now inheriting the Resource class will need Authentication
class longlat(Resource):

    def get(self):
        schema = AddressEntrySchema()
        results = AddressEntry.query.filter_by(is_avail=True)
        longlat = schema.dump(results, many=True).data
        return jsonify({"longlat": longlat})


api.add_resource(longlat, '/api/v1/geojson')


class geoip(Resource):

    def get(self):
        maxmind_db_path = config.GEOIP_FILEPATH

        maxmind = pygeoip.GeoIP(maxmind_db_path, pygeoip.MEMORY_CACHE)
        geo_data = maxmind.record_by_addr(request.remote_addr)
        if geo_data == None:
            return jsonify({'error': 'Error finding GeoIP data for that address'})
        else:
            return jsonify(geo_data)


api.add_resource(geoip, '/api/v1/geoip')
