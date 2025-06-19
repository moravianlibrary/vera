from requests import Session

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
    SaveMixin[UserModel, str],
):
    def __init__(self, db_session: Session):
        super().__init__(db_session, UserModel, "User")

    def create(self, user_id: str, username: str) -> UserModel:
        """
        Create a new role.
        """
        self.enforce_name_uniqueness(username)
        return self.save(UserModel(id=user_id, username=username))

    def update_name(self, user_id: str, username: str) -> UserModel:
        """
        Update an existing role.
        """
        user_model: UserModel = self.get_by_id(user_id)
        self.enforce_name_uniqueness(username, user_id)
        user_model.username = username
        return self.save(user_model)

    def update_settings(self, user_id: str, settings: JsonObject) -> UserModel:
        """
        Update an existing role.
        """
        user_model: UserModel = self.get_by_id(user_id)
        user_model.settings = settings
        return self.save(user_model)
