from definitions.permission import OwnershipPermission, OwnershipScope
from errors.category import CategoryNotChildError, DifferentParentIDsException
from repositories.category import CategoryRepository
from repositories.group import GroupRepository
from repositories.models.category import CategoryModel
from repositories.user import UserRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.category import CategoryEdit, CategoryParentChangeParams
from schemas.common import AssignmentChange


class CategoryService:
    def __init__(
        self,
        category_repository: CategoryRepository,
        group_repository: GroupRepository,
        user_repository: UserRepository,
    ):
        self._category_repository = category_repository
        self._group_repository = group_repository
        self._user_repository = user_repository

    def _enforce_ownership(
        self,
        target_category: CategoryModel | None,
        permission: OwnershipPermission,
        user: AuthenticatedUser,
    ) -> None:
        user_scope = user.get_scope(permission)

        if user_scope == OwnershipScope.Global:
            return

        if target_category is None:
            raise ValueError(
                f"User {user.username} does not have permission "
                f"{permission} for any category."
            )

        if any(user.id == u.id for u in target_category.effective_users):
            return

        if user_scope == OwnershipScope.User:
            raise ValueError(
                f"User {user.username} does not have permission "
                f"{permission} for category {target_category.id}."
            )

        if any(
            g.id in user.group_ids for g in target_category.effective_groups
        ):
            return

        raise ValueError(
            f"User {user.username} does not have permission "
            f"{permission} for category {target_category.id}."
        )

    def _enforce_manage_ownership(
        self,
        target_category: CategoryModel | None,
        user: AuthenticatedUser,
    ) -> None:
        self._enforce_ownership(
            target_category, OwnershipPermission.ManageCategories, user
        )

    async def create(
        self,
        parent_id: int | None,
        category: CategoryEdit,
        user: AuthenticatedUser,
        project_id: int | None = None,
    ) -> CategoryModel:
        parent_category = (
            self._category_repository.get_by_id(parent_id)
            if parent_id
            else None
        )

        self._enforce_manage_ownership(parent_category, user)

        return await self._category_repository.create(
            category.name,
            category.description,
            project_id,
            parent_id,
            parent_category.level + 1 if parent_category else 1,
            category.assignable,
            category.extract_whole,
        )

    def update(
        self, category_id: int, category: CategoryEdit, user: AuthenticatedUser
    ) -> CategoryModel:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        return self._category_repository.update(
            target_category,
            category.name,
            category.description,
            category.assignable,
            category.extract_whole,
            category.disabled,
        )

    async def change_assignment(
        self,
        category_id: int,
        assignment_change: AssignmentChange,
        user: AuthenticatedUser,
    ) -> CategoryModel:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        user_ids = (
            {u.id for u in target_category.direct_users}
            | set(assignment_change.add.users)
        ) - set(assignment_change.remove.users)

        group_ids = (
            {g.id for g in target_category.direct_groups}
            | set(assignment_change.add.groups)
        ) - set(assignment_change.remove.groups)

        return await self._category_repository.update_assignment(
            target_category,
            [
                self._group_repository.get_by_id(group_id)
                for group_id in group_ids
            ],
            [self._user_repository.get_by_id(user_id) for user_id in user_ids],
        )

    async def change_parent(
        self,
        category_id: int,
        params: CategoryParentChangeParams,
        user: AuthenticatedUser,
    ) -> CategoryModel:
        if params.from_parent_id == params.to_parent_id:
            raise DifferentParentIDsException()

        from_category = (
            self._category_repository.get_by_id(params.from_parent_id)
            if params.from_parent_id
            else None
        )
        to_category = (
            self._category_repository.get_by_id(params.to_parent_id)
            if params.to_parent_id
            else None
        )

        self._enforce_manage_ownership(from_category, user)
        self._enforce_manage_ownership(to_category, user)

        target_category = self._category_repository.get_by_id(category_id)

        if target_category.parent != from_category:
            raise CategoryNotChildError(category_id, params.from_parent_id)

        return await self._category_repository.update_parent(
            target_category,
            params.to_parent_id,
            to_category.level + 1 if to_category else 1,
        )

    def delete(self, category_id: int, user: AuthenticatedUser) -> None:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        return self._category_repository.delete(target_category, True, True)
