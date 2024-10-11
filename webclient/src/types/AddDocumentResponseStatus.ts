enum AddDocumentResponseStatus {
    // Errors
    AlephNotAvailable = "AlephNotAvailable",
    AlephRequestFailed = "AlephRequestFailed",
    InvalidSysno = "InvalidSysno",
    InvalidSysnoBase = "InvalidSysnoBase",
    AlephRecordNotFound = "AlephRecordNotFound",
    MultipleAlephRecordsFound = "MultipleAlephRecordsFound",
    InvalidAlephRecord = "InvalidAlephRecord",
    InvalidDigitizationState = "InvalidDigitizationState",
    UnknownError = "UnknownError",
    // Warnings
    DigitizationForbidden = "DigitizationForbidden",
    AlreadyDigitized = "AlreadyDigitized",
    DigitizationInProgress = "DigitizationInProgress",
    DigitizationPlanned = "DigitizationPlanned",
    AllIssuesProcessed = "AllIssuesProcessed",
    UniqueViolation = "UniqueViolation",
    // Infos
    MultipleIssues = "MultipleIssues",
    // Success
    Success = "Success",
}

const AddDocumentResponseErrorStatus = [
    AddDocumentResponseStatus.AlephNotAvailable,
    AddDocumentResponseStatus.AlephRequestFailed,
    AddDocumentResponseStatus.InvalidSysno,
    AddDocumentResponseStatus.InvalidSysnoBase,
    AddDocumentResponseStatus.AlephRecordNotFound,
    AddDocumentResponseStatus.MultipleAlephRecordsFound,
    AddDocumentResponseStatus.InvalidAlephRecord,
    AddDocumentResponseStatus.InvalidDigitizationState,
    AddDocumentResponseStatus.UnknownError,
];
const AddDocumentResponseWarningStatus = [
    AddDocumentResponseStatus.DigitizationForbidden,
    AddDocumentResponseStatus.AlreadyDigitized,
    AddDocumentResponseStatus.DigitizationInProgress,
    AddDocumentResponseStatus.DigitizationPlanned,
    AddDocumentResponseStatus.AllIssuesProcessed,
    AddDocumentResponseStatus.UniqueViolation,
];

const AddDocumentResponseInfoStatus = [
    AddDocumentResponseStatus.MultipleIssues,
];

const AddDocumentResponseSuccessStatus = [AddDocumentResponseStatus.Success];

export default AddDocumentResponseStatus;
export {
    AddDocumentResponseErrorStatus,
    AddDocumentResponseWarningStatus,
    AddDocumentResponseInfoStatus,
    AddDocumentResponseSuccessStatus,
};
