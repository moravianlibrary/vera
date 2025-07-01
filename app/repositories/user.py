from adapters.database import DatabaseSession
from definitions.json import JsonObject

from ._base import BaseRepository
from ._mixins import (
    EnforceNameUniquenessMixin,
    FindByIdMixin,
    FindByNameMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
)
from .models.user import UserModel


class UserRepository(
    BaseRepository,
    EnforceNameUniquenessMixin[UserModel, str],
    FindByIdMixin[UserModel, str],
    FindByNameMixin[UserModel],
    GetByIdMixin[UserModel, str],
    PaginationMixin[UserModel],
    SaveMixin[UserModel],
):
    def __init__(self, db_session: DatabaseSession):
        super().__init__(db_session, UserModel, "User")

    def create(self, user_id: str, username: str) -> UserModel:
        """
        Create a new role.
        """
        self.enforce_name_uniqueness(username)
        return self.save(UserModel(id=user_id, username=username))

    def update_name(self, user_model: UserModel, username: str) -> UserModel:
        """
        Update an existing role.
        """
        self.enforce_name_uniqueness(username, user_model.id)
        user_model.username = username
        return self.save(user_model)

    def update_settings(
        self, user_model: UserModel, settings: JsonObject
    ) -> UserModel:
        """
        Update an existing role.
        """
        user_model.settings = settings
        return self.save(user_model)
