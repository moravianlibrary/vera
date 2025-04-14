from enum import Enum


class CatalogFetchStatus(str, Enum):
    CatalogUnavailable = "CatalogUnavailable"
    CatalogRequestFailed = "CatalogRequestFailed"
    RecordNotFound = "RecordNotFound"
    UnrecognizedBase = "UnrecognizedBase"
    InvalidSystemNumber = "InvalidSystemNumber"
    Success = "Success"
