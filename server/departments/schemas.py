from pydantic import BaseModel


class DepartmentBase(BaseModel):
    # abbreviation: str
    name: str


class DepartmentCreate(DepartmentBase):
    pass


class Department(DepartmentBase):
    id: int
