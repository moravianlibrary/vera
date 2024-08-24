from fastapi import APIRouter, Path
from sqlalchemy.orm import Session
from typing import List
from .utils import access_emulation
from .utils import permissions
from .utils.dependencies import DependsOnCurrentUser, DependsOnDbSession
from .utils.permissions import CanManageAccess
from datatypes import ActionType, JsonBase
from schemas import (
    CurrentUser,
    ActionList,
    RoleCreate,
    UserResponse,
    RoleResponse,
    DepartmentCreate,
    DepartmentResponse,
)
from models import Role, User, Department


router = APIRouter(prefix="/users")


@router.get("/authorize", response_model=CurrentUser)
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
    db: Session = DependsOnDbSession
):
    user.settings = settings
    user.save(db)
    return user


@router.post(
    "/current/emulate",
    response_model=CurrentUser,
)
def emulate_access(
    actions: ActionList,
    user: CurrentUser = DependsOnCurrentUser,
):
    if not can_emulate_access(user):
        raise permissions.PermissionDeniedException()
    user.actions = access_emulation.emulate_access(user.username, actions.actions)
    return user


@router.delete(
    "/current/emulate",
    response_model=CurrentUser,
)
def end_emulation(
    user: CurrentUser = DependsOnCurrentUser,
    db: Session = DependsOnDbSession,
):
    if not access_emulation.can_emulate_access(user):
        raise permissions.PermissionDeniedException()
    access_emulation.stop_emulating_access(user.username)
    user.actions = Role.get(db, user.role_id).actions
    return user
