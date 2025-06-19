from definitions.permission import OwnershipPermission, OwnershipScope
from repositories.category import CategoryRepository
from repositories.models.category import CategoryModel
from schemas.category import CategoryAssignmentChange, CategoryEdit
from schemas.user import AuthenticatedUser


class CategoryService:
    def __init__(self, category_repository: CategoryRepository):
        self._category_repository = category_repository

    def _enforce_ownership(
        target_category: CategoryModel | None,
        permission: OwnershipPermission,
        user: AuthenticatedUser,
    ) -> None:
        user_scope = user.get_scope(permission)

        if user_scope == OwnershipScope.All:
            return

        if target_category is None:
            raise ValueError(
                f"User {user.username} does not have permission "
                f"{permission} for any category."
            )

        if any(user.user_id == u.id for u in target_category.indirect_users):
            return

        if user_scope == OwnershipScope.Own:
            raise ValueError(
                f"User {user.username} does not have permission "
                f"{permission} for category {target_category.id}."
            )

        if any(
            g.id in user.group_ids for g in target_category.indirect_groups
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
        self._enforce_manage_ownership(
            target_category, OwnershipPermission.ManageCategories, user
        )

    def create(
        self,
        parent_id: int | None,
        category: CategoryEdit,
        user: AuthenticatedUser,
        project_id: int | None = None,
    ) -> None:
        parent_category = (
            self._category_repository.get_by_id(parent_id)
            if parent_id
            else None
        )

        self._enforce_manage_ownership(parent_category, user)

        return self._category_repository.create(
            category.name,
            category.description,
            project_id,
            parent_id,
            parent_category.level + 1 if parent_category else 0,
            category.assignable,
            category.extract_whole,
        )

    def update(
        self, category_id: int, category: CategoryEdit, user: AuthenticatedUser
    ) -> None:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        self._category_repository.update(
            target_category.id,
            category.name,
            category.description,
            category.assignable,
            category.extract_whole,
            category.disabled,
        )

    def change_assignment(
        self,
        category_id: int,
        category_assignment_change: CategoryAssignmentChange,
        user: AuthenticatedUser,
    ) -> None:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        user_ids = {u.id for u in target_category.assigned_users} | set(
            category_assignment_change.add.user_ids
        ) - set(category_assignment_change.remove.user_ids)

        group_ids = {g.id for g in target_category.assigned_groups} | set(
            category_assignment_change.add.group_ids
        ) - set(category_assignment_change.remove.group_ids)

        self._category_repository.update_assingment(
            target_category.id, user_ids, group_ids
        )

    def change_parent(
        self,
        category_id: int,
        from_parent_id: int | None,
        to_parent_id: int | None,
        user: AuthenticatedUser,
    ) -> None:
        from_category = (
            CategoryRepository.get_by_id(from_parent_id)
            if from_parent_id
            else None
        )
        to_category = (
            CategoryRepository.get_by_id(to_parent_id)
            if to_parent_id
            else None
        )

        self._enforce_manage_ownership(from_category, user)
        self._enforce_manage_ownership(to_category, user)

        target_category = self._category_repository.get_by_id(category_id)

        self._category_repository.update_parent(
            target_category.id,
            to_parent_id,
            to_category.level + 1 if to_category else 0,
        )

    def delete(self, category_id: int, user: AuthenticatedUser) -> None:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        return self._category_repository.delete(target_category, True, True)
