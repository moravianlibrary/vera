from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Callable, List, Union


from security.api import get_current_user
from security.schemas import CurrentUser
from security.types import ActionType
from categories.categories.models import Category


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
        print(self.depends(user))
        return self.action in user.actions and self.depends(user)


def PermissionValidator(
    permission: Union[
        ActionType, List[Union[ActionType, OwnershipPermission]]
    ],
    exception: HTTPException = PermissionDeniedException,
):
    def permission_validator(
        current_user: CurrentUser = Depends(get_current_user),
    ):
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


class OwnershipValidator:
    def EnforceCategoryRead(
        current_user: CurrentUser,
        category_id: int,
        session: Session,
        exception: HTTPException = PermissionDeniedException,
    ):
        if ActionType.ReadCategoriesAll not in current_user.actions and (
            ActionType.ReadCategoriesDepartment not in current_user.actions
            or current_user.department_id
            not in Category.get(category_id, session).departments
        ):
            raise exception

    def EnforceDepartmentRead(
        current_user: CurrentUser,
        department_id: int,
        exception: HTTPException = PermissionDeniedException,
    ):
        if ActionType.ReadCategoriesAll not in current_user.actions and (
            ActionType.ReadCategoriesDepartment not in current_user.actions
            or current_user.department_id != department_id
        ):
            raise exception

    def EnforceCategoryEdit(
        current_user: CurrentUser,
        category_id: int,
        session: Session,
        exception: HTTPException = PermissionDeniedException,
    ):
        if ActionType.EditCategoriesAll not in current_user.actions and (
            ActionType.EditCategoriesDepartment not in current_user.actions
            or current_user.department_id
            not in Category.get(category_id, session).departments
        ):
            raise exception
