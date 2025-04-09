from sqlalchemy import Boolean, Column, ForeignKey, LargeBinary, String
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

    is_unreachable = Column(Boolean, nullable=False, default=False)
    is_archived = Column(Boolean)
    is_valid = Column(Boolean)

    status_logs = relationship(
        "CatalogRecordStatusLogModel",
        backref="catalog_record",
        lazy="joined",
        cascade="all, delete-orphan",
    )


class CatalogRecordStatusLogModel(BaseModel, UpdatedTimestampMixin):
    __tablename__ = "catalog_record_status_logs"

    id = Column(String, primary_key=True)

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), nullable=False, index=True
    )
    status = Column(String, nullable=False)

    catalog_record = relationship("CatalogRecordModel", backref="status_logs")
