from typing import TYPE_CHECKING, List

from marcdantic import IssuanceType
from sqlalchemy import JSON, Boolean, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, relationship

from adapters.database import BaseModel
from definitions.digitization_registry import DigitizationState

from .mixins.created_audit import CreatedAuditMixin

if TYPE_CHECKING:
    from .catalog_record import CatalogRecordModel
    from .category import CategoryModel


class DocumentModel(BaseModel):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), nullable=False
    )

    barcode = Column(String, nullable=True)
    volume_number = Column(String, nullable=True)
    volume_year = Column(String, nullable=True)
    bundle = Column(String, nullable=True)
    issuance_type = Column(Enum(IssuanceType), nullable=True)

    digitization_state = Column(Enum(DigitizationState))
    page_count_sources = Column(JSON, default={}, nullable=False)
    page_count = Column(Integer)
    can_be_extracted = Column(Boolean, default=False, nullable=False)

    catalog_record: Mapped["CatalogRecordModel"] = relationship(
        "CatalogRecordModel", backref="document"
    )
    properties: Mapped[List["DocumentPropertyModel"]] = relationship(
        "DocumentPropertyModel",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    iterations: Mapped[List["DocumentIterationModel"]] = relationship(
        "DocumentIterationModel", back_populates="document"
    )

    @hybrid_property
    def has_active_iteration(self) -> bool:
        return any(it.digitization_list_id is None for it in self.iterations)


class DocumentPropertyModel(BaseModel):
    __tablename__ = "document_properties"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # plugin_instance_id = Column(
    #     Integer, ForeignKey("plugin_instances.id"), nullable=False
    # )
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)

    key = Column(String, nullable=False)
    value = Column(String, nullable=True)
    # property_type = Column(
    #     Enum("string", "integer", "boolean"), nullable=False
    # )

    document: Mapped["DocumentModel"] = relationship(
        "DocumentModel", backref="properties"
    )


class DocumentIterationModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "document_iterations"

    id = Column(Integer, primary_key=True, autoincrement=True)

    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    iteration = Column(Integer, nullable=False)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    priority = Column(Integer, default=3, nullable=False)
    digitization_list_id = Column(Integer, nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)

    document: Mapped["DocumentModel"] = relationship(
        "DocumentModel", backref="iterations"
    )
    category: Mapped["CategoryModel"] = relationship(
        "CategoryModel", backref="document_iterations"
    )

    @hybrid_property
    def can_be_extracted(self) -> bool:
        return (
            self.document.can_be_extracted
            and self.digitization_list_id is None
        )
