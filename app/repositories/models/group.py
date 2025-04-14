from typing import TYPE_CHECKING, List

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel

from .associations import group_user_association

if TYPE_CHECKING:
    from .user import UserModel


class GroupModel(BaseModel):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)

    users: Mapped[List["UserModel"]] = relationship(
        "UserModel",
        secondary=group_user_association,
        back_populates="groups",
        lazy="joined",
        cascade="all, delete-orphan",
    )
