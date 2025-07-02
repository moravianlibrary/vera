from typing import List

from esorm import ESBaseModel, ESModel
from esorm.fields import keyword
from marcdantic import IssuanceType
from pydantic import BaseModel, model_validator
from vera_plugins.specs.digitization_registry_adapter import (
    DigitizationRecordState,
)

from adapters.indexer import EnumList
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
class DocumentDigitizationRecord(ESBaseModel):
    registry_record_id: keyword
    record_state: EnumList[DigitizationRecordState]
    registry_issue_id: keyword | None
    issue_state: DigitizationRecordState | None
    link: keyword | None = None
    error_message: keyword | None = None


DocumentProperties = ESBaseModel


class Document(ESModel):
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

    digitization_state: DigitizationState
    digitization_records: List[DocumentDigitizationRecord]
    page_count: int | None
    page_count_manual: int | None

    properties: DocumentProperties | None

    category_id: int
    priority: int
    digitization_list_id: int | None

    can_be_extracted: bool

    is_archived: bool
