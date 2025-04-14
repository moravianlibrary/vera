from typing import Any, Dict, List

from pydantic import BaseModel

from .group import Group
from .role import Permissions, Role

UserSettings = Dict[str, Any]


class AuthenticatedUser(Permissions):
    username: str
    roles: List[Role]
    groups: List[Group] = []


class UserNotifications(BaseModel):
    pass
