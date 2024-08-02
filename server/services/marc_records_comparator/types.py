from enum import Enum


class MarcFieldDifferenceResult(Enum):
    Equal = "Equal"
    DifferentValue = "DifferentValue"
    ExtraField = "ExtraField"
    MissingField = "MissingField"

    def __lt__(self, other: "MarcFieldDifferenceResult"):
        return self.value < other.value
