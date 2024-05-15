from sqlalchemy import ARRAY, Column, Integer, String, TIMESTAMP
from sqlalchemy import ForeignKey
from sqlalchemy import func
from sqlalchemy.orm import relationship

from services.database import Base


class DigitizationExtraction(Base):
    __tablename__ = "digitization_extractions"

    id = Column(Integer, primary_key=True, index=True)
    document_ids = Column(ARRAY(Integer))
    extracted_pages = Column(Integer)
    intention_id = Column(
        Integer, ForeignKey("categories_quotas.id"), nullable=True
    )
    extractor = Column(String, index=True)
    extracted_at = Column(TIMESTAMP, server_default=func.now())

    documents = relationship("Document", back_populates="extraction")
