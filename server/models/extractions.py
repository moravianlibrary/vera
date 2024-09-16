from sqlalchemy import Column, Float, Integer, String, TIMESTAMP, JSON
from sqlalchemy import func
from .base import BaseModel
from exceptions import EmptyExtractionException
from typing import List


class Extraction(BaseModel):
    __tablename__ = "generated_extractions"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    _document_ids = Column("document_ids", JSON)
    selected_pages = Column(Integer)
    target_pages = Column(Integer)
    _include_categories = Column("include_categories", JSON)
    _location_ids = Column("location_ids", JSON)
    target_pages_threshold = Column(Float)
    whole_categories_threshold = Column(Float)
    generated_by = Column(String, index=True)
    generated_at = Column(TIMESTAMP, server_default=func.now())

    @property
    def document_ids(self) -> List[int]:
        return (
            [int(item) for item in self._document_ids]
            if self._document_ids
            else []
        )

    @document_ids.setter
    def document_ids(self, values: List[int]):
        self._document_ids = values

    @property
    def include_categories(self) -> List[int]:
        return (
            [int(item) for item in self._include_categories]
            if self._include_categories
            else []
        )

    @include_categories.setter
    def include_categories(self, values: List[int]):
        self._include_categories = values

    @property
    def location_ids(self) -> List[int]:
        return (
            [int(item) for item in self._location_ids]
            if self._location_ids
            else []
        )

    @location_ids.setter
    def location_ids(self, values: List[int]):
        self._location_ids = values

    def validate_before_save(self, session):
        if not self.document_ids:
            raise EmptyExtractionException()
