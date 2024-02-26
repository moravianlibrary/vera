from pydantic import BaseModel
from typing import List


class DepartmentBase(BaseModel):
    abbreviation: str
    name: str
    users: List[str] = []


class DepartmentCreate(DepartmentBase):
    pass


class Department(DepartmentBase):
    id: int
