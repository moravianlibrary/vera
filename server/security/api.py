from fastapi import Depends
from sqlalchemy.orm import Session
from security.keycloak_client import get_user_from_token, oauth2_scheme
from security.schemas import CurrentUser
from services.database import get_db


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    return get_user_from_token(token, db)


def CallerUsername() -> CurrentUser:
    def get_caller_username(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> str:
        return current_user.username

    return Depends(get_caller_username)
