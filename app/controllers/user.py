from fastapi import APIRouter, Query

from adapters.identity_provider import IdentityProvider
from definitions.permission import GeneralPermission
from repositories.user import UserRepository
from schemas.pagination import Page
from schemas.role import Permissions
from schemas.user import (
    AuthenticatedUser,
    User,
    UserNotifications,
    UserSettings,
)

from ._resources import DependsOnIdentityProvider, DependsOnUserRepository
from ._security import DependsOnAuthenticatedUser, WithPermission

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=AuthenticatedUser)
def authorize_user(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
):
    return user


@router.get("/me/notifications", response_model=UserNotifications)
def list_notifications(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: UserRepository = DependsOnUserRepository,
):
    return repository.read_new_notifications(
        repository.get_by_id(user.user_id)
    )


@router.get("/me/settings", response_model=UserSettings)
def get_user_settings(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: UserRepository = DependsOnUserRepository,
):
    return repository.get_by_id(user.user_id).settings


@router.post("/me/settings", response_model=AuthenticatedUser)
def save_user_settings(
    settings: UserSettings,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: UserRepository = DependsOnUserRepository,
):
    return repository.update_settings(
        repository.get_by_id(user.user_id), settings
    )


@router.post(
    "/me/emulate",
    dependencies=[WithPermission(GeneralPermission.EmulateAccess)],
    response_model=AuthenticatedUser,
)
def enable_emulated_permissions(
    permissions: Permissions,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    identity_provider: IdentityProvider = DependsOnIdentityProvider,
):
    return identity_provider.enable_emulated_permissions(user, permissions)


@router.delete(
    "/me/emulate",
    dependencies=[WithPermission(GeneralPermission.EmulateAccess)],
    response_model=AuthenticatedUser,
)
def disable_emulated_permissions(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    identity_provider: IdentityProvider = DependsOnIdentityProvider,
):
    return identity_provider.disable_emulated_permissions(user)


@router.get(
    "/internal",
    dependencies=[WithPermission(GeneralPermission.ReadUsersAndGroups)],
    response_model=Page[User],
)
def paginate_internal(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    repository: UserRepository = DependsOnUserRepository,
):
    return repository.paginate(page, page_size)


@router.get(
    "/from-identity-provider",
    dependencies=[WithPermission(GeneralPermission.ReadUsersAndGroups)],
    response_model=Page[User],
)
def paginate_identity_provider(
    username: str | None = Query(None),
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    identity_provider: IdentityProvider = DependsOnIdentityProvider,
):
    return identity_provider.paginate_users(username, page, page_size)
