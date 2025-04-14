from typing import Any, Dict, List

from pydantic import BaseModel

from .group import Group
from .role import Role

UserSettings = Dict[str, Any]


class CurrentUser(BaseModel):
    username: str
    settings: UserSettings
    roles: List[Role]
    groups: List[Group] = []


class UserNotifications(BaseModel):
    pass
