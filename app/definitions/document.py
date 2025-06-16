from enum import Enum

DEFAULT_EXPORT_FIELDS = []
DEFAULT_EXPORT_FILENAME = "vera-documents"


class ExportFormat(str, Enum):
    xlsx = "xlsx"
    csv = "csv"
    txt = "txt"
    pdf = "pdf"
