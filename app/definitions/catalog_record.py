from enum import Enum


class CatalogRecordStatus(Enum):
    # No audit log
    Synced = "Synced"
    Unreachable = "Unreachable"
    DeletedInCatalog = "DeletedInCatalog"

    # Log with timestamp and bot user
    Valid = "Valid"
    Invalid = "Invalid"
    Archived = "Archived"

    # Log with timestamp, user, and optional message
    ForceValid = "ForceValid"
    RevertForceValid = "RevertForceValid"
    MarkInReview = "MarkInReview"
    UnmarkInReview = "UnmarkInReview"
