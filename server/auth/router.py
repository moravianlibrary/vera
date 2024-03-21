from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from auth.crud import get_users as get_users_crud
from auth.dependencies import get_current_user as get_current_user_dependency
from auth.permissions import EditAccessPermission
from auth.schemas import CurrentUser, User
from services.database import get_db


router = APIRouter()


@router.get("/auth/current_user", response_model=CurrentUser)
def get_current_user(user: CurrentUser = Depends(get_current_user_dependency)):
    return user


@router.get(
    "/auth/users", dependencies=EditAccessPermission, response_model=List[User]
)
def get_users(db: Session = Depends(get_db)):
    return get_users_crud(db)
