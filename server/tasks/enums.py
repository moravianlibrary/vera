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
