from typing import List

from marcdantic import IssuanceType
from pydantic import BaseModel, model_validator
from vera_plugins.specs.digitization_registry_adapter import (
    DigitizationRecordState,
)

from adapters.indexer import (
    Boolean,
    Enumerate,
    IndexerEntity,
    Integer,
    Keyword,
)
from definitions.digitization_registry import DigitizationState
from definitions.document import (
    DEFAULT_EXPORT_FIELDS,
    DEFAULT_EXPORT_FILENAME,
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
class DocumentDigitizationRecord(IndexerEntity):
    registry_record_id: Keyword
    record_state: List[Enumerate[DigitizationRecordState]]
    registry_issue_id: Keyword | None
    issue_state: Enumerate[DigitizationRecordState] | None
    link: Keyword | None = None
    error_message: Keyword | None = None


class Document(IndexerEntity):
    id: Integer

    catalog_record_id: Keyword
    catalog_record_valid: Boolean

    iteration_id: Integer
    iteration: Integer

    barcode: Keyword | None
    volume_number: Keyword | None
    volume_year: Keyword | None
    bundle: Keyword | None
    issuance_type: Enumerate[IssuanceType] | None

    digitization_state: Enumerate[DigitizationState]
    digitization_records: List[DocumentDigitizationRecord]
    page_count: Integer | None
    page_count_manual: Integer | None

    category_id: Integer
    priority: Integer
    digitization_list_id: Integer | None

    can_be_extracted: Boolean

    is_archived: Boolean
