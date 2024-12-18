from pydantic import BaseModel
from typing import Optional, List
from models import Location
from .base_es_model import BaseEsModel, Integer, Keyword, Text


class LocationCreate(BaseModel):
    name: str
    regexp: str
    description: Optional[str]
    included_in: Optional[List[str]] = None

    def load_to_model(self, model: Location) -> Location:
        model.name = self.name
        model.regexp = self.regexp
        model.description = self.description
        model.additional_info = self.additional_info
        model.state = self.state
        model.storage_id = self.storage_id
        return model


class IndexLocation(BaseEsModel):
    __index_name__ = "locations"

    id: Integer
    name: Keyword
    regexp: Keyword
    description: Optional[Text]
    included_in: List[Keyword]
