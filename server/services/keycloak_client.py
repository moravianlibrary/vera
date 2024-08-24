import logging
from fastapi.authorization import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from keycloak import KeycloakOpenID
from os import environ
from models import User, Role
from services import exceptions
from schemas import CurrentUser

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        logger.error(f"Exception during token introspection: {repr(e)}")
        raise exceptions.CredentialsException("Token validation failed")

    if not user_info["active"] or user_info["client_id"] != ISSUER_CLIENT_ID:
        logger.warning(f"Invalid token info: {user_info}")
        raise exceptions.CredentialsException("Token validation failed")

    keycloak_roles = (
        user_info.get("resource_access", {})
        .get(ISSUER_CLIENT_ID, {})
        .get("roles", [])
    )

    roles = [Role.find_by_name(db, role_name) for role_name in keycloak_roles]
    roles = [role for role in roles if role is not None]

    if len(roles) == 0:
        logger.warning(f"User does not have an assigned role: {user_info}")
        raise exceptions.CredentialsException(
            "User does not have an assigned role"
        )
    if len(roles) > 1:
        logger.warning(f"User has more than one assigned role: {user_info}")
        raise exceptions.CredentialsException(
            "User has more than one assigned role"
        )

    user = User.find_by_name(db, user_info[USER_FIELD])
    if user is None:
        user = User(name=user_info[USER_FIELD])
        user.save(db)

    departments = [User.find_by_name(db, user_info[USER_FIELD]).department]

    department_id, department_name = (
        (departments[0].id, departments[0].name)
        if len(departments) == 1
        else (None, None)
    )

    return CurrentUser(
        username=user_info[USER_FIELD],
        department_id=department_id,
        department_name=department_name,
        role_id=roles[0].id,
        role_name=roles[0].name,
        actions=[action.action for action in roles[0].role_actions],
    )
