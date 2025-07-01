from typing import TYPE_CHECKING, List

from sqlalchemy import JSON, Column, String
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel

from .associations.user import group_user_association

if TYPE_CHECKING:
    from .group import GroupModel


class UserModel(BaseModel):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    settings = Column(JSON, default={}, nullable=False)

    groups: Mapped[List["GroupModel"]] = relationship(
        "GroupModel",
        secondary=group_user_association,
        back_populates="users",
        lazy="joined",
    )
