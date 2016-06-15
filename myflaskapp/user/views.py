# -*- coding: utf-8 -*-
"""User views."""
import os, mapbox, json
import math
import stripe
from flask import Blueprint, Flask, render_template, \
    request, url_for, send_from_directory, redirect, session, g, flash, jsonify,\
    abort
from flask_login import login_required, current_user
from myflaskapp.user.models import User, AddressEntry, AddressDistance
from myflaskapp.extensions import celery
from myflaskapp.user.forms import EditForm, Update, AddressEntryForm, AddressEntryCommitForm
from myflaskapp.user.token import check_confirmed
from myflaskapp.database import db
from sqlalchemy.sql import not_

blueprint = Blueprint('user', __name__, url_prefix='/users', static_folder='../static')

@blueprint.before_request
def before_request():
    print(session)
    if 'user_id' in session:
        #print session['user_id']
        g.user = User.query.get(session['user_id'])
    #print current_user.is_authenticated
    g.user = current_user

#member login

@blueprint.route('/')
@login_required
@check_confirmed
def members():
    """List members."""
    g.user = User.query.get(session['user_id'])
    active_spots = AddressEntry.query.filter(AddressEntry.user_id==current_user.id, AddressEntry.is_avail==True, AddressEntry.is_dest==False).count()
    return render_template('users/members/members3.html', user=g.user.username, active_spots=active_spots)


#update user details

@blueprint.route('/update', methods=['GET','POST'])
@login_required
@check_confirmed
def update():
    form = Update()
    if request.method == 'POST':
        g.user = User.query.get(session['user_id'])
        g.user.username = request.form['username']
        g.user.email = request.form['email']
        db.session.add(g.user)
        db.session.commit()
        flash('User Details updated')
    return render_template('users/updateuserdetails.html', form=form)

# reset password

@blueprint.route('/resetpassword', methods=['GET','POST'] )
@login_required
@check_confirmed
def resetpassword():
    #if 'user_id' in session:
    form = EditForm()
    if request.method == 'POST':
        g.user = User.query.get(session['user_id'])
        if form.password.data == '':
            flash('invalid password')
        elif form.password.data == form.Retype_password.data:
            g.user.set_password(form.password.data)
            db.session.add(g.user)
            db.session.commit()
            flash('User password updated')
        else:
            flash('Check your password.')
    return render_template('users/resetpassword.html', form=form )


# display initial map with available parking

@blueprint.route('/parking')
@login_required
@check_confirmed
def index():
    # get coordinates of address from database
    return render_template('users/index.html')

# user rm single parking spot

@blueprint.route('/delete_spot', methods=["POST"])
@login_required
@check_confirmed
def delete_parking():
    spot_id = int(request.form.get('id'))
    if request.method == 'POST':
        spot = AddressEntry.query.get(spot_id)
        # delete relavant entries in distance table.
        AddressDistance.query.filter(AddressDistance.address_b_id==spot.id).delete()
        spot.delete()
        return 'success'

# user set individual parking spot availability

@blueprint.route('/set_avail', methods=["POST"])
@login_required
@check_confirmed
def set_avail():
    spot_id = int(request.form.get('id'))
    checked = request.form.get('checked') == 'true'
    if request.method == 'POST':
        spot = AddressEntry.query.get(spot_id)
        spot.is_avail = checked
        spot.save()
        return 'success'

# user update individual parking spot price

@blueprint.route('/update_price', methods=["POST"])
@login_required
@check_confirmed
def update_price():
    spot_id = int(request.form.get('id'))
    price = float(request.form.get('price'))
    if request.method == 'POST':
        spot = AddressEntry.query.get(spot_id)
        spot.price = price
        spot.save()
        return str(spot_id)

# user selecs parking spot to reserve

@blueprint.route('/parking_sale', methods=["GET"])
@login_required
@check_confirmed
def parking_sale():
    spot_id = int(request.args.get('id'))
    spot = AddressEntry.query.get(spot_id)

    return render_template('users/parking_sale.html', spot=spot)

# compiled list of users parking spots for sale

@celery.task
@blueprint.route('/selling', methods=("GET", "POST"))
@login_required
@check_confirmed
def sell_parking():
    if request.method == 'GET':
        spots = AddressEntry.query.filter(AddressEntry.user_id==current_user.id, AddressEntry.is_dest==False)
        return render_template('users/sell_parking.html', spots=spots)
    else:
        address_entry_form = AddressEntryForm()
        if address_entry_form.validate_on_submit():
            # Join the address fields into a single field.
            # 'address city state postal_code'
            lookup = ' '.join([address_entry_form.data['address'], 
                address_entry_form.data['city'],
                address_entry_form.data['state']])

            geocoder = mapbox.Geocoder()
            features = json.loads(geocoder.forward(lookup).content.decode('utf-8'))['features']
            features = [ feature for feature in features if ('address' in feature) ]
            # Storage Convenience
            session['_price'] = address_entry_form.data.get('price', None) 
            if address_entry_form.data.get('form_state', None) == 'validation':
                # Store the features in the session based off feature['id'].
                session['_geocoded_values'] = json.dumps({feature['id']:feature for feature in features })
                return jsonify({'features': features})
            else:
                abort(400) # Probably trying to do something nasty.

            address_entry_form = None

        # Frame Three Logic
        address_entry_commit_form = AddressEntryCommitForm()
        if address_entry_commit_form.validate_on_submit():
            address_entry = AddressEntry()

            if address_entry_commit_form.data.get('form_state', None) == 'commit':
                address_entry.user_id = current_user.id
                address_entry.is_dest = False
                address_entry.is_avail = True

                address_entry.price = session['_price']
                del session['_price']

                selected_feature = json.loads(session['_geocoded_values'])[address_entry_commit_form.data['picked']]            
                del session['_geocoded_values'] # Clean up the session
                address_entry.longitude = selected_feature['center'][0]
                address_entry.latitude = selected_feature['center'][1]
                address_entry.street_number = selected_feature['address']
                address_entry.street_name = selected_feature['text']
                address_entry.mapbox_place_name = selected_feature['place_name']

                # address_entry.name = data.get('name')
                # Generate a dict from
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

                origin = {
                    'type': 'Feature',
                    'properties': {'name': address_entry.street_name},
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [float(address_entry.longitude), float(address_entry.latitude)]
                    }
                }

                # just for the destinations within the threshold (20Km), create the distance from the new spot
                for sub_address in AddressEntry.query.filter(AddressEntry.is_dest==True, AddressEntry.is_avail==True):
                    distance = get_straight_distance(float(address_entry.latitude), float(address_entry.longitude), float(sub_address.latitude), float(sub_address.longitude))
                    if distance > 20000:
                        continue

                    address_distance = AddressDistance()

                    destination = {
                        'type': 'Feature',
                        'properties': {'name': sub_address.street_name},
                        'geometry': {
                            'type': 'Point',
                            'coordinates': [float(sub_address.longitude), float(sub_address.latitude)],
                        }
                    }

                    content = mapbox.Directions().directions([origin, destination],'mapbox.driving').geojson()
                    address_distance.address_a_id = sub_address.id      # destination
                    address_distance.address_b_id = address_entry.id    # parking spot
                    address_distance.mapbox_response = json.dumps(content)
                    address_distance.speed_scala = sum([feature['properties']['distance'] for feature in content['features']])
                    db_session = db.session()
                    db_session.add(address_distance)
                    db_session.commit()
                return 'success'

def _update_users_address():
    # Frame Two Logic
    address_entry_form = AddressEntryForm()
    if address_entry_form.validate_on_submit():
        # Join the address fields into a single field.
        # 'address city state postal_code'
        lookup = ','.join([address_entry_form.data['address'], 
            address_entry_form.data['city'],
            address_entry_form.data['state'], 
            address_entry_form.data['postal_code']])

        geocoder = mapbox.Geocoder()
        features = json.loads(geocoder.forward(lookup).content.decode('utf-8'))['features']
        features = [ feature for feature in features if ('address' in feature) ]
        # Storage Convenience
        session['_phone'] = address_entry_form.data.get('phone', None) 
        session['_building_name'] = address_entry_form.data.get('building_name', None)
        if address_entry_form.data.get('form_state', None) == 'validation':
            # Store the features in the session based off feature['id'].
            session['_geocoded_values'] = json.dumps({feature['id']:feature for feature in features })
            return jsonify({'features': features})
        else:
            abort(400) # Probably trying to do something nasty.

        address_entry_form = None

    # Frame Three Logic
    address_entry_commit_form = AddressEntryCommitForm()
    if address_entry_commit_form.validate_on_submit():
        query_set = AddressEntry.query.filter(AddressEntry.user_id==current_user.id)
        if query_set.count() == 0:
            address_entry = AddressEntry()
        else:
            address_entry = query_set.first()

        if address_entry_commit_form.data.get('form_state', None) == 'commit':
            address_entry.user_id = current_user.id
            address_entry.is_dest = True
            address_entry.is_avail = True

            address_entry.name = session['_building_name']
            address_entry.phone = session['_phone']
            del session['_building_name'] # Cleanup the session
            del session['_phone'] # Cleanup the session
            # https://www.mapbox.com/help/define-lat-lon/
            # Sometimes mapbox returns long/lat or lat/long. With the Geocoding API, it seems
            #  long/lat is the format. 
            # With that, make sure you double check the projections. Google will return a long in the 
            #  positive specturm while mapbox will return a long in the negative spectrum. Not a problem technically, 
            #  but this very question breeds hours of googling to understand the contextual differences between map
            #  providers.
            #  https://en.wikipedia.org/wiki/Map_projection
            #  https://www.mapbox.com/tilemill/docs/manual/basics/
            #  There is even some drama with the Google projections. epsg3857 and 900913 should be the same thing;
            #   but are very different when it comes to the specification. It's fun to read about. :)
            #  http://gis.stackexchange.com/questions/50347/which-is-correct-projection-in-arcgis-server-for-epsg3857-900913
            selected_feature = json.loads(session['_geocoded_values'])[address_entry_commit_form.data['picked']]            
            del session['_geocoded_values'] # Clean up the session
            address_entry.longitude = selected_feature['center'][0]
            address_entry.latitude = selected_feature['center'][1]
            address_entry.street_number = selected_feature['address']
            address_entry.street_name = selected_feature['text']
            address_entry.mapbox_place_name = selected_feature['place_name']

            # address_entry.name = data.get('name')
            # Generate a dict from
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

            origin = {
                'type': 'Feature',
                'properties': {'name': address_entry.name},
                'geometry': {
                    'type': 'Point',
                    'coordinates': [float(address_entry.longitude), float(address_entry.latitude)]
                }
            }

            # just for the parking spots within the threshold (20Km), create/update the distance from the destination
            for sub_address in AddressEntry.query.filter(AddressEntry.is_dest==False, AddressEntry.is_avail==True):
                distance = get_straight_distance(float(address_entry.latitude), float(address_entry.longitude), float(sub_address.latitude), float(sub_address.longitude))
                if distance > 20000:
                    continue

                query_set = AddressDistance.query.filter(AddressDistance.address_a_id==address_entry.id, AddressDistance.address_b_id==sub_address.id)
                if query_set.count() == 0:
                    address_distance = AddressDistance()
                else:
                    address_distance = query_set.first()

                destination = {
                    'type': 'Feature',
                    'properties': {'name': sub_address.name},
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [float(sub_address.longitude), float(sub_address.latitude)],
                    }
                }

                content = mapbox.Directions().directions([origin, destination],'mapbox.driving').geojson()
                address_distance.address_a_id = address_entry.id
                address_distance.address_b_id = sub_address.id
                address_distance.mapbox_response = json.dumps(content)
                address_distance.speed_scala = sum([feature['properties']['distance'] for feature in content['features']])
                db_session = db.session()
                db_session.add(address_distance)
                db_session.commit()

    return jsonify({
        'waypoints': AddressDistance.get_direction_pois(address_entry.id),
        'origin': address_entry.as_geojson(),
    })

@blueprint.route('/parking/submit-address.json', methods=("GET", "POST"))
@login_required
@check_confirmed
def submit_address():
    # GET returns the logged in user's address.
    # POST updates the logged in user's address.
    #
    # Returns an object array of geo-json with a length of one.
    if request.method == 'GET':
        # If no address is saved for the current user, return an empty object.
        query_set = AddressEntry.query.filter(AddressEntry.user_id==current_user.id)
        if query_set.count() < 1:
            return jsonify({'waypoints': [], 'origin': {}, 'empty': True})

        # destination address
        address_entry = query_set.first()
        return jsonify({
            'waypoints': AddressDistance.get_direction_pois(address_entry.id),
            'origin': address_entry.as_geojson(),
        })

    if request.method == 'POST':
        return _update_users_address()

    return abort(500)


def get_straight_distance(lat1, lon1, lat2, lon2):
    '''
    calculate the distance between two gps positions (latitude, longitude)
    '''    
    R = 6371  # Radius of the earth in km
    dLat = math.radians(lat2-lat1)  # deg2rad below
    dLon = math.radians(lon2-lon1) 
    a = math.sin(dLat/2) * math.sin(dLat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2) * math.sin(dLon/2)
     
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a)) 
    return R * c * 1000 # Distance in m

#billing
#test card = 4242 4242 4242 4242, 10/2018, 123

stripe_keys = {
    'stripe_secret_key': 'sk_test_Lu2XXzNk4NTCpml4LTJeP9nv',
    'publishable_key': 'pk_test_LZD0hxNPL2niArcUwTE3GyDH'
}

stripe.api_key = stripe_keys['stripe_secret_key']


@blueprint.route('/charge_initial')
@login_required
@check_confirmed
def charge_initial():
    spot_id = int(request.args.get('id'))
    spot = AddressEntry.query.get(spot_id)
    return render_template('users/charge_initial.html', key=stripe_keys['publishable_key'], price=spot.price)


@blueprint.route('/charge', methods=['POST'])
@login_required
@check_confirmed
def charge():
    # Amount in cents
    amount = int(request.form.get('amount')[:-2])
    customer = stripe.Customer.create(
        email=request.form['stripeEmail'],
        card=request.form['stripeToken'],
    )
    try:
        charge = stripe.Charge.create(
            customer=customer.id,
            amount=amount,
            currency='usd',
            description='Parking Spot purchase'
        )
        pass

    except stripe.error.CardError as e:
        return """<html><body><h1>Card Declined</h1><p>Your chard could not
        be charged. Please check the number and/or contact your credit card
        company.</p></body></html>"""
    return render_template('users/charge.html', amount=amount)



