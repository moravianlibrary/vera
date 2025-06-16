from typing import Any, Dict, List

from pydantic import BaseModel, model_validator

from definitions.json import JsonObject

from .group import Group
from .role import Permissions, Role

UserSettings = JsonObject


class AuthenticatedUser(Permissions):
    user_id: str
    username: str
    roles: List[Role]
    groups: List[Group] = []

    @property
    def group_ids(self) -> List[int]:
        return [group.id for group in self.groups]

    @classmethod
    def from_roles(cls, roles: List["Role"]) -> "Permissions":
        general_permissions = []
        ownership_permissions = []

        for role in roles:
            general_permissions.extend(role.general_permissions)
            ownership_permissions.extend(role.ownership_permissions)

        return cls(
            general_permissions=list(set(general_permissions)),
            ownership_permissions=list(set(ownership_permissions)),
        )

    @model_validator(mode="before")
    def validate_permissions(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        return values


class UserNotifications(BaseModel):
    pass


class User(BaseModel):
    user_id: str
    username: str
