from datetime import datetime
from typing import Any, List

from esorm.fields import boolean, integer, keyword, long, text
from marcdantic import MarcIssue
from pydantic import BaseModel, Field, model_validator
from vera_plugins.definitions.plugin_types import PluginType
from vera_plugins.schemas import (
    DocumentCanBeExtractedConfig,
    DocumentPageCountConfig,
)
from vera_plugins.specs.digitization_registry_adapter import (
    DigitizationRecordState,
)

from adapters.indexer import EnumList, IndexerModel, IndexerNestedModel
from adapters.plugin_registry import plugin_registry
from definitions.digitization_registry import (
    DigitizationListState,
    DigitizationState,
)
from definitions.document import (
    DEFAULT_EXPORT_FIELDS,
    DEFAULT_EXPORT_FILENAME,
    DocumentStatus,
    ExportFormat,
)
from repositories.models.document import (
    DocumentIterationModel,
    DocumentModel,
    DocumentPropertyModel,
)
from schemas.watchlist import WatchlistSummary

from .additional_properties import AdditionalDetails, AdditionalProperties


# --------------------
# - Query Parameters -
# --------------------
class DocumentsSyncParams(BaseModel):
    catalog_record: bool = False
    digitization_state: bool = False
    properties: bool = False

    @model_validator(mode="after")
    def validate(cls, model: "DocumentsSyncParams") -> "DocumentsSyncParams":
        if not any(
            [
                model.catalog_record,
                model.digitization_state,
                model.properties,
            ]
        ):
            raise ValueError("At least one sync parameter must be enabled.")
        return model


class DocumentExportParams(BaseModel):
    fields: List[str] = Field(DEFAULT_EXPORT_FIELDS, alias="field")
    filename: str = DEFAULT_EXPORT_FILENAME
    export_format: ExportFormat = ExportFormat.xlsx


class DocumentGenerateListParams(BaseModel):
    use_distribution: bool
    target_page_count: int
    target_document_count: int | None = None


# --------------------
# - Indexer Entities -
# --------------------
class DocumentDigitizationRecord(IndexerNestedModel):
    registry_record_id: keyword
    record_state: EnumList[DigitizationRecordState]
    registry_issue_id: keyword | None = None
    issue_state: DigitizationRecordState | None = None


class DocumentAdditionalProperties(AdditionalProperties):
    pass


class Document(IndexerModel):
    class ESConfig:
        index = "documents"
        id_field = "id"

    id: long

    catalog_record_id: text
    catalog_record_valid: boolean

    iteration_id: long
    iteration: integer

    barcode: keyword | None = None
    volume_number: keyword | None = None
    volume_year: keyword | None = None
    bundle: keyword | None = None
    material_type: keyword | None = None
    issuance_type: keyword | None = None

    digitization_state: EnumList[DigitizationState]
    digitization_records: List[DocumentDigitizationRecord]

    page_count_manual: integer | None = None
    page_count: integer | None = None

    properties: DocumentAdditionalProperties | None = None

    category_id: long
    priority: integer

    digitization_list_id: long | None = None
    digitization_list_state: DigitizationListState | None = None

    current_status: EnumList[DocumentStatus]

    created_by: keyword
    created_at: datetime
    updated_at: datetime

    watchlists: List[WatchlistSummary] = []

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, DocumentIterationModel):
            return data

        document = data.document
        catalog_record = document.catalog_record

        digitization_state = set([document.digitization_state])
        digitization_records = []

        for record in document.digitization_records:
            digitization_state.add(record.issue_state)
            digitization_records.append(
                DocumentDigitizationRecord(
                    registry_record_id=record.registry_record_id,
                    record_state=record.record_state,
                    registry_issue_id=record.registry_issue_id,
                    issue_state=record.issue_state,
                )
            )

        properties = {}
        for ap in document.properties:
            plugin_type = ap.plugin_instance.plugin.type
            if plugin_type != PluginType.DocumentProperty:
                continue

            instance = plugin_registry.document_property(ap.plugin_instance.id)

            properties[instance.config.property_name] = (
                instance.plugin.search_data_type.model_validate(ap.search_data)
                if ap.search_data
                else None
            )

        doc = {
            "id": document.id,
            "catalog_record_id": catalog_record.id,
            "catalog_record_valid": (
                catalog_record.is_valid or catalog_record.force_valid
            ),
            "iteration_id": data.id,
            "iteration": data.iteration,
            "material_type": catalog_record.material_type,
            "digitization_state": list(digitization_state),
            "digitization_records": digitization_records,
            "page_count_manual": document.page_count_manual,
            "page_count": document.page_count,
            "properties": properties,
            "category_id": data.category.id if data.category else None,
            "priority": data.priority,
            "digitization_list_id": (
                data.digitization_list.id if data.digitization_list else None
            ),
            "digitization_list_state": (
                data.digitization_list.state
                if data.digitization_list and data.digitization_list.state
                else None
            ),
            "current_status": data.current_status,
            "created_by": data.created_by,
            "created_at": data.created_at.isoformat(),
            "updated_at": data.updated_at.isoformat(),
            "watchlists": data.watchlists,
        }

        if document.marc_issue_data is None:
            return doc

        marc_issue = MarcIssue(field=document.marc_issue_data)
        doc.update(
            {
                "barcode": marc_issue.barcode,
                "volume_number": marc_issue.volume_number,
                "volume_year": marc_issue.volume_year,
                "bundle": marc_issue.bundle,
                "issuance_type": marc_issue.issuance_type,
            }
        )

        return doc


# -----------------
# - API Responses -
# -----------------
class DocumentDigitizationRecordDetails(BaseModel):
    registry_record_id: str
    record_state: List[DigitizationRecordState]
    registry_issue_id: str | None
    issue_state: DigitizationRecordState | None
    link: str | None
    error_message: str | None
    updated_at: datetime


class DocumentPageCount(BaseModel):
    plugin_instance_id: int
    key: str
    priority: int
    page_count: int | None = None

    @classmethod
    def load(
        cls,
        instance_id: int,
        config: DocumentPageCountConfig,
        model: DocumentPropertyModel | None,
    ) -> "DocumentPageCount":
        return cls(
            plugin_instance_id=instance_id,
            key=config.property_name,
            priority=config.priority,
            page_count=(
                model.detailed_data.get("page_count")
                if model.detailed_data
                else None
            ),
        )


class DocumentCanBeExtracted(BaseModel):
    plugin_instance_id: int
    key: str
    can_be_extracted: bool | None

    @classmethod
    def load(
        cls,
        instance_id: int,
        config: DocumentCanBeExtractedConfig,
        model: DocumentPropertyModel,
    ) -> "DocumentCanBeExtracted":
        return cls(
            plugin_instance_id=instance_id,
            key=config.property_name,
            can_be_extracted=(
                model.detailed_data.get("can_be_extracted")
                if model.detailed_data
                else None
            ),
        )


class DocumentAdditionalDetails(AdditionalDetails):
    pass


class DocumentDetails(BaseModel):
    id: int

    digitization_records: List[DocumentDigitizationRecordDetails]

    page_count_sources: List[DocumentPageCount] | None
    can_be_extracted_sources: List[DocumentCanBeExtracted] | None

    additional_details: DocumentAdditionalDetails | None

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, DocumentModel):
            return data

        page_count_sources = []
        can_be_extracted_sources = []
        additional_details = {}

        for ap in data.properties:
            plugin_type = ap.plugin_instance.plugin.type

            if plugin_type == PluginType.DocumentPageCount:
                page_count_sources.append(
                    DocumentPageCount.load(
                        ap.plugin_instance.id,
                        plugin_registry.document_page_count(
                            ap.plugin_instance.id
                        ).config,
                        ap,
                    )
                )

            elif plugin_type == PluginType.DocumentCanBeExtracted:
                can_be_extracted_sources.append(
                    DocumentCanBeExtracted.load(
                        ap.plugin_instance.id,
                        plugin_registry.document_can_be_extracted(
                            ap.plugin_instance.id
                        ).config,
                        ap,
                    )
                )

            else:
                instance = plugin_registry.document_property(
                    ap.plugin_instance.id
                )
                additional_details[instance.config.property_name] = (
                    instance.plugin.detailed_data_type.model_validate(
                        ap.detailed_data
                    )
                    if ap.detailed_data
                    else None
                )

        for ap in data.catalog_record.properties:
            instance = plugin_registry.catalog_record_property(
                ap.plugin_instance.id
            )
            if not instance.config.propagate_to_documents:
                continue
            additional_details[instance.config.property_name] = (
                instance.plugin.detailed_data_type.model_validate(
                    ap.detailed_data
                )
                if ap.detailed_data
                else None
            )

        return {
            "id": data.id,
            "digitization_records": data.digitization_records,
            "page_count_sources": page_count_sources,
            "can_be_extracted_sources": can_be_extracted_sources,
            "additional_details": additional_details,
        }
