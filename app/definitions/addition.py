from enum import Enum


class AdditionStatus(str, Enum):
    Enqueued = "Enqueued"
    Processing = "Processing"
    NotEligibleForAddition = "NotEligibleForAddition"
    Completed = "Completed"


class AdditionUpdateType(str, Enum):
    IgnoreDigitizationCheck = "IgnoreDigitizationCheck"
    AllowNewIteration = "AllowNewIteration"
