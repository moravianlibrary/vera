from fastapi import APIRouter
from sqlalchemy.orm import Session
from typing import List
from .utils import access_emulation
from .utils.dependencies import DependsOnCurrentUser, DependsOnDbSession
from .utils.permissions import CanManageAccess, CanEmulateAccess
from datatypes import JsonBase
from schemas import (
    CurrentUser,
    ActionList,
    UserResponse,
)
from models import Role, User


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/current", response_model=CurrentUser)
def authorize_user(
    user: CurrentUser = DependsOnCurrentUser,
):
    return user


@router.get(
    "",
    dependencies=[CanManageAccess],
    response_model=List[UserResponse],
)
def get_users(db: Session = DependsOnDbSession):
    return User.all(db)


@router.post("/current/settings", response_model=CurrentUser)
def set_user_settings(
    settings: JsonBase,
    user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    user_model = User.get(db, user.username)
    user_model.settings = settings
    user_model.save(db)
    user.settings = settings
    return user


@router.post(
    "/current/emulate",
    dependencies=[CanEmulateAccess],
    response_model=CurrentUser,
)
def emulate_access(
    actions: ActionList,
    user: CurrentUser = DependsOnCurrentUser,
):
    user.actions = access_emulation.emulate_access(
        user.username, actions.actions
    )
    return user


@router.delete(
    "/current/emulate",
    dependencies=[CanEmulateAccess],
    response_model=CurrentUser,
)
def stop_access_emulation(
    user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    access_emulation.stop_emulating_access(user.username)
    user.actions = Role.get(db, user.role_id).actions
    return user
