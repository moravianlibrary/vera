from adapters.database import DatabaseSession
from schemas.role import RoleEdit

from ._base import BaseRepository
from ._mixins import (
    DeleteMixin,
    EnforceNameUniquenessMixin,
    FindByNameMixin,
    FindByNamesMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
)
from .models.role import RoleModel


class RoleRepository(
    BaseRepository,
    DeleteMixin[RoleModel],
    EnforceNameUniquenessMixin[RoleModel, int],
    FindByNameMixin[RoleModel],
    FindByNamesMixin[RoleModel],
    GetByIdMixin[RoleModel, int],
    PaginationMixin[RoleModel],
    SaveMixin[RoleModel],
):
    def __init__(self, db_session: DatabaseSession):
        super().__init__(db_session, RoleModel, "Role")

    def create(self, role: RoleEdit) -> RoleModel:
        """
        Create a new role.
        """
        self.enforce_name_uniqueness(role.name)

        return self.save(
            RoleModel(name=role.name, description=role.description)
        )

    def update(self, role_model: RoleModel, role: RoleEdit) -> RoleModel:
        """
        Update an existing role.
        """
        self.enforce_name_uniqueness(role.name, role_model.id)

        role_model.name = role.name
        role_model.description = role.description

        return self.save(role_model)
