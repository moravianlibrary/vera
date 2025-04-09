from sqlalchemy import Column, ForeignKey, Table

from adapters.database import BaseModel

catalog_record_list_group_association = Table(
    "catalog_record_list_group_associations",
    BaseModel,
    Column("list_id", ForeignKey("catalog_record_lists.id"), primary_key=True),
    Column("group_id", ForeignKey("groups.id"), primary_key=True),
)

category_group_association = Table(
    "category_group_associations",
    BaseModel,
    Column("category_id", ForeignKey("categories.id"), primary_key=True),
    Column("group_id", ForeignKey("groups.id"), primary_key=True),
)
