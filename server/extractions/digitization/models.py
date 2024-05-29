from sqlalchemy import ARRAY, Column, Integer, String, TIMESTAMP
from sqlalchemy import ForeignKey
from sqlalchemy import func
from sqlalchemy.orm import relationship, Session
from typing import List

from services.database import Base


class DigitizationExtraction(Base):
    __tablename__ = "digitization_extractions"

    id = Column(Integer, primary_key=True, index=True)
    intention_id = Column(Integer, ForeignKey("intentions.id"))
    document_ids = Column(ARRAY(Integer))
    extracted_pages = Column(Integer)
    extractor = Column(String, index=True)
    extracted_at = Column(TIMESTAMP, server_default=func.now())

    documents = relationship("Document", back_populates="extraction")

    @classmethod
    def get_by_intention(
        cls, intention_id: int, session: Session
    ) -> List["DigitizationExtraction"]:
        return (
            session.query(DigitizationExtraction)
            .filter(DigitizationExtraction.intention_id == intention_id)
            .all()
        )
