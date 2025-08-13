from schemas.role import RoleEdit

from ._db_repository import (
    DbRepository,
    EnforceNameUniquenessMixin,
    FindByNameMixin,
    FindByNamesMixin,
    GetByIdMixin,
    PaginationMixin,
)
from .models.role import RoleModel


class RoleRepository(
    DbRepository[RoleModel],
    FindByNameMixin[RoleModel],
    FindByNamesMixin[RoleModel],
    GetByIdMixin[RoleModel, int],
    PaginationMixin[RoleModel],
    EnforceNameUniquenessMixin[RoleModel, int],
):
    _entity_name = "Role"
    _db_model = RoleModel

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
