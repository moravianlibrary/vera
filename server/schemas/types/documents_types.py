from enum import Enum
from services.external.aleph.types import AlephField, AlephResponseStatus
from schemas.types.catalog_types import IdentifierType
from services.external.digitization_registry.types import DigitizationState

IDENTIFIER_TO_ALEPH_FIELD = {
    IdentifierType.Sysno: AlephField.Sysno,
    IdentifierType.Barcode: AlephField.Barcode,
    IdentifierType.Signature: AlephField.Signature,
}


class AddDocumentResponseStatus(Enum):
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
    UnknownError = "UnknownError"


ALEPH_TO_ADD_DOCUMENT_RESPONSE_STATUS = {
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


DIGITIZATION_STATE_TO_RESPONSE_STATUS = {
    DigitizationState.Finished: AddDocumentResponseStatus.AlreadyDigitized,
    DigitizationState.InProgress: (
        AddDocumentResponseStatus.DigitizationInProgress
    ),
    DigitizationState.Planned: AddDocumentResponseStatus.DigitizationPlanned,
}
