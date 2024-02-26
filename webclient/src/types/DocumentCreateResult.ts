enum DocumentCreateResult {
    DocumentNotFoundInCatalog = "DocumentNotFoundInCatalog",
    CatalogDocumentParsingError = "CatalogDocumentParsingError",
    UniqueDocumentViolation = "UniqueDocumentViolation",
    InvalidIdentifier = "InvalidIdentifier",
    InvalidSysno = "InvalidSysno",
    InvalidSysnoBase = "InvalidSysnoBase",
    InvalidCatalogDocument = "InvalidCatalogDocument",
    CatalogError = "CatalogError",
    MultipleIssueChoices = "MultipleIssueChoices",
    AlreadyDigitized = "AlreadyDigitized",
    DigitizationInProgress = "DigitizationInProgress",
    DigitizationPlanned = "DigitizationPlanned",
    MultipleIssues = "MultipleIssues",
    Success = "Success"
}

export { DocumentCreateResult };
