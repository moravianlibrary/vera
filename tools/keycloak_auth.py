import os
import requests
import urllib
import json

KEYCLOAK_BASE = "https://keycloak.osdd.mzk.cz"
REALM_NAME = "mzk"
CLIENT_ID = "vera"
TOKEN_CALL = f"{KEYCLOAK_BASE}/realms/{REALM_NAME}/protocol/openid-connect/token"
TOKEN_KEY = "access_token"


def get_token():
    username = os.environ.get("VERA_USERNAME")
    password = os.environ.get("VERA_PASSWORD")

    body = {
        'client_id': CLIENT_ID,
        'username': username,
        'password': password,
        'grant_type': 'password'
    }

    r = requests.post(TOKEN_CALL, data=body)

    if r.ok:
        return r.json()[TOKEN_KEY]

