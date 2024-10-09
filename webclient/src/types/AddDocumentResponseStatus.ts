enum AddDocumentResponseStatus {
    AlephNotAvailable = "AlephNotAvailable",
    AlephRequestFailed = "AlephRequestFailed",
    AlephRecordNotFound = "AlephRecordNotFound",
    MultipleAlephRecordsFound = "MultipleAlephRecordsFound",
    InvalidSysno = "InvalidSysno",
    InvalidSysnoBase = "InvalidSysnoBase",
    Success = "Success",
    UniqueViolation = "UniqueViolation",
    MultipleIssues = "MultipleIssues",
    InvalidAlephRecord = "InvalidAlephRecord",
    DigitizationForbidden = "DigitizationForbidden",
    InvalidDigitizationState = "InvalidDigitizationState",
    AlreadyDigitized = "AlreadyDigitized",
    DigitizationInProgress = "DigitizationInProgress",
    DigitizationPlanned = "DigitizationPlanned",
    AllIssuesProcessed = "AllIssuesProcessed",
    UnknownError = "UnknownError",
}

export default AddDocumentResponseStatus;
