from typing import List

from sqlalchemy import (
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
)
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel
from definitions.catalog_record import CatalogRecordStatus
from definitions.identifier import IdentifierType

from .mixins.created_audit import CreatedTimestampMixin
from .mixins.updated_audit import UpdatedAuditMixin, UpdatedTimestampMixin


class CatalogRecordModel(
    BaseModel, CreatedTimestampMixin, UpdatedTimestampMixin
):
    __tablename__ = "catalog_records"

    id = Column(String, primary_key=True)
    base = Column(String, nullable=False)
    system_number = Column(String, nullable=False)

    marc = Column(LargeBinary, nullable=False)

    is_unreachable = Column(Boolean, default=False, nullable=False)
    is_deleted_in_catalog = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)

    set_validity = Column(Boolean, nullable=True)
    is_valid = Column(Boolean, nullable=False)

    identifiers: Mapped[List["CatalogRecordIdentifierModel"]] = relationship(
        "CatalogRecordIdentifierModel",
        backref="catalog_record",
        lazy="joined",
        cascade="all, delete-orphan",
    )
    additional_properties: Mapped[List["CatalogRecordPropertyModel"]] = (
        relationship(
            "CatalogRecordPropertyModel",
            backref="catalog_record",
            lazy="joined",
            cascade="all, delete-orphan",
        )
    )
    status_log: Mapped[List["CatalogRecordStatusLogModel"]] = relationship(
        "CatalogRecordStatusLogModel",
        backref="catalog_record",
        lazy="joined",
        cascade="all, delete-orphan",
    )


class CatalogRecordIdentifierModel(BaseModel):
    __tablename__ = "catalog_record_identifiers"

    id = Column(Integer, primary_key=True)

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), nullable=False, index=True
    )
    identifier_type = Column(Enum(IdentifierType), nullable=False)
    identifier_value = Column(String, nullable=False)

    catalog_record: Mapped["CatalogRecordModel"] = relationship(
        "CatalogRecordModel", backref="properties"
    )


class CatalogRecordPropertyModel(BaseModel):
    __tablename__ = "catalog_record_properties"

    id = Column(Integer, primary_key=True, autoincrement=True)

    catalog_record_id = Column(
        Integer, ForeignKey("catalog_records.id"), nullable=False
    )
    plugin_instance_id = Column(
        Integer, ForeignKey("plugin_instances.id"), nullable=False
    )

    value = Column(LargeBinary, nullable=True)

    catalog_record: Mapped["CatalogRecordModel"] = relationship(
        "CatalogRecordModel", backref="additional_properties"
    )


class CatalogRecordStatusLogModel(BaseModel, UpdatedAuditMixin):
    __tablename__ = "catalog_record_status_logs"

    id = Column(String, primary_key=True)

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), nullable=False, index=True
    )
    status = Column(Enum(CatalogRecordStatus), nullable=False)

    catalog_record: Mapped["CatalogRecordModel"] = relationship(
        "CatalogRecordModel", backref="status_logs"
    )
