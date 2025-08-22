from decimal import Decimal
from typing import List

from adapters.indexer import IndexerQuery
from definitions.permission import OwnershipPermission, OwnershipScope
from definitions.task import CategoryTask, TaskScope
from errors.category import (
    ActiveDistributionDeletionError,
    CategoryNotChildError,
    DifferentParentIDsException,
    InvalidChildProportionsError,
    InvalidTopLevelProportionsError,
)
from repositories.category import CategoryRepository, DistributionRepository
from repositories.group import GroupRepository
from repositories.models.category import CategoryModel
from repositories.models.task import TaskModel, TaskOrScheduleModel
from repositories.task import TaskRepository, TaskScheduleRepository
from repositories.user import UserRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.category import (
    Category,
    CategoryEdit,
    CategoryParentChangeParams,
    CategoryProportionNode,
    DistributionProportionsEdit,
    DocumentDiscoveryTaskData,
)
from schemas.common import AssignmentChange
from schemas.task import TaskScheduleParams
from services.task import TaskAndScheduleBasedService

TASK_TYPE_NAMES_MAPPING = {
    CategoryTask.Reindex: "Reindex categories",
    CategoryTask.DocumentDiscovery: "Run document discovery",
}
REINDEX_AFTER_UPDATING_PROPORTIONS = (
    "Reindex categories after updating proportions"
)
REINDEX_AFTER_DELETING_DISTRIBUTION = (
    "Reindex categories after deleting distribution"
)


class CategoryService(TaskAndScheduleBasedService):
    _task_scope = TaskScope.Category
    _task_names_mapping = TASK_TYPE_NAMES_MAPPING

    def __init__(
        self,
        category_repository: CategoryRepository,
        distribution_repository: DistributionRepository,
        group_repository: GroupRepository,
        user_repository: UserRepository,
        task_repository: TaskRepository,
        task_schedule_repository: TaskScheduleRepository,
    ):
        super().__init__(task_repository, task_schedule_repository)
        self._category_repository = category_repository
        self._distribution_repository = distribution_repository
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
    ) -> Category:
        parent_category = (
            self._category_repository.get_by_id(parent_id)
            if parent_id
            else None
        )

        self._enforce_manage_ownership(parent_category, user)

        return self._category_repository.serialize_entity(
            await self._category_repository.create(
                category.name,
                category.description,
                project_id,
                parent_id,
                parent_category.level + 1 if parent_category else 1,
                category.assignable,
                category.extract_whole,
            )
        )

    async def update(
        self, category_id: int, category: CategoryEdit, user: AuthenticatedUser
    ) -> Category:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        return self._category_repository.serialize_entity(
            await self._category_repository.update(
                target_category,
                category.name,
                category.description,
                category.assignable,
                category.extract_whole,
                category.disabled,
            )
        )

    async def change_assignment(
        self,
        category_id: int,
        assignment_change: AssignmentChange,
        user: AuthenticatedUser,
    ) -> Category:
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

        return self._category_repository.serialize_entity(
            await self._category_repository.update_assignment(
                target_category,
                [
                    self._group_repository.get_by_id(group_id)
                    for group_id in group_ids
                ],
                [
                    self._user_repository.get_by_id(user_id)
                    for user_id in user_ids
                ],
            )
        )

    async def change_parent(
        self,
        category_id: int,
        params: CategoryParentChangeParams,
        user: AuthenticatedUser,
    ) -> Category:
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

        return self._category_repository.serialize_entity(
            await self._category_repository.update_parent(
                target_category,
                params.to_parent_id,
                to_category.level + 1 if to_category else 1,
            )
        )

    async def change_document_discovery(
        self,
        category_id: int,
        plugin_instance_id: int | None,
        user: AuthenticatedUser,
    ) -> Category:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        return self._category_repository.serialize_entity(
            await self._category_repository.change_document_discovery(
                target_category, plugin_instance_id
            )
        )

    async def reindex(
        self,
        query: IndexerQuery,
        created_by: str,
        schedule_params: TaskScheduleParams,
    ) -> TaskOrScheduleModel:
        return await self._create_or_schedule_task(
            CategoryTask.Reindex, created_by, schedule_params, query
        )

    async def run_document_discovery(
        self,
        category_id: int,
        created_by: str,
        schedule_params: TaskScheduleParams,
    ) -> TaskOrScheduleModel:
        target_category = self._category_repository.get_by_id(category_id)

        return await self._create_or_schedule_task(
            CategoryTask.DocumentDiscovery,
            created_by,
            schedule_params,
            data=DocumentDiscoveryTaskData(
                category_id=category_id,
                plugin_instance_id=target_category.document_discovery_id,
            ),
        )

    async def delete(
        self, category_id: int, user: AuthenticatedUser
    ) -> Category:
        target_category = self._category_repository.get_by_id(category_id)

        self._enforce_manage_ownership(target_category.parent, user)

        return self._category_repository.serialize_entity(
            await self._category_repository.delete(target_category, True, True)
        )

    async def update_proportions(
        self,
        distribution_id: int,
        proportions: DistributionProportionsEdit,
        created_by: str,
    ) -> TaskModel:
        distribution = self._distribution_repository.get_by_id(distribution_id)

        def _validate_proportions(
            nodes: List[CategoryProportionNode], parent_id: int | None = None
        ):
            total = Decimal("0.0000")
            for node in nodes:
                category = self._category_repository.get_by_id(
                    node.category_id
                )
                if category.parent_id != parent_id:
                    raise CategoryNotChildError(node.category_id, parent_id)

                total += node.proportion

            if total != Decimal("0.0000") and total != Decimal("1.0000"):
                if parent_id is None:
                    raise InvalidTopLevelProportionsError(total)
                raise InvalidChildProportionsError(parent_id, total)

            for node in nodes:
                if node.children:
                    _validate_proportions(
                        node.children, parent_id=node.category_id
                    )

        _validate_proportions(proportions.root_proportions)

        self._distribution_repository.update_proportions(
            distribution, proportions.root_proportions
        )

        return await self._create_task(
            CategoryTask.Reindex,
            created_by,
            IndexerQuery.model_validate({"query": {"match_all": {}}}),
            name=REINDEX_AFTER_UPDATING_PROPORTIONS,
        )

    async def delete_distribution(
        self, distribution_id: int, created_by: str
    ) -> TaskModel:
        distribution = self._distribution_repository.get_by_id(distribution_id)

        if distribution.is_active:
            raise ActiveDistributionDeletionError()

        self._distribution_repository.delete(distribution)

        return await self._create_task(
            CategoryTask.Reindex,
            created_by,
            IndexerQuery.model_validate({"query": {"match_all": {}}}),
            name=REINDEX_AFTER_DELETING_DISTRIBUTION,
        )
