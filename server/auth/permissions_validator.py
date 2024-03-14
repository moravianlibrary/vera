from fastapi import Depends
from sqlalchemy.orm import Session
from typing import List

from auth.auth_client import get_user_from_token, oauth2_scheme
from auth.exceptions import PermissionDeniedException
from auth.schemas import CurrentUser
from categories.schemas import CategoryCreate
from roles.types import ActionType
from services.database import get_db


class PermissionsValidator:
    def __init__(self, required_permissions: List[ActionType]):
        self.required_permissions = required_permissions

    def __call__(
        self,
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db),
    ):
        user = get_user_from_token(token, db)
        user_permissions = set(user.actions)
        print(user_permissions)

        for required_permission in self.required_permissions:
            if required_permission in user_permissions:
                return True
        raise PermissionDeniedException()


class AccessValidator:
    def __init__(self):
        self.access_permissions = set()
        self.override_permissions = set()

    def __call__(self):
        return True

    def evaluate_override(self, user: CurrentUser):
        user_permissions_set = set(user.actions)
        return (
            self.override_permissions is not None
            and self.override_permissions.issubset(user_permissions_set)
        )

    def with_access_permissions(self, access_permissions: List[ActionType]):
        self.access_permissions = set(access_permissions)
        return self

    def with_override_permissions(
        self, override_permissions: List[ActionType]
    ):
        self.override_permissions = set(override_permissions)
        return self


def get_create_category_body(category: CategoryCreate):
    return category


def get_category_id(category_id: int):
    return category_id


def get_parent_id(parent_id: int):
    return parent_id


class CreateCategoryAccessValidator(AccessValidator):
    def __call__(
        self,
        category: CategoryCreate = Depends(get_create_category_body),
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db),
    ):
        from categories.crud import get_category_departments

        user = get_user_from_token(token, db)
        if self.evaluate_override(user):
            return True

        required_departments = [
            category_department.department_id
            for category_department in get_category_departments(
                category.parent_id, db
            )
        ]

        if (
            user.department_id not in required_departments
            or self.access_permissions is not None
            and not self.access_permissions.issubset(set(user.actions))
        ):
            raise PermissionDeniedException()

        return True


class UpdateCategoryAccessValidator(AccessValidator):
    def __call__(
        self,
        category_id: int = Depends(get_category_id),
        category: CategoryCreate = Depends(get_create_category_body),
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db),
    ):
        from categories.crud import get_category, get_category_departments

        user = get_user_from_token(token, db)
        if self.evaluate_override(user):
            return True

        db_category = get_category(category_id, db)
        if db_category.parent_id != category.parent_id:
            required_departments = [
                category_department.department_id
                for category_department in get_category_departments(
                    db_category.parent_id, db
                )
            ]

            if (
                user.department_id not in required_departments
                or self.access_permissions is not None
                and not self.access_permissions.issubset(set(user.actions))
            ):
                raise PermissionDeniedException()

        required_departments = [
            category_department.department_id
            for category_department in get_category_departments(
                category.parent_id, db
            )
        ]

        if (
            user.department_id not in required_departments
            or self.access_permissions is not None
            and not self.access_permissions.issubset(set(user.actions))
        ):
            raise PermissionDeniedException()

        return True


class EditCategoryDistributionAccessValidator(AccessValidator):
    def __call__(
        self,
        parent_id: int = Depends(get_parent_id),
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db),
    ):
        from categories.crud import get_category_departments

        user = get_user_from_token(token, db)
        if self.evaluate_override(user):
            return True

        required_departments = [
            category_department.department_id
            for category_department in get_category_departments(parent_id, db)
        ]

        if (
            user.department_id not in required_departments
            or self.access_permissions is not None
            and not self.access_permissions.issubset(set(user.actions))
        ):
            raise PermissionDeniedException()

        return True


class CategoryIdAccessValidator(AccessValidator):
    def __call__(
        self,
        category_id: int = Depends(get_category_id),
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db),
    ):
        from categories.crud import get_category_departments

        user = get_user_from_token(token, db)
        if self.evaluate_override(user):
            return True

        required_departments = [
            category_department.department_id
            for category_department in get_category_departments(
                category_id, db
            )
        ]

        if (
            user.department_id not in required_departments
            or self.access_permissions is not None
            and not self.access_permissions.issubset(set(user.actions))
        ):
            raise PermissionDeniedException()

        return True
