from typing import Callable, Sequence, Union

from fastapi import Depends, HTTPException, status

from definitions.permission import PermissionType
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
