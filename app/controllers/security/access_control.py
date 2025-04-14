from typing import Union

from fastapi import Depends, HTTPException

from custom_types import GeneralPermission, OwnershipPermission
from exceptions import PermissionDeniedException
from schemas import AuthenticatedUser

from .dependencies import DependsOnAuthenticatedUser


def WithPermission(
    permission: Union[GeneralPermission, OwnershipPermission],
    exception: HTTPException = PermissionDeniedException,
):
    def permission_validator(
        user: AuthenticatedUser = DependsOnAuthenticatedUser,
    ):
        if permission not in user.general_permissions and not any(
            permission == p for p, _ in user.ownership_permissions
        ):
            raise exception

    return Depends(permission_validator)
