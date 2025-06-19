from requests import Session

from adapters.indexer import IndexerSession
from repositories.models.group import GroupModel
from repositories.models.user import UserModel
from schemas.category import Category

from ._base import BaseRepository
from ._mixins import (
    ArchiveOnDeleteAndIndexMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    SaveAndIndexMixin,
    SearchMixin,
)
from .models.category import CategoryModel


class CategoryRepository(
    BaseRepository,
    ArchiveOnDeleteAndIndexMixin[CategoryModel],
    EnforceNameUniquenessMixin,
    GetByIdMixin[CategoryModel],
    SaveAndIndexMixin[CategoryModel],
    SearchMixin[Category],
):
    def __init__(self, db_session: Session, indexer_session: IndexerSession):
        super().__init__(
            db_session, CategoryModel, "Category", indexer_session
        )

    def create(
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
        return self.save_and_index(
            CategoryModel(
                name=name,
                description=description,
                project_id=project_id,
                parent_id=parent_id,
                level=level,
                assignable=assignable,
                extract_whole=extract_whole,
            ),
            True,
        )

    def save_and_refresh_subtree(
        self, category_model: CategoryModel
    ) -> CategoryModel:
        """
        Save the category model and refresh its subtree in the indexer.
        """
        saved_category = self.save(category_model)
        reindex = [saved_category]

        while reindex:
            current_category = reindex.pop()
            self._indexer_session.index(current_category)
            reindex.extend(current_category.children)

        return saved_category

    def update(
        self,
        category_id: int,
        name: str,
        description: str,
        assignable: bool,
        extract_whole: bool,
        disabled: bool,
    ) -> CategoryModel:
        """
        Update an existing role.
        """
        category_model = self.get_by_id(category_id)
        self.enforce_name_uniqueness(name, category_id)
        category_model.name = name
        category_model.description = description
        category_model.assignable = assignable
        category_model.extract_whole = extract_whole
        category_model.disabled = disabled
        return self.save(category_model)

    def update_assignment(
        self,
        category_id: int,
        user_ids: list[str],
        group_ids: list[int],
    ) -> CategoryModel:
        """
        Update the assignment of a category.
        """
        category_model = self.get_by_id(category_id)

        category_model.assigned_users = (
            self._database_session.query(UserModel)
            .filter(UserModel.id.in_(user_ids))
            .all()
        )

        category_model.assigned_groups = (
            self._database_session.query(GroupModel)
            .filter(GroupModel.id.in_(group_ids))
            .all()
        )

        return self.save_and_refresh_subtree(category_model)

    def update_parent(
        self, category_id: int, parent_id: int | None, level: int
    ) -> CategoryModel:
        """
        Update the parent of a category.
        """
        category_model = self.get_by_id(category_id)
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
