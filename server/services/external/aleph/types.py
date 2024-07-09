from enum import Enum


class AlephField(Enum):
    Sysno = "SYS"
    Barcode = "BAR"
    Signature = "SIG"
    CNB = "CNB"
    ISXN = "ISXN"
    ISBN = "SBN"
    ISSN = "SSN"
    ISMN = "SMN"


ISXN_FIELDS = [
    AlephField.ISBN,
    AlephField.ISSN,
    AlephField.ISMN,
]


class AlephResponseStatus(Enum):
    AlephNotAvailable = "AlephNotAvailable"
    RequestFailed = "RequestFailed"
    RecordNotFound = "RecordNotFound"
    MultipleRecordsFound = "MultipleRecordsFound"
    InvalidSysno = "InvalidSysno"
    InvalidSysnoBase = "InvalidSysnoBase"
    Success = "Success"


class IssuanceType(Enum):
    Unit = "Unit"
    Volume = "Volume"
    Bundle = "Bundle"


class MaterialType(Enum):
    Book = "Book"
    ContinuingResource = "ContinuingResource"
    Map = "Map"
    Music = "Music"
    Other = "Other"
