from typing import Any, Dict, TypeVar

from pydantic import BaseModel

Json = Dict[str, Any]


Entity = TypeVar("Entity", bound=BaseModel)

EsQuery = Json
EsResponse = Json
