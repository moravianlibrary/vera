from pydantic import BaseModel, model_validator
from typing import List, Optional, Any
from datatypes import ActionType, JsonBase
from models import User


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
    class Config:
        from_attibutes = True

    username: str

    @model_validator(mode="before")
    @classmethod
    def validate_model(cls, data: Any) -> Any:
        if isinstance(data, User):
            return {"username": data.username}
        return data
