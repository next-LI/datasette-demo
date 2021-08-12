# NextLI's Datasette Instance

# User Management

This uses a Django micro service for user management.

    http://localhost:8001/accounts/login/
    http://localhost:8001/accounts/logout/
    http://localhost:8001/accounts/password_reset/
    http://localhost:8001/accounts/password_change/

Optionally, we can enable two-factor registration, by setting `REGISTRATION_OPEN` in `django/settings.py` and then sending users here:

    http://localhost:8001/accounts/register/

Full list of user-related endpoints

    /accounts/activate/complete/
    /accounts/activate/<str:activation_key>/
    /accounts/register/
    /accounts/register/complete/
    /accounts/register/closed/
    /accounts/login/
    /accounts/logout/
    /accounts/password_change/
    /accounts/password_change/done/
    /accounts/password_reset/
    /accounts/password_reset/done/
    /accounts/reset/<uidb64>/<token>/
    /accounts/reset/done/
    /user
