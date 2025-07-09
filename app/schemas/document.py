from datetime import datetime
from typing import Any, List

from esorm.fields import boolean, integer, keyword, text
from marcdantic import IssuanceType
from pydantic import BaseModel, model_validator
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
from repositories.models.document import DocumentModel, DocumentPropertyModel

from .additional_properties import (
    AdditionalDetailsModel,
    AdditionalPropertiesModel,
)


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
    fields: List[str] = DEFAULT_EXPORT_FIELDS
    filename: str = DEFAULT_EXPORT_FILENAME
    export_format: ExportFormat = ExportFormat.xlsx


# --------------------
# - Indexer Entities -
# --------------------
class DocumentDigitizationRecord(IndexerNestedModel):
    registry_record_id: keyword
    record_state: EnumList[DigitizationRecordState]
    registry_issue_id: keyword | None
    issue_state: DigitizationRecordState | None


class DocumentAdditionalProperties(AdditionalPropertiesModel):
    pass


class Document(IndexerModel):
    class ESConfig:
        index = "documents"

    id: integer

    catalog_record_id: text
    catalog_record_valid: boolean

    iteration_id: integer
    iteration: integer

    barcode: text | None
    volume_number: text | None
    volume_year: text | None
    bundle: text | None
    issuance_type: IssuanceType | None

    digitization_state: EnumList[DigitizationState]
    digitization_records: List[DocumentDigitizationRecord]

    page_count_manual: integer | None
    page_count: integer | None

    additional_properties: DocumentAdditionalProperties | None

    category_id: integer
    priority: integer

    digitization_list_id: integer | None
    digitization_list_state: DigitizationListState | None

    status: EnumList[DocumentStatus]

    created_by: text
    created_at: datetime
    updated_at: datetime


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


class DocumentAdditionalDetails(AdditionalDetailsModel):
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

        for ap in data.additional_properties:
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

        for ap in data.catalog_record.additional_properties:
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
