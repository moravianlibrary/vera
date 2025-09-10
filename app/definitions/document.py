from enum import Enum
from typing import Literal

from pydantic import Field

DEFAULT_EXPORT_FILENAME = "vera-documents"


class ExportFormat(str, Enum):
    xlsx = "xlsx"
    csv = "csv"
    txt = "txt"
    pdf = "pdf"


EXPORT_MEDIA_TYPE = {
    ExportFormat.xlsx: (
        "application/vnd."
        "openxmlformats-officedocument."
        "spreadsheetml."
        "sheet"
    ),
    ExportFormat.csv: "text/csv",
    ExportFormat.txt: "text/plain",
    ExportFormat.pdf: "application/pdf",
}

Priority = Literal[1, 2, 3, 4, 5]
PriorityField = Field(3, ge=1, le=5)


class DocumentStatus(str, Enum):
    Archived = "Archived"
    AlreadyExtracted = "AlreadyExtracted"
    CanBeExtracted = "CanBeExtracted"
    CannotBeExtracted = "CannotBeExtracted"
    MissingPageCount = "MissingPageCount"
    # Catalog record statuses
    CatalogRecordSynced = "CatalogRecordSynced"
    CatalogRecordUnreachable = "CatalogRecordUnreachable"
    CatalogRecordDeleted = "CatalogRecordDeleted"
    # Catalog record validity
    CatalogRecordValid = "CatalogRecordValid"
    CatalogRecordInvalid = "CatalogRecordInvalid"
