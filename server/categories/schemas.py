from pydantic import BaseModel, SerializeAsAny
from typing import List, Optional


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    parent_id: Optional[int] = None
    assignable: bool = False
    percentage: float = 0
    disabled: bool = False
    departments: List[int] = []


class Category(CategoryCreate):
    id: int
    level: int


class CategoryNode(Category):
    children: List[SerializeAsAny[Category]]
    count_pages: int
    count_documents_with_pages: int
    count_documents: int


class CategoryPercentage(BaseModel):
    id: int
    percentage: float


class CategoryDescriptor(CategoryBase):
    id: int
    parent_category: Optional['CategoryDescriptor'] = None
