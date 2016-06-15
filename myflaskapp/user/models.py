# -*- coding: utf-8 -*-
"""User models."""
import datetime as dt
import json
from sqlalchemy.sql import not_
from flask_login import UserMixin
from myflaskapp.database import Column, Model, SurrogatePK, db, reference_col, relationship
from myflaskapp.extensions import bcrypt
from marshmallow import Schema, fields, validate

class Role(SurrogatePK, Model):
    """A role for a user."""

    __tablename__ = 'roles'
    name = Column(db.String(80), unique=True, nullable=False)
    user_id = reference_col('users', nullable=True)
    user = relationship('User', backref='roles')

    def __init__(self, name, **kwargs):
        """Create instance."""
        db.Model.__init__(self, name=name, **kwargs)

    def __repr__(self):
        """Represent instance as a unique string."""
        return '<Role({name})>'.format(name=self.name)


class User(UserMixin, SurrogatePK, Model):
    """A user of the app."""

    __tablename__ = 'users'
    username = Column(db.String(80), unique=True, nullable=False)
    email = Column(db.String(80), unique=True, nullable=False)
    #: The hashed password
    password = Column(db.String(128), nullable=True)
    created_at = Column(db.DateTime, nullable=False, default=dt.datetime.utcnow)
    first_name = Column(db.String(30), nullable=True)
    last_name = Column(db.String(30), nullable=True)
    address = Column(db.String(50), nullable=True)
    active = Column(db.Boolean(), default=True)
    admin = db.Column(db.Boolean, nullable=False, default=False)
    confirmed = db.Column(db.Boolean, nullable=False, default=False)
    confirmed_on = db.Column(db.DateTime, nullable=True)
    is_banned = Column(db.Boolean(), default=False)
    spot_id = Column(db.String(50), nullable=True)
    dest_id = Column(db.String(50), nullable=True)
    place_id = Column(db.String(50), nullable=True)
    spot_avail = Column(db.Boolean(), default=False)

    def __init__(self, username, email, password=None, admin=False, confirmed_on=None, **kwargs):
        """Create instance."""
        db.Model.__init__(self, username=username, email=email, admin=admin, confirmed_on=confirmed_on, **kwargs)
        if password:
            self.set_password(password)
        else:
            self.password = None

    def set_password(self, password):
        """Set password."""
        self.password = bcrypt.generate_password_hash(password)

    def check_password(self, value):
        """Check password."""
        return bcrypt.check_password_hash(self.password, value)

    @property
    def full_name(self):
        """Full user name."""
        return '{0} {1}'.format(self.first_name, self.last_name)

    def __repr__(self):
        """Represent instance as a unique string."""
        return '<User({username!r})>'.format(username=self.username)


class AddressDistance(SurrogatePK, Model):
    __tablename__ =  'address_distance'
    address_a_id = Column(db.ForeignKey('address.id'), unique=False, nullable=False)
    address_b_id = Column(db.ForeignKey('address.id'), unique=False, nullable=False)
    mapbox_response = Column(db.Text, nullable=False)
    speed_scala = Column(db.Integer, nullable=True) # max_distance

    @classmethod
    def get_direction_pois(cls, a_id):
        pois = []
        for result in cls.query \
            .filter(cls.address_a_id==a_id).order_by(cls.speed_scala): 
            # check availability
            spot = AddressEntry.query.get(result.address_b_id)
            if spot.is_avail == False:
                continue

            pois.append({
                'address_a_id': AddressEntry.query.get(result.address_a_id).as_geojson(),
                'address_b_id': AddressEntry.query.get(result.address_b_id).as_geojson(),
                'mapbox_response': json.loads(result.mapbox_response),
                'speed_scala': result.speed_scala,
            })
        return pois

class AddressEntry(SurrogatePK, Model):
    __tablename__ = 'address'
    user_id = Column(db.ForeignKey('users.id'), unique=False, nullable=False) # Owner
    latitude = Column(db.String(80), unique=False, nullable=False)
    longitude = Column(db.String(80), unique=False, nullable=False)
    mapbox_place_name = Column(db.String(1024), unique=False, nullable=True)
    street_name = Column(db.Unicode(1024), unique=False, nullable=True)
    street_number = Column(db.Unicode(1024), unique=False, nullable=True)
    building_number = Column(db.Unicode(1024), unique=False, nullable=True)
    cross_street = Column(db.Unicode(1024), unique=False, nullable=True)
    suite_number = Column(db.Unicode(1024), unique=False, nullable=True)
    neighborhood = Column(db.Unicode(1024), unique=False, nullable=True) # mapbox.neighborhood
    district = Column(db.Unicode(1024), unique=False, nullable=True) # mapbox.place
    county = Column(db.Unicode(1024), unique=False, nullable=True)
    country = Column(db.Unicode(1024), unique=False, nullable=True) # mapbox.country
    provence = Column(db.Unicode(1024), unique=False, nullable=True)
    phone = Column(db.Unicode(10), unique=False, nullable=True)
    state = Column(db.Unicode(1024), unique=False, nullable=True) # mapbox.region
    postal_code = Column(db.Unicode(1024), unique=False, nullable=False) # mapbox.postcode
    name = Column(db.Unicode(1024), unique=False, nullable=True)
    details = Column(db.Text, unique=False, nullable=True)
    price = Column(db.Float, nullable=True)
    is_dest = Column(db.Boolean(), default=True)
    is_avail = Column(db.Boolean(), default=True)

    def format_phone(self, phone_raw):
        return phone_raw

    def as_geojson(self):
        return {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                # Mapbox geocoding api sends back lat long in the format of long/lat. This may have
                #  to be rendered differently for the inclusion in the mapbox map.
                'coordinates': [self.longitude, self.latitude], # match mapbox specification, t
            },
            'properties': {
                'p0': self.id,
                'p1': self.name,
                'p4': self.phone,
                'p5': ' '.join([self.street_number or '', self.street_name or '']),
                'p6': self.state,
                'p8': self.cross_street,
                'p9': self.price,
            }
        }

class AddressEntrySchema(Schema):

    not_blank = validate.Length(min=1, error='Field cannot be blank')
    latitude = fields.String(validate=not_blank, dump_only=True)
    longitude = fields.String(validate=not_blank, dump_only=True)
    is_avail = fields.Boolean(dump_only=True)

    class Meta:
        fields = ('latitude', 'longitude')
