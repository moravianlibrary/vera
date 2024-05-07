from fastapi import Depends, HTTPException, status
from typing import Callable, List, Union


from auth.facade import get_current_user
from auth.schemas import CurrentUser
from roles.types import ActionType


class PermissionDeniedException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
            headers={"WWW-Authenticate": "Bearer"},
        )


class Permission:
    def __init__(
        self,
        action: ActionType,
    ):
        self.action = action

    def has_permission(self, user: CurrentUser):
        return self.action in user.actions


class OwnershipPermission(Permission):
    def __init__(
        self,
        action: ActionType,
        depends: Callable,
    ):
        super().__init__(action)
        self.depends = depends

    def has_permission(self, user: CurrentUser):
        return self.action in user.actions and self.depends(user)


def PermissionValidator(
    permission: Union[
        ActionType, List[Union[ActionType, OwnershipPermission]]
    ],
    exception: HTTPException = PermissionDeniedException,
):
    def permission_validator():
        current_user: CurrentUser = get_current_user()

        permissions_list = [
            Permission(p) if isinstance(p, ActionType) else p
            for p in (
                permission if isinstance(permission, list) else [permission]
            )
        ]

        if not any(
            permission.has_permission(current_user)
            for permission in permissions_list
        ):
            raise exception

    return Depends(permission_validator)
