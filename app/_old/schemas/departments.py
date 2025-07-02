from typing import List

from models import Department
from pydantic import BaseModel

from .base_es_model import BaseEsModel, int, str


class DepartmentCreate(BaseModel):
    abbreviation: str
    name: str
    usernames: List[str] = []

    def load_to_model(self, model: Department) -> Department:
        model.abbreviation = self.abbreviation
        model.name = self.name
        return model


class DepartmentResponse(DepartmentCreate):
    class Config:
        from_attributes = True

    id: int


class IndexDepartment(BaseEsModel):
    id: int
    name: str
    abbreviation: str
    usernames: List[str]
