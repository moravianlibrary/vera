from enum import Enum


class IdentifierType(Enum):
    SYSNO = 'SYSNO'
    BARCODE = 'BARCODE'
    CCNB = 'CCNB'


class DocumentField(Enum):
    Sysno = 'Sysno'
    Volume = 'Volume'
    Category = 'Category'
    Title = 'Title'
    PagesCount = 'PagesCount'


class GroupOption(Enum):
    MatchAll = 'MatchAll'
    MatchAny = 'MatchAny'


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
