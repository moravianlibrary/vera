from pydantic import BaseModel
from typing import List, Optional
from datatypes import ActionType, JsonBase


class CurrentUser(BaseModel):
    username: str
    settings: JsonBase

    role_id: int
    role_name: str
    actions: List[ActionType]

    department_id: Optional[int]
    department_name: Optional[str]
    department_categories_ids: List[int] = []

    def has_action(self, action: ActionType) -> bool:
        return action in self.actions


class UserResponse(BaseModel):
    username: str
