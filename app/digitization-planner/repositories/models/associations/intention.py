from sqlalchemy import Column, ForeignKey, Table

from adapters.database import BaseModel

digitization_list_intention_association = Table(
    "digitization_list_intention_associations",
    BaseModel,
    Column("list_id", ForeignKey("digitization_lists.id"), primary_key=True),
    Column("intention_id", ForeignKey("intentions.id"), primary_key=True),
)
