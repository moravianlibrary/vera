TOKEN_CALL = \
    "{KEYCLOAK_HOST}/realms/{REALM_NAME}/protocol/openid-connect/token"


def setUpEnv():
    from os import environ
    environ["POSTGRES_HOST"] = "localhost"
    environ["ALLOW_ORIGINS"] = "http://localhost:3000"


def get_admin_token() -> str:
    from os import environ
    import requests

    body = {
        'client_id': environ.get('KEYCLOAK_CLIENT_ID'),
        'client_secret': environ.get('KEYCLOAK_CLIENT_SECRET_KEY'),
        "username": environ.get('VERA_USERNAME'),
        "password": environ.get('VERA_PASSWORD'),
        'grant_type': 'password'
    }
    # print(environ.get('KEYCLOAK_CLIENT_ID'))
    # print(environ.get('KEYCLOAK_CLIENT_SECRET_KEY'))
    # print(environ.get('VERA_USERNAME'))
    # print(environ.get('VERA_PASSWORD'))

    response = requests.post(TOKEN_CALL.format(
        KEYCLOAK_HOST=environ.get('KEYCLOAK_SERVER_URL'),
        REALM_NAME=environ.get('KEYCLOAK_REALM')
    ), data=body)
    # print(response)

    return response.json()['access_token']
