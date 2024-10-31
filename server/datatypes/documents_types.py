from enum import Enum
from services.external.aleph import AlephField, AlephResponseStatus
from services.external.digitization_registry import DigitizationState
from datatypes import IdentifierType

IdentifierToAlephFieldConverted = {
    IdentifierType.Sysno: AlephField.Sysno,
    IdentifierType.Barcode: AlephField.Barcode,
    IdentifierType.Signature: AlephField.Signature,
}


class AddDocumentResponseStatus(Enum):
    # Processing
    Unprocessed = "Unprocessed"
    InternalError = "InternalError"
    # AlephResponseStatus values
    AlephNotAvailable = "AlephNotAvailable"
    AlephRequestFailed = "AlephRequestFailed"
    AlephRecordNotFound = "AlephRecordNotFound"
    MultipleAlephRecordsFound = "MultipleAlephRecordsFound"
    InvalidSysno = "InvalidSysno"
    InvalidSysnoBase = "InvalidSysnoBase"
    Success = "Success"
    # AddDocumentResponseStatus values
    UniqueViolation = "UniqueViolation"
    MultipleIssues = "MultipleIssues"
    InvalidAlephRecord = "InvalidAlephRecord"
    DigitizationForbidden = "DigitizationForbidden"
    InvalidDigitizationState = "InvalidDigitizationState"
    AlreadyDigitized = "AlreadyDigitized"
    DigitizationInProgress = "DigitizationInProgress"
    DigitizationPlanned = "DigitizationPlanned"
    AllIssuesProcessed = "AllIssuesProcessed"
    UnknownError = "UnknownError"
    SuccessWithMissingPageCount = "SuccessWithMissingPageCount"


class DocumentFlag(Enum):
    IsExtractable = "IsExtractable"
    AlreadyExtracted = "AlreadyExtracted"
    IsNotExtractable = "IsNotExtractable"
    InvalidMainRecord = "InvalidMainRecord"
    InvalidCnb = "InvalidCnb"
    MissingPageCount = "MissingPageCount"


AlephToResponseStatusConverter = {
    AlephResponseStatus.Success: AddDocumentResponseStatus.Success,
    AlephResponseStatus.RecordNotFound: (
        AddDocumentResponseStatus.AlephRecordNotFound
    ),
    AlephResponseStatus.MultipleRecordsFound: (
        AddDocumentResponseStatus.MultipleAlephRecordsFound
    ),
    AlephResponseStatus.InvalidSysno: AddDocumentResponseStatus.InvalidSysno,
    AlephResponseStatus.InvalidSysnoBase: (
        AddDocumentResponseStatus.InvalidSysnoBase
    ),
    AlephResponseStatus.AlephNotAvailable: (
        AddDocumentResponseStatus.AlephNotAvailable
    ),
    AlephResponseStatus.RequestFailed: (
        AddDocumentResponseStatus.AlephRequestFailed
    ),
}


DigitizationStateToResponseStatusConverter = {
    DigitizationState.Finished: AddDocumentResponseStatus.AlreadyDigitized,
    DigitizationState.InProgress: (
        AddDocumentResponseStatus.DigitizationInProgress
    ),
    DigitizationState.Planned: AddDocumentResponseStatus.DigitizationPlanned,
}
