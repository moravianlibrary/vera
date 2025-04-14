from requests import Session

from ._base import BaseRepository
from ._mixins import (
    DeleteMixin,
    EnforceNameUniquenessMixin,
    FindByNameMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
)
from .models import RoleModel


class RoleRepository(
    BaseRepository,
    DeleteMixin,
    EnforceNameUniquenessMixin,
    FindByNameMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
):
    def __init__(self, db_session: Session):
        super().__init__(db_session, RoleModel, "Role")

    def create(self, name: str, description: str) -> RoleModel:
        """
        Create a new role.
        """
        self.enforce_name_uniqueness(name)
        return self.save(RoleModel(name=name, description=description))

    def update(self, role_id: int, name: str, description: str) -> RoleModel:
        """
        Update an existing role.
        """
        role_model: RoleModel = self.get_by_id(role_id)
        self.enforce_name_uniqueness(name, role_id)
        role_model.name = name
        role_model.description = description
        return self.save(role_model)
