from enum import Enum
from typing import Literal

DEFAULT_EXPORT_FIELDS = []
DEFAULT_EXPORT_FILENAME = "vera-documents"


class ExportFormat(str, Enum):
    xlsx = "xlsx"
    csv = "csv"
    txt = "txt"
    pdf = "pdf"


Priority = Literal[1, 2, 3, 4, 5]


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
