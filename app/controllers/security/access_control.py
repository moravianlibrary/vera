from typing import Callable, Sequence, Union

from fastapi import Depends, HTTPException

from custom_types import GeneralPermission, OwnershipPermission
from exceptions import PermissionDeniedException
from schemas import AuthenticatedUser

from .dependencies import DependsOnAuthenticatedUser

PermissionType = Union[GeneralPermission, OwnershipPermission]
PermissionList = Union[PermissionType, Sequence[PermissionType]]


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
