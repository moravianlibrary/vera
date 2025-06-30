from sqlalchemy import (
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
)
from sqlalchemy.orm import relationship

from adapters.database import BaseModel
from definitions.identifier import IdentifierType

from .mixins.created_audit import CreatedTimestampMixin
from .mixins.updated_audit import UpdatedTimestampMixin


class CatalogRecordModel(
    BaseModel, CreatedTimestampMixin, UpdatedTimestampMixin
):
    __tablename__ = "catalog_records"

    id = Column(String, primary_key=True)
    base = Column(String, nullable=False)
    system_number = Column(String, nullable=False)

    marc = Column(LargeBinary, nullable=False)

    is_unreachable = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean)
    is_valid = Column(Boolean)

    identifiers = relationship(
        "CatalogRecordIdentifierModel",
        backref="catalog_record",
        lazy="joined",
        cascade="all, delete-orphan",
    )
    status_logs = relationship(
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

    catalog_record = relationship("CatalogRecordModel", backref="identifiers")


class CatalogRecordStatusLogModel(BaseModel, UpdatedTimestampMixin):
    __tablename__ = "catalog_record_status_logs"

    id = Column(String, primary_key=True)

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), nullable=False, index=True
    )
    status = Column(String, nullable=False)

    catalog_record = relationship("CatalogRecordModel", backref="status_logs")
