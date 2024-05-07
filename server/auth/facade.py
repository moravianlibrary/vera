from fastapi import Depends
from sqlalchemy.orm import Session
from auth.auth_client import get_user_from_token, oauth2_scheme
from auth.schemas import CurrentUser
from services.database import get_db


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    return get_user_from_token(token, db)
