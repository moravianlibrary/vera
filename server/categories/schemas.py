from pydantic import BaseModel
from typing import List, Optional


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    parent_id: Optional[int] = None
    assignable: bool = True
    percentage: float = 0
    disabled: bool = True


class CategoryCreated(CategoryBase):
    id: int
    level: int


class Category(CategoryCreated):
    departments: List[int] = []


class CategoryNode(Category):
    children: List[Category] = []


class CategoryPercentage(BaseModel):
    id: int
    percentage: float


class CategoryDescriptor(CategoryBase):
    id: int
