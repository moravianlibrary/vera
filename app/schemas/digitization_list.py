from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DigitizationList(BaseModel):
    id: int
    created_at: datetime
    created_by: str


class CreateDigitizationListResponse(BaseModel):
    digitization_list: Optional[DigitizationList]
    already_in_list: int
    ignored_by_state: int
    added: int


class AddDocumentsResponse(BaseModel):
    digitization_list: DigitizationList
    already_in_this_list: int
    already_in_other_list: int
    ignored_by_state: int
    added: int


class RemoveDocumentsResponse(BaseModel):
    digitization_list: DigitizationList
    not_in_any_list: int
    not_in_this_list: int
    removed: int
