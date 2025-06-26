from typing import Any, Generic, List, TypeVar

from pydantic import BaseModel, Field, model_validator

T = TypeVar("T")


class PageParams(BaseModel):
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(50, ge=1, le=100, description="Page size")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class Page(BaseModel, Generic[T]):
    class Config:
        from_attibutes = True

    items: List[T]
    num_found: int

    @model_validator(mode="before")
    @classmethod
    def flatten_tuple(cls, data: Any) -> Any:
        if isinstance(data, tuple):
            return cls(items=data[0], num_found=data[1])
        return data
        return data
