from pydantic import BaseModel
from typing import List, Optional
from roles.enums import ActionType


class CurrentUser(BaseModel):
    username: str
    department_id: Optional[int]
    department_name: Optional[str]
    role_id: int
    role_name: str
    actions: List[ActionType]


class User(BaseModel):
    username: str
