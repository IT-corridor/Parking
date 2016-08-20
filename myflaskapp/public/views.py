# -*- coding: utf-8 -*-
"""Public section, including homepage and signup."""
from flask import Blueprint, flash, redirect, render_template, request, url_for, jsonify, session, g, abort
from flask_login import login_required, login_user, logout_user, current_user
from myflaskapp.database import db
from myflaskapp.extensions import login_manager, bcrypt, celery
from myflaskapp.public.forms import LoginForm
from myflaskapp.user.forms import RegisterForm, EditForm, Update
from myflaskapp.public.forms import Reset, Forgot
from myflaskapp.user.models import User
from myflaskapp.utils import flash_errors
from itsdangerous import URLSafeTimedSerializer
from myflaskapp.user.token import generate_confirmation_token, confirm_token, \
     send_email, send_mailgun_email, create_token, parse_token
import datetime


blueprint = Blueprint('public', __name__, static_folder='../static')
ts = URLSafeTimedSerializer('Secretfuckingkeyseverywhere')

@login_manager.user_loader
def load_user(user_id):
    """Load user by ID."""
    return User.get_by_id(int(user_id))


@blueprint.route('/', methods=['GET'])
def home():
    """Home page."""
    return render_template('public/home.html')


@blueprint.route('/login/', methods=['GET','POST'])
def login():
    """login page."""
    form = LoginForm(request.form)
    # Handle logging in
    if request.method == 'POST':
        if form.validate_on_submit():
            login_user(form.user)
            flash('You are logged in.', 'success')
            redirect_url = request.args.get('next') or url_for('user.members')
            return redirect(redirect_url)
        else:
            flash_errors(form)
    return render_template('public/login.html', form=form)


@blueprint.route('/unconfirmed')
@login_required
def unconfirmed():
    if current_user.confirmed:
        return redirect('public.home')
    flash('Please confirm your account!', 'warning')
    return render_template('public/unconfirmed.html')


@blueprint.route('/resend')
@login_required
def resend_confirmation():
    token = generate_confirmation_token(current_user.email)
    confirm_url = url_for('public.confirm_email', token=token, _external=True)
    html = render_template('public/transactional-email-templates/templates/inlined/confirm.html', confirm_url=confirm_url)
    subject = "Please confirm your email"
    send_mailgun_email(current_user.email, subject, html)
    flash('A new confirmation email has been sent.', 'success')
    return redirect(url_for('public.unconfirmed'))


@blueprint.route('/confirm/<token>')
def confirm_email(token):
    try:
        email = confirm_token(token)
    except:
        flash('The confirmation link is invalid or has expired.', 'danger')
    user = User.query.filter_by(email=email).first_or_404()
    if user.confirmed:
        flash('Account already confirmed. Please login.', 'success')
    else:
        user.confirmed = True
        user.active= True
        user.confirmed_on = datetime.datetime.now()
        db.session.add(user)
        db.session.commit()
        flash('You have confirmed your account. Thanks!', 'success')
    return redirect(url_for('public.home'))



@blueprint.route('/forgot', methods=['GET', 'POST'])
def forgot():
    form = Forgot()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        # Check the user exists
        if user is not None:
            # Subject of the confirmation email
            subject = 'Reset your password.'
            token = ts.dumps(user.email, salt='password-reset-key')
            resetUrl = url_for('public.reset', token=token, _external=True)
            html = render_template('public/transactional-email-templates/templates/inlined/reset_password.html', reset_url=resetUrl)
            send_mailgun_email(user.email, subject, html)
            # Send back to the home page
            flash('Check your email to reset your password.', 'positive')
            return redirect(url_for('public.home'))
        else:
            flash('Unknown email address.', 'danger')
            return redirect(url_for('public.forgot'))
    return render_template('/public/forgot.html', form=form)


@blueprint.route('/reset/<token>', methods=['GET', 'POST'])
def reset(token):
    try:
        email = ts.loads(token, salt='password-reset-key', max_age=1000)
    # The token can either expire or be invalid
    except:
        abort(404)
    form = Reset()
    if form.validate_on_submit():
        user = User.query.filter_by(email=email).first()
        # Check the user exists
        if user is not None:
            user.password = form.password.data
            # Update the database with the user
            user.set_password(form.password.data)
            db.session.add(user)
            db.session.commit()
            # Send to the signin page
            flash('Your password has been reset, you can sign in.', 'positive')
            return redirect(url_for('public.home'))
        else:
            flash('Unknown email address.', 'warning')
            return redirect(url_for('public.forgot'))
    return render_template('public/reset_password.html', form=form, token=token)


@blueprint.route('/register/', methods=['GET', 'POST'])
def register():
    """Register new user."""
    form = RegisterForm(request.form, csrf_enabled=False)
    if form.validate_on_submit():
        user = User.create(username=form.username.data, email=form.email.data, password=form.password.data, 
                    first_name=form.firstname.data, last_name=form.lastname.data, active=True, confirmed=False)
        email = form.email.data
        token = generate_confirmation_token(email)
        confirm_url = url_for('public.confirm_email', token=token, _external=True)
        html = render_template('public/transactional-email-templates/templates/inlined/confirm.html', confirm_url=confirm_url)
        subject = "Please confirm your email"
        send_mailgun_email(email, subject, html)

        login_user(user)

        flash('Thank you for registering, a confirmation email has been sent', 'success')
        return redirect(url_for('public.unconfirmed'))

    else:
        flash_errors(form)
    return render_template('public/register.html', form=form)


@blueprint.route('/logout/')
@login_required
def logout():
    """Logout."""
    logout_user()
    flash('You are logged out.', 'info')
    return redirect(url_for('public.home'))


@blueprint.route('/about/')
def about():
    """About page."""
    form = LoginForm(request.form)
    return render_template('public/about.html', form=form)


#API Register

@blueprint.route('/api/register', methods=['POST'])
def registerapi():
    json_data = request.json
    user = User(
        username=json_data['username'],
        email=json_data['email'],
        password=json_data['password']
    )
    try:
        db.session.add(user)
        db.session.commit()
        status = 'success'
    except:
        status = 'this user is already registered'
    db.session.close()
    return jsonify({'result': status})


#API Login

#@CsrfProtect.exempt('viewname')
@blueprint.route('/api/login', methods=['POST'])
def loginapi():
    json_data = request.json
    user = User.query.filter_by(username=json_data['username']).first()
    if user and bcrypt.check_password_hash(
            user.password, json_data['password']):
        session['logged_in'] = True
        status = True
    else:
        status = False
    g.user = user
    if status == True:
        return jsonify(dict({'result': status, 
                             'token': create_token(user)
                            }))
    else:
        return jsonify({'result': status})

    
#API Logout

@blueprint.route('/api/logout')
def logoutapi():
    session.pop('logged_in', None)
    return jsonify({'result': 'success'})

