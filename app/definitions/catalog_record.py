from enum import Enum


class CatalogRecordStatus(Enum):
    # For these 3 log timestamp
    Synced = "Synced"
    Unreachable = "Unreachable"
    DeletedInCatalog = "DeletedInCatalog"
    # For these 2 log timestamp
    Valid = "Valid"
    Invalid = "Invalid"
    # For these 3 also log timestamp and user
    SetValid = "SetValid"
    UnsetValid = "UnsetValid"
    Archived = "Archived"
