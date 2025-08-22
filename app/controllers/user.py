from typing import Annotated

from fastapi import APIRouter, Query

from adapters.identity_provider import IdentityProvider
from definitions.permission import GeneralPermission
from repositories.user import UserRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.common import Page, PageParams
from schemas.role import Permissions
from schemas.user import (
    FilteredPageParams,
    UserNotifications,
    UserOverview,
    UserSettings,
)
from services.user import UserService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnIdentityProvider,
    DependsOnUserRepository,
    DependsOnUserService,
    WithPermission,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=AuthenticatedUser)
def authorize_user(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
):
    return user


@router.get("/me/settings", response_model=UserSettings)
def get_user_settings(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: UserRepository = DependsOnUserRepository,
):
    return repository.get_by_id(user.id).settings


@router.post("/me/settings", response_model=UserSettings)
def save_user_settings(
    settings: UserSettings,
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: UserRepository = DependsOnUserRepository,
):
    return repository.update_settings(
        repository.get_by_id(user.id), settings
    ).settings


@router.get("/me/notifications", response_model=UserNotifications)
def list_notifications(
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: UserRepository = DependsOnUserRepository,
    service: UserService = DependsOnUserService,
):
    return service.read_notifications(repository.get_by_id(user.id))


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
    "",
    dependencies=[WithPermission(GeneralPermission.ReadUsersAndGroups)],
    response_model=Page[UserOverview],
)
def paginate(
    page_params: Annotated[PageParams, Query()],
    repository: UserRepository = DependsOnUserRepository,
):
    return repository.paginate(page_params)


@router.get(
    "/from-identity-provider",
    dependencies=[WithPermission(GeneralPermission.ReadUsersAndGroups)],
    response_model=Page[UserOverview],
)
def paginate_identity_provider(
    page_params: Annotated[FilteredPageParams, Query()],
    identity_provider: IdentityProvider = DependsOnIdentityProvider,
):
    return identity_provider.paginate_users(
        page_params.page, page_params.page_size, page_params.username
    )
