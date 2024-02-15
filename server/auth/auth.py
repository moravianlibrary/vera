from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from keycloak import KeycloakOpenID
from os import environ


from services import exceptions
from roles import crud as roles_crud
from departments import crud as depts_crud
from . import schemas

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

KEYCLOAK_USER_FIELD = environ.get("KEYCLOAK_USER_FIELD")
USER_FIELD = KEYCLOAK_USER_FIELD if KEYCLOAK_USER_FIELD else "username"

SERVER_URL = environ.get("KEYCLOAK_SERVER_URL")
REALM_NAME = environ.get("KEYCLOAK_REALM")
CLIENT_ID = environ.get("KEYCLOAK_CLIENT_ID")
ISSUER_CLIENT_ID = environ.get("KEYCLOAK_ISSUER_CLIENT_ID")
CLIENT_SECRET_KEY = environ.get("KEYCLOAK_CLIENT_SECRET_KEY")

keycloak_openid = KeycloakOpenID(
    server_url=SERVER_URL,
    realm_name=REALM_NAME,
    client_id=CLIENT_ID,
    client_secret_key=CLIENT_SECRET_KEY,
)


def get_user_from_token(db: Session, token: str) -> schemas.CurrentUser:
    """
    Retrieves user information from the token and performs validation checks.

    Args:
        db (Session): The database session
        token (str): The user token to be validated

    Returns:
        schemas.CurrentUser: The current user object with username, department,
        role, and actions
    """
    try:
        user_info = keycloak_openid.introspect(token)
    except Exception as e:
        print(repr(e))
        raise exceptions.CredentialsException("Token validation failed")

    if not user_info["active"] or user_info["client_id"] != ISSUER_CLIENT_ID:
        print(user_info)
        raise exceptions.CredentialsException("Token validation failed")

    keycloak_roles = (
        user_info.get("resource_access", {})
        .get(ISSUER_CLIENT_ID, {})
        .get("roles", [])
    )

    roles = [
        roles_crud.get_role_by_name(role_name, db)
        for role_name in keycloak_roles
    ]
    roles = [role for role in roles if role is not None]

    if len(roles) == 0 or len(roles) > 1:
        print(user_info)
        raise exceptions.CredentialsException(
            "User does not have an assigned role"
            if len(roles) == 0
            else "User has more than one assigned role"
        )

    departments = [
        depts_crud.get_department(role_name, db)
        for role_name in keycloak_roles
    ]
    departments = [
        department for department in departments if department is not None
    ]

    if len(departments) > 1:
        print(user_info)
        raise exceptions.CredentialsException(
            "User has more than one assigned department"
        )

    department_id, department_name = (
        (departments[0].id, departments[0].name)
        if len(departments) == 1
        else (None, None)
    )

    return schemas.CurrentUser(
        username=user_info[USER_FIELD],
        department_id=department_id,
        department_name=department_name,
        role_id=roles[0].id,
        role_name=roles[0].name,
        actions=roles_crud.get_role_actions(roles[0].id, db),
    )
