from typing import List

from esorm.fields import Integer, Keyword, Text, boolean
from marcdantic import IssuanceType
from pydantic import BaseModel, model_validator
from vera_plugins.specs.digitization_registry_adapter import (
    DigitizationRecordState,
)

from adapters.indexer import EnumList, IndexerModel, IndexerNestedModel
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
    registry_record_id: Keyword
    record_state: EnumList[DigitizationRecordState]
    registry_issue_id: Keyword | None
    issue_state: DigitizationRecordState | None


class DocumentAdditionalProperties(AdditionalPropertiesModel):
    pass


class Document(IndexerModel):
    class ESConfig:
        index = "documents"

    id: Integer

    catalog_record_id: Text
    catalog_record_valid: boolean

    iteration_id: Integer
    iteration: Integer

    barcode: Text | None
    volume_number: Text | None
    volume_year: Text | None
    bundle: Text | None
    issuance_type: IssuanceType | None

    digitization_state: EnumList[DigitizationState]
    digitization_records: List[DocumentDigitizationRecord]

    page_count_manual: Integer | None
    page_count: Integer | None

    additional_properties: DocumentAdditionalProperties | None

    category_id: Integer
    priority: Integer

    digitization_list_id: Integer | None
    digitization_list_state: DigitizationListState | None

    status: EnumList[DocumentStatus]


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


class DocumentPageCount(BaseModel):
    plugin_instance_id: int
    key: str
    page_count: int | None = None
    priority: int


class DocumentCanBeExtracted(BaseModel):
    plugin_instance_id: int
    key: str
    can_be_extracted: bool | None


class DocumentAdditionalDetails(AdditionalDetailsModel):
    pass


class DocumentDetails(BaseModel):
    id: int

    digitization_records: List[DocumentDigitizationRecordDetails]

    page_count_source: List[DocumentPageCount] | None
    can_be_extracted_source: List[DocumentCanBeExtracted] | None

    additional_details: DocumentAdditionalDetails | None
