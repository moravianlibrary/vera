from enum import Enum


class IntentionClassification(Enum):
    TargetAndEndDateSpecified = "TargetAndEndDateSpecified"
    TargetSpecified = "TargetSpecified"
    Unbounded = "Unbounded"

    @classmethod
    def dispatch(cls, target_page_count, start_date, end_date):
        if target_page_count and start_date and end_date:
            return cls.TargetAndEndDateSpecified
        elif target_page_count and start_date:
            return cls.TargetSpecified
        return cls.Unbounded
