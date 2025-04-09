from typing import TYPE_CHECKING, List

from sqlalchemy import JSON, Column, String
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel

if TYPE_CHECKING:
    from .group import GroupModel, GroupUserAssociation


class UserModel(BaseModel):
    __tablename__ = "users"

    username = Column(String, primary_key=True)
    settings = Column(JSON, default={}, nullable=False)

    group_associations: Mapped[List["GroupUserAssociation"]] = relationship(
        "GroupUserAssociation",
        back_populates="user",
        lazy="joined",
        cascade="all, delete-orphan",
    )

    @hybrid_property
    def groups(self) -> List["GroupModel"]:
        return [association.group for association in self.group_associations]
