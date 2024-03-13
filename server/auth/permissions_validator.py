from fastapi import Depends
from sqlalchemy.orm import Session
from typing import Callable, List, Union

from auth.auth_client import get_user_from_token, oauth2_scheme
from auth.exceptions import PermissionDeniedException
from auth.schemas import CurrentUser
from categories.schemas import CategoryCreate
from roles.types import ActionType
from services.database import get_db


class PermissionsValidator:
    def __init__(
        self,
        required_permissions: List[ActionType] = [],
        required_function: Callable[..., bool] = None,
    ):
        self.required_permissions = required_permissions
        self.required_function = required_function
        self.or_permission = None
        self.and_permission = None

    def __call__(
        self,
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db),
    ):
        user = get_user_from_token(token, db)
        user_permissions_set = set(user.actions)
        required_permissions_set = set(self.required_permissions)

        if not required_permissions_set.issubset(user_permissions_set) and (
            not self.or_permissions
            or not any(
                or_permission(token, db)
                for or_permission in self.or_permissions
            )
        ):
            raise PermissionDeniedException()

    def validate(self, user: CurrentUser, db: Session):
        user_permissions_set = set(user.actions)
        required_permissions_set = set(self.required_permissions)

        if not required_permissions_set.issubset(user_permissions_set) and (
            not self.or_permissions
            or not any(
                or_permission(token, db)
                for or_permission in self.or_permissions
            )
        ):
            raise PermissionDeniedException()
        print("has permission")
        return True

    def or_(self, other: Union["PermissionsValidator", Callable[..., bool]]):
        self.or_permissions.append(other)
        return self


class StateValidator:
    def __init__(
        self,
        required_function: Callable[..., bool] = None,
    ):
        self.required_function = required_function
        self.or_permission = None
        self.and_permission = None

    def __call__(
        self,
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db),
    ):
        pass


def has_department_access(
    required_departments: List[int],
    token: str,
    db: Session,
):
    user = get_user_from_token(token, db)
    if user.department_id not in required_departments:
        raise PermissionDeniedException


def has_category_department_access(
    category: CategoryCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    from categories.crud import get_category_departments

    has_department_access(
        get_category_departments(category.parent_id, db), token, db
    )
