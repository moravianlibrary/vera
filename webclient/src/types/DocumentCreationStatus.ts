enum DocumentCreationStatus {
    DocumentNotFoundInCatalog = 'DOCUMENT_NOT_FOUND_IN_CATALOG',
    CatalogDocumentParsingError = 'CATALOG_DOCUMENT_PARSING_ERROR',
    UniqueDocumentViolation = 'UNIQUE_DOCUMENT_VIOLATION',
    InvalidIdentifier = 'INVALID_IDENTIFIER',
    InvalidSysno = 'INVALID_SYSNO',
    InvalidSysnoBase = 'INVALID_SYSNO_BASE',
    MultipleIssueChoices = 'MULTIPLE_ISSUE_CHOICES',
    AlreadyDigitized = 'ALREADY_DIGITIZED',
    Prepared = 'PREPARED',
    MultipleIssues = 'MULTIPLE_ISSUES',
    Success = 'SUCCESS'
}

export { DocumentCreationStatus };
