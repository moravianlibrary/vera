from enum import Enum


class IntentionClassification(Enum):
    TargetAndEndDateSpecified = "TargetAndEndDateSpecified"
    TargetSpecified = "TargetSpecified"
    Unbounded = "Unbounded"
    Previous = "Previous"
    Current = "Current"
    Upcoming = "Upcoming"
