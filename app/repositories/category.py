from typing import List

from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
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
        print(db_session)
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
        saved_category = await self.save(category_model)
        reindex = [saved_category]

        while reindex:
            current_category = reindex.pop()
            self._indexer_session.index(current_category)
            reindex.extend(current_category.children)

        return saved_category

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

    def update_assignment(
        self,
        category_model: CategoryModel,
        users: List[UserModel],
        groups: List[GroupModel],
    ) -> CategoryModel:
        """
        Update the assignment of a category.
        """
        category_model.direct_users = users
        category_model.direct_groups = groups

        return self.save_and_refresh_subtree(category_model)

    def update_parent(
        self, category_model: CategoryModel, parent_id: int | None, level: int
    ) -> CategoryModel:
        """
        Update the parent of a category.
        """
        category_model.parent_id = parent_id
        category_model.level = level

        self.save(category_model)

        subcategories = category_model.children
        while subcategories:
            child = subcategories.pop()
            child.level = child.parent.level + 1
            self.save(child)
            subcategories.extend(child.children)

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
