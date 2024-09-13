from sqlalchemy import Column, Float, Integer, String, TIMESTAMP, JSON
from sqlalchemy import func
from .base import BaseModel
from exceptions import EmptyExtractionException


class Extraction(BaseModel):
    __tablename__ = "generated_extractions"

    id = Column(Integer, primary_key=True, index=True)
    document_ids = Column(JSON(Integer))
    selected_pages = Column(Integer)
    target_pages = Column(Integer)
    include_categories = Column(JSON(Integer))
    location_ids = Column(JSON(Integer))
    target_pages_threshold = Column(Float)
    whole_categories_threshold = Column(Float)
    generated_by = Column(String, index=True)
    generated_at = Column(TIMESTAMP, server_default=func.now())

    def validate_before_save(self, session):
        if not self.document_ids:
            raise EmptyExtractionException()
