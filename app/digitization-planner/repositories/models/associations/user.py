from sqlalchemy import Column, ForeignKey, Table

from adapters.database import BaseModel

catalog_record_list_user_association = Table(
    "catalog_record_list_user_associations",
    BaseModel,
    Column("list_id", ForeignKey("catalog_record_lists.id"), primary_key=True),
    Column("username", ForeignKey("users.username"), primary_key=True),
)

category_user_association = Table(
    "category_user_associations",
    BaseModel,
    Column("category_id", ForeignKey("categories.id"), primary_key=True),
    Column("username", ForeignKey("users.username"), primary_key=True),
)

group_user_association = Table(
    "group_user_associations",
    BaseModel,
    Column("group_id", ForeignKey("groups.id"), primary_key=True),
    Column("username", ForeignKey("users.username"), primary_key=True),
)
