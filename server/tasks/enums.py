from enum import Enum


class TaskType(Enum):
    PREDICT_ITEMS_PAGES = 'PREDICT_ITEMS_PAGES'


class TaskScope(Enum):
    ALL = 'ALL'
    PROCESSED = 'PROCESSED'
    UNPROCESSED = 'UNPROCESSED'
    SELECT = 'SELECT'


class TaskState(Enum):
    PLANNED = 'PLANNED'
    RUNNING = 'RUNNING'
    FINISHED = 'FINISHED'
    FAILED = 'FAILED'


class TaskDocumentErrorType(Enum):
    MISING_VOLUME = 'MISSING_VOLUME'
    MISING_ITEM = 'MISSING_ITEM'
    CONFLICT_PAGES_COUNT = 'CONFLICT_PAGES_COUNT'
