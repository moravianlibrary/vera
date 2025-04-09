from typing import TYPE_CHECKING, List

from sqlalchemy import JSON, Column, String
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel

from .associations import (
    catalog_record_list_group_association,
    catalog_record_list_user_association,
)
from .mixins import CreatedAuditMixin, UpdatedAuditMixin

if TYPE_CHECKING:
    from .group import GroupModel
    from .user import UserModel


class CatalogRecordListModel(BaseModel, CreatedAuditMixin, UpdatedAuditMixin):
    __tablename__ = "catalog_record_lists"

    id = Column(String, primary_key=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    query = Column(JSON, nullable=False)

    groups: Mapped[List["GroupModel"]] = relationship(
        "GroupModel",
        secondary=catalog_record_list_group_association,
        back_populates="catalog_record_lists",
        lazy="joined",
        cascade="all, delete-orphan",
    )
    users: Mapped[List["UserModel"]] = relationship(
        "UserModel",
        secondary=catalog_record_list_user_association,
        back_populates="catalog_record_lists",
        lazy="joined",
        cascade="all, delete-orphan",
    )
