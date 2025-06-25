from requests import Session

from schemas.role import PluginInstanceEdit

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
from .models.plugin import PluginInstanceModel


class PluginRepository(
    BaseRepository,
):
    pass


class PluginInstanceRepository(
    BaseRepository,
    DeleteMixin[PluginInstanceModel],
    EnforceNameUniquenessMixin[PluginInstanceModel, int],
    FindByNameMixin[PluginInstanceModel],
    FindByNamesMixin[PluginInstanceModel],
    GetByIdMixin[PluginInstanceModel, int],
    PaginationMixin[PluginInstanceModel],
    SaveMixin[PluginInstanceModel],
):
    def __init__(self, db_session: Session):
        super().__init__(db_session, PluginInstanceModel, "PluginInstance")

    def create(self, role: PluginInstanceEdit) -> PluginInstanceModel:
        """
        Create a new role.
        """
        self.enforce_name_uniqueness(role.name)

        return self.save(
            PluginInstanceModel(name=role.name, description=role.description)
        )

    def update(
        self, role_model: PluginInstanceModel, role: PluginInstanceEdit
    ) -> PluginInstanceModel:
        """
        Update an existing role.
        """
        self.enforce_name_uniqueness(role.name, role_model.id)

        role_model.name = role.name
        role_model.description = role.description

        return self.save(role_model)
        return self.save(role_model)
