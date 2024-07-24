from pydantic import BaseModel
from typing import List, TypeVar, Generic, Tuple

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: List[T]
    num_found: int

    @staticmethod
    def from_tuple(data: Tuple[List[T], int]) -> "Page[T]":
        return Page(items=data[0], num_found=data[1])
