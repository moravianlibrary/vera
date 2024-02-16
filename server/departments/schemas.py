from pydantic import BaseModel
from typing import List


class DepartmentBase(BaseModel):
    abbreviation: str
    name: str


class DepartmentCreate(DepartmentBase):
    pass


class Department(DepartmentBase):
    id: int
    users: List[str] = []
