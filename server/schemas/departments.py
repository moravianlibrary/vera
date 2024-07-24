from pydantic import BaseModel
from typing import List
from models import Department


class DepartmentCreate(BaseModel):
    abbreviation: str
    name: str
    users: List[str] = []

    def load_to_model(self, model: Department) -> Department:
        model.abbreviation = self.abbreviation
        model.name = self.name
        return model


class DepartmentResponse(DepartmentCreate):
    id: int
