from requests import Session

from ._base import BaseRepository
from ._mixins import (
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
)
from .models import GroupModel


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

    def create(self, name: str, description: str) -> GroupModel:
        """
        Create a new group.
        """
        self.enforce_name_uniqueness(name)
        return self.save(GroupModel(name=name, description=description))

    def update(self, role_id: int, name: str, description: str) -> GroupModel:
        """
        Update an existing role.
        """
        role_model: GroupModel = self.get_by_id(role_id)
        self.enforce_name_uniqueness(name, role_id)
        role_model.name = name
        role_model.description = description
        return self.save(role_model)
