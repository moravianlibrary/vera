from typing import TYPE_CHECKING, List

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Mapped

from adapters.database import BaseModel, connected_with

from .associations import (
    category_group_association,
    group_user_association,
    project_group_association,
)

if TYPE_CHECKING:
    from .category import CategoryModel
    from .project import ProjectModel
    from .user import UserModel


class GroupModel(BaseModel):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)

    users: Mapped[List["UserModel"]] = connected_with(
        "UserModel", group_user_association, "groups"
    )

    categories: Mapped[List["CategoryModel"]] = connected_with(
        "CategoryModel", category_group_association, "assigned_groups"
    )
    projects: Mapped[List["ProjectModel"]] = connected_with(
        "ProjectModel", project_group_association, "groups"
    )
