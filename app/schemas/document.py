from typing import List

from marcdantic import IssuanceType
from pydantic import BaseModel, model_validator
from vera_plugins.specs.digitization_registry_adapter import (
    DigitizationRecordState,
)

from adapters.indexer import (
    AdditionalPropertiesModel,
    EnumList,
    IndexerModel,
    IndexerNestedModel,
)
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
    registry_record_id: str
    record_state: EnumList[DigitizationRecordState]
    registry_issue_id: str | None
    issue_state: DigitizationRecordState | None
    link: str | None = None
    error_message: str | None = None


class DocumentPageCount(IndexerNestedModel):
    plugin_instance_id: int
    key: str
    page_count: int | None = None
    priority: int


class DocumentCanBeExtracted(IndexerNestedModel):
    plugin_instance_id: int
    key: str
    can_be_extracted: bool | None


class DocumentAdditionalProperties(AdditionalPropertiesModel):
    pass


class Document(IndexerModel):
    class ESConfig:
        index = "documents"

    id: int

    catalog_record_id: str
    catalog_record_valid: bool

    iteration_id: int
    iteration: int

    barcode: str | None
    volume_number: str | None
    volume_year: str | None
    bundle: str | None
    issuance_type: IssuanceType | None

    digitization_state: EnumList[DigitizationState]
    digitization_records: List[DocumentDigitizationRecord]

    page_count_manual: int | None
    page_count_source: List[DocumentPageCount] | None
    page_count: int | None

    can_be_extracted_source: List[DocumentCanBeExtracted] | None

    additional_properties: DocumentAdditionalProperties | None

    category_id: int
    priority: int

    digitization_list_id: int | None
    digitization_list_state: DigitizationListState | None

    status: EnumList[DocumentStatus]
