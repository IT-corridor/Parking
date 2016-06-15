# -*- coding: utf-8 -*-
"""User forms."""
from flask_wtf import Form
from wtforms import PasswordField, StringField, BooleanField
from wtforms.validators import DataRequired, Email, EqualTo, Length

from .models import User


class RegisterForm(Form):
    """Register form."""

    username = StringField('Username',
                           validators=[DataRequired(), Length(min=3, max=25)])
    firstname = StringField('First Name',
                            validators=[DataRequired(), Length(min=2, max=15)])
    lastname = StringField('Last Name',
                            validators=[DataRequired(), Length(min=3, max=25)])
    email = StringField('Email',
                        validators=[DataRequired(), Email(), Length(min=6, max=40)])
    password = PasswordField('Password',
                             validators=[DataRequired(), Length(min=6, max=40)])
    confirm = PasswordField('Verify password',
                            [DataRequired(), EqualTo('password', message='Passwords must match')])


    def __init__(self, *args, **kwargs):
        """Create instance."""
        super(RegisterForm, self).__init__(*args, **kwargs)
        self.user = None

    def validate(self):
        """Validate the form."""
        initial_validation = super(RegisterForm, self).validate()
        if not initial_validation:
            return False
        user = User.query.filter_by(username=self.username.data).first()
        if user:
            self.username.errors.append('Username already registered')
            return False
        user = User.query.filter_by(email=self.email.data).first()
        if user:
            self.email.errors.append('Email already registered')
            return False
        return True


class EditForm(Form):
    password = PasswordField('password', validators=[DataRequired(), Length(min=6, max=40)])
    Retype_password = PasswordField('Retype_password', [DataRequired(), EqualTo('password', message='Passwords must match')])

class Update(Form):
    username = StringField('username', validators=[DataRequired(), Length(min=3, max=25)])
    email = StringField('email', validators=[DataRequired(), Email(), Length(min=6, max=40)])

class AddressEntryForm(Form):
    building_name = StringField('building_name')
    phone = StringField('phone')
    address = StringField('address', validators=[DataRequired()])
    city = StringField('city', validators=[DataRequired()])
    state = StringField('state', validators=[DataRequired()])
    postal_code = StringField('postal_code')
    price = StringField('price')
    form_state = StringField('form_state', validators=[DataRequired()])

class AddressEntryCommitForm(Form):
    picked = StringField('picked')
    form_state = StringField('form_state', validators=[DataRequired()])
