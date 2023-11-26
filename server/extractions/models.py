from sqlalchemy import Column, ForeignKey, Integer, TIMESTAMP, func

from services.database import Base


class Extraction(Base):
    __tablename__ = "extractions"

    id = Column(Integer, primary_key=True, index=True)
    extractor_id = Column(Integer, ForeignKey("users.id"), index=True)
    extracted_at = Column(TIMESTAMP, server_default=func.now())
