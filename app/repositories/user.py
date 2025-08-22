from schemas.user import UserSettings

from ._db_repository import (
    DbRepository,
    EnforceNameUniquenessMixin,
    FindByIdMixin,
    FindByNameMixin,
    GetByIdMixin,
    PaginationMixin,
)
from .models.user import UserModel


class UserRepository(
    DbRepository[UserModel],
    FindByIdMixin[UserModel, str],
    FindByNameMixin[UserModel],
    GetByIdMixin[UserModel, str],
    PaginationMixin[UserModel],
    EnforceNameUniquenessMixin[UserModel, str],
):
    _entity_name = "User"
    _db_model = UserModel

    def create(self, user_id: str, username: str, email: str) -> UserModel:
        self.enforce_name_uniqueness(username)
        return self.save(UserModel(id=user_id, username=username, email=email))

    def update_name(self, user_model: UserModel, username: str) -> UserModel:
        self.enforce_name_uniqueness(username, user_model.id)
        user_model.username = username
        return self.save(user_model)

    def update_settings(
        self, user_model: UserModel, settings: UserSettings
    ) -> UserModel:
        user_model.settings = settings.model_dump()
        return self.save(user_model)
