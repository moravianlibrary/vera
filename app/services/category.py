from definitions.permission import OwnershipPermission, OwnershipScope
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

    def change_assignment(
        self,
        category_id: int,
        assignment_change: AssignmentChange,
        user: AuthenticatedUser,
    ) -> None:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        user_ids = {u.id for u in target_category.direct_users} | set(
            assignment_change.add.user_ids
        ) - set(assignment_change.remove.user_ids)

        group_ids = {g.id for g in target_category.direct_groups} | set(
            assignment_change.add.group_ids
        ) - set(assignment_change.remove.group_ids)

        self._category_repository.update_assignment(
            target_category,
            [
                self._group_repository.get_by_id(group_id)
                for group_id in group_ids
            ],
            [self._user_repository.get_by_id(user_id) for user_id in user_ids],
        )

    def change_parent(
        self,
        category_id: int,
        params: CategoryParentChangeParams,
        user: AuthenticatedUser,
    ) -> None:
        from_category = (
            CategoryRepository.get_by_id(params.from_parent_id)
            if params.from_parent_id
            else None
        )
        to_category = (
            CategoryRepository.get_by_id(params.to_parent_id)
            if params.to_parent_id
            else None
        )

        self._enforce_manage_ownership(from_category, user)
        self._enforce_manage_ownership(to_category, user)

        target_category = self._category_repository.get_by_id(category_id)

        self._category_repository.update_parent(
            target_category,
            params.to_parent_id,
            to_category.level + 1 if to_category else 0,
        )

    def delete(self, category_id: int, user: AuthenticatedUser) -> None:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        return self._category_repository.delete(target_category, True, True)
