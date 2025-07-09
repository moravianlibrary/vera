from typing import TYPE_CHECKING, List

from marcdantic import IssuanceType
from sqlalchemy import (
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, relationship
from vera_plugins.specs.digitization_registry_adapter import (
    DigitizationRecordState,
)

from adapters.database import BaseModel
from definitions.digitization_registry import DigitizationState

from .mixins.created_audit import CreatedAuditMixin
from .mixins.property import PropertyDataMixin
from .mixins.updated_audit import UpdatedTimestampMixin

if TYPE_CHECKING:
    from .catalog_record import CatalogRecordModel
    from .category import CategoryModel
    from .digitization_list import DigitizationListModel
    from .plugin import PluginInstanceModel


class DocumentModel(BaseModel, UpdatedTimestampMixin):
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

    page_count_manual = Column(Integer, nullable=True)
    page_count = Column(Integer)

    can_be_extracted = Column(Boolean, default=False, nullable=False)

    catalog_record: Mapped["CatalogRecordModel"] = relationship(
        "CatalogRecordModel", backref="document"
    )
    digitization_records: Mapped[List["DocumentDigitizationRecordModel"]] = (
        relationship(
            "DocumentDigitizationRecordModel",
            back_populates="document",
            cascade="all, delete-orphan",
        )
    )
    additional_properties: Mapped[List["DocumentPropertyModel"]] = (
        relationship(
            "DocumentPropertyModel",
            back_populates="document",
            cascade="all, delete-orphan",
        )
    )
    iterations: Mapped[List["DocumentIterationModel"]] = relationship(
        "DocumentIterationModel", back_populates="document"
    )

    @hybrid_property
    def has_active_iteration(self) -> bool:
        return any(it.digitization_list_id is None for it in self.iterations)


class DocumentDigitizationRecordModel(BaseModel, UpdatedTimestampMixin):
    __tablename__ = "document_digitization_records"

    id = Column(Integer, primary_key=True, autoincrement=True)

    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)

    registry_record_id = Column(String, nullable=False)
    _record_state = Column(JSONB, nullable=False, key="record_state")

    registry_issue_id = Column(String, nullable=True)
    issue_state = Column(Enum(DigitizationRecordState), nullable=True)

    link = Column(String, nullable=True)
    error_message = Column(String, nullable=True)

    document: Mapped["DocumentModel"] = relationship(
        "DocumentModel", backref="digitization_records"
    )

    @hybrid_property
    def record_state(self) -> List[DigitizationRecordState]:
        return [DigitizationRecordState(state) for state in self._record_state]

    @record_state.setter
    def record_state(self, value: List[DigitizationRecordState]) -> None:
        self._record_state = [state.value for state in value]


class DocumentPropertyModel(
    BaseModel, PropertyDataMixin, UpdatedTimestampMixin
):
    __tablename__ = "document_properties"

    id = Column(Integer, primary_key=True, autoincrement=True)

    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    plugin_instance_id = Column(
        Integer, ForeignKey("plugin_instances.id"), nullable=False
    )

    value = Column(LargeBinary, nullable=True)

    document: Mapped["DocumentModel"] = relationship(
        "DocumentModel", backref="properties"
    )
    plugin_instance: Mapped["PluginInstanceModel"] = relationship(
        "PluginInstanceModel", backref="document_properties"
    )


class DocumentIterationModel(
    BaseModel, CreatedAuditMixin, UpdatedTimestampMixin
):
    __tablename__ = "document_iterations"

    id = Column(Integer, primary_key=True, autoincrement=True)

    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    iteration = Column(Integer, nullable=False)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    priority = Column(Integer, default=3, nullable=False)

    digitization_list_id = Column(
        Integer, ForeignKey("digitization_lists.id"), nullable=True
    )

    is_archived = Column(Boolean, default=False, nullable=False)

    document: Mapped["DocumentModel"] = relationship(
        "DocumentModel", backref="iterations"
    )
    category: Mapped["CategoryModel"] = relationship(
        "CategoryModel", backref="document_iterations"
    )
    digitization_list: Mapped["DigitizationListModel"] = relationship(
        "DigitizationListModel",
        back_populates="document_iterations",
    )

    @hybrid_property
    def can_be_extracted(self) -> bool:
        return (
            self.document.can_be_extracted
            and self.digitization_list_id is None
        )
