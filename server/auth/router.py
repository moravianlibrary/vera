from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from auth.auth import get_user_from_token, oauth2_scheme
from auth.schemas import CurrentUser, User
from services.database import get_db


router = APIRouter()


@router.get("/auth/current_user", response_model=CurrentUser)
def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
):
    return get_user_from_token(db, token)


@router.get("/users", response_model=List[User])
def get_users(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
):
    return get_user_from_token(db, token)
