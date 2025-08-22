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

    def create(self, role_edit: RoleEdit) -> RoleModel:
        """
        Create a new role.
        """
        self.enforce_name_uniqueness(role_edit.name)

        role = RoleModel(
            name=role_edit.name, description=role_edit.description
        )
        role.general_permissions = role_edit.general_permissions
        role.ownership_permissions = role_edit.ownership_permissions

        return self.save(role)

    def update(self, role_model: RoleModel, role_edit: RoleEdit) -> RoleModel:
        """
        Update an existing role.
        """
        self.enforce_name_uniqueness(role_edit.name, role_model.id)

        role_model.name = role_edit.name
        role_model.description = role_edit.description
        role_model.general_permissions = role_edit.general_permissions
        role_model.ownership_permissions = role_edit.ownership_permissions

        return self.save(role_model)
