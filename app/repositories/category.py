from requests import Session

from adapters.indexer import IndexerSession
from schemas.category import Category

from ._base import BaseRepository
from ._mixins import (
    ArchiveOnDeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    SaveMixin,
    SearchMixin,
)
from .models.category import CategoryModel


class CategoryRepository(
    BaseRepository,
    ArchiveOnDeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    SaveMixin,
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
        return self.save(
            CategoryModel(
                name=name,
                description=description,
                project_id=project_id,
                parent_id=parent_id,
                level=level,
                assignable=assignable,
                extract_whole=extract_whole,
            )
        )

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
        category_model: CategoryModel = self.get_by_id(category_id)
        self.enforce_name_uniqueness(name, category_id)
        category_model.name = name
        category_model.description = description
        category_model.assignable = assignable
        category_model.extract_whole = extract_whole
        category_model.disabled = disabled
        return self.save(category_model)

    def update_parent(
        self, category_id: int, parent_id: int | None, level: int
    ) -> CategoryModel:
        """
        Update the parent of a category.
        """
        category_model: CategoryModel = self.get_by_id(category_id)
        category_model.parent_id = parent_id
        category_model.level = level
        return self.save(category_model)
