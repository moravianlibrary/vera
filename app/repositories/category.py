from typing import List

from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from definitions.category import ALLOWED_LEVELS
from errors.category import CycleDetectedError, InvalidLevelError
from repositories.models.group import GroupModel
from repositories.models.user import UserModel
from schemas.category import Category

from ._db_indexed_repository import DbIndexedRepository
from ._db_repository import (
    DbRepository,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
)
from .models.category import CategoryModel, CategoryProportionModel


class CategoryRepository(
    DbIndexedRepository[CategoryModel, Category],
    GetByIdMixin[CategoryModel, int],
    EnforceNameUniquenessMixin,
):
    def __init__(
        self, db_session: DatabaseSession, indexer_session: IndexerSession
    ):
        super().__init__(
            "Category", db_session, CategoryModel, indexer_session, Category
        )

    def serialize_entity(self, db_entity):
        index_entity = super().serialize_entity(db_entity)
        return index_entity

    async def create(
        self,
        name: str,
        description: str,
        project_id: int | None,
        parent_id: int | None,
        level: int,
        assignable: bool,
        extract_whole: bool,
    ) -> CategoryModel:
        """
        Create a new group.
        """
        self.enforce_name_uniqueness(name)
        return await self.save(
            CategoryModel(
                name=name,
                description=description,
                project_id=project_id,
                parent_id=parent_id,
                level=level,
                assignable=assignable,
                extract_whole=extract_whole,
            ),
            wait_for=True,
        )

    async def save_and_refresh_subtree(
        self, category_model: CategoryModel
    ) -> CategoryModel:
        """
        Save the category model and refresh its subtree in the indexer.
        """
        categories = [category_model]

        children = list(category_model.children)
        while children:
            current_child = children.pop()
            categories.append(current_child)
            children.extend(current_child.children)

        await self.save_bulk(categories, wait_for=True)

        return category_model

    async def update(
        self,
        category_model: CategoryModel,
        name: str,
        description: str,
        assignable: bool,
        extract_whole: bool,
        disabled: bool,
    ) -> CategoryModel:
        """
        Update an existing role.
        """
        self.enforce_name_uniqueness(name, category_model.id)

        category_model.name = name
        category_model.description = description
        category_model.assignable = assignable
        category_model.extract_whole = extract_whole
        category_model.disabled = disabled

        return await self.save(category_model)

    async def update_assignment(
        self,
        category_model: CategoryModel,
        groups: List[GroupModel],
        users: List[UserModel],
    ) -> CategoryModel:
        """
        Update the assignment of a category.
        """
        category_model.direct_groups = groups
        category_model.direct_users = users

        return await self.save_and_refresh_subtree(category_model)

    async def update_parent(
        self, category_model: CategoryModel, parent_id: int | None, level: int
    ) -> CategoryModel:
        """
        Update the parent of a category
        and propagate level changes to descendants.
        Prevents cycles and enforces MAX_HEIGHT limit.
        All changes are saved at the end.
        """
        visited = set()
        updated_models = []

        # Assign new parent and level
        category_model.parent_id = parent_id
        category_model.level = level
        updated_models.append(category_model)
        visited.add(category_model.id)

        # DFS stack
        stack = [(child, level + 1) for child in category_model.children]

        max_depth = level

        while stack:
            child, current_level = stack.pop()

            if child.id in visited:
                raise CycleDetectedError(category_model.id)

            visited.add(child.id)

            if current_level not in ALLOWED_LEVELS:
                raise InvalidLevelError(category_model.id, current_level)

            child.level = current_level
            updated_models.append(child)

            stack.extend(
                (grandchild, current_level + 1)
                for grandchild in child.children
            )

            max_depth = max(max_depth, current_level)

        await self.save_bulk(updated_models)

        return category_model


class CategoryProportionRepository(DbRepository[CategoryProportionModel]):
    def __init__(self, db_session: DatabaseSession):
        super().__init__(
            "CategoryProportion", db_session, CategoryProportionModel
        )

    def create(
        self, distribution_id: int, category_id: int, proportion: float
    ) -> CategoryProportionModel:
        """
        Create a new category proportion.
        """
        return self.save(
            CategoryProportionModel(
                category_id=category_id,
                distribution_id=distribution_id,
                proportion=proportion,
            )
        )
