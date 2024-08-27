import re
from typing import Optional, List, TypeVar
from pymarc import Field
from pydantic import BaseModel
from .types import MarcFieldDifferenceType


T = TypeVar("T")


class MatchedPair(BaseModel):
    item1: Optional[T] = None
    item2: Optional[T] = None
    score: float


class MarcSubfieldDifference(BaseModel):
    code: Optional[str] = None
    value: Optional[str] = None
    different_to: Optional[str] = None
    differs: bool = True

    def __lt__(self, other: "MarcSubfieldDifference"):
        if self.code is None:
            return False
        if other.code is None:
            return True
        self_is_number = re.match(r"\d", self.code)
        other_is_number = re.match(r"\d", other.code)
        if self_is_number and other_is_number:
            return int(self.code) < int(other.code)
        if self_is_number:
            return False
        if other_is_number:
            return True
        return self.code < other.code


class MarcFieldDifference(BaseModel):
    result: MarcFieldDifferenceType
    tag: str
    indicator1: Optional[str] = None
    indicator2: Optional[str] = None
    subfields_differences: List[MarcSubfieldDifference] = []
    control_field: bool = False

    class Config:
        use_enum_values = True

    def __lt__(self, other: "MarcFieldDifference"):
        tag_num = int(self.tag)
        other_tag_num = int(other.tag)
        return (
            tag_num < other_tag_num
            or tag_num == other_tag_num
            and self.result < other.result
        )

    @classmethod
    def from_marc_field(
        cls,
        result: MarcFieldDifferenceType,
        field: Field,
        subfield_differences: List[MarcSubfieldDifference],
    ) -> "MarcFieldDifference":
        return cls(
            result=result,
            tag=field.tag,
            indicator1=(
                field.indicator1
                if not field.is_control_field() and field.indicators
                else None
            ),
            indicator2=(
                field.indicator2
                if not field.is_control_field() and field.indicators
                else None
            ),
            subfields_differences=subfield_differences,
            control_field=field.is_control_field(),
            data=field.data if field.is_control_field() else None,
        )

    def __str__(self) -> str:
        def subfields_values_str() -> str:
            return " ".join(
                [
                    f"|{subfield.code or " "} {subfield.value.strip()}"
                    for subfield in sorted(self.subfields_differences)
                    if subfield.value is not None
                ]
            )

        def subfields_different_to_str() -> str:
            return " ".join(
                [
                    f"|{subfield.code or " "} {subfield.different_to.strip()}"
                    for subfield in sorted(self.subfields_differences)
                    if subfield.different_to is not None
                ]
            )

        def field_str(subfields_repr: str) -> str:
            indicators = (
                "CTL"
                if self.control_field
                else f"{self.indicator1} {self.indicator2}"
            )
            return f"{self.tag} {indicators} {subfields_repr}"

        if self.result == MarcFieldDifferenceType.ExtraField:
            return f"+ {field_str(subfields_values_str())}"
        if self.result == MarcFieldDifferenceType.MissingField:
            return f"- {field_str(subfields_different_to_str())}"
        if self.result == MarcFieldDifferenceType.DifferentValue:
            return (
                f"┌ {field_str(subfields_values_str())}\n"
                f"└ {field_str(subfields_different_to_str())}"
            )
        return (
            f"╔ {field_str(subfields_values_str())}\n"
            f"╚ {field_str(subfields_different_to_str())}"
        )
