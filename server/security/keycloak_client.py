from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from keycloak import KeycloakOpenID
from os import environ


from security.crud import add_user, get_role_by_name, get_user_departments
from services import exceptions
from schemas.security import CurrentUser

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


def get_user_from_token(token: str, db: Session) -> CurrentUser:
    """
    Retrieves user information from the token and performs validation checks.

    Args:
        token (str): The user token to be validated
        db (Session): The database session

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

    roles = [get_role_by_name(role_name, db) for role_name in keycloak_roles]
    roles = [role for role in roles if role is not None]

    if len(roles) == 0 or len(roles) > 1:
        print(user_info)
        raise exceptions.CredentialsException(
            "User does not have an assigned role"
            if len(roles) == 0
            else "User has more than one assigned role"
        )

    departments = get_user_departments(user_info[USER_FIELD], db)

    department_id, department_name = (
        (departments[0].id, departments[0].name)
        if len(departments) == 1
        else (None, None)
    )

    add_user(user_info[USER_FIELD], db)

    return CurrentUser(
        username=user_info[USER_FIELD],
        department_id=department_id,
        department_name=department_name,
        role_id=roles[0].id,
        role_name=roles[0].name,
        actions=[action.action for action in roles[0].role_actions],
    )
