from fastapi import APIRouter, Query
from sqlalchemy.orm import Session

from custom_types import GeneralPermission
from datatypes import JsonBase
from models import Role, User
from schemas import ActionList, AuthenticatedUser, Page, UserResponse

from ._resources import DependsOnDbSession
from .security import (
    DependsOnAuthenticatedUser,
    WithPermission,
    clear_emulated_access,
    emulate_user_access,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=AuthenticatedUser)
def authorize_user(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
):
    return user


@router.get("/me/notifications", response_model=AuthenticatedUser)
def list_notifications(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
):
    pass


@router.get("/me/settings", response_model=AuthenticatedUser)
def get_user_settings(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
):
    pass


@router.post("/me/settings", response_model=AuthenticatedUser)
def save_user_settings(
    settings: JsonBase,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    db: Session = DependsOnDbSession,
):
    user_model = User.get(db, user.username)
    user_model.settings = settings
    user_model.save(db)
    user.settings = settings
    return user


@router.post(
    "/me/emulate",
    dependencies=[WithPermission(GeneralPermission.EmulateAccess)],
    response_model=AuthenticatedUser,
)
def emulate_access(
    actions: ActionList,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
):
    user.actions = emulate_user_access(user.username, actions.actions)
    return user


@router.delete(
    "/me/emulate",
    dependencies=[WithPermission(GeneralPermission.EmulateAccess)],
    response_model=AuthenticatedUser,
)
def stop_access_emulation(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    db: Session = DependsOnDbSession,
):
    clear_emulated_access(user.username)
    user.actions = Role.get(db, user.role_id).actions
    return user


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageAccess)],
    response_model=Page[UserResponse],
)
def list_users(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    session: Session = DependsOnDbSession,
):
    return User.get_page(session, page, page_size)
