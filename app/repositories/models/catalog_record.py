from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
)
from sqlalchemy.orm import relationship

from adapters.database import BaseModel

from .mixins import CreatedTimestampMixin, UpdatedTimestampMixin


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

    status_logs = relationship(
        "CatalogRecordStatusLogModel",
        backref="catalog_record",
        lazy="joined",
        cascade="all, delete-orphan",
    )


class CatalogRecordFieldDefinitionModel(BaseModel):
    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True, nullable=False)
    labels = Column(JSON, nullable=False)


class CatalogRecordFieldValueModel(BaseModel):
    pass


# ## Catalog Record
# - System should be able to store catalog records in a database
# - System should be able log that the synchronization with the catalog record was not successful
# - System should be able to log that the catalog record was archived ??
# - System should be able to log the validity of the catalog record based on provided validation rules
# - System should be able to parse custom fields from the MARC record and index them
# - System should be able to fetch custom fields for catalog record, store them in the database and index them
# - System should log changes of the catalog record status


class CatalogRecordStatusLogModel(BaseModel, UpdatedTimestampMixin):
    __tablename__ = "catalog_record_status_logs"

    id = Column(String, primary_key=True)

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), nullable=False, index=True
    )
    status = Column(String, nullable=False)

    catalog_record = relationship("CatalogRecordModel", backref="status_logs")
