from adapters.database import DatabaseSession
from schemas.plugin import PluginInstanceEdit

from ._db_repository import (
    DbRepository,
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
    DbRepository,
):
    pass


class PluginInstanceRepository(
    DbRepository,
    DeleteMixin[PluginInstanceModel],
    EnforceNameUniquenessMixin[PluginInstanceModel, int],
    FindByNameMixin[PluginInstanceModel],
    FindByNamesMixin[PluginInstanceModel],
    GetByIdMixin[PluginInstanceModel, int],
    PaginationMixin[PluginInstanceModel],
    SaveMixin[PluginInstanceModel],
):
    def __init__(self, db_session: DatabaseSession):
        super().__init__(db_session, PluginInstanceModel, "PluginInstance")

    def create(self, instance: PluginInstanceEdit) -> PluginInstanceModel:
        """
        Create a new instance.
        """
        self.enforce_name_uniqueness(instance.name)

        return self.save(
            PluginInstanceModel(
                name=instance.name,
                description=instance.description,
            )
        )

    def update(
        self,
        instance_model: PluginInstanceModel,
        instance: PluginInstanceEdit,
    ) -> PluginInstanceModel:
        """
        Update an existing instance.
        """
        self.enforce_name_uniqueness(instance.name, instance_model.id)

        instance_model.name = instance.name
        instance_model.description = instance.description

        return self.save(instance_model)
