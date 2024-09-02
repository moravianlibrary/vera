from pydantic import BaseModel
from typing import List
from datatypes import ActionType
from models import Role


class RoleCreate(BaseModel):
    name: str
    actions: List[ActionType]

    def load_to_model(self, model: Role) -> Role:
        model.name = self.name
        model.actions = self.actions
        return model


class RoleResponse(BaseModel):
    id: int
    name: str
    actions: List[ActionType]


class ActionList(BaseModel):
    actions: List[ActionType]
