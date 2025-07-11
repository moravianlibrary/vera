from typing import TYPE_CHECKING, List

from sqlalchemy import (
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, deferred, relationship

from adapters.database import BaseModel
from definitions.catalog_record import CatalogRecordStatus

from .mixins.created_audit import CreatedAuditMixin
from .mixins.property import PropertyDataMixin
from .mixins.updated_audit import UpdatedTimestampMixin

if TYPE_CHECKING:
    from .plugin import PluginInstanceModel


class CatalogRecordModel(BaseModel, UpdatedTimestampMixin):
    __tablename__ = "catalog_records"

    id = Column(String, primary_key=True)

    base = Column(String, nullable=False)
    system_number = Column(String, nullable=False)

    marc = deferred(Column(LargeBinary, nullable=False))

    material_type = Column(String, nullable=True)

    is_unreachable = Column(Boolean, default=False, nullable=False)
    is_deleted_in_catalog = Column(Boolean, default=False, nullable=False)

    # TODO: setting if the syncs should be performed
    # on records that have no added documents
    has_added_documents = Column(Boolean, default=False, nullable=False)
    is_valid = Column(Boolean, nullable=True)

    force_valid = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    is_in_review = Column(Boolean, default=False, nullable=False)

    additional_properties: Mapped[List["CatalogRecordPropertyModel"]] = (
        relationship(
            "CatalogRecordPropertyModel",
            back_populates="catalog_record",
            lazy="joined",
            cascade="all, delete-orphan",
        )
    )
    status_log: Mapped[List["CatalogRecordStatusLogModel"]] = relationship(
        "CatalogRecordStatusLogModel",
        back_populates="catalog_record",
        lazy="joined",
        cascade="all, delete-orphan",
    )

    @property
    def current_status(self) -> List[CatalogRecordStatus]:
        is_valid = self.is_valid or self.force_valid
        return [
            status
            for status, condition in [
                (CatalogRecordStatus.Synced, not self.is_unreachable),
                (CatalogRecordStatus.Unreachable, self.is_unreachable),
                (
                    CatalogRecordStatus.DeletedInCatalog,
                    self.is_deleted_in_catalog,
                ),
                (CatalogRecordStatus.Valid, is_valid),
                (CatalogRecordStatus.Invalid, not is_valid),
                (CatalogRecordStatus.ForceValid, self.force_valid),
                (CatalogRecordStatus.Archived, self.is_archived),
                (CatalogRecordStatus.MarkInReview, self.is_in_review),
            ]
            if condition
        ]


class CatalogRecordPropertyModel(
    BaseModel, PropertyDataMixin, UpdatedTimestampMixin
):
    __tablename__ = "catalog_record_properties"

    id = Column(Integer, primary_key=True, autoincrement=True)

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), nullable=False
    )
    plugin_instance_id = Column(
        Integer, ForeignKey("plugin_instances.id"), nullable=False
    )

    catalog_record: Mapped["CatalogRecordModel"] = relationship(
        "CatalogRecordModel", back_populates="additional_properties"
    )
    plugin_instance: Mapped["PluginInstanceModel"] = relationship(
        "PluginInstanceModel", back_populates="catalog_record_properties"
    )

    __table_args__ = (
        UniqueConstraint(
            "catalog_record_id",
            "plugin_instance_id",
            name="uq_catalog_record_property",
        ),
    )


class CatalogRecordStatusLogModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "catalog_record_status_logs"

    id = Column(String, primary_key=True)

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), nullable=False, index=True
    )
    status = Column(Enum(CatalogRecordStatus), nullable=False)
    message = Column(String, nullable=True)

    catalog_record: Mapped["CatalogRecordModel"] = relationship(
        "CatalogRecordModel", back_populates="status_logs"
    )
