from enum import Enum


class AdditionStatus(str, Enum):
    Enqueued = "Enqueued"
    NotEligibleForAddition = "NotEligibleForAddition"
    Completed = "Completed"
