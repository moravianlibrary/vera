enum AddDocumentResponseStatus {
    // Unprocessed
    Unprocessed = "Unprocessed",
    InternalError = "InternalError",
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
    SuccessWithMissingPageCount = "SuccessWithMissingPageCount",
}

const AddDocumentResponseErrorStatus = [
    AddDocumentResponseStatus.InternalError,
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
    AddDocumentResponseStatus.AllIssuesProcessed,
    AddDocumentResponseStatus.UniqueViolation,
    AddDocumentResponseStatus.AlreadyDigitized,
    AddDocumentResponseStatus.DigitizationInProgress,
    AddDocumentResponseStatus.DigitizationPlanned,
];

const AddDocumentResponseInfoStatus = [
    AddDocumentResponseStatus.MultipleIssues,
    AddDocumentResponseStatus.SuccessWithMissingPageCount,
];

const AddDocumentResponseSuccessStatus = [AddDocumentResponseStatus.Success];

const Order = Object.values(AddDocumentResponseStatus);
const orderBy = (
    a: AddDocumentResponseStatus,
    b: AddDocumentResponseStatus
): number => Order.indexOf(a) - Order.indexOf(b);

export default AddDocumentResponseStatus;
export {
    AddDocumentResponseErrorStatus,
    AddDocumentResponseWarningStatus,
    AddDocumentResponseInfoStatus,
    AddDocumentResponseSuccessStatus,
    orderBy,
};
