from typing import Callable, Sequence, Union

from fastapi import Depends, HTTPException

from adapters.identity_provider import AuthScheme, IdentityProvider
from definitions.permission import GeneralPermission, OwnershipPermission
from repositories import RoleRepository, UserRepository
from schemas import AuthenticatedUser

from ._resources import (
    DependsOnIdentityProvider,
    DependsOnRoleRepository,
    DependsOnUserRepository,
)

PermissionType = Union[GeneralPermission, OwnershipPermission]
PermissionList = Union[PermissionType, Sequence[PermissionType]]


def resolve_authenticated_user(
    token: str = Depends(AuthScheme),
    identity_provider: IdentityProvider = DependsOnIdentityProvider,
    user_repository: UserRepository = DependsOnUserRepository,
    role_repository: RoleRepository = DependsOnRoleRepository,
) -> AuthenticatedUser:
    return identity_provider.authenticate_user(
        token, user_repository, role_repository
    )


DependsOnAuthenticatedUser = Depends(resolve_authenticated_user)


class PermissionDeniedException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=403,
            detail="You do not have permission to perform this action.",
        )


def WithPermission(
    permissions: PermissionList,
    *,
    require_all: bool = False,
    exception: HTTPException = PermissionDeniedException,
) -> Callable:
    """
    - `permissions`: single permission or a list of permissions.
    - `require_all`: if True, acts like AND (all permissions required).
        If False (default), acts like OR.
    """

    def permission_validator(
        user: AuthenticatedUser = DependsOnAuthenticatedUser,
    ):
        if not isinstance(permissions, (list, tuple)):
            perms = [permissions]
        else:
            perms = permissions

        def has_permission(permission: PermissionType) -> bool:
            return permission in user.general_permissions or any(
                permission == p for p, _ in user.ownership_permissions
            )

        if require_all:
            if not all(has_permission(p) for p in perms):
                raise exception
        elif not any(has_permission(p) for p in perms):
            raise exception

    return Depends(permission_validator)
