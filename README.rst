Fire up virtual environment

.. code-block:: bash
    
    cd myflaskapp
    pyvenv .
    source bin/activate

For OSX and Postgres devel
::

    export PATH="/Applications/Postgres.app/Contents/Versions/9.3/bin:$PATH"

===============================
My Flask App
===============================

A flasky app.


Quickstart
----------

First, set your app's secret key as an environment variable. For example, example add the following to ``.bashrc`` or ``.bash_profile``.

.. code-block:: bash

    export MYFLASKAPP_SECRET='something-really-secret'


Then run the following commands to bootstrap your environment.


::

    git clone git@ssh.gitgud.io:Jogyn/myflaskapp.git
    cd myflaskapp
    pip install -r requirements/dev.txt
    python manage.py server

You will see a pretty welcome screen.

Once you have installed your DBMS, run the following to create your app's database tables and perform the initial migration:

::

    python manage.py db init
    python manage.py db migrate
    python manage.py db upgrade
    python manage.py server



There are three commands now, used to seed the database.
If you delete all the data in dev.db, you can run these commands to regenerate the data.

::

    ./manage.py add_user --email=test-map@test.io --username rob -p aoeu -n
    ./manage.py add_user --email=test2-map@test.io --username rob2 -p aoeu -n
    ./manage.py add_user --email=test3-map@test.io --username rob3 -p aoeu -n
    ./manage.py add_user --email=test4-map@test.io --username rob4 -p aoeu -n
    ./manage.py add_user --email=test5-map@test.io --username rob5 -p aoeu -n
    ./manage.py seed_database 
    
    ## ./manage.py link_dataset -- WRONG


Deployment
----------

In your production environment, make sure the ``MYFLASKAPP_ENV`` environment variable is set to ``"prod"``.


Shell
-----

To open the interactive shell, run ::

    python manage.py shell

By default, you will have access to ``app``, ``db``, and the ``User`` model.


Running Tests
-------------

To run all tests, run ::

    python manage.py test


Migrations
----------

Whenever a database migration needs to be made. Run the following commands:
::

    python manage.py db migrate

This will generate a new migration script. Then run:
::

    python manage.py db upgrade

To apply the migration.

For a full migration command reference, run ``python manage.py db --help``.


Api
---

/api/register:
::

    curl -H "Accept: application/json" \
    -H "Content-type: application/json" -X POST \
    -d '{"username: "myusername", "email": "my@email.com", "password": "mypassword"}' \
    http://domain:port/api/register

/api/login:
::

    curl -H "Accept: application/json" \
    -H "Content-type: application/json" -X POST \
    -d '{"username": "myusername", "password": "mypassword"}' \
    http://domain:port/api/v1/login

/api/login:
::

    curl -X GET -H "Authorization: Basic $token" http://127.0.0.1:5000/api/v1/geojson


/api/logout:
::

    curl http://domain:port/api/logout

    