TOKEN_CALL = (
    "{KEYCLOAK_HOST}/realms/{REALM_NAME}/protocol/openid-connect/token"
)


def mockClsEnv(cls):
    from os import environ
    from unittest.mock import patch

    cls.mock_env_vars = {
        "POSTGRES_HOST": "localhost",
        "ALLOW_ORIGINS": "*",
        # "ALLOW_ORIGINS": "http://localhost:3000",
        "KEYCLOAK_CLIENT_ID": "vera-backend",
        "KEYCLOAK_ISSUER_CLIENT_ID": "vera",
    }
    cls.patcher = patch.dict(environ, cls.mock_env_vars)
    cls.patcher.start()


def createTestClient():
    from fastapi.testclient import TestClient
    from vera import app

    return TestClient(app)


def createTestUser(actions=[]):
    from auth.schemas import CurrentUser

    return CurrentUser(
        username="test_user",
        department_id=10,
        department_name="test_department",
        role_id=7,
        role_name="test_role",
        actions=actions,
    )


def get_all_actions_except(actions):
    from roles.types import ActionType

    return [action for action in ActionType if action not in actions]


def get_admin_token() -> str:
    from os import environ
    import requests

    body = {
        "client_id": environ.get("KEYCLOAK_ISSUER_CLIENT_ID"),
        "username": environ.get("VERA_USERNAME"),
        "password": environ.get("VERA_PASSWORD"),
        "grant_type": "password",
    }

    response = requests.post(
        TOKEN_CALL.format(
            KEYCLOAK_HOST=environ.get("KEYCLOAK_SERVER_URL"),
            REALM_NAME=environ.get("KEYCLOAK_REALM"),
        ),
        data=body,
    )

    return response.json()["access_token"]


def get_test_user_token() -> str:
    from os import environ
    import requests

    body = {
        "client_id": environ.get("KEYCLOAK_ISSUER_CLIENT_ID"),
        "username": "vera_user",
        "password": "vera_user",
        "grant_type": "password",
    }

    response = requests.post(
        TOKEN_CALL.format(
            KEYCLOAK_HOST=environ.get("KEYCLOAK_SERVER_URL"),
            REALM_NAME=environ.get("KEYCLOAK_REALM"),
        ),
        data=body,
    )

    return response.json()["access_token"]
