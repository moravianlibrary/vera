from pydantic import BaseModel
from enum import Enum
from pymarc import Field
from typing import List, Optional


class Marc21DiffType(Enum):
    MissingField = "MissingField"
    ExtraField = "ExtraField"
    DifferentValue = "DifferentValue"
    Equal = "Equal"


class Marc21Subfield(BaseModel):
    code: str
    value: str


class Marc21Field(BaseModel):
    tag: str
    control_field: bool = False
    indicator1: Optional[str] = None
    indicator2: Optional[str] = None
    subfields: List[Marc21Subfield] = []
    data: Optional[str] = None


class Marc21Diff(BaseModel):
    type: Marc21DiffType
    field: Marc21Field
    value: Optional[str]

    @classmethod
    def from_marc21_field(
        cls,
        type: Marc21DiffType,
        field: Field,
        value: Optional[str] = None,
    ) -> "Marc21Diff":
        if field.is_control_field():
            return cls(
                type=type,
                field=Marc21Field(
                    tag=field.tag,
                    control_field=True,
                    data=field.data,
                ),
                value=value,
            )
        return cls(
            type=type,
            field=Marc21Field(
                tag=field.tag,
                indicator1=field.indicator1,
                indicator2=field.indicator2,
                subfields=[
                    Marc21Subfield(code=subfield.code, value=subfield.value)
                    for subfield in field.subfields
                ],
            ),
            value=value,
        )

    def format_subfields(self) -> str:
        return " ".join(
            [
                f"|{subfield.code} {subfield.value.strip()}"
                for subfield in self.field.subfields
            ]
        )

    def format_field(self) -> str:
        if self.field.control_field:
            return f"{self.field.tag} CTL |  {self.field.data.strip()}"
        return (
            f"{self.field.tag} "
            f"{self.field.indicator1} "
            f"{self.field.indicator2} "
            f"{self.format_subfields()}"
        )

    def __str__(self) -> str:
        if self.type == Marc21DiffType.MissingField:
            return f"- {self.format_field()}"
        if self.type == Marc21DiffType.ExtraField:
            return f"+ {self.format_field()}"
        if self.type == Marc21DiffType.DifferentValue:
            return f"~ {self.format_field()} !! {self.value}"
        if self.type == Marc21DiffType.Equal:
            return f"= {self.format_field()}"


class Marc21DiffRecord(BaseModel):
    diffs: List[Marc21Diff] = []

    sysno1: Optional[str] = None
    sysno2: Optional[str] = None

    def __str__(self) -> str:
        return f"{self.sysno1} x {self.sysno2}:\n" + "\n".join(
            str(diff) for diff in self.diffs
        )
