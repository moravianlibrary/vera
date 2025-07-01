from sqlalchemy import Column, ForeignKey, Table

from adapters.database import BaseModel

category_user_association = Table(
    "category_user_associations",
    BaseModel.metadata,
    Column("category_id", ForeignKey("categories.id"), primary_key=True),
    Column("user_id", ForeignKey("users.id"), primary_key=True),
)

group_user_association = Table(
    "group_user_associations",
    BaseModel.metadata,
    Column("group_id", ForeignKey("groups.id"), primary_key=True),
    Column("user_id", ForeignKey("users.id"), primary_key=True),
)

project_user_association = Table(
    "project_user_associations",
    BaseModel.metadata,
    Column("project_id", ForeignKey("projects.id"), primary_key=True),
    Column("user_id", ForeignKey("users.id"), primary_key=True),
)
