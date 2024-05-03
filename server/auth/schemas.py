from pydantic import BaseModel
from typing import List, Optional
from roles.types import ActionType
from auth.types import PermissionType


class CurrentUser(BaseModel):
    username: str
    department_id: Optional[int]
    department_name: Optional[str]
    role_id: int
    role_name: str
    actions: List[ActionType]


class User(BaseModel):
    username: str


class Permission(BaseModel):
    type: PermissionType
    action: Optional[ActionType] = None
    department: Optional[int] = None
    user: Optional[str] = None
