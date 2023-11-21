from enum import Enum


class DigitizationState(Enum):
    FINISHED = 'FINSHED'
    IN_PROGRESS = 'IN_PROGRESS'
    PLANNED = 'PLANNED'
    NOT_DIGITIZED = 'NOT_DIGITIZED'


class DocumentCreateResult(Enum):
    DOCUMENT_NOT_FOUND_IN_CATALOG = 'DOCUMENT_NOT_FOUND_IN_CATALOG'
    CATALOG_DOCUMENT_PARSING_ERROR = 'CATALOG_DOCUMENT_PARSING_ERROR'
    UNIQUE_DOCUMENT_VIOLATION = 'UNIQUE_DOCUMENT_VIOLATION'
    INVALID_SYSNO = 'INVALID_SYSNO'
    INVALID_SYSNO_BASE = 'INVALID_SYSNO_BASE'
    MULTIPLE_ISSUE_CHOICES = 'MULTIPLE_ISSUE_CHOICES'
    ALREADY_DIGITIZED = 'ALREADY_DIGITIZED'
    PREPARED = 'PREPARED'
    MULTIPLE_ISSUES = 'MULTIPLE_ISSUES'
    SUCCESS = 'SUCCESS'


class MaterialType(Enum):
    book = 'book'
    continuing_resource = 'continuing_resource'
    map = 'map'
    music = 'music'
    other = 'other'


class IssuanceType(Enum):
    edition = 'edition'
    volume = 'volume'
    item = 'item'
