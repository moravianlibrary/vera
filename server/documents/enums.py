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
    MultipleIssues = "MultipleIssues"
    Success = "Success"


class DocumentField(Enum):
    Sysno = "Sysno"
    Volume = "Volume"
    Category = "Category"
    Title = "title"
    PagesCount = "PagesCount"


class GroupOption(Enum):
    MatchAll = "MatchAll"
    MatchAny = "MatchAny"


class TextOption(Enum):
    Equals = "Equals"
    StartsWith = "StartsWith"
    EndsWith = "EndsWith"
    Contains = "Contains"
    NotContains = "NotContains"
    NotEquals = "NotEquals"
    IsNull = "IsNull"
    IsNotNull = "IsNotNull"


class NumberOption(Enum):
    EqualTo = "EqualTo"
    NotEqualTo = "NotEqualTo"
    LessThan = "LessThan"
    MoreThan = "MoreThan"
    Between = "Between"
    IsNull = "IsNull"
    IsNotNull = "IsNotNull"


class TreeOption(Enum):
    IsIn = "IsIn"
    IsNotIn = "IsNotIn"
    IsNull = "IsNull"
    IsNotNull = "IsNotNull"


class SortOrder(Enum):
    Ascending = "Ascending"
    Descending = "Descending"
