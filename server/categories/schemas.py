from pydantic import BaseModel, SerializeAsAny
from typing import List, Optional

from roles.types import ActionType


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    parent_id: Optional[int] = None
    assignable: bool = False
    percentage: float = 0
    extract_whole: bool = False
    disabled: bool = False
    departments: List[int] = []


class Category(CategoryCreate):
    id: int
    level: int

    def __acl__(self):
        acl = [
            ("allow", f"action:{ActionType.ReadCategoriesAll}", "read"),
            (
                "allow",
                f"action:{ActionType.EditCategoriesAll}",
                ["update", "delete"],
            ),
        ]
        acl += [
            (
                "allow",
                f"action:{action},department:{department_id}",
                permissions,
            )
            for department_id in self.departments
            for action, permissions in [
                (ActionType.ReadCategoriesDepartment, "read"),
                (ActionType.EditCategoriesDepartment, ["update", "delete"]),
            ]
        ]
        return acl


class CategoryNode(Category):
    children: List[SerializeAsAny[Category]]
    count_pages: int
    count_pages_extractable: int
    count_documents: int
    count_documents_with_pages: int
    count_documents_extractable: int
    count_documents_without_cnb: int


class CategoryPercentage(BaseModel):
    id: int
    percentage: float


class CategoryDescriptor(CategoryBase):
    id: int
    parent_category: Optional["CategoryDescriptor"] = None
    children_categories: Optional[List["CategoryDescriptor"]] = None
