from requests import Session

from schemas.group import GroupEdit

from ._base import BaseRepository
from ._mixins import (
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
)
from .models.group import GroupModel


class GroupRepository(
    BaseRepository,
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
):
    def __init__(self, db_session: Session):
        super().__init__(db_session, GroupModel, "Group")

    def create(self, group: GroupEdit) -> GroupModel:
        """
        Create a new group.
        """
        self.enforce_name_uniqueness(group.name)
        return self.save(
            GroupModel(name=group.name, description=group.description)
        )

    def update(self, role_id: int, group: GroupEdit) -> GroupModel:
        """
        Update an existing role.
        """
        role_model: GroupModel = self.get_by_id(role_id)
        self.enforce_name_uniqueness(group.name, role_id)
        role_model.name = group.name
        role_model.description = group.description
        return self.save(role_model)
