from pydantic import BaseModel
from typing import List
from .enums import ActionType


class RoleBase(BaseModel):
    name: str


class RoleCreate(RoleBase):
    actions: List[ActionType]


class Role(RoleBase):
    id: int


class RoleActions(Role):
    actions: List[ActionType]


class RolesResponse(BaseModel):
    roles: List[Role]


class RolesActionsResponse(BaseModel):
    roles: List[RoleActions]
