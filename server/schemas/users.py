from pydantic import BaseModel
from typing import List, Optional
from datatypes import ActionType, JsonBase


class CurrentUser(BaseModel):
    class Config:
        from_attibutes = True

    username: str
    settings: JsonBase = {}

    role_id: int
    role_name: str
    actions: List[ActionType]

    department_id: Optional[int] = None
    department_name: Optional[str] = None
    department_categories_ids: Optional[List[int]] = None

    def has_action(self, action: ActionType) -> bool:
        return action in self.actions


class UserResponse(BaseModel):
    username: str
