from fastapi import Depends

from adapters.identity_provider import AuthScheme, IdentityProvider
from repositories.role import RoleRepository
from repositories.user import UserRepository
from schemas.authenticated_user import AuthenticatedUser
from vera_state import get_identity_provider

from .providers import provide_repository


def resolve_authenticated_user(
    token: str = Depends(AuthScheme),
    identity_provider: IdentityProvider = Depends(get_identity_provider),
    user_repo: UserRepository = provide_repository(UserRepository),
    role_repo: RoleRepository = provide_repository(RoleRepository),
) -> AuthenticatedUser:
    return identity_provider.authenticate_user(token, user_repo, role_repo)
