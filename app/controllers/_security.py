from typing import Callable, List, Sequence, Type, Union

from fastapi import Depends, HTTPException, status
from pydantic import BaseModel

from definitions.permission import GeneralPermission, OwnershipPermission
from schemas.task import TaskScheduleParams
from schemas.user import AuthenticatedUser

from ._resources import DependsOnAuthenticatedUser

PermissionType = Union[GeneralPermission, OwnershipPermission]
PermissionList = Union[PermissionType, Sequence[PermissionType]]


class PermissionDeniedException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=403,
            detail="You do not have permission to perform this action.",
        )


def has_permission(
    user: AuthenticatedUser,
    permission: PermissionType,
) -> bool:
    if isinstance(permission, GeneralPermission):
        return permission in user.general_permissions
    if isinstance(permission, OwnershipPermission):
        return any(permission == p for p in user.ownership_permissions)


def WithPermission(
    permissions: PermissionList,
    *,
    require_all: bool = True,
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

        if require_all:
            if not all(has_permission(user, p) for p in perms):
                raise exception
        elif not any(has_permission(user, p) for p in perms):
            raise exception

    return Depends(permission_validator)


# TODO: move to params.. maybe rename to DependsOn..
def WithRestrictedParams(
    permission: PermissionType,
    model: Type[BaseModel],
    *,
    restricted_fields: List[str] = [],
    exception: HTTPException = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User does not have permission to use these parameters.",
    ),
) -> Callable:
    def _restrict_params(
        params: BaseModel = Depends(model),
        user: AuthenticatedUser = DependsOnAuthenticatedUser,
    ):
        if has_permission(user, permission):
            return params

        for field in restricted_fields or model.model_fields.keys():
            default = model.model_fields[field].default
            current = getattr(params, field)
            if current != default:
                raise exception

    return Depends(_restrict_params)


def resolve_schedule_params(
    params: TaskScheduleParams = Depends(),
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
):
    if not params:
        return None

    if not has_permission(user, GeneralPermission.ScheduleTasks):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to schedule tasks.",
        )

    return params


ResolveTaskScheduleParams = Depends(resolve_schedule_params)
