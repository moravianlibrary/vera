from sqlalchemy import Column, ForeignKey, Table

from adapters.database import BaseModel

project_category_association = Table(
    "project_category_associations",
    BaseModel.metadata,
    Column("project_id", ForeignKey("projects.id"), primary_key=True),
    Column("category_id", ForeignKey("categories.id"), primary_key=True),
)
