from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from auth.auth_client import get_user_from_token, oauth2_scheme
from auth.crud import get_users as get_users_crud
from auth.permissions import EditAccessPermission
from auth.schemas import CurrentUser, User
from services.database import get_db


router = APIRouter()


@router.get("/auth/current_user", response_model=CurrentUser)
def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    return get_user_from_token(token, db)


@router.get(
    "/auth/users", dependencies=EditAccessPermission, response_model=List[User]
)
def get_users(db: Session = Depends(get_db)):
    return get_users_crud(db)
