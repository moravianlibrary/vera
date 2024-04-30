from sqlalchemy import ARRAY, Column, Float, Integer, String, TIMESTAMP
from sqlalchemy import func

from services.database import Base


class GeneratedExtraction(Base):
    __tablename__ = "generated_extractions"

    id = Column(Integer, primary_key=True, index=True)
    document_ids = Column(ARRAY(Integer))
    selected_pages = Column(Integer)
    target_pages = Column(Integer)
    include_categories = Column(ARRAY(Integer))
    location_ids = Column(ARRAY(Integer))
    target_pages_threshold = Column(Float)
    whole_categories_threshold = Column(Float)
    generated_by = Column(String, index=True)
    generated_at = Column(TIMESTAMP, server_default=func.now())
