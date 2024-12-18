from pydantic import BaseModel
from typing import List
from models import Department
from .base_es_model import BaseEsModel, Integer, Keyword


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
    id: Integer
    name: Keyword
    abbreviation: Keyword
    usernames: List[Keyword]
