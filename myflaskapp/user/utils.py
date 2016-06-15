from flask_script import Command, Manager, Option
from myflaskapp.extensions import login_manager, bcrypt
from myflaskapp.user.models import User, AddressEntry, AddressDistance
from myflaskapp.database import db
from sqlalchemy import not_
import mapbox
import json
import uuid
import logging
import datetime

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

@login_manager.user_loader
def load_user(user_id):
    """Load user by ID."""
    return User.get_by_id(int(user_id))

class CrossReferenceAndBuildCrossLinks(Command):
    """
    ./manage.py seed_database && ./manage.py link_dataset
    """
    def run(self, filepath=None):
        '''
        logically wrong
        '''
        pass
        # for address in AddressEntry.query.all():
        #     origin = {
        #         'type': 'Feature',
        #         'properties': {'name': address.name},
        #         'geometry': {
        #             'type': 'Point',
        #             'coordinates': [float(address.longitude), float(address.latitude)]
        #         }
        #     }
        #     for sub_address in AddressEntry.query.filter(not_(AddressEntry.id==address.id)):
        #         # mapbox wants lat/long for the distance calculation; oppisite of the geocoding api.
        #         destination = {
        #             'type': 'Feature',
        #             'properties': {'name': sub_address.name},
        #             'geometry': {
        #                 'type': 'Point',
        #                 'coordinates': [float(sub_address.longitude), float(sub_address.latitude)],
        #             }
        #         }
        #         content = mapbox.Directions().directions([origin, destination],'mapbox.driving').geojson()
        #         address_distance = AddressDistance()
        #         address_distance.address_a_id = address.id
        #         address_distance.address_b_id = sub_address.id
        #         address_distance.mapbox_response = json.dumps(content)
        #         address_distance.speed_scala = sum([feature['properties']['distance'] for feature in content['features']])
        #         db_session = db.session()
        #         db_session.add(address_distance)
        #         db_session.commit()
        #         print("Likned %s to %s" % (address.name, sub_address.name))


class SeedDatabaseWithGEOJSONSeed(Command):
    """
    Example Usage:
      ./manage.py seed_database
    """
    # option_list += ()
    def run(self, filepath=None):
        addresses = {
            'rob': {
                'name': 'First test Location',
                'phone': '250-588-9595',
                'address': '3329 University Woods, Canada',
                'price': 12.35,
            },
            'rob2': {
                'name': 'Second test Location',
                'phone': '800 647 5463',
                'address': '3800 Finnerty Rd,  Canada',
                'price': 22.42,
            },
            'rob3': {
                'name': 'Third test Location',
                'phone': '202-426-6841',
                'address': '3440 Saanich Rd,  Canada',
                'price': 11.52,
            },
            'rob4': {
                'name': 'Fourth test Location',
                'phone': '202.334.6000',
                'address': '1150 Douglas St, Victoria, V8W3M9, Canada',
                'price': 16.65,
            },
            'rob5': {
                'name': 'Fifth test Location',
                'phone': '240-283-9942',
                'address': '3190 Shelbourne St, Victoria, V8T3A8, Canada',
                'price': 6.99,
            }
        }
        for username, address in addresses.items():
            address_entry = AddressEntry()
            address_entry.user_id = User.query.filter(User.username==username).first().id
            address_entry.name = address['name']
            address_entry.phone = address['phone']

            geocoder = mapbox.Geocoder()
            selected_feature = json.loads(geocoder.forward(address['address']).content.decode('utf-8'))['features'][0]
            address_entry.longitude = selected_feature['center'][0]
            address_entry.latitude = selected_feature['center'][1]
            address_entry.street_number = selected_feature['address']
            address_entry.street_name = selected_feature['text']
            address_entry.mapbox_place_name = selected_feature['place_name']
            for feature in selected_feature['context']:
                if feature['id'].startswith('place'):
                    address_entry.county = feature['text']

                if feature['id'].startswith('postcode'):
                    address_entry.postal_code = feature['text']

                if feature['id'].startswith('region'):
                    address_entry.state = feature['text']

                if feature['id'].startswith('country'):
                    address_entry.country = feature['text']

                if feature['id'].startswith('neighborhood'):
                    address_entry.neighborhood = feature['text']
            db_session = db.session()
            db_session.add(address_entry)
            db_session.commit()
            print("Created: %s" % address['name'])

        
class AddFlaskUser(Command):
    """
    Example Usage:
      ./manage.py add_user --email=test-map@test.io --username rob -p aoeu -n
      ./manage.py add_user --email=test2-map@test.io --username rob2 -p aoeu -n
      ./manage.py add_user --email=test3-map@test.io --username rob3 -p aoeu -n
      ./manage.py add_user --email=test4-map@test.io --username rob4 -p aoeu -n
      ./manage.py add_user --email=test5-map@test.io --username rob5 -p aoeu -n
    """
    option_list = (
        Option('--username', '-u', dest="username"),
        Option('--email', '-e', dest="email"),
        Option('--password', '-p', dest="password", default=None),
        Option('--new-password','-n', action="store_true", default=False),
    )
    def run(self, username, email, password, new_password, **options):
        if password is None:
            password = uuid.uuid4().__str__().replace('-','')
        logger.info("User created: %s, %s. With password: %s" % (username, email, password))
        query_set = User.query.filter(User.email==email)
        if query_set.count() is 0:
            user = User.create(username=username, email=email, password=password,
                active=True,
                first_name=options.get('firstname', email.split('@')[0]),
                last_name=options.get('lastname', email.split('@')[0]))
        else:
            if new_password is False:
                raise ValueError("User Exists")
            user = query_set.first()
            user.set_password(password)
            user.save()
            logger.info("User password renewed")

class CreateAdmin(Command):
    """creates the admin user"""
    def run(user):
        user = User.create(username="admin", email="admin@admin.com", password="admin",
            active=True,
            first_name="admin",
            last_name="admin",
            admin=True,
            confirmed=True,
            confirmed_on=datetime.datetime.now()
            )
        user.save()
