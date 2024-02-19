from sqlalchemy import ARRAY, Boolean, Column, Integer, String, TIMESTAMP, func

from services.database import Base


class Extraction(Base):
    __tablename__ = "extractions"

    id = Column(Integer, primary_key=True, index=True)
    extractor = Column(String, index=True)
    extracted_at = Column(TIMESTAMP, server_default=func.now())
    marked = Column(Boolean, server_default="false")
    target_pages = Column(Integer)
    extracted_pages = Column(Integer)
    document_ids = Column(ARRAY(Integer))
