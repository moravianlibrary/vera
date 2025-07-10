from typing import List

from pydantic import BaseModel, Field


# -----------------
# - API Responses -
# -----------------
# TODO: Move all to marcdantic
class MarcField(BaseModel):
    field: str = Field(..., min_length=3, max_length=3, pattern=r"^\d{3}$")
    subfield: str | None = Field(None, pattern=r"^[a-z0-9]$")
    ind1: str | None = Field(None, pattern=r"^[\\_0-9a-z ]?$")
    ind2: str | None = Field(None, pattern=r"^[\\_0-9a-z ]?$")


class SearchSettings(BaseModel):
    available_fields: List[MarcField]
    # TODO: use MarcMapping from marcdantic
    fields_mapping: dict[str, str]
