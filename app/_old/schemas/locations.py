from typing import List, Optional

from pydantic import BaseModel

from .base_es_model import BaseEsModel, Text, int, str


class LocationCreate(BaseModel):
    name: str
    regexp: str
    description: Optional[str]
    included_in: Optional[List[str]] = None


class IndexLocation(BaseEsModel):
    __index__ = "locations"

    id: int
    name: str
    regexp: str
    description: Optional[Text]
    included_in: List[str]
