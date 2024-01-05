from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from keycloak import KeycloakOpenID
from os import environ

from services import exceptions
from roles import crud as roles_crud
from departments import crud as depts_crud
from . import schemas


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

KEYCLOAK_USER_FIELD = environ.get('KEYCLOAK_USER_FIELD')
USER_FIELD = KEYCLOAK_USER_FIELD if KEYCLOAK_USER_FIELD else 'username'
CLIENT_ID = environ.get('KEYCLOAK_CLIENT_ID')

keycloak_openid = KeycloakOpenID(
    server_url=environ.get('KEYCLOAK_SERVER_URL'),
    realm_name=environ.get('KEYCLOAK_REALM'),
    client_id=CLIENT_ID,
    client_secret_key=environ.get('KEYCLOAK_CLIENT_SECRET_KEY')
)


def get_user_from_token(db: Session, token: str):
    try:
        user_info = keycloak_openid.introspect(token)
        if not user_info['active']:
            print(user_info)
            raise exceptions.CredentialsException
        if user_info['client_id'] != CLIENT_ID:
            print(user_info)
            raise exceptions.CredentialsException

        keycloak_roles = user_info['resource_access'][CLIENT_ID]['roles']

        roles = [role for role_name in keycloak_roles
                 if (role := roles_crud.get_role_by_name(role_name, db))
                 is not None]
        if len(roles) == 0:
            print(roles)
            raise exceptions.CredentialsException
        if len(roles) > 1:
            print(roles)
            raise exceptions.CredentialsException

        departments = [
            department for role_name in keycloak_roles
            if (department := depts_crud.get_department(role_name, db))
            is not None
        ]
        if len(departments) > 1:
            print(departments)
            raise exceptions.CredentialsException

        department_id, department_name = None, None
        if len(departments) == 1:
            department_id = departments[0].id
            department_name = departments[0].name

        return schemas.CurrentUser(
            username=user_info[USER_FIELD],
            department_id=department_id,
            department_name=department_name,
            role_id=roles[0].id,
            role_name=roles[0].name,
            actions=roles_crud.get_role_actions(roles[0].id, db)
        )
    except Exception as e:
        print(e)
        raise exceptions.CredentialsException
