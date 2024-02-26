from enum import Enum


class IdentifierType(Enum):
    Sysno = "Sysno"
    Barcode = "Barcode"
    Signature = "Signature"
    Cnb = "Cnb"


class DigitizationState(Enum):
    Finished = "Finished"
    InProgress = "InProgress"
    Planned = "Planned"
    NotDigitized = "NotDigitized"


class CatalogResponseStatus(Enum):
    DocumentNotFound = "DocumentNotFound"
    DocumentParsingError = "DocumentParsingError"
    InvalidIdentifier = "InvalidIdentifier"
    InvalidSysno = "InvalidSysno"
    InvalidSysnoBase = "InvalidSysnoBase"
    Success = "Success"


class MaterialType(Enum):
    Book = "Book"
    ContinuingResource = "ContinuingResource"
    Map = "Map"
    Music = "Music"
    Other = "Other"


class IssuanceType(Enum):
    Unit = "Unit"
    Volume = "Volume"
    Bundle = "Bundle"
