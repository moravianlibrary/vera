from enum import Enum


class DocumentCreateResult(Enum):
    DocumentNotFoundInCatalog = "DocumentNotFoundInCatalog"
    CatalogDocumentParsingError = "CatalogDocumentParsingError"
    UniqueDocumentViolation = "UniqueDocumentViolation"
    InvalidIdentifier = "InvalidIdentifier"
    InvalidSysno = "InvalidSysno"
    InvalidSysnoBase = "InvalidSysnoBase"
    InvalidCatalogDocument = "InvalidCatalogDocument"
    CatalogError = "CatalogError"
    MultipleIssueChoices = "MultipleIssueChoices"
    AlreadyDigitized = "AlreadyDigitized"
    DigitizationInProgress = "DigitizationInProgress"
    DigitizationPlanned = "DigitizationPlanned"
    DigitizationForbidden = "DigitizationForbidden"
    MultipleIssues = "MultipleIssues"
    Success = "Success"
