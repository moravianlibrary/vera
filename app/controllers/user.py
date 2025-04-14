from fastapi import APIRouter, Query
from sqlalchemy.orm import Session

from datatypes import JsonBase
from models import Role, User
from schemas import ActionList, CurrentUser, Page, UserResponse

from .utils import access_emulation
from .utils.dependencies import DependsOnCurrentUser, DependsOnDbSession
from .utils.permissions import CanEmulateAccess, CanManageAccess

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=CurrentUser)
def authorize_user(
    user: CurrentUser = DependsOnCurrentUser,
):
    if user.username in access_emulation.emulated_users:
        user.actions = access_emulation.emulated_users[user.username]
    return user


@router.get("/me/notifications", response_model=CurrentUser)
def list_notifications(
    user: CurrentUser = DependsOnCurrentUser,
):
    pass


@router.post("/me/settings", response_model=CurrentUser)
def save_user_settings(
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
    "/me/emulate",
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
    "/me/emulate",
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


@router.get(
    "",
    dependencies=[CanManageAccess],
    response_model=Page[UserResponse],
)
def list_users(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    session: Session = DependsOnDbSession,
):
    return User.get_page(session, page, page_size)
