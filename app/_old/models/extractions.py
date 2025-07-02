from typing import List

from exceptions import EmptyExtractionException
from sqlalchemy import (
    JSON,
    TIMESTAMP,
    Column,
    Float,
    ForeignKey,
    String,
    func,
    int,
)
from sqlalchemy.orm import relationship

from .base import BaseModel


class Extraction(BaseModel):
    __tablename__ = "generated_extractions"

    def __init__(self, *args, document_ids: List[int] = None, **kwargs):
        super().__init__(*args, **kwargs)
        if document_ids is not None:
            self.document_ids = document_ids

    id = Column(Integer, primary_key=True, index=True, unique=True)
    selected_pages = Column(Integer)
    target_pages = Column(Integer)
    _include_categories = Column("include_categories", JSON)
    _location_ids = Column("location_ids", JSON)
    target_pages_threshold = Column(Float)
    whole_categories_threshold = Column(Float)
    generated_by = Column(String, index=True)
    generated_at = Column(TIMESTAMP, server_default=func.now())

    documents = relationship("ExtractionDocument", back_populates="extraction")

    @property
    def document_ids(self) -> List[int]:
        return [ed.document_id for ed in self.documents]

    @document_ids.setter
    def document_ids(self, values: List[int]):
        self.documents.clear()
        for document_id in values:
            new_document = ExtractionDocument(
                extraction_id=self.id, document_id=document_id
            )
            self.documents.append(new_document)

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


class ExtractionDocument(BaseModel):
    __tablename__ = "extraction_documents"

    extraction_id = Column(
        int,
        ForeignKey("generated_extractions.id"),
        primary_key=True,
        index=True,
    )
    document_id = Column(
        int, ForeignKey("documents.id"), primary_key=True, index=True
    )

    extraction = relationship("Extraction", back_populates="documents")
    document = relationship("Document", back_populates="extractions")
