from enum import Enum


class CatalogSource(Enum):
    SKC = "SKC"
    CNB = "CNB"


class SkcRecordFlag(Enum):
    NotFound = "NotFound"
    Valid = "Valid"
    Equal = "Equal"
    DifferentValue = "DifferentValue"
    ExtraField = "ExtraField"
    MissingField = "MissingField"


class CnbRecordFlag(Enum):
    NotFound = "NotFound"
    ShouldNotHaveCnb = "ShouldNotHaveCnb"
    Valid = "Valid"
    Equal = "Equal"
    DifferentValue = "DifferentValue"
    ExtraField = "ExtraField"
    MissingField = "MissingField"


CZECH_LANGUAGE = "cze"
