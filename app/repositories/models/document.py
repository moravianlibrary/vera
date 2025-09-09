from typing import TYPE_CHECKING, List

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
from sqlalchemy.orm import Mapped
from vera_plugins.specs.digitization_registry_adapter import (
    DigitizationRecordState,
)

from adapters.database import (
    BaseModel,
    belongs_to,
    contains,
    has_many,
    has_one,
)
from definitions.catalog_record import CatalogRecordStatus
from definitions.digitization_registry import DigitizationState
from definitions.document import DocumentStatus

from .mixins.created_audit import CreatedAuditMixin
from .mixins.property import PropertyDataMixin
from .mixins.updated_audit import UpdatedTimestampMixin

if TYPE_CHECKING:
    from .catalog_record import CatalogRecordModel
    from .category import CategoryModel
    from .digitization_list import DigitizationListModel
    from .plugin import PluginInstanceModel
    from .task import TaskDocumentIterationModel
    from .watchlist import WatchlistDocumentIterationModel


class DocumentModel(BaseModel, UpdatedTimestampMixin):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), nullable=False
    )

    marc_issue_data = Column(JSONB, nullable=True)

    digitization_state = Column(
        Enum(DigitizationState),
        nullable=False,
        default=DigitizationState.Unknown,
    )

    page_count_manual = Column(Integer, nullable=True)
    page_count = Column(Integer, nullable=True)

    can_be_extracted = Column(Boolean, default=False, nullable=False)

    catalog_record: Mapped["CatalogRecordModel"] = has_one(
        "CatalogRecordModel", "documents"
    )
    digitization_records: Mapped[List["DocumentDigitizationRecordModel"]] = (
        contains("DocumentDigitizationRecordModel", "document")
    )
    properties: Mapped[List["DocumentPropertyModel"]] = contains(
        "DocumentPropertyModel", "document"
    )
    iterations: Mapped[List["DocumentIterationModel"]] = has_many(
        "DocumentIterationModel", "document"
    )
    task_items: Mapped[List["TaskDocumentIterationModel"]] = contains(
        "TaskDocumentIterationModel", "document", "selectin"
    )

    @property
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

    document: Mapped["DocumentModel"] = belongs_to(
        "DocumentModel", "digitization_records"
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

    document: Mapped["DocumentModel"] = belongs_to(
        "DocumentModel", "properties"
    )
    plugin_instance: Mapped["PluginInstanceModel"] = has_one(
        "PluginInstanceModel", back_populates="document_properties"
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

    document: Mapped["DocumentModel"] = has_one("DocumentModel", "iterations")
    category: Mapped["CategoryModel"] = has_one(
        "CategoryModel", "document_iterations"
    )
    digitization_list: Mapped["DigitizationListModel"] = belongs_to(
        "DigitizationListModel", "document_iterations"
    )

    task_items: Mapped[List["TaskDocumentIterationModel"]] = contains(
        "TaskDocumentIterationModel", "document_iteration"
    )
    watchlists: Mapped[List["WatchlistDocumentIterationModel"]] = contains(
        "WatchlistDocumentIterationModel", "document_iteration"
    )

    @property
    def can_be_extracted(self) -> bool:
        return (
            self.document.can_be_extracted
            and self.digitization_list_id is None
        )

    @property
    def current_status(self) -> List[DocumentStatus]:
        can_be_extracted = self.can_be_extracted
        catalog_record_status = self.document.catalog_record.current_status
        return [
            status
            for status, condition in [
                (DocumentStatus.Archived, self.is_archived),
                (
                    DocumentStatus.AlreadyExtracted,
                    self.digitization_list_id is not None,
                ),
                (DocumentStatus.CanBeExtracted, can_be_extracted),
                (DocumentStatus.CannotBeExtracted, not can_be_extracted),
                (
                    DocumentStatus.MissingPageCount,
                    self.document.page_count is None,
                ),
                (
                    DocumentStatus.CatalogRecordSynced,
                    CatalogRecordStatus.Synced in catalog_record_status,
                ),
                (
                    DocumentStatus.CatalogRecordUnreachable,
                    CatalogRecordStatus.Unreachable in catalog_record_status,
                ),
                (
                    DocumentStatus.CatalogRecordDeleted,
                    CatalogRecordStatus.DeletedInCatalog
                    in catalog_record_status,
                ),
                (
                    DocumentStatus.CatalogRecordValid,
                    CatalogRecordStatus.Valid in catalog_record_status,
                ),
                (
                    DocumentStatus.CatalogRecordInvalid,
                    CatalogRecordStatus.Invalid in catalog_record_status,
                ),
            ]
            if condition
        ]
