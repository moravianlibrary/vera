from pydantic import BaseModel
from typing import List
from .types import ActionType


class RoleBase(BaseModel):
    name: str


class RoleCreate(RoleBase):
    actions: List[ActionType]


class Role(RoleBase):
    id: int


class RoleActions(Role):
    actions: List[ActionType]
