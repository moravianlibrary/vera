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

    class Config:
        from_attributes = True

    def __hash__(self):
        return hash((self.code, self.value, self.different_to, self.differs))

    def __eq__(self, other: "MarcSubfieldDifference"):
        return (
            self.code == other.code
            and self.value == other.value
            and self.different_to == other.different_to
            and self.differs == other.differs
        )

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
    tag: str
    indicator1: Optional[str] = None
    indicator2: Optional[str] = None
    control_field: bool = False
    difference_type: MarcFieldDifferenceType
    subfield_differences: List[MarcSubfieldDifference] = []

    class Config:
        use_enum_values = True
        from_attributes = True

    def __hash__(self):
        return hash(
            (
                self.tag,
                self.indicator1,
                self.indicator2,
                self.control_field,
                self.difference_type,
                tuple(self.subfield_differences),
            )
        )

    def __eq__(self, other: "MarcFieldDifference"):
        return (
            self.tag == other.tag
            and self.indicator1 == other.indicator1
            and self.indicator2 == other.indicator2
            and self.control_field == other.control_field
            and self.difference_type == other.difference_type
            and self.subfield_differences == other.subfield_differences
        )

    def __lt__(self, other: "MarcFieldDifference"):
        tag_num = int(self.tag)
        other_tag_num = int(other.tag)
        return (
            tag_num < other_tag_num
            or tag_num == other_tag_num
            and self.difference_type < other.difference_type
        )

    @classmethod
    def from_marc_field(
        cls,
        difference_type: MarcFieldDifferenceType,
        field: Field,
        subfield_differences: List[MarcSubfieldDifference],
    ) -> "MarcFieldDifference":
        return cls(
            difference_type=difference_type,
            tag=field.tag,
            indicator1=(
                field.indicator1
                if (
                    not field.is_control_field()
                    and field.indicators
                    and field.indicator1 != " "
                )
                else None
            ),
            indicator2=(
                field.indicator2
                if (
                    not field.is_control_field()
                    and field.indicators
                    and field.indicator2 != " "
                )
                else None
            ),
            subfield_differences=sorted(subfield_differences),
            control_field=field.is_control_field(),
        )

    def __str__(self) -> str:
        def subfields_values_str() -> str:
            return " ".join(
                [
                    f"|{subfield.code or " "} {subfield.value.strip()}"
                    for subfield in self.subfield_differences
                    if subfield.value is not None
                ]
            )

        def subfields_different_to_str() -> str:
            return " ".join(
                [
                    f"|{subfield.code or " "} {subfield.different_to.strip()}"
                    for subfield in self.subfield_differences
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

        if self.difference_type == MarcFieldDifferenceType.ExtraField:
            return f"+ {field_str(subfields_values_str())}"
        if self.difference_type == MarcFieldDifferenceType.MissingField:
            return f"- {field_str(subfields_different_to_str())}"
        if self.difference_type == MarcFieldDifferenceType.DifferentValue:
            return (
                f"┌ {field_str(subfields_values_str())}\n"
                f"└ {field_str(subfields_different_to_str())}"
            )
        return (
            f"╔ {field_str(subfields_values_str())}\n"
            f"╚ {field_str(subfields_different_to_str())}"
        )
