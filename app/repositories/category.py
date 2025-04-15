from requests import Session

from adapters.elasticsearch import EsSession
from schemas import Category, EsQuery

from ._base import BaseRepository
from ._mixins import (
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    SaveMixin,
)
from .models import CategoryModel


class CategoryRepository(
    BaseRepository,
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    SaveMixin,
):
    def __init__(self, db_session: Session, es_session: EsSession):
        super().__init__(db_session, CategoryModel, "Category")

    # TODO: Implement search method and move to SearchMixin
    def search(self, query: EsQuery[Category]):
        pass

    def create(self, name: str, description: str) -> CategoryModel:
        """
        Create a new group.
        """
        self.enforce_name_uniqueness(name)
        return self.save(CategoryModel(name=name, description=description))

    def update(
        self, role_id: int, name: str, description: str
    ) -> CategoryModel:
        """
        Update an existing role.
        """
        role_model: CategoryModel = self.get_by_id(role_id)
        self.enforce_name_uniqueness(name, role_id)
        role_model.name = name
        role_model.description = description
        return self.save(role_model)
