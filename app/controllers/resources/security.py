from typing import Callable, Protocol, Sequence, TypeVar, Union

from fastapi import Depends, HTTPException, status

from definitions.permission import (
    OwnershipPermission,
    OwnershipScope,
    PermissionType,
)
from schemas.user import AuthenticatedUser

from .resolvers import resolve_authenticated_user


class PermissionDenied(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )


def require_permission(
    permissions: Union[PermissionType, Sequence[PermissionType]],
    *,
    require_all: bool = True,
    exception: HTTPException = PermissionDenied(),
) -> Callable:
    def _check_permissions(
        user: AuthenticatedUser = Depends(resolve_authenticated_user),
    ):
        perms = (
            permissions
            if isinstance(permissions, (list, tuple))
            else [permissions]
        )

        if require_all and not all(user.has_permission(p) for p in perms):
            raise exception
        if not require_all and not any(user.has_permission(p) for p in perms):
            raise exception

    return Depends(_check_permissions)


class AuthoredModel(Protocol):
    created_by: str


AuthoredModelType = TypeVar("AuthoredModelType", bound=AuthoredModel)


def enforce_ownership(
    item: AuthoredModelType,
    permission: OwnershipPermission,
    user: AuthenticatedUser,
    exception: HTTPException = PermissionDenied(),
) -> AuthoredModelType:
    scope = user.get_scope(permission)

    if scope == OwnershipScope.Global:
        return item

    if scope == OwnershipScope.Group and any(
        uid == item.created_by for uid in user.group_users_ids
    ):
        return item

    if item.created_by == user.id:
        return item

    raise exception
