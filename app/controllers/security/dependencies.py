from fastapi import Depends
from sqlalchemy.orm import Session

from adapters.database import get_db_session
from schemas import AuthenticatedUser

# TODO:
from services.keycloak_client import get_user_from_token, oauth2_scheme

from .access_emulation import get_emulated_actions, is_user_emulated


# TODO: cache users
def resolve_authenticated_user(
    token: str = Depends(oauth2_scheme),
    db_session: Session = Depends(get_db_session),
) -> AuthenticatedUser:
    # TODO: merge permissions
    user = get_user_from_token(token, db_session)

    # Override actions if user is being emulated
    if is_user_emulated(user.username):
        user.actions = get_emulated_actions(user.username)

    return user


def resolve_username(
    user: AuthenticatedUser = Depends(resolve_authenticated_user),
) -> str:
    return user.username


DependsOnAuthenticatedUser = Depends(resolve_authenticated_user)
DependsOnCallerUsername = Depends(resolve_username)
