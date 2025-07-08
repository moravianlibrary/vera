from enum import Enum


class CatalogRecordStatus(Enum):
    # No audit log
    Synced = "Synced"
    Unreachable = "Unreachable"
    DeletedInCatalog = "DeletedInCatalog"

    # Log with timestamp and bot user
    Valid = "Valid"
    Invalid = "Invalid"

    # Log with timestamp, user, and optional message
    ForceValid = "ForceValid"
    UnforceValid = "UnforceValid"
    Archived = "Archived"
    Unarchived = "Unarchived"
    MarkInReview = "MarkInReview"
    UnmarkInReview = "UnmarkInReview"
