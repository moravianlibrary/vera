from pydantic import BaseModel, model_validator
from typing import List, TypeVar, Generic, Any

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: List[T]
    num_found: int

    @model_validator(mode="before")
    @classmethod
    def flatten_tuple(cls, data: Any) -> Any:
        if isinstance(data, tuple):
            return cls(items=data[0], num_found=data[1])
        return data
