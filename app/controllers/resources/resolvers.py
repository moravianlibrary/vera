from fastapi import Depends, HTTPException, status

from adapters.identity_provider import AuthScheme, IdentityProvider
from definitions.permission import GeneralPermission
from repositories.role import RoleRepository
from repositories.user import UserRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.task import TaskScheduleParams
from vera_state import get_identity_provider

from .providers import provide_repository


def resolve_authenticated_user(
    token: str = Depends(AuthScheme),
    identity_provider: IdentityProvider = Depends(get_identity_provider),
    user_repo: UserRepository = provide_repository(UserRepository),
    role_repo: RoleRepository = provide_repository(RoleRepository),
) -> AuthenticatedUser:
    return identity_provider.authenticate_user(token, user_repo, role_repo)


def resolve_schedule_params(
    params: TaskScheduleParams = Depends(),
    user: AuthenticatedUser = Depends(resolve_authenticated_user),
) -> TaskScheduleParams:
    if not user.has_permission(GeneralPermission.ScheduleTasks):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to schedule tasks.",
        )
    return params
