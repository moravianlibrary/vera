from fastapi import Depends, HTTPException, status

from adapters.identity_provider import AuthScheme, IdentityProvider
from definitions.permission import GeneralPermission
from repositories.role import RoleRepository
from repositories.user import UserRepository
from schemas.task import TaskScheduleParams
from schemas.user import AuthenticatedUser
from vera_state import get_identity_provider

from .providers import ProvideRepository


def resolve_authenticated_user(
    token: str = Depends(AuthScheme),
    identity_provider: IdentityProvider = Depends(get_identity_provider),
    user_repo: UserRepository = ProvideRepository(UserRepository),
    role_repo: RoleRepository = ProvideRepository(RoleRepository),
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
