from pydantic import BaseModel, computed_field
from typing import List, Optional
from security.types import ActionType


# User schemas
class CurrentUser(BaseModel):
    username: str
    department_id: Optional[int]
    department_name: Optional[str]
    role_id: int
    role_name: str
    actions: List[ActionType]


class User(BaseModel):
    username: str


# Role schemas
class RoleCreate(BaseModel):
    name: str
    actions: List[ActionType]


class RoleAction(BaseModel):
    role_id: int
    action: ActionType


# Extend BaseModel because it is not possible to
# override field with computed field
class Role(BaseModel):
    id: int
    name: str
    role_actions: List[RoleAction]

    @computed_field
    @property
    def actions(self) -> List[ActionType]:
        return [role_action.action for role_action in self.role_actions]

    class Config:
        from_attributes = True


# Department schemas
class DepartmentCreate(BaseModel):
    abbreviation: str
    name: str
    users: List[str] = []


class Department(DepartmentCreate):
    id: int


ActionList = List[ActionType]
