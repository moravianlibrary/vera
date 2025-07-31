from typing import List

from adapters.database import DatabaseSession
from repositories.models.user import UserModel
from schemas.group import GroupEdit

from ._db_repository import (
    DbRepository,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
)
from .models.group import GroupModel


class GroupRepository(
    DbRepository[GroupModel],
    GetByIdMixin[GroupModel, int],
    PaginationMixin[GroupModel],
    EnforceNameUniquenessMixin[GroupModel, int],
):
    def __init__(self, db_session: DatabaseSession):
        super().__init__("Group", db_session, GroupModel)

    def create(self, group: GroupEdit) -> GroupModel:
        """
        Create a new group.
        """
        self.enforce_name_uniqueness(group.name)

        return self.save(
            GroupModel(name=group.name, description=group.description)
        )

    def update(self, group_model: GroupModel, group: GroupEdit) -> GroupModel:
        """
        Update an existing group.
        """
        self.enforce_name_uniqueness(group.name, group_model.id)

        group_model.name = group.name
        group_model.description = group.description

        return self.save(group_model)

    def update_assingment(
        self, group_model: GroupModel, users: List[UserModel]
    ) -> GroupModel:
        """
        Update the assignment of users to a group.
        """
        group_model.users = users

        return self.save(group_model)
