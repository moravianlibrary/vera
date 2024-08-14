from enum import Enum


class MarcFieldDifferenceType(Enum):
    Equal = "Equal"
    DifferentValue = "DifferentValue"
    ExtraField = "ExtraField"
    MissingField = "MissingField"

    def __lt__(self, other: "MarcFieldDifferenceType"):
        return self.value < other.value
