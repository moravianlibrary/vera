from pydantic import BaseModel
from typing import List


class DepartmentBase(BaseModel):
    abbreviation: str
    name: str


class DepartmentCreate(DepartmentBase):
    pass


class Department(DepartmentBase):
    id: int


class DepartmentsResponse(BaseModel):
    departments: List[Department]
