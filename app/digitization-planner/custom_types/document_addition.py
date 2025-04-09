from enum import Enum


class DocumentAdditionStatus(Enum):
    Enqueued = "Enqueued"
    Processing = "Processing"
    NotEligibleForAddition = "NotEligibleForAddition"
    Completed = "Completed"
