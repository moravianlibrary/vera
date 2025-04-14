from sqlalchemy import JSON, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from adapters.database import BaseModel


class DocumentModel(BaseModel):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)

    catalog_record_id = Column(
        String, ForeignKey("catalog_records.id"), nullable=False
    )

    barcode = Column(String, nullable=True)
    volume_number = Column(String, nullable=True)
    volume_year = Column(String, nullable=True)
    bundle = Column(String, nullable=True)
    issuance_type = Column(Enum(), nullable=False)

    page_count_sources = Column(JSON, default={}, nullable=False)
    page_count = Column(Integer)

    catalog_record = relationship("CatalogRecordModel", backref="document")
