from typing import Callable, Protocol, TypeVar

from fastapi import Depends, HTTPException, status

from definitions.permission import (
    OwnershipPermission,
    OwnershipScope,
    PermissionType,
)
from schemas.authenticated_user import AuthenticatedUser

from .resolvers import resolve_authenticated_user


class PermissionDenied(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )


def require_permission(
    *permissions: PermissionType,
    require_all: bool = True,
    exception: HTTPException = PermissionDenied(),
) -> Callable:
    def _check_permissions(
        user: AuthenticatedUser = Depends(resolve_authenticated_user),
    ):
        check = all if require_all else any
        if not check(user.has_permission(p) for p in permissions):
            raise exception

    return Depends(_check_permissions)


def require_global_permission(
    *permissions: OwnershipPermission,
    require_all: bool = True,
    exception: HTTPException = PermissionDenied(),
):
    def _check_permissions(
        user: AuthenticatedUser = Depends(resolve_authenticated_user),
    ):
        check = all if require_all else any
        if not check(
            user.has_permission(p)
            and user.get_scope(p) == OwnershipScope.Global
            for p in permissions
        ):
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
