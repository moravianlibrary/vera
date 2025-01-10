from pydantic import BaseModel
from typing import Optional, List
from .base_es_model import BaseEsModel, Integer, Keyword, Text


class LocationCreate(BaseModel):
    name: str
    regexp: str
    description: Optional[str]
    included_in: Optional[List[str]] = None


class IndexLocation(BaseEsModel):
    __index_name__ = "locations"

    id: Integer
    name: Keyword
    regexp: Keyword
    description: Optional[Text]
    included_in: List[Keyword]
