from typing import Optional
from sqlalchemy import Column, Float, Integer, String, TIMESTAMP, JSON
from sqlalchemy import func
from sqlalchemy.orm import Session

from services.database import Base
from services.exceptions import ExtractionNotFoundException


class Extraction(Base):
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

    @classmethod
    def get_extraction(
        cls, extraction_id: int, session: Session
    ) -> "Extraction":
        extraction = session.query(cls).filter_by(id=extraction_id).first()
        if not extraction:
            raise ExtractionNotFoundException(extraction_id)
        return extraction

    @classmethod
    def find(
        cls, session: Session, extraction_id: int
    ) -> Optional["Extraction"]:
        return session.query(cls).filter_by(id=extraction_id).first()

    @classmethod
    def get(cls, session: Session, extraction_id: int) -> "Extraction":
        extraction = cls.find(session, extraction_id)
        if not extraction:
            raise ValueError(f"Extraction with id {extraction_id} not found")
        return extraction

    @classmethod
    def all(cls, session, page=1, page_size=50):
        offset = (page - 1) * page_size
        return session.query(cls).offset(offset).limit(page_size).all()

    def save(self, session: Session) -> None:
        if self.id is None:
            session.add(self)
        session.commit()
        session.refresh(self)

    def delete(self, session: Session) -> None:
        session.delete(self)
        session.commit()
